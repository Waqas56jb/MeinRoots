import { Router } from 'express'
import { many, one, query, transaction } from '../../db/pool.js'
import { asyncHandler, conflict, forbidden, notFound } from '../../lib/errors.js'
import { ok, page } from '../../lib/http.js'
import { audit } from '../../lib/audit.js'
import { validateBody, validateQuery, z } from '../../lib/validate.js'
import { requireAuth } from '../../middleware/auth.js'
import { queueEmail } from '../../lib/mailer.js'
import { hasConsent } from '../auth/consents.js'

/**
 * The candidate's side of recruitment.
 *
 * Everything here is scoped to the caller by their own id, taken from the
 * session and never from the request. There is no endpoint that accepts a
 * candidate id, so there is no endpoint that can be pointed at somebody else.
 *
 * What a candidate is shown about the company that approached them is
 * deliberately narrow: the name, and what they wrote. Not the recruiter's
 * email, not the company's internal record — an approach is an introduction,
 * not an exchange of directories.
 */

const router = Router()

router.use(requireAuth)

/** Recruiters and admins have their own views of this data; this route is the
 *  candidate's, and only a candidate has one. */
const requireCandidate = (req, _res, next) => {
  if (req.user?.role !== 'candidate') return next(forbidden('forbidden', 'Not allowed'))
  return next()
}
router.use(requireCandidate)

const present = (r) => ({
  id: r.id,
  type: r.type,
  status: r.status,
  message: r.message,
  role: r.role_context,
  createdAt: r.created_at,
  respondedAt: r.responded_at,
  company: {
    // The trading name if there is one — it is what a candidate would recognise
    // from a job advert. Nothing else about the company is included.
    name: r.trading_name || r.legal_name,
    country: r.company_country,
    website: r.company_website,
    verified: r.verification_status === 'verified',
  },
})

router.get(
  '/requests',
  validateQuery(z.object({
    status: z.enum(['pending', 'accepted', 'declined', 'cancelled', 'completed', 'expired']).optional(),
    limit: z.coerce.number().int().min(1).max(100).default(50),
    offset: z.coerce.number().int().min(0).default(0),
  })),
  asyncHandler(async (req, res) => {
    const { status, limit, offset } = req.validatedQuery
    const params = [req.user.id]
    let clause = 'r.candidate_id = $1'
    if (status) {
      params.push(status)
      clause += ` AND r.status = $${params.length}::request_status`
    }

    const total = await one(
      `SELECT count(*)::int AS n FROM recruitment_requests r WHERE ${clause}`,
      params,
    )
    const rows = await many(
      `SELECT r.*, c.legal_name, c.trading_name, c.country AS company_country,
              c.website AS company_website, c.verification_status
         FROM recruitment_requests r JOIN companies c ON c.id = r.company_id
        WHERE ${clause}
        ORDER BY r.status = 'pending' DESC, r.created_at DESC
        LIMIT $${params.length + 1} OFFSET $${params.length + 2}`,
      [...params, limit, offset],
    )

    page(res, rows.map(present), { total: total.n, limit, offset })
  }),
)

router.get(
  '/requests/:id',
  asyncHandler(async (req, res) => {
    const row = await one(
      `SELECT r.*, c.legal_name, c.trading_name, c.country AS company_country,
              c.website AS company_website, c.verification_status
         FROM recruitment_requests r JOIN companies c ON c.id = r.company_id
        WHERE r.id = $1 AND r.candidate_id = $2`,
      [req.params.id, req.user.id],
    )
    if (!row) throw notFound('request_not_found', 'Not found')
    ok(res, { request: present(row) })
  }),
)

/**
 * Answering a request.
 *
 * One handler for both answers because the guards are identical and the only
 * difference is what gets written — two near-identical handlers is how one of
 * them ends up missing a check.
 */
const respond = (accept) =>
  asyncHandler(async (req, res) => {
    const request = await one(
      `SELECT r.*, c.legal_name, c.trading_name
         FROM recruitment_requests r JOIN companies c ON c.id = r.company_id
        WHERE r.id = $1 AND r.candidate_id = $2`,
      [req.params.id, req.user.id],
    )
    // Scoped by candidate_id: somebody else's request is not "forbidden", it
    // simply is not theirs to find.
    if (!request) throw notFound('request_not_found', 'Not found')
    if (request.status !== 'pending') {
      throw conflict('already_answered', 'You have already answered this request')
    }

    // Accepting is what releases contact details, so the consent that makes
    // sharing lawful is re-checked at the moment of the decision rather than
    // trusted from when the request was created.
    if (accept && !(await hasConsent(req.user.id, 'employer_sharing'))) {
      throw forbidden('sharing_consent_required', 'Turn on employer sharing in your settings first')
    }

    await transaction(async (client) => {
      await client.query(
        `UPDATE recruitment_requests
            SET status = $2::request_status, response = $3, responded_at = now(),
                resolved_at = CASE WHEN $2 = 'declined' THEN now() ELSE resolved_at END
          WHERE id = $1`,
        [request.id, accept ? 'accepted' : 'declined', req.body?.message ?? null],
      )

      // The pipeline follows the answer. A decline closes the entry rather than
      // deleting it — the company should see that it ended, and why not to ask
      // again.
      await client.query(
        `UPDATE pipeline_entries
            SET stage = $3, updated_at = now()
          WHERE company_id = $1 AND candidate_id = $2`,
        [request.company_id, req.user.id, accept ? 'candidate_responded' : 'closed'],
      )
    })

    // Tell the recruiter who asked. Falls back to the company's administrators
    // if that seat has since been removed.
    const recipients = await many(
      `SELECT u.id, u.email, u.full_name, u.locale
         FROM users u
        WHERE u.id = $1 AND u.deleted_at IS NULL
        UNION
       SELECT u.id, u.email, u.full_name, u.locale
         FROM company_members m JOIN users u ON u.id = m.user_id
        WHERE m.company_id = $2 AND m.role = 'company_admin' AND m.status = 'active'
          AND u.deleted_at IS NULL AND $1 IS NULL`,
      [request.recruiter_id, request.company_id],
    )
    for (const r of recipients.slice(0, 3)) {
      await queueEmail({
        userId: r.id,
        to: r.email,
        template: 'recruitment_response',
        locale: r.locale ?? 'en',
        vars: { name: r.full_name, accepted: accept, type: request.type },
      }).catch(() => {})
    }

    await audit(req, {
      action: accept ? 'candidate.request_accepted' : 'candidate.request_declined',
      entityType: 'recruitment_request',
      entityId: request.id,
      metadata: { companyId: request.company_id, type: request.type },
    })

    ok(res, { status: accept ? 'accepted' : 'declined' })
  })

const responseBody = z.object({ message: z.string().trim().max(1000).optional() }).strict()

router.post('/requests/:id/accept', validateBody(responseBody), respond(true))
router.post('/requests/:id/decline', validateBody(responseBody), respond(false))

export default router
