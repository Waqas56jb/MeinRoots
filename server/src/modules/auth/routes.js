import { Router } from 'express'
import config from '../../config.js'
import { asyncHandler } from '../../lib/errors.js'
import { created, noContent, ok } from '../../lib/http.js'
import { audit } from '../../lib/audit.js'
import {
  emailField,
  goalsField,
  localeField,
  passwordField,
  validateBody,
  z,
} from '../../lib/validate.js'
import { requireAuth } from '../../middleware/auth.js'
import { authLimiter } from '../../middleware/rateLimit.js'
import * as service from './service.js'

const router = Router()

// ------------------------------- cookies ------------------------------------

const baseCookie = {
  httpOnly: true,
  secure: config.cookie.secure,
  sameSite: config.cookie.sameSite,
  path: '/',
  ...(config.cookie.domain ? { domain: config.cookie.domain } : {}),
}

/**
 * Both tokens are httpOnly cookies, so no script — including an injected one —
 * can read them. The refresh cookie outlives the access cookie; the front end
 * calls /auth/refresh when a request comes back 401.
 */
const setAuthCookies = (res, { accessToken, refreshToken }) => {
  res.cookie(config.cookie.accessName, accessToken, { ...baseCookie, maxAge: 20 * 60 * 1000 })
  res.cookie(config.cookie.name, refreshToken, {
    ...baseCookie,
    maxAge: config.jwt.refreshTtlDays * 24 * 60 * 60 * 1000,
  })
}

const clearAuthCookies = (res) => {
  res.clearCookie(config.cookie.accessName, baseCookie)
  res.clearCookie(config.cookie.name, baseCookie)
}

// ------------------------------- schemas ------------------------------------

const registerSchema = z.object({
  name: z.string().trim().min(1, 'name_required').max(120),
  email: emailField,
  password: passwordField,
  goals: goalsField,
  locale: localeField.default('en'),
  // The CV cannot lawfully be processed without this, so it is required rather
  // than optional-with-a-default.
  gdprConsent: z.literal(true, { errorMap: () => ({ message: 'consent_required' }) }),
})

const loginSchema = z.object({ email: emailField, password: z.string().min(1, 'password_required') })
const resetRequestSchema = z.object({ email: emailField })
const resetSchema = z.object({ token: z.string().min(10, 'reset_invalid'), password: passwordField })
const goalsSchema = z.object({ goals: goalsField })
const localeSchema = z.object({ locale: localeField })

// -------------------------------- routes ------------------------------------

router.post(
  '/register',
  authLimiter,
  validateBody(registerSchema),
  asyncHandler(async (req, res) => {
    const result = await service.register(req.body, req)
    setAuthCookies(res, result)
    await audit(req, {
      action: 'auth.register',
      entityType: 'user',
      entityId: result.user.id,
      actorId: result.user.id,
      actorRole: result.user.role,
      metadata: { goals: result.user.goals },
    })
    created(res, { user: result.user })
  }),
)

router.post(
  '/login',
  authLimiter,
  validateBody(loginSchema),
  asyncHandler(async (req, res) => {
    const result = await service.login(req.body, req)
    setAuthCookies(res, result)
    await audit(req, {
      action: 'auth.login',
      entityType: 'user',
      entityId: result.user.id,
      actorId: result.user.id,
      actorRole: result.user.role,
    })
    ok(res, { user: result.user })
  }),
)

router.post(
  '/refresh',
  asyncHandler(async (req, res) => {
    const result = await service.refresh(req.cookies?.[config.cookie.name], req)
    setAuthCookies(res, result)
    ok(res, { user: result.user })
  }),
)

router.post(
  '/logout',
  asyncHandler(async (req, res) => {
    await service.logout(req.cookies?.[config.cookie.name])
    clearAuthCookies(res)
    if (req.user) await audit(req, { action: 'auth.logout', entityType: 'user', entityId: req.user.id })
    noContent(res)
  }),
)

router.get(
  '/me',
  requireAuth,
  asyncHandler(async (req, res) => {
    ok(res, { user: service.publicUser({ ...req.user, full_name: req.user.full_name }) })
  }),
)

router.post(
  '/email/verify',
  authLimiter,
  validateBody(z.object({ token: z.string().min(10, 'verification_invalid') })),
  asyncHandler(async (req, res) => {
    const { user } = await service.verifyEmail(req.body.token)
    await audit(req, {
      action: 'auth.email_verified',
      entityType: 'user',
      entityId: user.id,
      actorId: user.id,
    })
    ok(res, { user })
  }),
)

/**
 * Re-sends the verification link.
 *
 * Requires a session rather than taking an address, so it cannot be used to
 * discover which addresses hold accounts, or to send mail to a stranger.
 */
router.post(
  '/email/verify/resend',
  requireAuth,
  authLimiter,
  asyncHandler(async (req, res) => {
    if (req.user.email_verified_at) {
      return ok(res, { alreadyVerified: true })
    }
    await service.sendVerificationEmail(req.user)
    await audit(req, { action: 'auth.verification_resent', entityType: 'user', entityId: req.user.id })
    return ok(res, { sent: true })
  }),
)

router.patch(
  '/notifications',
  requireAuth,
  validateBody(z.object({ notifyByEmail: z.boolean() })),
  asyncHandler(async (req, res) => {
    const user = await service.updateNotifications(req.user.id, req.body.notifyByEmail)
    ok(res, { user })
  }),
)

router.post(
  '/password/reset-request',
  authLimiter,
  validateBody(resetRequestSchema),
  asyncHandler(async (req, res) => {
    const result = await service.requestPasswordReset(req.body.email)
    await audit(req, { action: 'auth.reset_request', entityType: 'email', entityId: req.body.email })
    // Identical response either way — see the service comment.
    ok(res, { sent: true, ...(result.link ? { devLink: result.link } : {}) })
  }),
)

router.post(
  '/password/reset',
  authLimiter,
  validateBody(resetSchema),
  asyncHandler(async (req, res) => {
    const { userId } = await service.resetPassword(req.body)
    clearAuthCookies(res)
    await audit(req, { action: 'auth.reset_complete', entityType: 'user', entityId: userId, actorId: userId })
    ok(res, { reset: true })
  }),
)

router.patch(
  '/goals',
  requireAuth,
  validateBody(goalsSchema),
  asyncHandler(async (req, res) => {
    const user = await service.updateGoals(req.user.id, req.body.goals)
    await audit(req, {
      action: 'auth.goals_updated',
      entityType: 'user',
      entityId: req.user.id,
      metadata: { goals: req.body.goals },
    })
    ok(res, { user })
  }),
)

router.patch(
  '/locale',
  requireAuth,
  validateBody(localeSchema),
  asyncHandler(async (req, res) => {
    await service.updateLocale(req.user.id, req.body.locale)
    ok(res, { locale: req.body.locale })
  }),
)

export default router
