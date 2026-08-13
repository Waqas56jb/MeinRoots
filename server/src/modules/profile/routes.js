import { Router } from 'express'
import config from '../../config.js'
import { many, one, query } from '../../db/pool.js'
import { asyncHandler, badRequest, notFound } from '../../lib/errors.js'
import { ok } from '../../lib/http.js'
import { audit } from '../../lib/audit.js'
import { validateBody, z } from '../../lib/validate.js'
import { requireAuth } from '../../middleware/auth.js'
import { assessReadiness } from '../../ai/steps.js'
import {
  getFullProfile,
  getProfileByUser,
  recomputeCompleteness,
  refreshReviewFlags,
  saveReadiness,
} from './repository.js'
import { presentFullProfile } from './present.js'

const router = Router()
router.use(requireAuth)

const mine = async (userId) => {
  const profile = await getProfileByUser(userId)
  if (!profile) throw notFound('profile_not_found', 'No profile yet — upload a CV first')
  return profile
}

router.get(
  '/me',
  asyncHandler(async (req, res) => {
    const profile = await getProfileByUser(req.user.id)
    if (!profile) return ok(res, { profile: null })
    const full = await getFullProfile(profile.id)
    ok(res, { profile: presentFullProfile(full, req.user.locale) })
  }),
)

/**
 * Candidate corrections to the extracted profile.
 *
 * Restricted to the handful of fields a person can sensibly correct about
 * themselves. Editing experience or skills is a Milestone 2 screen; letting it
 * happen here without versioning would quietly destroy what the AI extracted
 * and make the confidence scores meaningless.
 */
const patchSchema = z
  .object({
    headline: z.string().trim().max(160).nullish(),
    summary: z.string().trim().max(2000).nullish(),
    country: z.string().trim().max(80).nullish(),
    city: z.string().trim().max(80).nullish(),
    willingToRelocate: z.boolean().nullish(),
    noticePeriodWeeks: z.number().int().min(0).max(104).nullish(),
  })
  .refine((v) => Object.keys(v).length > 0, { message: 'nothing_to_update' })

router.patch(
  '/me',
  validateBody(patchSchema),
  asyncHandler(async (req, res) => {
    const profile = await mine(req.user.id)
    const map = {
      headline: 'headline',
      summary: 'summary',
      country: 'country',
      city: 'city',
      willingToRelocate: 'willing_to_relocate',
      noticePeriodWeeks: 'notice_period_weeks',
    }

    const sets = []
    const params = [profile.id]
    for (const [key, column] of Object.entries(map)) {
      if (req.body[key] !== undefined) {
        params.push(req.body[key])
        sets.push(`${column} = $${params.length}`)
      }
    }
    if (!sets.length) throw badRequest('nothing_to_update', 'No supported fields in the request')

    await query(`UPDATE candidate_profiles SET ${sets.join(', ')} WHERE id = $1`, params)
    await recomputeCompleteness(profile.id)
    await audit(req, {
      action: 'profile.update',
      entityType: 'profile',
      entityId: profile.id,
      metadata: { fields: Object.keys(req.body) },
    })

    const full = await getFullProfile(profile.id)
    ok(res, { profile: presentFullProfile(full, req.user.locale) })
  }),
)

router.get(
  '/me/readiness',
  asyncHandler(async (req, res) => {
    const profile = await getProfileByUser(req.user.id)
    if (!profile) return ok(res, { assessments: [] })
    const full = await getFullProfile(profile.id)
    ok(res, { assessments: presentFullProfile(full, req.user.locale).assessments })
  }),
)

/**
 * Recomputes readiness for the current goals, taking the questionnaire answers
 * into account. Runs inline rather than through the queue because the candidate
 * is looking at the screen and the input is already in the database.
 */
router.post(
  '/me/readiness/refresh',
  asyncHandler(async (req, res) => {
    const profile = await mine(req.user.id)
    const document = await one(
      'SELECT extracted_text FROM cv_documents WHERE id = $1 AND deleted_at IS NULL',
      [profile.document_id],
    )
    if (!document?.extracted_text) {
      throw badRequest('no_cv', 'Upload a CV before recalculating readiness')
    }

    const full = await getFullProfile(profile.id)
    const answers = await many(
      `SELECT qq.question, qa.value
         FROM questionnaires q
         JOIN questionnaire_questions qq ON qq.questionnaire_id = q.id
         JOIN questionnaire_answers qa ON qa.question_id = qq.id
        WHERE q.profile_id = $1
        ORDER BY qq.sort_order`,
      [profile.id],
    )

    const classification = full.profile.domain
      ? {
          domain: full.profile.domain,
          specialisation: full.profile.specialisation,
          seniority: full.profile.seniority,
        }
      : null

    // Rebuilt from the stored rows rather than the original model output: the
    // candidate may have corrected fields since, and the assessment should
    // reflect what the profile says now.
    const extraction = {
      headline: full.profile.headline,
      country: full.profile.country,
      totalExperienceMonths: full.profile.total_experience_months,
      experiences: full.experiences,
      education: full.education,
      certifications: full.certifications,
      skills: full.skills.map((s) => ({ name: s.name, isEvidenced: s.is_evidenced, years: s.years })),
      languages: full.languages,
    }

    const goals = req.user.goals?.length ? req.user.goals : ['germany']
    for (const goal of goals) {
      const readiness = await assessReadiness({
        extraction,
        classification,
        goal,
        answers,
        userId: req.user.id,
      })
      await saveReadiness({ profileId: profile.id, goal, readiness, model: config.openai.model })
    }

    await refreshReviewFlags(profile.id)
    await recomputeCompleteness(profile.id)
    await audit(req, { action: 'profile.readiness_refresh', entityType: 'profile', entityId: profile.id })

    const refreshed = await getFullProfile(profile.id)
    ok(res, { assessments: presentFullProfile(refreshed, req.user.locale).assessments })
  }),
)

export default router
