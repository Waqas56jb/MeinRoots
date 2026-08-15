import { Router } from 'express'
import { many, one, query, transaction } from '../../db/pool.js'
import { asyncHandler, badRequest, conflict, forbidden, notFound } from '../../lib/errors.js'
import { created, noContent, ok, page } from '../../lib/http.js'
import { audit } from '../../lib/audit.js'
import { emailField, passwordField, localeField, validateBody, validateQuery, z } from '../../lib/validate.js'
import { requireAuth } from '../../middleware/auth.js'
import { authLimiter } from '../../middleware/rateLimit.js'
import { queueEmail } from '../../lib/mailer.js'
import { hashPassword } from '../../lib/password.js'
import { createSession, publicUser, sendVerificationEmail } from '../auth/service.js'
import { setAuthCookies } from '../auth/routes.js'
import { recordConsents } from '../auth/consents.js'
import { TERMS_VERSION } from '../../lib/legal.js'
import { requireCompanyAdmin, requireFeature, requireRecruiter } from './middleware.js'
import { entitlementsFor, currentSubscription, presentSubscription, startTrial, effectiveStatus } from './entitlements.js'
import {
  attachCardDetail, candidateDetail, presentCard, searchCandidates,
} from './candidateAccess.js'

const router = Router()

/* ------------------------------- registration ----------------------------- */

/**
 * The six confirmations, each required and each its own literal.
 *
 * `z.literal(true)` rather than a boolean: a missing field is rejected rather
 * than coerced to false and quietly recorded as a refusal that still let the
 * account through.
 */
const consentsSchema = z.object({
  terms: z.literal(true, { errorMap: () => ({ message: 'consent_required' }) }),
  privacy: z.literal(true, { errorMap: () => ({ message: 'consent_required' }) }),
  legitimate_company: z.literal(true, { errorMap: () => ({ message: 'consent_required' }) }),
  legitimate_use: z.literal(true, { errorMap: () => ({ message: 'consent_required' }) }),
  access_understood: z.literal(true, { errorMap: () => ({ message: 'consent_required' }) }),
  no_guarantee: z.literal(true, { errorMap: () => ({ message: 'consent_required' }) }),
})

const registerSchema = z.object({
  recruiter: z.object({
    name: z.string().trim().min(1, 'name_required').max(120),
    email: emailField,
    password: passwordField,
    phone: z.string().trim().max(40).optional(),
  }),
  company: z.object({
    legalName: z.string().trim().min(1, 'company_required').max(200),
    tradingName: z.string().trim().max(200).optional(),
    country: z.string().trim().min(1, 'country_required').max(80),
    city: z.string().trim().max(80).optional(),
    website: z.string().trim().max(300).optional(),
    registrationNumber: z.string().trim().max(80).optional(),
    vatId: z.string().trim().max(60).optional(),
    industry: z.string().trim().max(120).optional(),
    size: z.string().trim().max(40).optional(),
  }),
  consents: consentsSchema,
  locale: localeField.default('en'),
})

/** The consent types this registration records, in the order they were shown. */
const RECRUITER_CONSENTS = {
  terms: 'recruiter_terms',
  privacy: 'recruiter_privacy',
  legitimate_company: 'legitimate_company',
  legitimate_use: 'legitimate_use',
  access_understood: 'access_understood',
  no_guarantee: 'no_guarantee',
}

