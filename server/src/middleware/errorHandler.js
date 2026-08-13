import multer from 'multer'
import config from '../config.js'
import { AppError } from '../lib/errors.js'
import { logger } from '../lib/logger.js'

export const notFoundHandler = (req, res) => {
  res.status(404).json({ error: { code: 'not_found', message: `No route for ${req.method} ${req.path}` } })
}

/**
 * The single place an error becomes a response.
 *
 * Anything that is not an AppError is treated as a bug: logged with its stack,
 * reported to the client as a generic 500. Leaking `err.message` from an
 * unexpected throw is how database structure and file paths end up in a
 * browser console.
 */
// eslint-disable-next-line no-unused-vars -- Express identifies error middleware by arity
export const errorHandler = (err, req, res, _next) => {
  if (err instanceof AppError) {
    if (err.status >= 500) logger.error(err.code, { message: err.message, path: req.path })
    return res.status(err.status).json({
      error: { code: err.code, message: err.message, ...(err.details ? { details: err.details } : {}) },
    })
  }

  if (err instanceof multer.MulterError) {
    const code = err.code === 'LIMIT_FILE_SIZE' ? 'file_too_large' : 'upload_failed'
    const status = err.code === 'LIMIT_FILE_SIZE' ? 413 : 400
    return res.status(status).json({
      error: {
        code,
        message: err.code === 'LIMIT_FILE_SIZE'
          ? `File exceeds ${Math.round(config.storage.maxUploadBytes / 1024 / 1024)} MB`
          : 'Upload failed',
      },
    })
  }

  // Body-parser's JSON syntax error arrives here with a `type` of entity.parse.failed
  if (err?.type === 'entity.parse.failed') {
    return res.status(400).json({ error: { code: 'invalid_json', message: 'Body is not valid JSON' } })
  }

  logger.error('unhandled error', {
    message: err?.message,
    stack: err?.stack?.split('\n').slice(0, 4).join(' | '),
    path: req.path,
    method: req.method,
  })

  return res.status(500).json({
    error: {
      code: 'server_error',
      message: 'Something went wrong',
      ...(config.isProd ? {} : { debug: err?.message }),
    },
  })
}
