import { Router } from 'express'
import { many, one, query } from '../../db/pool.js'
import { asyncHandler, notFound } from '../../lib/errors.js'
import { ok, page } from '../../lib/http.js'
import { audit } from '../../lib/audit.js'
import { validateBody, validateQuery, z } from '../../lib/validate.js'
import { requireAuth, requireRole } from '../../middleware/auth.js'
import { effectiveStatus, presentSubscription } from '../recruiter/entitlements.js'

/**
 * The console's view of the recruiter ecosystem.
 *
 * One rule shapes every response here: operational staff see the candidate
 * reference, not the candidate. Monitoring how many requests a company sent
 * does not require knowing who they were sent to, and a screen that shows a
 * name anyway is a screen that leaks by default. The candidate detail page
 * already exists for the cases where identity is genuinely needed, and it
 * audits every open.
 */

const router = Router()
router.use(requireAuth, requireRole('admin'))

const presentCompany = (c) => ({
  id: c.id,
  legalName: c.legal_name,
  tradingName: c.trading_name,
  country: c.country,
  city: c.city,
  website: c.website,
  industry: c.industry,
  registrationNumber: c.registration_number,
  vatId: c.vat_id,
  verificationStatus: c.verification_status,
  verificationNote: c.verification_note,
  verifiedAt: c.verified_at,
  deactivatedAt: c.deactivated_at,
  createdAt: c.created_at,
})

/* -------------------------------- companies -------------------------------- */

const listQuery = z.object({
  q: z.string().trim().max(120).optional(),
  verification: z.enum(['pending', 'verified', 'info_required', 'rejected']).optional(),
  plan: z.string().trim().max(40).optional(),
  limit: z.coerce.number().int().min(1).max(100).default(25),
  offset: z.coerce.number().int().min(0).default(0),
})

router.get(
  '/companies',
  validateQuery(listQuery),
  asyncHandler(async (req, res) => {
    const { q, verification, plan, limit, offset } = req.validatedQuery
    const where = ['1 = 1']
    const params = []
    const add = (v) => {
      params.push(v)
      return `$${params.length}`
    }

    if (q) {
      const needle = add(`%${q.toLowerCase()}%`)
      where.push(`(lower(c.legal_name) LIKE ${needle} OR lower(coalesce(c.trading_name,'')) LIKE ${needle})`)
    }
    if (verification) where.push(`c.verification_status = ${add(verification)}::company_verification`)
    if (plan) where.push(`s.plan_key = ${add(plan)}`)

    const clause = `WHERE ${where.join(' AND ')}`
    const total = await one(
      `SELECT count(*)::int AS n FROM companies c
         LEFT JOIN subscriptions s ON s.company_id = c.id
           AND s.status IN ('trialing','active','past_due')
       ${clause}`,
      params,
    )
    const rows = await many(
      `SELECT c.*, s.plan_key, s.status AS sub_status, s.trial_end, s.current_period_end,
              (SELECT count(*)::int FROM company_members m WHERE m.company_id = c.id AND m.status = 'active') AS seats,
              (SELECT count(*)::int FROM recruitment_requests r WHERE r.company_id = c.id) AS request_count
         FROM companies c
         LEFT JOIN subscriptions s ON s.company_id = c.id
           AND s.status IN ('trialing','active','past_due')
       ${clause}
       ORDER BY (c.verification_status = 'pending') DESC, c.created_at DESC
       LIMIT ${add(limit)} OFFSET ${add(offset)}`,
      params,
    )

    page(
      res,
      rows.map((c) => ({
        ...presentCompany(c),
        plan: c.plan_key ?? null,
        subscriptionStatus: c.sub_status ? effectiveStatus({ ...c, status: c.sub_status }) : null,
        seats: c.seats,
        requestCount: c.request_count,
      })),
      { total: total.n, limit, offset },
    )
  }),
)

/** The console's recruiter list is the company list — a recruiter without a
 *  company cannot exist, and the company is the unit staff actually manage. */
router.get('/recruiters', validateQuery(listQuery), asyncHandler(async (req, res) => {
  req.url = '/companies'
  router.handle(req, res)
}))