router.post(
  '/register',
  authLimiter,
  validateBody(registerSchema),
  asyncHandler(async (req, res) => {
    const { recruiter, company, consents, locale } = req.body

    const existing = await one(
      'SELECT id FROM users WHERE email = $1 AND deleted_at IS NULL',
      [recruiter.email],
    )
    if (existing) throw conflict('email_taken', 'An account with this email already exists')

    const passwordHash = await hashPassword(recruiter.password)

    const result = await transaction(async (client) => {
      // The first person to register a company owns it: somebody has to be able
      // to manage the team and the subscription from minute one.
      const { rows: userRows } = await client.query(
        `INSERT INTO users (full_name, email, password_hash, role, locale, phone, gdpr_consent_at)
         VALUES ($1, $2, $3, 'company_admin', $4, $5, now())
         RETURNING *`,
        [recruiter.name, recruiter.email, passwordHash, locale, recruiter.phone ?? null],
      )
      const user = userRows[0]

      const { rows: companyRows } = await client.query(
        `INSERT INTO companies
           (legal_name, trading_name, country, city, website, registration_number, vat_id, industry, size)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)
         RETURNING *`,
        [
          company.legalName, company.tradingName ?? null, company.country, company.city ?? null,
          company.website ?? null, company.registrationNumber ?? null, company.vatId ?? null,
          company.industry ?? null, company.size ?? null,
        ],
      )
      const createdCompany = companyRows[0]

      await client.query(
        `INSERT INTO company_members (company_id, user_id, role, status)
         VALUES ($1, $2, 'company_admin', 'active')`,
        [createdCompany.id, user.id],
      )

      // Every confirmation as its own row, with the document version attached —
      // the same append-only log the candidate consents use, so proving what a
      // recruiter agreed to works the same way as proving it for a candidate.
      await recordConsents(client, {
        userId: user.id,
        consents: Object.fromEntries(
          Object.entries(RECRUITER_CONSENTS).map(([key, type]) => [type, consents[key] === true]),
        ),
        source: 'registration',
        req,
      })

      const subscription = await startTrial(client, createdCompany.id)

      return { user, company: createdCompany, subscription }
    })

    await sendVerificationEmail(result.user).catch(() => {})

    const tokens = await createSession(result.user, req)
    setAuthCookies(res, tokens)

    await audit(req, {
      action: 'recruiter.registered',
      entityType: 'company',
      entityId: result.company.id,
      actorId: result.user.id,
      actorRole: result.user.role,
      metadata: { companyId: result.company.id, termsVersion: TERMS_VERSION },
    })

    const entitlements = await entitlementsFor(result.company.id, { subscription: result.subscription })

    created(res, {
      user: publicUser(result.user),
      company: presentCompany(result.company),
      subscription: presentSubscription({ ...result.subscription, ...planFields(entitlements) }, entitlements.status),
      features: entitlements.features,
    })
  }),
)

const planFields = (e) => ({
  plan_name: e.subscription?.plan_name,
  price_cents: e.subscription?.price_cents,
  currency: e.subscription?.currency,
  interval: e.subscription?.interval,
})

const presentCompany = (c) => ({
  id: c.id,
  legalName: c.legal_name,
  tradingName: c.trading_name,
  website: c.website,
  country: c.country,
  city: c.city,
  industry: c.industry,
  size: c.size,
  registrationNumber: c.registration_number,
  vatId: c.vat_id,
  description: c.description,
  verificationStatus: c.verification_status,
  verificationNote: c.verification_note,
  verifiedAt: c.verified_at,
  createdAt: c.created_at,
})

/* ------------------------- everything below is signed in ------------------ */

router.use(requireAuth, requireRecruiter)

router.get(
  '/me',
  asyncHandler(async (req, res) => {
    const { companyId, entitlements } = req.recruiter
    const company = await one('SELECT * FROM companies WHERE id = $1', [companyId])
    ok(res, {
      user: publicUser({ ...req.user, full_name: req.user.full_name }),
      company: presentCompany(company),
      membership: { role: req.recruiter.role, isCompanyAdmin: req.recruiter.isCompanyAdmin },
      subscription: presentSubscription(entitlements.subscription, entitlements.status),
      // The authoritative map. The portal renders from this and computes nothing.
      features: entitlements.features,
    })
  }),
)

/* --------------------------------- company -------------------------------- */

router.get(
  '/company',
  asyncHandler(async (req, res) => {
    const company = await one('SELECT * FROM companies WHERE id = $1', [req.recruiter.companyId])
    ok(res, { company: presentCompany(company) })
  }),
)

