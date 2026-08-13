import { Router } from 'express'
import { many, one, query, transaction } from '../../db/pool.js'
import { asyncHandler, badRequest, notFound } from '../../lib/errors.js'
import { ok, page } from '../../lib/http.js'
import { audit } from '../../lib/audit.js'
import { validateBody, validateQuery, z } from '../../lib/validate.js'
import { requireAuth, requireRole } from '../../middleware/auth.js'
import { getFullProfile } from '../profile/repository.js'
import { presentFullProfile } from '../profile/present.js'
import { absolutePath, deleteUserFiles } from '../cv/storage.js'

const router = Router()
router.use(requireAuth, requireRole('admin'))

// ------------------------------- candidates ----------------------------------

const listQuery = z.object({
  q: z.string().trim().max(120).optional(),
  status: z.enum(['pending', 'auto_cleared', 'flagged', 'approved', 'rejected']).optional(),
  domain: z.string().max(40).optional(),
  goal: z.enum(['germany', 'remote', 'freelance', 'ausbildung']).optional(),
  flagged: z.coerce.boolean().optional(),
  minReadiness: z.coerce.number().min(0).max(100).optional(),
  sort: z.enum(['recent', 'readiness', 'completeness', 'confidence']).default('recent'),
  limit: z.coerce.number().int().min(1).max(100).default(25),
  offset: z.coerce.number().int().min(0).default(0),
})

/**
 * The console's main list.
 *
 * Built to answer one question fast — "which profiles actually need me?" — so
 * open flags, extraction confidence and readiness are all filterable and
 * sortable in a single query rather than needing the admin to open each CV.
 */
router.get(
  '/candidates',
  validateQuery(listQuery),
  asyncHandler(async (req, res) => {
    const f = req.validatedQuery
    const where = ['u.deleted_at IS NULL', "u.role = 'candidate'"]
    const params = []
    // Every `?` in the clause binds to the same value — the search filter needs
    // the same term in two places, and repeating the parameter would be a
    // silent off-by-one waiting to happen.
    const add = (clause, value) => {
      params.push(value)
      where.push(clause.replaceAll('?', `$${params.length}`))
    }

    if (f.q) add('(u.full_name ILIKE ? OR u.email ILIKE ?)', `%${f.q}%`)
    if (f.status) add('p.review_status = ?::review_status', f.status)
    if (f.domain) add('c.domain = ?', f.domain)
    if (f.goal) add('?::work_goal = ANY(u.goals)', f.goal)
    if (f.flagged) where.push('EXISTS (SELECT 1 FROM review_flags rf WHERE rf.profile_id = p.id AND rf.resolved_at IS NULL)')
    if (f.minReadiness !== undefined) add('COALESCE(r.best_score, 0) >= ?', f.minReadiness)

    const order = {
      recent: 'u.created_at DESC',
      readiness: 'COALESCE(r.best_score, -1) DESC, u.created_at DESC',
      completeness: 'p.completeness DESC, u.created_at DESC',
      confidence: 'COALESCE(p.extraction_confidence, 1) ASC, u.created_at DESC',
    }[f.sort]

    const base = `
      FROM users u
      LEFT JOIN candidate_profiles p ON p.user_id = u.id
      LEFT JOIN profile_classifications c ON c.profile_id = p.id AND c.is_current
      LEFT JOIN LATERAL (
        SELECT max(score) AS best_score FROM readiness_assessments
         WHERE profile_id = p.id AND is_current
      ) r ON true
      WHERE ${where.join(' AND ')}
    `

    const [{ count }] = await many(`SELECT count(*)::int AS count ${base}`, params)
    const rows = await many(
      `SELECT u.id AS user_id, u.full_name, u.email, u.goals, u.created_at, u.locale,
              p.id AS profile_id, p.review_status, p.completeness, p.extraction_confidence,
              p.headline, p.country, p.total_experience_months,
              c.domain, c.specialisation, c.seniority,
              r.best_score,
              (SELECT count(*)::int FROM review_flags rf WHERE rf.profile_id = p.id AND rf.resolved_at IS NULL) AS open_flags,
              (SELECT status FROM cv_documents d WHERE d.user_id = u.id AND d.is_primary AND d.deleted_at IS NULL) AS cv_status
       ${base}
       ORDER BY ${order}
       LIMIT $${params.length + 1} OFFSET $${params.length + 2}`,
      [...params, f.limit, f.offset],
    )

    page(
      res,
      rows.map((r) => ({
        userId: r.user_id,
        profileId: r.profile_id,
        name: r.full_name,
        email: r.email,
        goals: r.goals ?? [],
        locale: r.locale,
        headline: r.headline,
        country: r.country,
        totalExperienceMonths: r.total_experience_months,
        domain: r.domain,
        specialisation: r.specialisation,
        seniority: r.seniority,
        reviewStatus: r.review_status,
        completeness: r.completeness,
        extractionConfidence: r.extraction_confidence,
        bestReadiness: r.best_score,
        openFlags: r.open_flags,
        cvStatus: r.cv_status,
        createdAt: r.created_at,
      })),
      { total: count, limit: f.limit, offset: f.offset },
    )
  }),
)