router.get(
  '/companies/:id',
  asyncHandler(async (req, res) => {
    const company = await one('SELECT * FROM companies WHERE id = $1', [req.params.id])
    if (!company) throw notFound('company_not_found', 'Not found')

    const [members, subscription, requests] = await Promise.all([
      many(
        `SELECT m.role, m.status, m.invited_at, u.id, u.full_name, u.email, u.last_login_at
           FROM company_members m JOIN users u ON u.id = m.user_id
          WHERE m.company_id = $1 AND u.deleted_at IS NULL ORDER BY m.role DESC`,
        [company.id],
      ),
      one(
        `SELECT s.*, p.name AS plan_name, p.price_cents, p.currency, p.interval
           FROM subscriptions s JOIN plans p ON p.key = s.plan_key
          WHERE s.company_id = $1 ORDER BY s.created_at DESC LIMIT 1`,
        [company.id],
      ),
      many(
        `SELECT r.id, r.type, r.status, r.created_at, p.reference AS candidate_reference
           FROM recruitment_requests r JOIN candidate_profiles p ON p.user_id = r.candidate_id
          WHERE r.company_id = $1 ORDER BY r.created_at DESC LIMIT 25`,
        [company.id],
      ),
    ])

    await audit(req, { action: 'admin.company_view', entityType: 'company', entityId: company.id })

    ok(res, {
      company: presentCompany(company),
      members: members.map((m) => ({
        id: m.id, name: m.full_name, email: m.email,
        role: m.role === 'company_admin' ? 'admin' : 'member',
        status: m.status, lastLoginAt: m.last_login_at,
      })),
      subscription: subscription ? presentSubscription(subscription, effectiveStatus(subscription)) : null,
      // References only. Staff monitoring a company's activity do not need to
      // know which people it approached.
      requests: requests.map((r) => ({
        id: r.id, type: r.type, status: r.status, createdAt: r.created_at,
        candidateReference: r.candidate_reference,
      })),
    })
  }),
)

router.post(
  '/companies/:id/verify',
  validateBody(z.object({
    status: z.enum(['verified', 'rejected', 'info_required', 'pending']),
    note: z.string().trim().max(2000).optional(),
  }).strict()),
  asyncHandler(async (req, res) => {
    const { status, note } = req.body
    const company = await one(
      `UPDATE companies
          SET verification_status = $2::company_verification,
              verification_note = $3,
              verified_at = CASE WHEN $2 = 'verified' THEN now() ELSE NULL END,
              verified_by = CASE WHEN $2 = 'verified' THEN $4::uuid ELSE NULL END
        WHERE id = $1 RETURNING *`,
      [req.params.id, status, note ?? null, req.user.id],
    )
    if (!company) throw notFound('company_not_found', 'Not found')

    await audit(req, {
      action: `admin.company_${status}`,
      entityType: 'company',
      entityId: company.id,
      metadata: { status, note: note ?? null },
    })
    ok(res, { company: presentCompany(company) })
  }),
)

/* ------------------------------ subscriptions ------------------------------ */

router.get(
  '/subscriptions',
  validateQuery(z.object({
    status: z.enum(['trialing', 'active', 'past_due', 'cancelled', 'expired']).optional(),
    plan: z.string().trim().max(40).optional(),
    limit: z.coerce.number().int().min(1).max(100).default(50),
    offset: z.coerce.number().int().min(0).default(0),
  })),
  asyncHandler(async (req, res) => {
    const { status, plan, limit, offset } = req.validatedQuery
    const where = ['1 = 1']
    const params = []
    const add = (v) => {
      params.push(v)
      return `$${params.length}`
    }
    if (status) where.push(`s.status = ${add(status)}::subscription_status`)
    if (plan) where.push(`s.plan_key = ${add(plan)}`)

    const clause = `WHERE ${where.join(' AND ')}`
    const total = await one(`SELECT count(*)::int AS n FROM subscriptions s ${clause}`, params)
    const rows = await many(
      `SELECT s.*, c.legal_name, c.trading_name, p.name AS plan_name, p.price_cents, p.currency, p.interval
         FROM subscriptions s
         JOIN companies c ON c.id = s.company_id
         JOIN plans p ON p.key = s.plan_key
       ${clause}
       ORDER BY s.created_at DESC LIMIT ${add(limit)} OFFSET ${add(offset)}`,
      params,
    )

    page(
      res,
      rows.map((s) => ({
        id: s.id,
        company: { id: s.company_id, name: s.trading_name || s.legal_name },
        ...presentSubscription(s, effectiveStatus(s)),
      })),
      { total: total.n, limit, offset },
    )
  }),
)

/* ---------------------------------- plans ---------------------------------- */