const companyPatch = z.object({
  tradingName: z.string().trim().max(200).nullish(),
  website: z.string().trim().max(300).nullish(),
  city: z.string().trim().max(80).nullish(),
  country: z.string().trim().min(1).max(80).optional(),
  industry: z.string().trim().max(120).nullish(),
  size: z.string().trim().max(40).nullish(),
  registrationNumber: z.string().trim().max(80).nullish(),
  vatId: z.string().trim().max(60).nullish(),
  description: z.string().trim().max(2000).nullish(),
}).strict()

const COMPANY_COLUMNS = {
  tradingName: 'trading_name', website: 'website', city: 'city', country: 'country',
  industry: 'industry', size: 'size', registrationNumber: 'registration_number',
  vatId: 'vat_id', description: 'description',
}

router.patch(
  '/company',
  requireCompanyAdmin,
  validateBody(companyPatch),
  asyncHandler(async (req, res) => {
    const entries = Object.entries(req.body).filter(([k]) => COMPANY_COLUMNS[k])
    if (!entries.length) throw badRequest('nothing_to_update', 'No changes supplied')

    // Column names come from the allowlist above, never from the request.
    const sets = entries.map(([k], i) => `${COMPANY_COLUMNS[k]} = $${i + 2}`)
    const values = entries.map(([, v]) => (v === '' ? null : v))

    const company = await one(
      `UPDATE companies SET ${sets.join(', ')} WHERE id = $1 RETURNING *`,
      [req.recruiter.companyId, ...values],
    )

    await audit(req, {
      action: 'company.updated',
      entityType: 'company',
      entityId: company.id,
      metadata: { fields: entries.map(([k]) => k) },
    })
    ok(res, { company: presentCompany(company) })
  }),
)

/* ---------------------------------- team ---------------------------------- */

router.get(
  '/team',
  asyncHandler(async (req, res) => {
    const members = await many(
      `SELECT m.id, m.role, m.status, m.invited_at,
              u.id AS user_id, u.full_name, u.email, u.last_login_at
         FROM company_members m JOIN users u ON u.id = m.user_id
        WHERE m.company_id = $1 AND u.deleted_at IS NULL
        ORDER BY m.role = 'company_admin' DESC, u.full_name`,
      [req.recruiter.companyId],
    )
    ok(res, {
      members: members.map((m) => ({
        id: m.user_id,
        membershipId: m.id,
        name: m.full_name,
        email: m.email,
        // The seat that created the company is shown as the owner; both it and
        // company_admin can administer, but only one is the original.
        role: m.role === 'company_admin' ? 'admin' : 'member',
        status: m.status,
        invitedAt: m.invited_at,
        lastLoginAt: m.last_login_at,
      })),
    })
  }),
)

router.post(
  '/team/invitations',
  requireCompanyAdmin,
  requireFeature('team_management'),
  validateBody(z.object({ email: emailField, role: z.enum(['member', 'admin']).default('member') }).strict()),
  asyncHandler(async (req, res) => {
    const { email, role } = req.body

    const existing = await one('SELECT id, role FROM users WHERE email = $1 AND deleted_at IS NULL', [email])
    if (existing) {
      // Never say whose account it is. "Already in use" is all a stranger needs.
      throw conflict('email_taken', 'That address already has an account')
    }

    const memberRole = role === 'admin' ? 'company_admin' : 'recruiter'

    const invited = await transaction(async (client) => {
      // Invited seats have no password until they set one from the email link,
      // so a random hash is stored rather than a guessable placeholder.
      const { randomBytes } = await import('node:crypto')
      const placeholder = await hashPassword(randomBytes(24).toString('hex'))
      const { rows } = await client.query(
        `INSERT INTO users (full_name, email, password_hash, role, locale)
         VALUES ($1, $2, $3, $4, $5) RETURNING *`,
        [email.split('@')[0], email, placeholder, memberRole, req.user.locale ?? 'en'],
      )
      const user = rows[0]
      await client.query(
        `INSERT INTO company_members (company_id, user_id, role, status, invited_by, invited_at)
         VALUES ($1, $2, $3, 'invited', $4, now())`,
        [req.recruiter.companyId, user.id, memberRole, req.user.id],
      )
      return user
    })

    // Reuses the existing password-reset path as the "set your password" link:
    // one flow to keep secure rather than two that do the same thing.
    await queueEmail({
      userId: invited.id,
      to: email,
      template: 'password_reset',
      locale: invited.locale,
      vars: { name: invited.full_name },
    }).catch(() => {})

    await audit(req, {
      action: 'company.member_invited',
      entityType: 'company',
      entityId: req.recruiter.companyId,
      metadata: { role: memberRole },
    })
    created(res, { invited: true })
  }),
)

