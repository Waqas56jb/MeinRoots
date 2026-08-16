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
import { TERMS_VERSION } from '../../lib/legal.js'
import { currentConsents, presentConsents, updateOptionalConsents } from './consents.js'
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
/**
 * The one place that knows how an auth cookie is shaped.
 *
 * Exported because recruiter registration also has to open a session, and a
 * second copy of this is a second thing to get wrong — which it duly was:
 * the copy read a config key that does not exist and set maxAge to NaN.
 */
export const setAuthCookies = (res, { accessToken, refreshToken }) => {
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

/**
 * The six decisions the registration form collects.
 *
 * The three required ones are `z.literal(true)` — the request is rejected, not
 * silently coerced, if any is missing. The three optional ones default to
 * false: an omitted optional consent is a refusal, never an assumption, and a
 * client that forgets to send one must not thereby opt a person in.
 */
const consentsSchema = z.object({
  terms: z.literal(true, { errorMap: () => ({ message: 'consent_required' }) }),
  privacy: z.literal(true, { errorMap: () => ({ message: 'consent_required' }) }),
  data_processing: z.literal(true, { errorMap: () => ({ message: 'consent_required' }) }),
  // employer_sharing is still accepted so an older client build does not start
  // failing validation, but the value is ignored: the server derives it from
  // the terms. A field the caller cannot influence is safer than one it can.
  employer_sharing: z.boolean().optional(),
  job_alerts: z.boolean().default(false),
  marketing: z.boolean().default(false),
})

const registerSchema = z.object({
  name: z.string().trim().min(1, 'name_required').max(120),
  email: emailField,
  password: passwordField,
  goals: goalsField,
  locale: localeField.default('en'),
  consents: consentsSchema,
})

/**
 * Only the optional three are writable after signup.
 *
 * `.strict()` rather than the default, which silently drops unknown keys. If a
 * client sends `{ terms: false }` believing it is withdrawing acceptance of the
 * terms, the worst possible answer is 200 and no change: the caller walks away
 * thinking it worked. It is refused loudly instead — withdrawing a required
 * consent means closing the account, and that is a different endpoint.
 */
const optionalConsentsSchema = z
  .object({
    employer_sharing: z.boolean().optional(),
    job_alerts: z.boolean().optional(),
    marketing: z.boolean().optional(),
  })
  .strict()

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
      // The optional answers and the document version go in the audit trail as
      // well as the consent table. Two independent records of the same fact is
      // the point: one of them can be produced without the other being trusted.
      metadata: {
        goals: result.user.goals,
        termsVersion: TERMS_VERSION,
        optionalConsents: {
          job_alerts: Boolean(req.body.consents.job_alerts),
          marketing: Boolean(req.body.consents.marketing),
        },
        // Recorded separately because it is no longer something the candidate
        // ticked: it came with the terms, and the log should say which.
        employerSharingVia: 'terms',
      },
    })
    const current = await currentConsents(result.user.id)
    created(res, {
      user: { ...result.user, consents: presentConsents(current), termsVersion: TERMS_VERSION },
    })
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
    const current = await currentConsents(req.user.id)
    ok(res, {
      user: {
        ...service.publicUser({ ...req.user, full_name: req.user.full_name }),
        consents: presentConsents(current),
        // The client compares this with what it holds to know whether a
        // re-acceptance is due after the document changes.
        termsVersion: TERMS_VERSION,
      },
    })
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

router.post(
  '/password/change',
  requireAuth,
  authLimiter,
  validateBody(
    z.object({
      currentPassword: z.string().min(1, 'password_required'),
      newPassword: passwordField,
    }),
  ),
  asyncHandler(async (req, res) => {
    await service.changePassword({ userId: req.user.id, ...req.body })
    // The candidate's own session was revoked with the rest; give them a new
    // one so changing a password does not silently sign them out.
    const tokens = await service.createSession(req.user, req)
    setAuthCookies(res, tokens)
    await audit(req, { action: 'auth.password_changed', entityType: 'user', entityId: req.user.id })
    ok(res, { changed: true })
  }),
)

/** Self-service GDPR erasure. Irreversible, so it asks for the password. */
router.delete(
  '/account',
  requireAuth,
  authLimiter,
  validateBody(z.object({ password: z.string().min(1, 'password_required') })),
  asyncHandler(async (req, res) => {
    const { id, role } = req.user
    await service.deleteAccount({ userId: id, password: req.body.password })
    clearAuthCookies(res)
    await audit(req, {
      action: 'auth.account_deleted',
      entityType: 'user',
      entityId: id,
      actorId: null, // the actor no longer exists; the entity id is the record
      actorRole: role,
    })
    ok(res, { erased: true })
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

/**
 * Withdrawing or granting an optional consent.
 *
 * Article 7(3): withdrawal has to be as easy as granting was. Granting took one
 * tick on a form, so withdrawal is one toggle in settings on the same footing —
 * not an email to support, and not buried behind account deletion.
 *
 * Only changes are written, and only the optional three are accepted; the
 * required ones are not a preference and the schema will not take them.
 */
router.patch(
  '/consents',
  requireAuth,
  validateBody(optionalConsentsSchema),
  asyncHandler(async (req, res) => {
    const { changed } = await updateOptionalConsents({
      userId: req.user.id,
      consents: req.body,
      req,
    })
    if (changed.length) {
      await audit(req, {
        action: 'auth.consents_updated',
        entityType: 'user',
        entityId: req.user.id,
        // What changed and to what — the log has to be able to answer "when did
        // they withdraw it" without reading the consent table beside it.
        metadata: Object.fromEntries(changed.map((type) => [type, Boolean(req.body[type])])),
      })
    }
    const current = await currentConsents(req.user.id)
    ok(res, { consents: presentConsents(current) })
  }),
)

export default router
