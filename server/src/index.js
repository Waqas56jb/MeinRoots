import config from './config.js'
import { createApp } from './app.js'
import { closePool, one } from './db/pool.js'
import { logger } from './lib/logger.js'
import { ensureStorage } from './modules/cv/storage.js'
import { startWorker, stopWorker } from './worker/index.js'

const boot = async () => {
  // Fail at startup rather than on the first request, so a bad deploy is
  // obvious in the service log instead of showing up as user-facing 500s.
  const { count } = await one(
    "SELECT count(*)::int AS count FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'users'",
  )
  if (!count) throw new Error('database schema is missing — run `npm run migrate` first')

  await ensureStorage()

  if (!config.openai.enabled) {
    logger.warn('OPENAI_API_KEY is not set — uploads will queue but analysis will fail')
  }

  let server = null
  if (!config.worker.only) {
    const app = createApp()
    server = app.listen(config.port, () => {
      logger.info('api listening', { port: config.port, env: config.env })
    })
  }

  if (config.worker.inProcess || config.worker.only) await startWorker()

  const shutdown = async (signal) => {
    logger.info('shutting down', { signal })
    // Order matters: stop taking new work, let running jobs land, then close
    // the pool they are still using.
    const closed = new Promise((resolve) => (server ? server.close(resolve) : resolve()))
    await Promise.all([closed, stopWorker()])
    await closePool()
    process.exit(0)
  }

  process.on('SIGTERM', () => shutdown('SIGTERM'))
  process.on('SIGINT', () => shutdown('SIGINT'))
  process.on('unhandledRejection', (reason) => {
    logger.error('unhandled rejection', { message: reason?.message ?? String(reason) })
  })
}

boot().catch((err) => {
  logger.error('failed to start', { message: err.message })
  process.exit(1)
})