router.delete(
  '/team/:memberId',
  requireCompanyAdmin,
  asyncHandler(async (req, res) => {
    if (req.params.memberId === req.user.id) {
      throw badRequest('cannot_remove_self', 'You cannot remove your own seat')
    }
    // Scoped to this company: a member id from elsewhere simply does not match.
    const membership = await one(
      'SELECT id, role FROM company_members WHERE user_id = $1 AND company_id = $2',
      [req.params.memberId, req.recruiter.companyId],
    )
    if (!membership) throw notFound('member_not_found', 'Not found')

    const admins = await one(
      `SELECT count(*)::int AS n FROM company_members
        WHERE company_id = $1 AND role = 'company_admin' AND status = 'active'`,
      [req.recruiter.companyId],
    )
    if (membership.role === 'company_admin' && admins.n <= 1) {
      throw conflict('last_admin', 'A company must keep at least one administrator')
    }

    await query("UPDATE company_members SET status = 'disabled' WHERE id = $1", [membership.id])
    await audit(req, {
      action: 'company.member_removed',
      entityType: 'company',
      entityId: req.recruiter.companyId,
    })
    noContent(res)
  }),
)

/* ------------------------------- candidates -------------------------------- */

const searchQuery = z.object({
  q: z.string().trim().max(120).optional(),
  profession: z.string().trim().max(120).optional(),
  skills: z.string().trim().max(300).optional(),
  germanLevel: z.enum(['A1', 'A2', 'B1', 'B2', 'C1', 'C2', 'native']).optional(),
  minExperienceMonths: z.coerce.number().int().min(0).max(720).optional(),
  location: z.string().trim().max(120).optional(),
  workAuthorisation: z.string().trim().max(40).optional(),
  minReadiness: z.coerce.number().int().min(0).max(100).optional(),
  goal: z.enum(['germany', 'remote', 'freelance', 'ausbildung']).optional(),
  sort: z.enum(['relevance', 'readiness', 'experience', 'recent']).default('relevance'),
  limit: z.coerce.number().int().min(1).max(50).default(12),
  offset: z.coerce.number().int().min(0).default(0),
})

router.get(
  '/candidates',
  requireFeature('candidate_search'),
  validateQuery(searchQuery),
  asyncHandler(async (req, res) => {
    const q = req.validatedQuery
    // Filters the plan does not include are dropped rather than rejected: the
    // portal hides the controls, and a stale URL should still return results.
    const advanced = req.recruiter.entitlements.features.advanced_filters === true

    const { rows, total } = await searchCandidates({
      ...q,
      skills: q.skills ? q.skills.split(',').map((s) => s.trim()).filter(Boolean) : [],
      minReadiness: advanced ? q.minReadiness : undefined,
    })

    const withDetail = await attachCardDetail(rows)
    const ids = withDetail.map((r) => r.id)

    const [saved, requests] = ids.length
      ? await Promise.all([
          many(
            'SELECT candidate_id FROM saved_candidates WHERE company_id = $1 AND candidate_id = ANY($2::uuid[])',
            [req.recruiter.companyId, ids],
          ),
          many(
            `SELECT DISTINCT ON (candidate_id) candidate_id, status
               FROM recruitment_requests
              WHERE company_id = $1 AND candidate_id = ANY($2::uuid[])
              ORDER BY candidate_id, created_at DESC`,
            [req.recruiter.companyId, ids],
          ),
        ])
      : [[], []]

    const savedSet = new Set(saved.map((s) => s.candidate_id))
    const requestMap = Object.fromEntries(requests.map((r) => [r.candidate_id, r.status]))

    await audit(req, {
      action: 'recruiter.candidate_search',
      entityType: 'company',
      entityId: req.recruiter.companyId,
      // The query, never the results: who was returned is not a fact worth
      // storing on every search.
      metadata: { filters: Object.keys(q).filter((k) => q[k] !== undefined), resultCount: total },
    })

    page(
      res,
      withDetail.map((r) =>
        presentCard(r, { saved: savedSet.has(r.id), requestState: requestMap[r.id] ?? null }),
      ),
      { total, limit: q.limit, offset: q.offset },
    )
  }),
)

