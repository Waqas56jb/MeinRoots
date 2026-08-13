import config from '../../config.js'
import { one, query, transaction } from '../../db/pool.js'
import { conflict, unauthorized } from '../../lib/errors.js'
import { burnPasswordTime, hashPassword, verifyPassword } from '../../lib/password.js'
import { hashToken, newOpaqueToken, signAccessToken } from '../../lib/tokens.js'
import { clientIp } from '../../lib/audit.js'
import { logger } from '../../lib/logger.js'

/** The shape of a user the browser is allowed to see. Never includes the hash. */
export const publicUser = (row) => ({
  id: row.id,
  name: row.full_name,
  email: row.email,
  role: row.role,
  locale: row.locale,
  goals: row.goals ?? [],
  createdAt: row.created_at,
})

const refreshExpiry = () => {
  const d = new Date()
  d.setDate(d.getDate() + config.jwt.refreshTtlDays)
  return d
}

export const createSession = async (user, req) => {
  const { token, hash } = newOpaqueToken()
  await query(
    `INSERT INTO sessions (user_id, token_hash, user_agent, ip, expires_at)
     VALUES ($1, $2, $3, $4, $5)`,
    [user.id, hash, req?.get?.('user-agent')?.slice(0, 500) ?? null, clientIp(req), refreshExpiry()],
  )
  return { accessToken: signAccessToken(user), refreshToken: token }
}

export const register = async ({ name, email, password, goals, locale, gdprConsent }, req) => {
  const existing = await one('SELECT id FROM users WHERE email = $1 AND deleted_at IS NULL', [email])
  if (existing) throw conflict('email_taken', 'An account with this email already exists')

  const passwordHash = await hashPassword(password)

  const user = await transaction(async (client) => {
    const { rows } = await client.query(
      `INSERT INTO users (full_name, email, password_hash, goals, locale, gdpr_consent_at)
       VALUES ($1, $2, $3, $4::work_goal[], $5, $6)
       RETURNING *`,
      [name, email, passwordHash, goals, locale, gdprConsent ? new Date() : null],
    )
    const created = rows[0]
    // The profile row exists from minute one so the dashboard has something to
    // read before any CV is uploaded — an empty profile is a valid state.
    await client.query('INSERT INTO candidate_profiles (user_id) VALUES ($1)', [created.id])
    return created
  })

  const tokens = await createSession(user, req)
  return { user: publicUser(user), ...tokens }
}

export const login = async ({ email, password }, req) => {
  const user = await one('SELECT * FROM users WHERE email = $1 AND deleted_at IS NULL', [email])

  // Same error for "no such account" and "wrong password" — telling them apart
  // turns the login form into an account-enumeration oracle.
  const invalid = unauthorized('invalid_credentials', 'Email or password is incorrect')

  if (!user) {
    await burnPasswordTime(password)
    throw invalid
  }

  if (user.locked_until && new Date(user.locked_until) > new Date()) {
    throw unauthorized('account_locked', 'Too many failed attempts — try again shortly')
  }

  const okPassword = await verifyPassword(password, user.password_hash)
  if (!okPassword) {
    const attempts = user.failed_logins + 1
    const lock =
      attempts >= config.security.maxFailedLogins
        ? new Date(Date.now() + config.security.lockMinutes * 60000)
        : null
    await query('UPDATE users SET failed_logins = $2, locked_until = $3 WHERE id = $1', [
      user.id,
      lock ? 0 : attempts,
      lock,
    ])
    throw invalid
  }

  await query('UPDATE users SET failed_logins = 0, locked_until = NULL, last_login_at = now() WHERE id = $1', [
    user.id,
  ])

  const tokens = await createSession(user, req)
  return { user: publicUser(user), ...tokens }
}

/**
 * Refresh rotates: the presented token is revoked and a new one issued. A
 * stolen refresh token is therefore usable at most once, and the legitimate
 * user's next refresh fails loudly instead of silently sharing the session.
 */
export const refresh = async (refreshToken, req) => {
  if (!refreshToken) throw unauthorized('no_session', 'No session')

  const session = await one(
    `SELECT s.*, u.id AS user_id, u.role
       FROM sessions s
       JOIN users u ON u.id = s.user_id AND u.deleted_at IS NULL
      WHERE s.token_hash = $1`,
    [hashToken(refreshToken)],
  )

  if (!session || session.revoked_at || new Date(session.expires_at) < new Date()) {
    throw unauthorized('session_expired', 'Session expired')
  }

  const user = await one('SELECT * FROM users WHERE id = $1', [session.user_id])
  await query('UPDATE sessions SET revoked_at = now() WHERE id = $1', [session.id])
  const tokens = await createSession(user, req)
  return { user: publicUser(user), ...tokens }
}

export const logout = async (refreshToken) => {
  if (!refreshToken) return
  await query('UPDATE sessions SET revoked_at = now() WHERE token_hash = $1 AND revoked_at IS NULL', [
    hashToken(refreshToken),
  ])
}

export const logoutEverywhere = (userId) =>
  query('UPDATE sessions SET revoked_at = now() WHERE user_id = $1 AND revoked_at IS NULL', [userId])

/**
 * Always reports success to the caller. Whether a reset mail was actually sent
 * is not the requester's business — otherwise this endpoint lists which
 * addresses hold accounts.
 */
export const requestPasswordReset = async (email) => {
  const user = await one('SELECT id, full_name, email FROM users WHERE email = $1 AND deleted_at IS NULL', [
    email,
  ])
  if (!user) return { sent: false }

  const { token, hash } = newOpaqueToken()
  const expires = new Date(Date.now() + config.security.resetTtlMinutes * 60000)
  await query('INSERT INTO password_resets (user_id, token_hash, expires_at) VALUES ($1, $2, $3)', [
    user.id,
    hash,
    expires,
  ])

  const link = `${config.appUrl}/reset-password?token=${token}`
  // No mail transport is configured in Milestone 1 — the link is logged so it
  // can be delivered by hand during testing. Wiring an SMTP sender here is the
  // only change needed to make this real.
  logger.info('password reset requested', { email: user.email, link })
  return { sent: true, link: config.isProd ? undefined : link }
}

export const resetPassword = async ({ token, password }) => {
  const record = await one(
    `SELECT * FROM password_resets
      WHERE token_hash = $1 AND used_at IS NULL AND expires_at > now()`,
    [hashToken(token)],
  )
  if (!record) throw unauthorized('reset_invalid', 'This reset link is invalid or has expired')

  const passwordHash = await hashPassword(password)
  await transaction(async (client) => {
    await client.query('UPDATE users SET password_hash = $2 WHERE id = $1', [record.user_id, passwordHash])
    await client.query('UPDATE password_resets SET used_at = now() WHERE id = $1', [record.id])
    // A password change ends every other session — that is the point of
    // resetting after a suspected compromise.
    await client.query('UPDATE sessions SET revoked_at = now() WHERE user_id = $1 AND revoked_at IS NULL', [
      record.user_id,
    ])
  })
  return { userId: record.user_id }
}

export const updateGoals = async (userId, goals) => {
  const row = await one(
    'UPDATE users SET goals = $2::work_goal[] WHERE id = $1 RETURNING *',
    [userId, goals],
  )
  return publicUser(row)
}

export const updateLocale = (userId, locale) =>
  query('UPDATE users SET locale = $2 WHERE id = $1', [userId, locale])
