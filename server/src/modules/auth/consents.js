import { many, query } from '../../db/pool.js'
import { clientIp } from '../../lib/audit.js'
import { ALL_CONSENTS, OPTIONAL_CONSENTS, TERMS_VERSION } from '../../lib/legal.js'

/**
 * Reading and writing the consent log.
 *
 * Every function here appends. Nothing updates a row and nothing deletes one:
 * the table is the evidence that a person agreed, and evidence that can be
 * edited is not evidence. A withdrawal is a new row saying granted = false, so
 * the record still shows that consent was once given and when it ended.
 */

/**
 * Writes one row per decision.
 *
 * All six are always written, including the ones that were declined — an
 * explicit "no" is a fact worth holding. Six months later "we have no record"
 * and "they said no on 14 August" are very different answers to give a
 * regulator, and only one of them is true.
 *
 * Takes a client so it can join the transaction that creates the user; a
 * consent row for a user that failed to be created is not a state worth having.
 */
export const recordConsents = async (client, { userId, consents, source, req }) => {
  const runner = client ?? { query }
  const ip = clientIp(req)
  const agent = req?.get?.('user-agent')?.slice(0, 500) ?? null

  for (const type of ALL_CONSENTS) {
    await runner.query(
      `INSERT INTO user_consents (user_id, type, granted, doc_version, source, ip, user_agent)
       VALUES ($1, $2::consent_type, $3, $4, $5, $6, $7)`,
      [userId, type, Boolean(consents[type]), TERMS_VERSION, source, ip, agent],
    )
  }
}

/**
 * Appends only the optional decisions that actually changed.
 *
 * Re-recording an unchanged choice would fill the log with rows that prove
 * nothing and bury the moments that matter. The required three are not
 * writable here at all: withdrawing them is not a settings toggle, it is
 * closing the account, and that route already exists.
 */
export const updateOptionalConsents = async ({ userId, consents, req }) => {
  const current = await currentConsents(userId)
  const changed = OPTIONAL_CONSENTS.filter(
    (type) => consents[type] !== undefined && Boolean(consents[type]) !== Boolean(current[type]?.granted),
  )
  if (!changed.length) return { changed: [] }

  const ip = clientIp(req)
  const agent = req?.get?.('user-agent')?.slice(0, 500) ?? null

  for (const type of changed) {
    await query(
      `INSERT INTO user_consents (user_id, type, granted, doc_version, source, ip, user_agent)
       VALUES ($1, $2::consent_type, $3, $4, 'settings', $5, $6)`,
      [userId, type, Boolean(consents[type]), TERMS_VERSION, ip, agent],
    )
  }
  return { changed }
}

/**
 * Current state: the newest row per type.
 *
 * DISTINCT ON with a matching ORDER BY is what makes this one index scan rather
 * than a group-and-max over the whole history.
 */
export const currentConsents = async (userId) => {
  const rows = await many(
    `SELECT DISTINCT ON (type) type, granted, doc_version, source, created_at
       FROM user_consents
      WHERE user_id = $1
      ORDER BY type, created_at DESC`,
    [userId],
  )
  return Object.fromEntries(rows.map((r) => [r.type, r]))
}

/** The shape the browser sees: a plain map of type → boolean, plus the version. */
export const presentConsents = (current) => ({
  ...Object.fromEntries(ALL_CONSENTS.map((type) => [type, Boolean(current[type]?.granted)])),
  acceptedVersion: current.terms?.doc_version ?? null,
  acceptedAt: current.terms?.created_at ?? null,
})

/**
 * Whether one specific permission is currently held.
 *
 * Used for employer sharing, which is the one optional consent that gates
 * something rather than only being recorded.
 */
export const hasConsent = async (userId, type) => {
  const rows = await many(
    `SELECT granted FROM user_consents
      WHERE user_id = $1 AND type = $2::consent_type
      ORDER BY created_at DESC LIMIT 1`,
    [userId, type],
  )
  return Boolean(rows[0]?.granted)
}

/** The full history for one candidate, newest first — what the console shows. */
export const consentHistory = async (userId) =>
  many(
    `SELECT type, granted, doc_version, source, created_at
       FROM user_consents WHERE user_id = $1
      ORDER BY created_at DESC`,
    [userId],
  )
