import { query, transaction } from '../../db/pool.js'
import { finaliseErasure } from '../../lib/erasure.js'
import { logger } from '../../lib/logger.js'
import { enqueue } from '../queue.js'

/**
 * Retires candidate accounts that never uploaded a CV.
 *
 * An account with no CV holds no work for anyone: it cannot be reviewed, it
 * cannot be searched, and it is a name and an email address sitting in a
 * database for no purpose. Keeping it is the thing that needs justifying, not
 * removing it.
 *
 * ## What counts as having uploaded a CV
 *
 * Any row in cv_documents. Not "an analysed row" — any row.
 *
 * The row is inserted at upload time, before analysis is queued, so its
 * presence means a file was accepted and written to disk. `status = 'failed'`
 * therefore means *our* analysis failed on a CV the candidate did supply, and
 * deleting that person would be deleting someone for our own bug. The brief
 * asks for both "only non-failed states count" and "must not be deleted even if
 * CV processing failed"; those cannot both hold, and since deletion has no undo
 * the conservative reading wins. Soft-deleted rows count too: a candidate who
 * uploaded a CV and then removed it made a decision, and it was not this one.
 *
 * So the rule is exactly:
 *
 *     role = 'candidate'  AND  no cv_documents row  AND  older than 24 hours
 *
 * Nothing about last login, profile completeness, questionnaire progress or
 * readiness enters into it. Those describe how far someone got; this is about
 * accounts that never started.
 */

/** Hours an account gets before it is expected to have a CV. */
const MAX_AGE_HOURS = 24

/** How many accounts one run may erase, so a backlog cannot monopolise a worker. */
const BATCH = 50
const MAX_BATCHES = 40

/** How long until the next sweep. */
const INTERVAL_HOURS = 6

export const CLEANUP_JOB = 'candidates.cleanup_no_cv'

/**
 * The eligibility scan.
 *
 * Ordered oldest first so a backlog drains in the order accounts became
 * eligible, and so a run that hits MAX_BATCHES leaves a stable remainder rather
 * than re-reading the same page.
 */
const ELIGIBLE = `
  SELECT u.id
    FROM users u
   WHERE u.role = 'candidate'
     AND u.deleted_at IS NULL
     AND u.created_at < now() - make_interval(hours => $1)
     AND NOT EXISTS (SELECT 1 FROM cv_documents d WHERE d.user_id = u.id)
   ORDER BY u.created_at
   LIMIT $2`

/**
 * The single definition of "this candidate uploaded a CV".
 *
 * Exported so the admin console asks the same question the job does. The
 * console's own document list filters out soft-deleted rows, which is right for
 * showing documents and wrong for this: a candidate who uploaded a CV and later
 * removed it has still uploaded one, and deriving the cleanup flag from that
 * list would have shown "will be removed" for an account the job would never
 * touch.
 */
export const hasAnyCvDocument = async (userId) => {
  const { rows } = await query('SELECT 1 FROM cv_documents WHERE user_id = $1 LIMIT 1', [userId])
  return rows.length > 0
}

/**
 * Counts what a run *would* remove, without removing it. Used by the admin
 * console so the number it shows is the query itself rather than a guess.
 */
export const countEligible = async (hours = MAX_AGE_HOURS) => {
  const { rows } = await query(
    `SELECT count(*)::int AS n
       FROM users u
      WHERE u.role = 'candidate'
        AND u.deleted_at IS NULL
        AND u.created_at < now() - make_interval(hours => $1)
        AND NOT EXISTS (SELECT 1 FROM cv_documents d WHERE d.user_id = u.id)`,
    [hours],
  )
  return rows[0].n
}

/**
 * Erases one candidate, or declines to.
 *
 * The re-check is the whole point of this function, and it is why the row is
 * locked first. Between the scan and this moment the candidate may have
 * uploaded a CV — they had 24 hours to do it, so the last second is as likely
 * as any other. FOR UPDATE holds the user row for the length of the
 * transaction; the upload path writes cv_documents inside its own transaction
 * and we read that table after taking the lock, so either the upload committed
 * before we looked, and we see it and stop, or it commits after we have gone,
 * against a user row that no longer exists and whose foreign key refuses it.
 *
 * Returns 'erased', 'has_cv' (uploaded in the meantime) or 'gone' (already
 * removed — a second pass over the same id, which is a no-op by design).
 */
