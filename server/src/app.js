import express from 'express'
import cookieParser from 'cookie-parser'
import cors from 'cors'
import helmet from 'helmet'
import config from './config.js'
import { one } from './db/pool.js'
import { asyncHandler } from './lib/errors.js'
import { ok } from './lib/http.js'
import { logger } from './lib/logger.js'
import { attachUser } from './middleware/auth.js'
import { errorHandler, notFoundHandler } from './middleware/errorHandler.js'
import { generalLimiter } from './middleware/rateLimit.js'
import authRoutes from './modules/auth/routes.js'
import cvRoutes from './modules/cv/routes.js'
import profileRoutes from './modules/profile/routes.js'
import questionnaireRoutes from './modules/questionnaire/routes.js'
import adminRoutes from './modules/admin/routes.js'

export const createApp = () => {
  const app = express()

  // Behind nginx, without this every request appears to come from 127.0.0.1 —
  // which would make the rate limiters global and the audit log useless.
  app.set('trust proxy', 1)
  app.disable('x-powered-by')

  app.use(
    helmet({
      // This process serves JSON, not pages; the CSP that matters belongs to
      // whatever hosts the front end.
      contentSecurityPolicy: false,
      crossOriginResourcePolicy: { policy: 'same-site' },
    }),
  )

  app.use(
    cors({
      origin(origin, callback) {
        // No Origin header: curl, health checks, same-origin server calls.
        if (!origin) return callback(null, true)
        if (config.cors.origins.includes(origin)) return callback(null, true)
        // Vercel gives every deploy its own hostname, so previews cannot be
        // listed ahead of time.
        if (config.cors.allowVercelPreviews && /^https:\/\/[a-z0-9-]+\.vercel\.app$/.test(origin)) {
          return callback(null, true)
        }
        logger.warn('cors rejected origin', { origin })
        return callback(null, false)
      },
      // The session lives in cookies, so the browser must be allowed to send them.
      credentials: true,
      methods: ['GET', 'POST', 'PATCH', 'PUT', 'DELETE', 'OPTIONS'],
    }),
  )

  app.use(express.json({ limit: '1mb' }))
  app.use(express.urlencoded({ extended: false, limit: '1mb' }))
  app.use(cookieParser())

  app.use((req, res, next) => {
    const started = Date.now()
    res.on('finish', () => {
      const ms = Date.now() - started
      const line = { method: req.method, path: req.path, status: res.statusCode, ms }
      if (res.statusCode >= 500) logger.error('request', line)
      else if (res.statusCode >= 400) logger.warn('request', line)
      else logger.info('request', line)
    })
    next()
  })

  app.use(attachUser)
  app.use('/api', generalLimiter)

  /** Liveness + a real database round trip, for uptime monitoring. */
  app.get(
    '/api/health',
    asyncHandler(async (_req, res) => {
      const row = await one('SELECT now() AS now')
      ok(res, {
        status: 'ok',
        time: row.now,
        env: config.env,
        ai: config.openai.enabled ? 'configured' : 'missing_key',
      })
    }),
  )

  app.use('/api/auth', authRoutes)
  app.use('/api/cv', cvRoutes)
  app.use('/api/profile', profileRoutes)
  app.use('/api/questionnaire', questionnaireRoutes)
  app.use('/api/admin', adminRoutes)

  app.use(notFoundHandler)
  app.use(errorHandler)

  return app
}

export default createApp