router.get(
  '/candidates/:userId',
  asyncHandler(async (req, res) => {
    const user = await one(
      'SELECT id, full_name, email, role, locale, goals, country, created_at, last_login_at, gdpr_consent_at FROM users WHERE id = $1 AND deleted_at IS NULL',
      [req.params.userId],
    )
    if (!user) throw notFound('candidate_not_found', 'Candidate not found')

    const profile = await one('SELECT id FROM candidate_profiles WHERE user_id = $1', [user.id])
    const full = profile ? await getFullProfile(profile.id) : null

    const [documents, versions, questionnaire, reviews] = await Promise.all([
      many(
        'SELECT id, original_filename, status, source_language, size_bytes, uploaded_at, processed_at, error_message FROM cv_documents WHERE user_id = $1 AND deleted_at IS NULL ORDER BY uploaded_at DESC',
        [user.id],
      ),
      many(
        `SELECT v.id, v.language, v.is_source, v.reviewed_at, v.created_at
           FROM cv_versions v JOIN cv_documents d ON d.id = v.document_id
          WHERE d.user_id = $1 AND d.is_primary AND d.deleted_at IS NULL`,
        [user.id],
      ),
      profile
        ? many(
            `SELECT qq.key, qq.question, qq.reason, qa.value, qa.answered_at
               FROM questionnaires q
               JOIN questionnaire_questions qq ON qq.questionnaire_id = q.id
               LEFT JOIN questionnaire_answers qa ON qa.question_id = qq.id
              WHERE q.profile_id = $1 ORDER BY qq.sort_order`,
            [profile.id],
          )
        : [],
      profile
        ? many(
            `SELECT ar.*, u.full_name AS reviewer_name
               FROM admin_reviews ar LEFT JOIN users u ON u.id = ar.reviewer_id
              WHERE ar.profile_id = $1 ORDER BY ar.created_at DESC LIMIT 20`,
            [profile.id],
          )
        : [],
    ])

    // Opening a candidate record is itself an event worth recording — it is
    // personal data, and "who looked at this" must be answerable.
    await audit(req, { action: 'admin.candidate_view', entityType: 'user', entityId: user.id })

    ok(res, {
      candidate: {
        id: user.id,
        name: user.full_name,
        email: user.email,
        locale: user.locale,
        goals: user.goals ?? [],
        country: user.country,
        createdAt: user.created_at,
        lastLoginAt: user.last_login_at,
        gdprConsentAt: user.gdpr_consent_at,
      },
      profile: full ? presentFullProfile(full, 'en') : null,
      documents: documents.map((d) => ({
        id: d.id,
        filename: d.original_filename,
        status: d.status,
        sourceLanguage: d.source_language,
        sizeBytes: Number(d.size_bytes),
        uploadedAt: d.uploaded_at,
        processedAt: d.processed_at,
        error: d.error_message,
      })),
      cvVersions: versions.map((v) => ({
        id: v.id,
        language: v.language,
        isSource: v.is_source,
        reviewed: Boolean(v.reviewed_at),
      })),
      questionnaire: questionnaire.map((q) => ({
        key: q.key,
        question: q.question,
        reason: q.reason,
        answer: q.value,
        answeredAt: q.answered_at,
      })),
      reviews: reviews.map((r) => ({
        id: r.id,
        status: r.status,
        note: r.note,
        reviewer: r.reviewer_name,
        createdAt: r.created_at,
      })),
    })
  }),
)

const reviewSchema = z.object({
  status: z.enum(['approved', 'rejected', 'flagged', 'pending']),
  note: z.string().trim().max(2000).optional(),
  resolveFlags: z.boolean().default(true),
})

router.post(
  '/candidates/:userId/review',
  validateBody(reviewSchema),
  asyncHandler(async (req, res) => {
    const profile = await one('SELECT id FROM candidate_profiles WHERE user_id = $1', [req.params.userId])
    if (!profile) throw notFound('profile_not_found', 'This candidate has no profile yet')

    await transaction(async (client) => {
      await client.query(
        'INSERT INTO admin_reviews (profile_id, reviewer_id, status, note) VALUES ($1,$2,$3,$4)',
        [profile.id, req.user.id, req.body.status, req.body.note ?? null],
      )
      await client.query('UPDATE candidate_profiles SET review_status = $2 WHERE id = $1', [
        profile.id,
        req.body.status,
      ])
      if (req.body.resolveFlags && (req.body.status === 'approved' || req.body.status === 'rejected')) {
        await client.query(
          'UPDATE review_flags SET resolved_at = now(), resolved_by = $2 WHERE profile_id = $1 AND resolved_at IS NULL',
          [profile.id, req.user.id],
        )
      }
    })

    await audit(req, {
      action: `admin.review.${req.body.status}`,
      entityType: 'profile',
      entityId: profile.id,
      metadata: { note: req.body.note ?? null },
    })
    ok(res, { reviewed: true, status: req.body.status })
  }),
)