router.get(
  '/candidates/filters',
  requireFeature('candidate_search'),
  asyncHandler(async (_req, res) => {
    // Drawn from the data that exists, so a filter can never offer a value that
    // returns nothing.
    const [domains, countries, levels] = await Promise.all([
      many(
        `SELECT d.code, d.label_en FROM domains d
          WHERE EXISTS (SELECT 1 FROM profile_classifications c WHERE c.domain = d.code AND c.is_current)
          ORDER BY d.sort_order`,
      ),
      many(
        `SELECT DISTINCT country FROM candidate_profiles
          WHERE country IS NOT NULL ORDER BY country LIMIT 100`,
      ),
      many(
        `SELECT DISTINCT level::text AS level FROM profile_languages
          WHERE level IS NOT NULL AND lower(language) IN ('german','deutsch','allemand')`,
      ),
    ])
    ok(res, {
      professions: domains.map((d) => ({ value: d.code, label: d.label_en })),
      countries: countries.map((c) => c.country),
      germanLevels: levels.map((l) => l.level),
      goals: ['germany', 'remote', 'freelance', 'ausbildung'],
    })
  }),
)

router.get(
  '/candidates/:id',
  requireFeature('candidate_search'),
  validateQuery(z.object({}).passthrough()),
  asyncHandler(async (req, res) => {
    const uuid = z.string().uuid().safeParse(req.params.id)
    if (!uuid.success) throw notFound('candidate_not_found', 'Not found')

    const result = await candidateDetail({
      candidateId: req.params.id,
      companyId: req.recruiter.companyId,
      entitlements: req.recruiter.entitlements,
    })
    // A candidate who never consented, or who withdrew, is "not found" rather
    // than "exists but hidden". The difference is itself information.
    if (!result) throw notFound('candidate_not_found', 'Not found')

    const [saved, request] = await Promise.all([
      one('SELECT id FROM saved_candidates WHERE company_id = $1 AND candidate_id = $2',
        [req.recruiter.companyId, req.params.id]),
      one(
        `SELECT status FROM recruitment_requests
          WHERE company_id = $1 AND candidate_id = $2 ORDER BY created_at DESC LIMIT 1`,
        [req.recruiter.companyId, req.params.id],
      ),
    ])

    await audit(req, {
      action: result.access.level === 'granted'
        ? 'recruiter.candidate_contact_access'
        : 'recruiter.candidate_profile_access',
      entityType: 'user',
      entityId: req.params.id,
      metadata: { companyId: req.recruiter.companyId, accessLevel: result.access.level },
    })

    ok(res, {
      candidate: { ...result.candidate, isSaved: Boolean(saved), requestState: request?.status ?? null },
      access: result.access,
    })
  }),
)

/* ----------------------------- saved candidates ---------------------------- */