router.get(
  '/plans',
  asyncHandler(async (_req, res) => {
    const [plans, features] = await Promise.all([
      many('SELECT * FROM plans ORDER BY sort_order'),
      many('SELECT plan_key, feature, enabled FROM plan_features'),
    ])
    const byPlan = features.reduce((acc, f) => {
      ;(acc[f.plan_key] ??= []).push({ key: f.feature, enabled: f.enabled })
      return acc
    }, {})
    ok(res, {
      plans: plans.map((p) => ({
        key: p.key,
        name: p.name,
        description: p.description,
        price: p.price_cents === null ? null : p.price_cents / 100,
        priceCents: p.price_cents,
        currency: p.currency,
        interval: p.interval,
        trialDays: p.trial_days,
        enabled: p.enabled,
        highlighted: p.highlighted,
        checkoutAvailable: Boolean(p.provider_price_id),
        features: byPlan[p.key] ?? [],
      })),
    })
  }),
)

/**
 * Changing a plan.
 *
 * super_admin only: a price is what customers are charged, and it should take
 * more than an ordinary console login to move it. Prices arrive as minor units
 * so nothing is ever rounded on the way in.
 */
router.patch(
  '/plans/:key',
  requireRole('super_admin'),
  validateBody(z.object({
    name: z.string().trim().min(1).max(80).optional(),
    description: z.string().trim().max(500).nullish(),
    priceCents: z.number().int().min(0).max(100000000).nullable().optional(),
    currency: z.string().length(3).optional(),
    interval: z.enum(['month', 'year']).nullable().optional(),
    trialDays: z.number().int().min(0).max(365).optional(),
    enabled: z.boolean().optional(),
    highlighted: z.boolean().optional(),
  }).strict()),
  asyncHandler(async (req, res) => {
    const COLUMNS = {
      name: 'name', description: 'description', priceCents: 'price_cents', currency: 'currency',
      interval: 'interval', trialDays: 'trial_days', enabled: 'enabled', highlighted: 'highlighted',
    }
    const entries = Object.entries(req.body).filter(([k]) => COLUMNS[k])
    if (!entries.length) throw notFound('nothing_to_update', 'No changes supplied')

    const sets = entries.map(([k], i) =>
      k === 'interval' ? `${COLUMNS[k]} = $${i + 2}::billing_interval` : `${COLUMNS[k]} = $${i + 2}`)
    const plan = await one(
      `UPDATE plans SET ${sets.join(', ')} WHERE key = $1 RETURNING *`,
      [req.params.key, ...entries.map(([, v]) => v)],
    )
    if (!plan) throw notFound('plan_not_found', 'Not found')

    await audit(req, {
      action: 'admin.plan_changed',
      entityType: 'plan',
      entityId: null,
      metadata: { plan: plan.key, fields: entries.map(([k]) => k) },
    })
    ok(res, { plan: { key: plan.key, priceCents: plan.price_cents, enabled: plan.enabled } })
  }),
)

/* --------------------------------- requests -------------------------------- */

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
    const where = ['1 = 1']
    const params = []
    const add = (v) => {
      params.push(v)
      return `$${params.length}`
    }
    if (type) where.push(`r.type = ${add(type)}::request_type`)
    if (status) where.push(`r.status = ${add(status)}::request_status`)

    const clause = `WHERE ${where.join(' AND ')}`
    const total = await one(`SELECT count(*)::int AS n FROM recruitment_requests r ${clause}`, params)
    const rows = await many(
      `SELECT r.id, r.type, r.status, r.created_at, r.responded_at,
              c.legal_name, c.trading_name,
              p.reference AS candidate_reference,
              u.full_name AS recruiter_name
         FROM recruitment_requests r
         JOIN companies c ON c.id = r.company_id
         JOIN candidate_profiles p ON p.user_id = r.candidate_id
         LEFT JOIN users u ON u.id = r.recruiter_id
       ${clause}
       ORDER BY r.created_at DESC LIMIT ${add(limit)} OFFSET ${add(offset)}`,
      params,
    )

    page(
      res,
      rows.map((r) => ({
        id: r.id,
        type: r.type,
        status: r.status,
        createdAt: r.created_at,
        respondedAt: r.responded_at,
        company: { name: r.trading_name || r.legal_name },
        recruiter: r.recruiter_name ?? null,
        // The reference, never the name.
        candidateReference: r.candidate_reference,
      })),
      { total: total.n, limit, offset },
    )
  }),
)

export default router