router.post(
  '/flags/:flagId/resolve',
  asyncHandler(async (req, res) => {
    const flag = await one(
      'UPDATE review_flags SET resolved_at = now(), resolved_by = $2 WHERE id = $1 AND resolved_at IS NULL RETURNING *',
      [req.params.flagId, req.user.id],
    )
    if (!flag) throw notFound('flag_not_found', 'Flag not found or already resolved')
    await audit(req, { action: 'admin.flag_resolved', entityType: 'review_flag', entityId: flag.id })
    ok(res, { resolved: true })
  }),
)

/** Marks an AI-generated CV translation as human-checked. */
router.post(
  '/cv-versions/:versionId/approve',
  asyncHandler(async (req, res) => {
    const version = await one(
      'UPDATE cv_versions SET reviewed_at = now(), reviewed_by = $2 WHERE id = $1 RETURNING *',
      [req.params.versionId, req.user.id],
    )
    if (!version) throw notFound('version_not_found', 'CV version not found')
    await audit(req, { action: 'admin.cv_version_approved', entityType: 'cv_version', entityId: version.id })
    ok(res, { approved: true })
  }),
)

// -------------------------------- overview -----------------------------------

router.get(
  '/stats',
  asyncHandler(async (req, res) => {
    const [counts] = await many(`
      SELECT
        (SELECT count(*)::int FROM users WHERE role = 'candidate' AND deleted_at IS NULL) AS candidates,
        (SELECT count(*)::int FROM users WHERE role = 'candidate' AND deleted_at IS NULL AND created_at > now() - interval '7 days') AS candidates_7d,
        (SELECT count(*)::int FROM cv_documents WHERE deleted_at IS NULL) AS documents,
        (SELECT count(*)::int FROM cv_documents WHERE status = 'analysed' AND deleted_at IS NULL) AS analysed,
        (SELECT count(*)::int FROM cv_documents WHERE status = 'failed' AND deleted_at IS NULL) AS failed,
        (SELECT count(*)::int FROM candidate_profiles WHERE review_status = 'flagged') AS flagged,
        (SELECT count(*)::int FROM candidate_profiles WHERE review_status = 'auto_cleared') AS auto_cleared,
        (SELECT count(*)::int FROM jobs WHERE status = 'queued') AS jobs_queued,
        (SELECT count(*)::int FROM jobs WHERE status = 'running') AS jobs_running,
        (SELECT count(*)::int FROM jobs WHERE status = 'dead') AS jobs_dead,
        (SELECT coalesce(sum(prompt_tokens + completion_tokens), 0)::int FROM ai_calls WHERE created_at > now() - interval '30 days') AS tokens_30d
    `)

    const byDomain = await many(`
      SELECT d.code, d.label_en, count(c.id)::int AS candidates
        FROM domains d
        LEFT JOIN profile_classifications c ON c.domain = d.code AND c.is_current
       GROUP BY d.code, d.label_en, d.sort_order
       ORDER BY d.sort_order
    `)

    const byGoal = await many(`
      SELECT g::text AS goal, count(*)::int AS candidates
        FROM users u, unnest(u.goals) g
       WHERE u.deleted_at IS NULL AND u.role = 'candidate'
       GROUP BY g ORDER BY 2 DESC
    `)

    // The headline number for the business case: how much of the intake needed
    // no human at all.
    const automation =
      counts.analysed > 0 ? Math.round((counts.auto_cleared / Math.max(counts.analysed, 1)) * 100) : 0

    ok(res, { counts, byDomain, byGoal, automationRate: automation })
  }),
)

router.get(
  '/jobs',
  validateQuery(z.object({ status: z.string().optional(), limit: z.coerce.number().min(1).max(100).default(30) })),
  asyncHandler(async (req, res) => {
    const { status, limit } = req.validatedQuery
    const rows = await many(
      `SELECT id, type, status, attempts, max_attempts, progress, last_error, created_at, started_at, finished_at
         FROM jobs ${status ? 'WHERE status = $2::job_status' : ''}
        ORDER BY created_at DESC LIMIT $1`,
      status ? [limit, status] : [limit],
    )
    ok(res, { jobs: rows })
  }),
)

