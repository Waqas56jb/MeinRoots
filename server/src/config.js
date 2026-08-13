import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import dotenv from 'dotenv'

const here = dirname(fileURLToPath(import.meta.url))
export const ROOT = resolve(here, '..')

dotenv.config({ path: resolve(ROOT, '.env') })

const required = (key) => {
  const value = process.env[key]
  if (!value) {
    // Failing at boot beats failing on the first request that happens to need it.
    throw new Error(`Missing required environment variable: ${key} (see .env.example)`)
  }
  return value
}

const optional = (key, fallback) => process.env[key] ?? fallback
const int = (key, fallback) => Number.parseInt(process.env[key] ?? '', 10) || fallback
const bool = (key, fallback) => {
  const raw = process.env[key]
  if (raw === undefined) return fallback
  return raw === 'true' || raw === '1'
}

export const config = {
  env: optional('NODE_ENV', 'development'),
  isProd: optional('NODE_ENV', 'development') === 'production',
  port: int('PORT', 4000),

  databaseUrl: required('DATABASE_URL'),
  dbPoolMax: int('DB_POOL_MAX', 10),

  jwt: {
    secret: required('JWT_SECRET'),
    accessTtl: optional('JWT_ACCESS_TTL', '15m'),
    // The refresh cookie is what actually keeps someone logged in; the access
    // token is deliberately short so a leaked one expires quickly.
    refreshTtlDays: int('JWT_REFRESH_TTL_DAYS', 30),
  },

  cookie: {
    name: optional('COOKIE_NAME', 'mr_session'),
    accessName: optional('COOKIE_ACCESS_NAME', 'mr_access'),
    domain: optional('COOKIE_DOMAIN', undefined),
    // must be true in production — the cookies are httpOnly but still need TLS
    secure: bool('COOKIE_SECURE', optional('NODE_ENV', 'development') === 'production'),
    sameSite: optional('COOKIE_SAMESITE', 'lax'),
  },

  cors: {
    // comma-separated list; the Vercel preview domains change per deploy, so
    // an exact-match list plus an optional suffix rule is the practical shape
    origins: optional('CORS_ORIGINS', 'http://localhost:5173')
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean),
    allowVercelPreviews: bool('CORS_ALLOW_VERCEL_PREVIEWS', true),
  },

  storage: {
    dir: resolve(ROOT, optional('STORAGE_DIR', 'storage')),
    maxUploadBytes: int('MAX_UPLOAD_BYTES', 10 * 1024 * 1024),
    acceptedMime: [
      'application/pdf',
      'application/msword',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    ],
    acceptedExt: ['.pdf', '.doc', '.docx'],
  },

  openai: {
    apiKey: optional('OPENAI_API_KEY', ''),
    model: optional('OPENAI_MODEL', 'gpt-4o-mini'),
    // Translation of a whole CV is the expensive call; a bigger model here is a
    // per-deployment decision rather than a code change.
    translationModel: optional('OPENAI_TRANSLATION_MODEL', optional('OPENAI_MODEL', 'gpt-4o-mini')),
    timeoutMs: int('OPENAI_TIMEOUT_MS', 120000),
    maxRetries: int('OPENAI_MAX_RETRIES', 2),
    enabled: Boolean(optional('OPENAI_API_KEY', '')),
  },

  worker: {
    // Running the worker in the API process is right for Milestone 1 volumes.
    // Set WORKER_IN_PROCESS=false and run `npm run start` twice (once with
    // WORKER_ONLY=true) when analysis starts competing with request latency.
    inProcess: bool('WORKER_IN_PROCESS', true),
    only: bool('WORKER_ONLY', false),
    concurrency: int('WORKER_CONCURRENCY', 2),
    pollIntervalMs: int('WORKER_POLL_MS', 2000),
  },

  security: {
    bcryptRounds: int('BCRYPT_ROUNDS', 12),
    maxFailedLogins: int('MAX_FAILED_LOGINS', 8),
    lockMinutes: int('LOGIN_LOCK_MINUTES', 15),
    resetTtlMinutes: int('RESET_TTL_MINUTES', 60),
  },

  appUrl: optional('APP_URL', 'http://localhost:5173'),
  logLevel: optional('LOG_LEVEL', 'info'),
}

export default config
