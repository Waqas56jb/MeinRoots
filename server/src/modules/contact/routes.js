import { Router } from 'express'
import rateLimit from 'express-rate-limit'
import config from '../../config.js'
import { asyncHandler } from '../../lib/errors.js'
import { ok } from '../../lib/http.js'
import { audit } from '../../lib/audit.js'
import { logger } from '../../lib/logger.js'
import { queueEmail } from '../../lib/mailer.js'
import { validateBody, z } from '../../lib/validate.js'

/**
 * The public contact form.
 *
 * Open to anyone, which is the whole point and also the risk, so the shape is
 * deliberately narrow: a fixed set of choices, a bounded message, one address
 * it can ever send to, and a rate limit per IP. Nothing here decides the
 * recipient from the request — a contact form that will mail whatever address
 * it is handed is an open relay with a nicer front end.
 *
 * The message becomes an ordinary outbound_emails row and goes through the
 * existing queue and templates. No second mail path.
 */

const router = Router()

/** Five a quarter-hour per address is a conversation; more is a script. */
const contactLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 5,
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req) => req.ip,
  handler: (_req, res) =>
    res.status(429).json({
      error: { code: 'too_many_attempts', message: 'Too many messages — try again in a few minutes' },
    }),
})

const contactSchema = z.object({
  name: z.string().trim().min(1, 'name_required').max(120),
  email: z.string().trim().toLowerCase().email('email_invalid').max(160),
  // Which side of the marketplace they are on. It changes who reads the
  // message, so it is asked rather than guessed from the wording.
  role: z.enum(['candidate', 'recruiter']),
  // The same four goals the sign-up asks about, so an enquiry can be matched
  // against a real profile later without translating anything.
  goals: z.array(z.enum(['germany', 'remote', 'freelance', 'ausbildung'])).max(4).default([]),
  // The keys in the `plans` table, so an enquiry names something that exists.
  // Optional: plenty of enquiries are not about a plan at all.
  plan: z.enum(['trial', 'professional', 'premium']).optional(),
  message: z.string().trim().min(10, 'message_too_short').max(4000),
  // Not decoration. The message contains an address and whatever they choose
  // to write about themselves, and that is personal data being collected.
  consent: z.literal(true, { errorMap: () => ({ message: 'consent_required' }) }),
  locale: z.enum(['en', 'de', 'fr']).default('en'),
})

router.post(
  '/',
  contactLimiter,
  validateBody(contactSchema),
  asyncHandler(async (req, res) => {
    const body = req.body

    const row = await queueEmail({
      userId: null,
      // Fixed at boot from configuration. Never from the request.
      to: config.mail.contactTo,
      template: 'contact_message',
      // The team reads these; the enquirer's own language is in the body.
      locale: 'en',
      vars: {
        name: body.name,
        email: body.email,
        role: body.role,
        goals: body.goals,
        plan: body.plan ?? null,
        message: body.message,
        locale: body.locale,
      },
    })

    // Worth a record: it is the only inbound channel, and "we never received
    // it" is a claim somebody will eventually make.
    await audit(req, {
      action: 'contact.message',
      entityType: 'contact',
      entityId: row.id,
      // The message body is not copied here. One record of what someone wrote
      // is enough, and the audit log is the wrong place for it.
      metadata: { role: body.role, plan: body.plan ?? null, goals: body.goals, locale: body.locale },
    })

    logger.info('contact message queued', { emailId: row.id, role: body.role })
    ok(res, { received: true })
  }),
)

export default router
