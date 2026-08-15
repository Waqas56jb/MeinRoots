import nodemailer from 'nodemailer'
import config from '../config.js'
import { one, query } from '../db/pool.js'
import { logger } from './logger.js'
import { renderEmail } from './emailTemplates.js'
import { enqueue } from '../worker/queue.js'

/**
 * Outgoing email.
 *
 * Two things this deliberately does:
 *
 * 1. **Every message is a database row first, then a job.** A slow or dead SMTP
 *    server must never hold up the request that triggered it — a candidate
 *    signing up should not wait on a mail handshake, and should not fail if it
 *    times out.
 * 2. **Not configuring SMTP is a supported state.** Without credentials the
 *    message is recorded as `skipped` and the link is written to the log, so the
 *    platform stays fully usable and the link can be delivered by hand. That is
 *    the state this deployment is in until SMTP details exist.
 */

let transport = null

const getTransport = () => {
  if (!config.mail.enabled) return null
  if (!transport) {
    transport = nodemailer.createTransport({
      host: config.mail.host,
      port: config.mail.port,
      // Port 465 is implicit TLS; 587 starts plain and upgrades via STARTTLS.
      secure: config.mail.secure,
      auth: config.mail.user ? { user: config.mail.user, pass: config.mail.pass } : undefined,
      connectionTimeout: 15000,
      greetingTimeout: 10000,
    })
  }
  return transport
}

/**
 * Records the message and queues delivery. Returns the row so callers can log
 * or assert on it; it never throws for delivery reasons.
 */
export const queueEmail = async ({ userId = null, to, template, locale = 'en', vars = {}, url }) => {
  const { subject } = renderEmail({ template, locale, vars, url })

  const row = await one(
    `INSERT INTO outbound_emails (user_id, to_email, template, locale, subject, status)
     VALUES ($1, $2, $3, $4, $5, $6::email_status)
     RETURNING *`,
    [userId, to, template, locale, subject, config.mail.enabled ? 'queued' : 'skipped'],
  )

  if (!config.mail.enabled) {
    // The one case where printing a link is correct: there is no other way to
    // deliver it, and the alternative is a candidate who cannot proceed.
    logger.warn('email not sent — SMTP is not configured', {
      template,
      to,
      link: url ?? null,
    })
    return row
  }

  await enqueue({
    type: 'email.send',
    payload: { emailId: row.id, template, locale, vars, url, to },
    priority: 20, // ahead of CV analysis: a person is waiting on a link
    maxAttempts: 4,
  })
  return row
}

/** Performs the actual send. Called by the worker, not by request handlers. */
export const deliverEmail = async ({ emailId, template, locale, vars, url, to }) => {
  const mailer = getTransport()
  if (!mailer) throw new Error('SMTP is not configured')

  const { subject, text, html } = renderEmail({ template, locale, vars, url })

  await query('UPDATE outbound_emails SET attempts = attempts + 1 WHERE id = $1', [emailId])

  try {
    const result = await mailer.sendMail({
      from: config.mail.from,
      ...(config.mail.replyTo ? { replyTo: config.mail.replyTo } : {}),
      to,
      subject,
      text,
      html,
    })
    await query(
      "UPDATE outbound_emails SET status = 'sent', sent_at = now(), provider_id = $2, error = NULL WHERE id = $1",
      [emailId, result.messageId ?? null],
    )
    logger.info('email sent', { template, to, messageId: result.messageId })
    return result
  } catch (err) {
    await query("UPDATE outbound_emails SET status = 'failed', error = $2 WHERE id = $1", [
      emailId,
      String(err.message).slice(0, 1000),
    ])
    throw err
  }
}

/** Verifies the SMTP connection at boot so a bad config is loud, not silent. */
export const verifyMailer = async () => {
  const mailer = getTransport()
  if (!mailer) return { configured: false }
  try {
    await mailer.verify()
    logger.info('smtp ready', { host: config.mail.host, port: config.mail.port })
    return { configured: true, ok: true }
  } catch (err) {
    logger.error('smtp verification failed — email will not be delivered', { message: err.message })
    return { configured: true, ok: false, error: err.message }
  }
}