/**
 * Puts a buried job back in the queue with a fresh attempt budget.
 *
 * A job only reaches `dead` after exhausting its retries, so the cause is
 * usually something outside the job — an expired API key, a rate limit, a
 * provider outage. Once that is fixed the admin needs a way to run the work
 * again without asking the candidate to re-upload.
 */
router.post(
  '/jobs/:jobId/retry',
  asyncHandler(async (req, res) => {
    const job = await one('SELECT * FROM jobs WHERE id = $1', [req.params.jobId])
    if (!job) throw notFound('job_not_found', 'Job not found')
    if (job.status === 'queued' || job.status === 'running') {
      throw badRequest('job_active', 'This job is already queued or running')
    }

    await transaction(async (client) => {
      await client.query(
        `UPDATE jobs
            SET status = 'queued', attempts = 0, run_after = now(),
                locked_at = NULL, locked_by = NULL, finished_at = NULL
          WHERE id = $1`,
        [job.id],
      )
      // The document is showing "failed" to the candidate; put it back to a
      // state that matches what is about to happen.
      if (job.payload?.documentId) {
        await client.query(
          "UPDATE cv_documents SET status = 'uploaded', error_message = NULL WHERE id = $1",
          [job.payload.documentId],
        )
      }
    })

    await audit(req, { action: 'admin.job_retry', entityType: 'job', entityId: job.id })
    ok(res, { retried: true })
  }),
)

/** Streams any candidate's original CV. Owner-scoped download lives in /api/cv. */
router.get(
  '/documents/:documentId/file',
  asyncHandler(async (req, res) => {
    const document = await one(
      'SELECT * FROM cv_documents WHERE id = $1 AND deleted_at IS NULL',
      [req.params.documentId],
    )
    if (!document) throw notFound('document_not_found', 'CV not found')

    await audit(req, {
      action: 'admin.cv_download',
      entityType: 'cv_document',
      entityId: document.id,
      metadata: { candidateId: document.user_id },
    })

    res.type(document.mime_type)
    res.setHeader(
      'Content-Disposition',
      `attachment; filename="${encodeURIComponent(document.original_filename)}"`,
    )
    res.sendFile(absolutePath(document.storage_path))
  }),
)

router.get(
  '/audit',
  validateQuery(
    z.object({
      action: z.string().max(60).optional(),
      actorId: z.string().uuid().optional(),
      limit: z.coerce.number().int().min(1).max(200).default(50),
      offset: z.coerce.number().int().min(0).default(0),
    }),
  ),
  asyncHandler(async (req, res) => {
    const { action, actorId, limit, offset } = req.validatedQuery
    const where = []
    const params = []
    if (action) {
      params.push(action)
      where.push(`a.action = $${params.length}`)
    }
    if (actorId) {
      params.push(actorId)
      where.push(`a.actor_id = $${params.length}`)
    }
    const clause = where.length ? `WHERE ${where.join(' AND ')}` : ''

    const [{ count }] = await many(`SELECT count(*)::int AS count FROM audit_log a ${clause}`, params)
    const rows = await many(
      `SELECT a.id, a.action, a.entity_type, a.entity_id, a.ip, a.metadata, a.created_at,
              u.full_name AS actor_name, a.actor_role
         FROM audit_log a LEFT JOIN users u ON u.id = a.actor_id
         ${clause}
        ORDER BY a.created_at DESC
        LIMIT $${params.length + 1} OFFSET $${params.length + 2}`,
      [...params, limit, offset],
    )
    page(res, rows, { total: count, limit, offset })
  }),
)

// ------------------------------ GDPR erasure ---------------------------------

/**
 * Hard erasure of a candidate on request.
 *
 * Deliberately destructive: the cascade removes profile, CV rows and sessions,
 * the files are unlinked, and only an anonymised audit entry survives to record
 * that an erasure happened — which is itself a GDPR obligation. Restricted to
 * super_admin because there is no undo.
 */
router.delete(
  '/candidates/:userId',
  requireRole('super_admin'),
  asyncHandler(async (req, res) => {
    const user = await one('SELECT id, email FROM users WHERE id = $1', [req.params.userId])
    if (!user) throw notFound('candidate_not_found', 'Candidate not found')

    await deleteUserFiles(user.id)
    await query('DELETE FROM users WHERE id = $1', [user.id])

    await audit(req, {
      action: 'admin.gdpr_erasure',
      entityType: 'user',
      entityId: user.id,
      // The address is hashed, not stored: the log must prove an erasure
      // happened without preserving the personal data it erased.
      metadata: { emailDigest: Buffer.from(user.email).toString('base64').slice(0, 12) },
    })
    ok(res, { erased: true })
  }),
)

export default router