router.get(
  '/saved',
  requireFeature('saved_candidates'),
  validateQuery(z.object({
    limit: z.coerce.number().int().min(1).max(50).default(12),
    offset: z.coerce.number().int().min(0).default(0),
  })),
  asyncHandler(async (req, res) => {
    const { limit, offset } = req.validatedQuery
    const total = await one(
      'SELECT count(*)::int AS n FROM saved_candidates WHERE company_id = $1',
      [req.recruiter.companyId],
    )
    const ids = await many(
      `SELECT candidate_id FROM saved_candidates WHERE company_id = $1
        ORDER BY created_at DESC LIMIT $2 OFFSET $3`,
      [req.recruiter.companyId, limit, offset],
    )
    if (!ids.length) return page(res, [], { total: total.n, limit, offset })

    // Reuses the same consent-gated projection: a candidate who withdrew
    // consent after being saved drops out of the list rather than remaining
    // visible because the row is still there.
    const { rows } = await searchCandidates({ limit, offset: 0 })
    const wanted = new Set(ids.map((i) => i.candidate_id))
    const filtered = rows.filter((r) => wanted.has(r.id))
    const withDetail = await attachCardDetail(filtered)

    return page(
      res,
      withDetail.map((r) => presentCard(r, { saved: true })),
      { total: total.n, limit, offset },
    )
  }),
)

router.post(
  '/candidates/:id/save',
  requireFeature('saved_candidates'),
  asyncHandler(async (req, res) => {
    const uuid = z.string().uuid().safeParse(req.params.id)
    if (!uuid.success) throw notFound('candidate_not_found', 'Not found')

    // Only a candidate this company could legitimately have seen.
    const visible = await candidateDetail({
      candidateId: req.params.id,
      companyId: req.recruiter.companyId,
      entitlements: req.recruiter.entitlements,
    })
    if (!visible) throw notFound('candidate_not_found', 'Not found')

    await query(
      `INSERT INTO saved_candidates (company_id, candidate_id, saved_by)
       VALUES ($1, $2, $3) ON CONFLICT (company_id, candidate_id) DO NOTHING`,
      [req.recruiter.companyId, req.params.id, req.user.id],
    )
    await audit(req, {
      action: 'recruiter.candidate_saved',
      entityType: 'user',
      entityId: req.params.id,
      metadata: { companyId: req.recruiter.companyId },
    })
    created(res, { saved: true })
  }),
)

router.delete(
  '/candidates/:id/save',
  asyncHandler(async (req, res) => {
    await query('DELETE FROM saved_candidates WHERE company_id = $1 AND candidate_id = $2',
      [req.recruiter.companyId, req.params.id])
    noContent(res)
  }),
)

/* -------------------------------- requests --------------------------------- */

router.get(
  '/requests',
  validateQuery(z.object({
    type: z.enum(['contact', 'interview']).optional(),
    status: z.enum(['pending', 'accepted', 'declined', 'cancelled', 'completed', 'expired']).optional(),
    limit: z.coerce.number().int().min(1).max(100).default(50),
    offset: z.coerce.number().int().min(0).default(0),
  })),
  asyncHandler(async (req, res) => {
    const { type, status, limit, offset } = req.validatedQuery
    const where = ['r.company_id = $1']
    const params = [req.recruiter.companyId]
    if (type) { params.push(type); where.push(`r.type = $${params.length}::request_type`) }
    if (status) { params.push(status); where.push(`r.status = $${params.length}::request_status`) }

    const total = await one(
      `SELECT count(*)::int AS n FROM recruitment_requests r WHERE ${where.join(' AND ')}`,
      params,
    )
    const rows = await many(
      `SELECT r.id, r.type, r.status, r.message, r.response, r.role_context,
              r.created_at, r.responded_at, r.candidate_id,
              p.reference AS candidate_reference,
              d.label_en AS candidate_profession
         FROM recruitment_requests r
         JOIN candidate_profiles p ON p.user_id = r.candidate_id
         LEFT JOIN profile_classifications cl ON cl.profile_id = p.id AND cl.is_current
         LEFT JOIN domains d ON d.code = cl.domain
        WHERE ${where.join(' AND ')}
        ORDER BY r.created_at DESC LIMIT $${params.length + 1} OFFSET $${params.length + 2}`,
      [...params, limit, offset],
    )

    page(res, rows.map((r) => ({
      id: r.id,
      type: r.type,
      status: r.status,
      message: r.message,
      // Only present once the candidate has answered — an unanswered request
      // has nothing to show and must not imply otherwise.
      response: r.status === 'pending' ? null : r.response,
      createdAt: r.created_at,
      respondedAt: r.responded_at,
      candidateId: r.candidate_id,
      candidate: { reference: r.candidate_reference, profession: r.candidate_profession },
    })), { total: total.n, limit, offset })
  }),
)

