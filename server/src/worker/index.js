import { hostname } from 'node:os'
import config from '../config.js'
import { logger } from '../lib/logger.js'
import { claim, fail, reclaimStale, succeed } from './queue.js'
import { analyseCv, onAnalyseFailed } from './handlers/analyseCv.js'
import { deliverEmail } from '../lib/mailer.js'

/**
 * Job type → handler. `onFail` runs once the queue has decided the job is
 * finished for good, so a handler can record a user-visible failure state.
 */
const HANDLERS = {
  'cv.analyse': { run: analyseCv, onFail: onAnalyseFailed },
  // Delivery is retried with the queue's backoff; a mail server refusing a
  // connection for a minute should not cost a candidate their reset link.
  'email.send': { run: (job) => deliverEmail(job.payload) },
}

const WORKER_ID = `${hostname()}:${process.pid}`

let running = false
let stopping = false
let inFlight = 0
let timer = null

const processJob = async (job) => {
  const handler = HANDLERS[job.type]
  const started = Date.now()

  if (!handler) {
    await fail(job, new Error(`no handler registered for job type "${job.type}"`))
    return
  }

  logger.info('job started', { id: job.id, type: job.type, attempt: job.attempts })

  try {
    const result = await handler.run(job)
    await succeed(job.id, { result: result ?? {}, ms: Date.now() - started })
    logger.info('job finished', { id: job.id, type: job.type, ms: Date.now() - started })
  } catch (err) {
    const { retrying, backoffSeconds } = await fail(job, err)
    logger.error('job failed', {
      id: job.id,
      type: job.type,
      attempt: job.attempts,
      retrying,
      backoffSeconds,
      message: err.message,
    })
    // Only surface a failure once no retry remains, otherwise the upload screen
    // shows an error that is about to fix itself.
    if (!retrying && handler.onFail) {
      try {
        await handler.onFail(job, err)
      } catch (hookErr) {
        logger.error('job onFail hook threw', { id: job.id, message: hookErr.message })
      }
    }
  }
}

/**
 * Poll loop.
 *
 * Claiming is awaited so two slots can never race for the same row, but the
 * handlers themselves are deliberately not awaited here — that is what makes
 * WORKER_CONCURRENCY mean anything. An idle worker costs one indexed query
 * every couple of seconds.
 */
const tick = async () => {
  if (stopping) return
  try {
    while (!stopping && inFlight < config.worker.concurrency) {
      const job = await claim(WORKER_ID)
      if (!job) break
      inFlight += 1
      processJob(job)
        .catch((err) => logger.error('job crashed outside handler', { message: err.message }))
        .finally(() => {
          inFlight -= 1
        })
    }
  } catch (err) {
    logger.error('worker tick failed', { message: err.message })
  } finally {
    if (!stopping) timer = setTimeout(tick, config.worker.pollIntervalMs)
  }
}

export const startWorker = async () => {
  if (running) return
  running = true
  stopping = false

  const reclaimed = await reclaimStale()
  if (reclaimed.rowCount) logger.warn('requeued stale jobs', { count: reclaimed.rowCount })

  logger.info('worker started', { id: WORKER_ID, concurrency: config.worker.concurrency })
  tick()
}

export const stopWorker = async () => {
  stopping = true
  if (timer) clearTimeout(timer)
  // Let anything mid-flight finish rather than leaving a half-written profile.
  const deadline = Date.now() + 20000
  while (inFlight > 0 && Date.now() < deadline) {
    await new Promise((r) => setTimeout(r, 200))
  }
  running = false
  logger.info('worker stopped', { inFlight })
}
