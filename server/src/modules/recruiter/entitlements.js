import { many, one, query } from '../../db/pool.js'

/**
 * What a company is allowed to do, decided here and nowhere else.
 *
 * The portal receives a map of feature → boolean and renders from it. It never
 * works the map out from the plan name, and neither does any route handler:
 * every check goes through `can()` so that changing what Professional includes
 * is a row in plan_features rather than a search through the codebase.
 *
 * Two rules this file exists to enforce:
 *
 *   1. A trial that has run out grants nothing, even if the sweeper has not
 *      run yet. Status is derived from the timestamps at read time and the
 *      stored status is only a cache of that. A subscription row that still
 *      says 'trialing' three days after trial_end must not open a single door.
 *
 *   2. An entitlement is never the whole answer for anything involving a
 *      person's identity. `enhanced_profiles` says the plan permits richer
 *      data; whether this candidate agreed is a separate question asked
 *      separately, in candidateAccess.js.
 */

/** No company, no subscription, nothing enabled. The safe default. */
const NOTHING = Object.freeze({})

/**
 * The live status, worked out from the clock rather than trusted from the row.
 *
 * `expired` is returned for a trial past its end date whatever the column says.
 */
export const effectiveStatus = (sub, now = new Date()) => {
  if (!sub) return 'expired'
  if (sub.status === 'cancelled') return 'cancelled'
  if (sub.status === 'trialing') {
    if (sub.trial_end && new Date(sub.trial_end) <= now) return 'expired'
    return 'trialing'
  }
  if (sub.status === 'active' || sub.status === 'past_due') {
    // A paid period that has run out without renewing is expired, not active.
    if (sub.current_period_end && new Date(sub.current_period_end) <= now) return 'expired'
    return sub.status
  }
  return sub.status
}

/** Statuses that entitle anything at all. `past_due` keeps access briefly — the
 *  provider retries a card for days, and locking a paying customer out on the
 *  first failed charge is a support ticket, not a policy. */
const GRANTING = new Set(['trialing', 'active', 'past_due'])

/** The company's current subscription row, or null. */
export const currentSubscription = (companyId) =>
  one(
    `SELECT s.*, p.name AS plan_name, p.price_cents, p.currency, p.interval, p.trial_days
       FROM subscriptions s
       JOIN plans p ON p.key = s.plan_key
      WHERE s.company_id = $1
      ORDER BY (s.status IN ('trialing','active','past_due')) DESC, s.created_at DESC
      LIMIT 1`,
    [companyId],
  )

/**
 * The feature map for a company.
 *
 * Reads the plan's rows and gates the whole thing on the subscription actually
 * granting anything right now. An expired trial returns an empty map, not the
 * trial's features.
 */
export const entitlementsFor = async (companyId, { subscription } = {}) => {
  const sub = subscription ?? (await currentSubscription(companyId))
  const status = effectiveStatus(sub)

  if (!sub || !GRANTING.has(status)) return { features: NOTHING, subscription: sub, status }

  const rows = await many(
    'SELECT feature, enabled, limit_value FROM plan_features WHERE plan_key = $1',
    [sub.plan_key],
  )
  const features = Object.fromEntries(rows.filter((r) => r.enabled).map((r) => [r.feature, true]))
  const limits = Object.fromEntries(
    rows.filter((r) => r.limit_value !== null).map((r) => [r.feature, r.limit_value]),
  )
  return { features, limits, subscription: sub, status }
}

/**
 * Whether one feature is held.
 *
 * Unknown means no. A feature nobody has granted is one the platform must not
 * offer, and defaulting the other way turns a typo into a privilege.
 */
export const can = (entitlements, feature) => entitlements?.features?.[feature] === true

/**
 * Starts a company on the trial plan.
 *
 * The length comes from the plan row, so changing the trial is an UPDATE. A
 * plan with trial_days = 0 produces a trial that has already ended, which is
 * the correct reading of "no trial" rather than an unbounded one.
 */
export const startTrial = async (client, companyId, planKey = 'trial') => {
  const plan = await one('SELECT key, trial_days FROM plans WHERE key = $1 AND enabled', [planKey])
  if (!plan) throw new Error(`plan not found: ${planKey}`)

  const now = new Date()
  const end = new Date(now.getTime() + plan.trial_days * 86400000)

  const runner = client ?? { query }
  const { rows } = await runner.query(
    `INSERT INTO subscriptions
       (company_id, plan_key, status, trial_start, trial_end, started_at)
     VALUES ($1, $2, 'trialing', $3, $4, $3)
     RETURNING *`,
    [companyId, plan.key, now, end],
  )
  return rows[0]
}

/**
 * Marks run-out trials and lapsed periods as expired.
 *
 * Only ever a tidy-up: entitlementsFor already treats them as expired, so the
 * sweeper failing to run is a reporting inaccuracy and never an access one.
 * Run from the existing job worker rather than a second scheduler.
 */
export const expireLapsedSubscriptions = async () => {
  const { rowCount: trials } = await query(
    `UPDATE subscriptions SET status = 'expired'
      WHERE status = 'trialing' AND trial_end IS NOT NULL AND trial_end <= now()`,
  )
  const { rowCount: periods } = await query(
    `UPDATE subscriptions SET status = 'expired'
      WHERE status IN ('active', 'past_due')
        AND current_period_end IS NOT NULL
        AND current_period_end <= now() - interval '3 days'
        AND cancel_at_period_end`,
  )
  return { trials, periods }
}

/** The shape the portal reads. Timestamps, never a computed countdown — the
 *  browser can subtract, and a number computed here goes stale in the tab. */
export const presentSubscription = (sub, status) => {
  if (!sub) return null
  return {
    plan: sub.plan_key,
    planName: sub.plan_name,
    status: status ?? effectiveStatus(sub),
    price: sub.price_cents === null || sub.price_cents === undefined ? null : sub.price_cents / 100,
    currency: sub.currency,
    interval: sub.interval,
    trialStartedAt: sub.trial_start,
    trialEndsAt: sub.trial_end,
    startedAt: sub.started_at,
    currentPeriodEnd: sub.current_period_end,
    renewsAt: sub.cancel_at_period_end ? null : sub.current_period_end,
    cancelAtPeriodEnd: sub.cancel_at_period_end,
    cancelledAt: sub.cancelled_at,
  }
}