const createRequestSchema = z.object({
  candidateId: z.string().uuid(),
  type: z.enum(['contact', 'interview']),
  message: z.string().trim().max(1000).optional(),
  context: z.string().trim().max(200).optional(),
}).strict()

router.post(
  '/requests',
  validateBody(createRequestSchema),
  asyncHandler(async (req, res) => {
    const { candidateId, type, message, context } = req.body
    const feature = type === 'interview' ? 'interview_requests' : 'contact_requests'
    if (req.recruiter.entitlements.features[feature] !== true) {
      throw forbidden('feature_not_available', `Your plan does not include ${feature}`)
    }

    // The candidate must be one this company could see, which is the same check
    // as consent: a candidate who has not agreed to be found cannot be asked.
    const visible = await candidateDetail({
      candidateId,
      companyId: req.recruiter.companyId,
      entitlements: req.recruiter.entitlements,
    })
    if (!visible) throw notFound('candidate_not_found', 'Not found')

    const open = await one(
      `SELECT id FROM recruitment_requests
        WHERE company_id = $1 AND candidate_id = $2 AND type = $3::request_type AND status = 'pending'`,
      [req.recruiter.companyId, candidateId, type],
    )
    if (open) throw conflict('request_already_open', 'A request of this type is already awaiting an answer')

    const request = await transaction(async (client) => {
      const { rows } = await client.query(
        `INSERT INTO recruitment_requests
           (candidate_id, company_id, recruiter_id, type, message, role_context)
         VALUES ($1,$2,$3,$4::request_type,$5,$6) RETURNING *`,
        [candidateId, req.recruiter.companyId, req.user.id, type, message ?? null, context ?? null],
      )
      const created_ = rows[0]

      // The pipeline entry appears when the first approach is made, so the
      // process is visible from the moment it starts rather than after a reply.
      await client.query(
        `INSERT INTO pipeline_entries (company_id, candidate_id, request_id, stage, updated_by)
         VALUES ($1, $2, $3, $4, $5)
         ON CONFLICT (company_id, candidate_id) DO UPDATE
           SET stage = EXCLUDED.stage, request_id = EXCLUDED.request_id, updated_at = now()`,
        [
          req.recruiter.companyId, candidateId, created_.id,
          type === 'interview' ? 'interview_requested' : 'contact_requested',
          req.user.id,
        ],
      )
      return created_
    })

    const candidate = await one(
      'SELECT id, email, full_name, locale, notify_by_email FROM users WHERE id = $1',
      [candidateId],
    )
    if (candidate?.notify_by_email !== false) {
      await queueEmail({
        userId: candidate.id,
        to: candidate.email,
        template: 'recruitment_request',
        locale: candidate.locale ?? 'en',
        vars: {
          name: candidate.full_name,
          company: req.recruiter.company.trading_name || req.recruiter.company.legal_name,
          type,
        },
      }).catch(() => {})
    }

    await audit(req, {
      action: type === 'interview' ? 'recruiter.interview_request' : 'recruiter.contact_request',
      entityType: 'recruitment_request',
      entityId: request.id,
      metadata: { companyId: req.recruiter.companyId, candidateId },
    })

    created(res, { request: { id: request.id, type: request.type, status: request.status } })
  }),
)

router.delete(
  '/requests/:id',
  asyncHandler(async (req, res) => {
    const request = await one(
      'SELECT * FROM recruitment_requests WHERE id = $1 AND company_id = $2',
      [req.params.id, req.recruiter.companyId],
    )
    if (!request) throw notFound('request_not_found', 'Not found')
    if (request.status !== 'pending') throw conflict('request_not_pending', 'That request has already been answered')

    await query(
      "UPDATE recruitment_requests SET status = 'cancelled', resolved_at = now() WHERE id = $1",
      [request.id],
    )
    await audit(req, {
      action: 'recruiter.request_withdrawn',
      entityType: 'recruitment_request',
      entityId: request.id,
      metadata: { companyId: req.recruiter.companyId },
    })
    noContent(res)
  }),
)

