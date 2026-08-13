import { one, query } from '../db/pool.js'

/**
 * A job queue in Postgres.
 *
 * Milestone 1 processes a handful of CVs a day; adding Redis or a broker would
 * be one more service to install, secure and back up on the same box for no
 * throughput benefit. `FOR UPDATE SKIP LOCKED` is exactly the primitive needed
 * to let several workers claim different rows without blocking each other, and
 * it has been in Postgres since 9.5.
 */

export const enqueue = async ({ type, payload = {}, priority = 0, runAfter = null, maxAttempts = 3 }) => {
  const row = await one(
    `INSERT INTO jobs (type, payload, priority, run_after, max_attempts)
     VALUES ($1, $2, $3, COALESCE($4, now()), $5)
     RETURNING *`,
    [type, payload, priority, runAfter, maxAttempts],
  )
  return row
}

/**
 * Claims one job atomically. The UPDATE ... FROM (SELECT ... SKIP LOCKED)
 * pattern is a single statement, so two workers polling at the same instant
 * cannot both get the same row.
 */
export const claim = async (workerId) => {
  const row = await one(
    `UPDATE jobs j
        SET status = 'running',
            attempts = j.attempts + 1,
            locked_at = now(),
            locked_by = $1,
            started_at = COALESCE(j.started_at, now())
       FROM (
         SELECT id FROM jobs
          WHERE status = 'queued' AND run_after <= now()
          ORDER BY priority DESC, run_after
          FOR UPDATE SKIP LOCKED
          LIMIT 1
       ) next
      WHERE j.id = next.id
      RETURNING j.*`,
    [workerId],
  )
  return row
}

export const succeed = (jobId, progress = {}) =>
  query(
    `UPDATE jobs
        SET status = 'succeeded', finished_at = now(), locked_at = NULL, locked_by = NULL,
            progress = progress || $2::jsonb
      WHERE id = $1`,
    [jobId, progress],
  )

/**
 * Fails a job with exponential backoff, or buries it once the attempt budget is
 * spent. `dead` rather than `failed` for the terminal state, so the admin can
 * tell "will retry" from "gave up" at a glance.
 */
export const fail = async (job, error) => {
  const message = String(error?.message || error).slice(0, 2000)
  const exhausted = job.attempts >= job.max_attempts
  const backoffSeconds = Math.min(600, 15 * 2 ** (job.attempts - 1))

  await query(
    `UPDATE jobs
        SET status = $2::job_status,
            last_error = $3,
            locked_at = NULL,
            locked_by = NULL,
            run_after = now() + ($4 || ' seconds')::interval,
            finished_at = CASE WHEN $2 = 'dead' THEN now() ELSE NULL END
      WHERE id = $1`,
    [job.id, exhausted ? 'dead' : 'queued', message, exhausted ? 0 : backoffSeconds],
  )
  return { retrying: !exhausted, backoffSeconds }
}

export const setProgress = (jobId, progress) =>
  query('UPDATE jobs SET progress = progress || $2::jsonb WHERE id = $1', [jobId, progress])

export const getJob = (jobId) => one('SELECT * FROM jobs WHERE id = $1', [jobId])

/** Latest job for a document — what the upload screen polls while it waits. */
export const latestJobForDocument = (documentId) =>
  one(
    `SELECT * FROM jobs
      WHERE payload ->> 'documentId' = $1
      ORDER BY created_at DESC
      LIMIT 1`,
    [documentId],
  )

/**
 * Releases jobs whose worker died mid-run (deploy, OOM, power cut). Without
 * this they would sit in `running` forever and the candidate's upload screen
 * would spin with no explanation.
 */
export const reclaimStale = (staleMinutes = 15) =>
  query(
    `UPDATE jobs
        SET status = 'queued', locked_at = NULL, locked_by = NULL,
            last_error = COALESCE(last_error, 'worker died mid-run; requeued')
      WHERE status = 'running'
        AND locked_at < now() - ($1 || ' minutes')::interval
        AND attempts < max_attempts`,
    [staleMinutes],
  )
