import { Router } from 'express'
import { many, one, transaction } from '../../db/pool.js'
import { asyncHandler, badRequest, notFound } from '../../lib/errors.js'
import { ok } from '../../lib/http.js'
import { audit } from '../../lib/audit.js'
import { validateBody, z } from '../../lib/validate.js'
import { requireAuth } from '../../middleware/auth.js'
import { getProfileByUser, recomputeCompleteness } from '../profile/repository.js'
import { presentQuestion } from '../profile/present.js'

const router = Router()
router.use(requireAuth)

const loadCurrent = async (userId) => {
  const profile = await getProfileByUser(userId)
  if (!profile) return null

  const questionnaire = await one(
    `SELECT * FROM questionnaires WHERE profile_id = $1 ORDER BY created_at DESC LIMIT 1`,
    [profile.id],
  )
  if (!questionnaire) return { profile, questionnaire: null, questions: [] }

  const questions = await many(
    `SELECT qq.*, qa.value AS answer, qa.answered_at
       FROM questionnaire_questions qq
       LEFT JOIN questionnaire_answers qa ON qa.question_id = qq.id
      WHERE qq.questionnaire_id = $1
      ORDER BY qq.sort_order`,
    [questionnaire.id],
  )
  return { profile, questionnaire, questions }
}

router.get(
  '/current',
  asyncHandler(async (req, res) => {
    const current = await loadCurrent(req.user.id)
    if (!current?.questionnaire) return ok(res, { questionnaire: null, questions: [] })

    const questions = current.questions.map(presentQuestion)
    ok(res, {
      questionnaire: {
        id: current.questionnaire.id,
        status: current.questionnaire.status,
        createdAt: current.questionnaire.created_at,
        completedAt: current.questionnaire.completed_at,
        total: questions.length,
        answered: questions.filter((q) => q.answer !== null).length,
        // Required-and-unanswered is what actually blocks completion, so the UI
        // gets it computed rather than re-deriving it.
        outstandingRequired: questions.filter((q) => q.isRequired && q.answer === null).length,
      },
      questions,
    })
  }),
)

const answersSchema = z.object({
  answers: z
    .array(
      z.object({
        questionId: z.string().uuid(),
        // Shapes differ per input type (string, number, boolean, string[]),
        // so the column is jsonb and the type check happens below against the
        // question the answer belongs to.
        value: z.union([z.string(), z.number(), z.boolean(), z.array(z.string())]),
      }),
    )
    .min(1)
    .max(20),
})

const valueFitsType = (inputType, value) => {
  switch (inputType) {
    case 'boolean':
      return typeof value === 'boolean'
    case 'number':
      return typeof value === 'number' && Number.isFinite(value)
    case 'multi_select':
      return Array.isArray(value) && value.every((v) => typeof v === 'string')
    default:
      return typeof value === 'string' && value.trim().length > 0
  }
}

router.post(
  '/answers',
  validateBody(answersSchema),
  asyncHandler(async (req, res) => {
    const current = await loadCurrent(req.user.id)
    if (!current?.questionnaire) throw notFound('questionnaire_not_found', 'No questionnaire to answer')

    const byId = new Map(current.questions.map((q) => [q.id, q]))
    for (const answer of req.body.answers) {
      const question = byId.get(answer.questionId)
      // Answers are addressed by id, so this also prevents writing an answer to
      // another candidate's questionnaire.
      if (!question) throw badRequest('unknown_question', `Question ${answer.questionId} is not on your questionnaire`)
      if (!valueFitsType(question.input_type, answer.value)) {
        throw badRequest('invalid_answer', `Answer for "${question.key}" does not match ${question.input_type}`)
      }
      if (question.input_type === 'single_select' || question.input_type === 'multi_select') {
        const allowed = new Set((question.options ?? []).map((o) => o.value))
        const values = Array.isArray(answer.value) ? answer.value : [answer.value]
        if (allowed.size && values.some((v) => !allowed.has(v))) {
          throw badRequest('invalid_option', `Answer for "${question.key}" is not one of the offered options`)
        }
      }
    }

    await transaction(async (client) => {
      for (const answer of req.body.answers) {
        await client.query(
          `INSERT INTO questionnaire_answers (question_id, value)
           VALUES ($1, $2::jsonb)
           ON CONFLICT (question_id) DO UPDATE SET value = EXCLUDED.value, answered_at = now()`,
          [answer.questionId, JSON.stringify(answer.value)],
        )
      }
      await client.query(
        `UPDATE questionnaires SET status = 'in_progress' WHERE id = $1 AND status = 'pending'`,
        [current.questionnaire.id],
      )
    })

    await recomputeCompleteness(current.profile.id)
    await audit(req, {
      action: 'questionnaire.answer',
      entityType: 'questionnaire',
      entityId: current.questionnaire.id,
      metadata: { count: req.body.answers.length },
    })

    const refreshed = await loadCurrent(req.user.id)
    ok(res, { questions: refreshed.questions.map(presentQuestion) })
  }),
)

router.post(
  '/complete',
  asyncHandler(async (req, res) => {
    const current = await loadCurrent(req.user.id)
    if (!current?.questionnaire) throw notFound('questionnaire_not_found', 'No questionnaire to complete')

    const outstanding = current.questions.filter((q) => q.is_required && q.answer === null)
    if (outstanding.length) {
      throw badRequest('questions_outstanding', 'Some required questions are unanswered', {
        keys: outstanding.map((q) => q.key),
      })
    }

    await one(
      `UPDATE questionnaires SET status = 'completed', completed_at = now() WHERE id = $1 RETURNING id`,
      [current.questionnaire.id],
    )
    await recomputeCompleteness(current.profile.id)
    await audit(req, {
      action: 'questionnaire.complete',
      entityType: 'questionnaire',
      entityId: current.questionnaire.id,
    })

    ok(res, { completed: true })
  }),
)

export default router
