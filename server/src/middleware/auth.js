import config from '../config.js'
import { one } from '../db/pool.js'
import { forbidden, unauthorized } from '../lib/errors.js'
import { verifyAccessToken } from '../lib/tokens.js'

/**
 * Reads the access token from the httpOnly cookie, falling back to a bearer
 * header.
 *
 * The cookie is what the browser uses. The header exists for curl, the smoke
 * test and any future mobile client — same token, different transport.
 */
const readToken = (req) => {
  const fromCookie = req.cookies?.[config.cookie.accessName]
  if (fromCookie) return fromCookie
  const header = req.get('authorization')
  if (header?.startsWith('Bearer ')) return header.slice(7)
  return null
}

/**
 * Populates req.user when a valid token is present, and does nothing when it
 * is not. Use for endpoints that behave differently for signed-in visitors but
 * are not restricted.
 */
export const attachUser = async (req, _res, next) => {
  const token = readToken(req)
  if (!token) return next()
  try {
    const payload = verifyAccessToken(token)
    // Re-read the row rather than trusting the token's claims: a role change or
    // a deletion must take effect immediately, not when the token expires.
    const user = await one(
      `SELECT id, full_name, email, role, locale, goals, gdpr_consent_at,
              email_verified_at, notify_by_email, created_at
         FROM users WHERE id = $1 AND deleted_at IS NULL`,
      [payload.sub],
    )
    if (user) req.user = user
  } catch {
    // expired or tampered — treated as anonymous
  }
  return next()
}

export const requireAuth = (req, _res, next) => {
  if (!req.user) return next(unauthorized('unauthorized', 'Sign in to continue'))
  return next()
}

/** requireRole('admin') also admits super_admin — it is strictly more powerful. */
export const requireRole =
  (...roles) =>
  (req, _res, next) => {
    if (!req.user) return next(unauthorized())
    const allowed = new Set(roles)
    if (allowed.has('admin')) allowed.add('super_admin')
    if (!allowed.has(req.user.role)) return next(forbidden('forbidden', 'Insufficient role'))
    return next()
  }