const eraseIfStillEligible = async (userId) =>
  transaction(async (client) => {
    const { rows } = await client.query(
      `SELECT id FROM users
        WHERE id = $1 AND role = 'candidate' AND deleted_at IS NULL
        FOR UPDATE`,
      [userId],
    )
    if (!rows.length) return 'gone'

    const { rows: docs } = await client.query(
      'SELECT 1 FROM cv_documents WHERE user_id = $1 LIMIT 1',
      [userId],
    )
    if (docs.length) return 'has_cv'

    await client.query('DELETE FROM users WHERE id = $1', [userId])
    return 'erased'
  })

export const cleanupNoCv = async () => {
  const started = Date.now()
  logger.info('candidate cleanup started', { maxAgeHours: MAX_AGE_HOURS, batch: BATCH })

  let erased = 0
  let savedByUpload = 0
  let alreadyGone = 0
  let batches = 0

  for (; batches < MAX_BATCHES; batches += 1) {
    const { rows } = await query(ELIGIBLE, [MAX_AGE_HOURS, BATCH])
    if (!rows.length) break

    for (const row of rows) {
      let outcome
      try {
        outcome = await eraseIfStillEligible(row.id)
      } catch (err) {
        logger.error('candidate cleanup: erase failed', { userId: row.id, message: err.message })
        continue
      }

      if (outcome === 'has_cv') { savedByUpload += 1; continue }
      if (outcome === 'gone') { alreadyGone += 1; continue }

      erased += 1
      // Files and audit, outside the transaction that removed the row. No
      // email is passed: it went with the row, and a deletion nobody requested
      // does not need a fingerprint of the person it removed.
      await finaliseErasure({
        userId: row.id,
        action: 'candidate.auto_erasure',
        // actor_role is the user_role enum and has no 'system' member, so
        // writing one silently threw inside audit()'s catch and the erasures
        // went unrecorded. The actor is named in the metadata instead; the
        // action already says this was not a person.
        actorRole: null,
        metadata: { actor: 'system', reason: 'no_cv_after_24_hours', thresholdHours: MAX_AGE_HOURS },
      })
    }

    // A short page means the last one, so there is no point asking again.
    if (rows.length < BATCH) break
  }

  const ms = Date.now() - started
  logger.info('candidate cleanup finished', {
    erased, savedByUpload, alreadyGone, batches, ms,
  })
  return { erased, savedByUpload, alreadyGone, batches, ms }
}

/**
 * Puts the next sweep on the queue.
 *
 * Guarded by NOT EXISTS and, underneath that, by a partial unique index, so
 * calling this on every boot and at the end of every run still leaves exactly
 * one scheduled cleanup. The insert conflict is swallowed on purpose: losing
 * the race means somebody else scheduled it, which is the desired outcome.
 */
export const ensureCleanupScheduled = async ({ delayHours = INTERVAL_HOURS } = {}) => {
  const { rows } = await query(
    `SELECT id FROM jobs WHERE type = $1 AND status IN ('queued', 'running') LIMIT 1`,
    [CLEANUP_JOB],
  )
  if (rows.length) return null

  try {
    const job = await enqueue({
      type: CLEANUP_JOB,
      priority: -10, // behind anything a person is waiting on
      runAfter: new Date(Date.now() + delayHours * 3600 * 1000),
      maxAttempts: 3,
    })
    logger.info('candidate cleanup scheduled', { jobId: job.id, inHours: delayHours })
    return job
  } catch (err) {
    if (err.code === '23505') return null // the unique index did its job
    throw err
  }
}

/** Runs the sweep, then schedules the next one whether or not it found anything. */
export const runCleanupJob = async () => {
  try {
    return await cleanupNoCv()
  } finally {
    await ensureCleanupScheduled().catch((err) =>
      logger.error('could not schedule the next cleanup', { message: err.message }))
  }
}

export const cleanupConfig = { MAX_AGE_HOURS, BATCH, MAX_BATCHES, INTERVAL_HOURS }
