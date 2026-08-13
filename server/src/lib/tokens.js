import { createHash, randomBytes, timingSafeEqual } from 'node:crypto'
import jwt from 'jsonwebtoken'
import config from '../config.js'

/** Short-lived access token. Carries only what middleware needs — no PII. */
export const signAccessToken = (user) =>
  jwt.sign({ sub: user.id, role: user.role }, config.jwt.secret, {
    expiresIn: config.jwt.accessTtl,
    issuer: 'meinroots',
  })

export const verifyAccessToken = (token) =>
  jwt.verify(token, config.jwt.secret, { issuer: 'meinroots' })

/**
 * Opaque refresh / reset tokens.
 *
 * Only the sha256 is stored. A database dump therefore cannot be replayed as a
 * set of live sessions, which is the whole reason not to store the raw value.
 */
export const newOpaqueToken = () => {
  const token = randomBytes(32).toString('base64url')
  return { token, hash: hashToken(token) }
}

export const hashToken = (token) => createHash('sha256').update(token).digest('hex')

/** Constant-time compare for anything an attacker can guess at repeatedly. */
export const safeEqual = (a, b) => {
  const bufA = Buffer.from(String(a))
  const bufB = Buffer.from(String(b))
  if (bufA.length !== bufB.length) return false
  return timingSafeEqual(bufA, bufB)
}