/* -------------------------------- pipeline --------------------------------- */

router.get(
  '/pipeline',
  requireFeature('recruitment_pipeline'),
  asyncHandler(async (req, res) => {
    const [stages, entries] = await Promise.all([
      many('SELECT key, label_en, label_de, label_fr, sort_order FROM pipeline_stages WHERE enabled ORDER BY sort_order'),
      many(
        `SELECT e.id, e.stage, e.updated_at, e.candidate_id,
                p.reference, d.label_en AS profession
           FROM pipeline_entries e
           JOIN candidate_profiles p ON p.user_id = e.candidate_id
           LEFT JOIN profile_classifications cl ON cl.profile_id = p.id AND cl.is_current
           LEFT JOIN domains d ON d.code = cl.domain
          WHERE e.company_id = $1
          ORDER BY e.updated_at DESC`,
        [req.recruiter.companyId],
      ),
    ])

    const counts = entries.reduce((acc, e) => {
      acc[e.stage] = (acc[e.stage] ?? 0) + 1
      return acc
    }, {})

    ok(res, {
      stages: stages.map((s) => ({
        key: s.key,
        label: { en: s.label_en, de: s.label_de, fr: s.label_fr }[req.user.locale ?? 'en'] ?? s.label_en,
        count: counts[s.key] ?? 0,
      })),
      entries: entries.map((e) => ({
        id: e.id,
        stage: e.stage,
        updatedAt: e.updated_at,
        candidateId: e.candidate_id,
        candidate: { reference: e.reference, profession: e.profession },
      })),
    })
  }),
)

/* --------------------------------- billing --------------------------------- */

router.get(
  '/plans',
  asyncHandler(async (_req, res) => {
    const [plans, features] = await Promise.all([
      many('SELECT * FROM plans WHERE enabled ORDER BY sort_order'),
      many('SELECT plan_key, feature FROM plan_features WHERE enabled'),
    ])
    const byPlan = features.reduce((acc, f) => {
      ;(acc[f.plan_key] ??= []).push(f.feature)
      return acc
    }, {})

    ok(res, {
      plans: plans.map((p) => ({
        key: p.key,
        name: p.name,
        description: p.description,
        // Minor units in the database, decimal on the wire. A null price stays
        // null — "on request" is a real answer and not a missing one.
        price: p.price_cents === null ? null : p.price_cents / 100,
        currency: p.currency,
        interval: p.interval,
        trialDays: p.trial_days,
        highlighted: p.highlighted,
        // Absent provider price means checkout is not wired for this plan yet.
        checkoutAvailable: Boolean(p.provider_price_id),
        features: (byPlan[p.key] ?? []).map((key) => ({ key, label: key })),
      })),
    })
  }),
)

router.get(
  '/subscription',
  asyncHandler(async (req, res) => {
    const sub = await currentSubscription(req.recruiter.companyId)
    ok(res, { subscription: presentSubscription(sub, effectiveStatus(sub)) })
  }),
)

router.get(
  '/invoices',
  asyncHandler(async (req, res) => {
    // Only this company's, and only what the provider has confirmed. Nothing is
    // synthesised from the subscription row.
    const rows = await many(
      `SELECT be.id, be.event_type, be.payload, be.created_at
         FROM billing_events be
        WHERE be.company_id = $1 AND be.event_type LIKE 'invoice.%' AND be.processed_at IS NOT NULL
        ORDER BY be.created_at DESC LIMIT 50`,
      [req.recruiter.companyId],
    )
    ok(res, {
      invoices: rows.map((r) => ({
        id: r.id,
        issuedAt: r.created_at,
        amount: r.payload?.amount_paid != null ? r.payload.amount_paid / 100 : null,
        currency: (r.payload?.currency ?? 'eur').toUpperCase(),
        status: r.event_type === 'invoice.paid' ? 'paid' : 'failed',
        url: r.payload?.hosted_invoice_url ?? null,
      })),
    })
  }),
)

export default router
