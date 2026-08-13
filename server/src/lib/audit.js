import { query } from '../db/pool.js'
import { logger } from './logger.js'

/**
 * Append-only audit trail.
 *
 * Every state change that touches candidate data goes through here — the SRS
 * asks for full audit logging, and a recruitment platform handling CVs has to
 * be able to answer "who looked at this profile, and when".
 *
 * Deliberately never throws: an audit write failing must not roll back the
 * action the user actually asked for. It is logged loudly instead.
 */
export const audit = async (req, { action, entityType, entityId, metadata = {}, actorId, actorRole }) => {
  try {
    await query(
      `INSERT INTO audit_log (actor_id, actor_role, action, entity_type, entity_id, ip, user_agent, metadata)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
      [
        actorId ?? req?.user?.id ?? null,
        actorRole ?? req?.user?.role ?? null,
        action,
        entityType ?? null,
        entityId ? String(entityId) : null,
        clientIp(req),
        req?.get?.('user-agent')?.slice(0, 500) ?? null,
        metadata,
      ],
    )
  } catch (err) {
    logger.error('audit write failed', { action, message: err.message })
  }
}

/**
 * Behind nginx, req.ip is the proxy unless trust proxy is set (it is, in
 * app.js). Falls back through the header for completeness and returns null
 * rather than a bad value, because the column is inet-typed.
 */
export const clientIp = (req) => {
  const raw =
    req?.ip ||
    req?.headers?.['x-forwarded-for']?.split(',')[0]?.trim() ||
    req?.socket?.remoteAddress ||
    ''
  const cleaned = raw.replace(/^::ffff:/, '')
  return cleaned && cleaned !== '::1' ? cleaned : cleaned === '::1' ? '127.0.0.1' : null
}
