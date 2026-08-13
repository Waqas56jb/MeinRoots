import rateLimit from 'express-rate-limit'

const json = (code, message) => (req, res) => res.status(429).json({ error: { code, message } })

/** Everything else — generous, only there to blunt scripted abuse. */
export const generalLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 120,
  standardHeaders: true,
  legacyHeaders: false,
  handler: json('rate_limited', 'Too many requests — slow down'),
})

/**
 * Login and password reset. Tight, because these are the endpoints worth
 * brute-forcing. Keyed by IP + email so one attacker cannot lock out every
 * account from a single address, and so a shared office IP does not lock out
 * innocent colleagues.
 */
export const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 20,
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req) => `${req.ip}:${String(req.body?.email || '').toLowerCase()}`,
  handler: json('too_many_attempts', 'Too many attempts — try again in a few minutes'),
})

/** Analysis costs real OpenAI money per call, so uploads get their own budget. */
export const uploadLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req) => req.user?.id || req.ip,
  handler: json('upload_rate_limited', 'Upload limit reached — try again later'),
})
