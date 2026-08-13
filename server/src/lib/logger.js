import config from '../config.js'

const LEVELS = { error: 0, warn: 1, info: 2, debug: 3 }
const threshold = LEVELS[config.logLevel] ?? LEVELS.info

/**
 * One-line JSON logs in production so `journalctl -u meinroots | jq` works;
 * readable text in development. No dependency — a logging library earns its
 * place when there are transports to configure, and here there are none.
 */
const emit = (level, message, meta) => {
  if (LEVELS[level] > threshold) return
  const time = new Date().toISOString()

  if (config.isProd) {
    process.stdout.write(`${JSON.stringify({ time, level, message, ...meta })}\n`)
    return
  }

  const tail = meta && Object.keys(meta).length ? ` ${JSON.stringify(meta)}` : ''
  const tag = level.toUpperCase().padEnd(5)
  process.stdout.write(`${time.slice(11, 19)} ${tag} ${message}${tail}\n`)
}

export const logger = {
  error: (message, meta) => emit('error', message, meta),
  warn: (message, meta) => emit('warn', message, meta),
  info: (message, meta) => emit('info', message, meta),
  debug: (message, meta) => emit('debug', message, meta),
}

export default logger
