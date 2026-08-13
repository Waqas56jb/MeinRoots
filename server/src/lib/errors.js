/**
 * Errors the client is allowed to see.
 *
 * `code` is a stable machine string the front end switches on for translated
 * messages — the English `message` is for logs and developers, never for the
 * candidate, because the UI renders in three languages.
 */
export class AppError extends Error {
  constructor(status, code, message, details) {
    super(message || code)
    this.name = 'AppError'
    this.status = status
    this.code = code
    this.details = details
    this.expose = true
  }
}

export const badRequest = (code, message, details) => new AppError(400, code, message, details)
export const unauthorized = (code = 'unauthorized', message = 'Authentication required') =>
  new AppError(401, code, message)
export const forbidden = (code = 'forbidden', message = 'Not allowed') => new AppError(403, code, message)
export const notFound = (code = 'not_found', message = 'Not found') => new AppError(404, code, message)
export const conflict = (code, message) => new AppError(409, code, message)
export const tooLarge = (code = 'file_too_large', message = 'File too large') => new AppError(413, code, message)
export const tooMany = (code = 'rate_limited', message = 'Too many requests') => new AppError(429, code, message)
export const serverError = (code = 'server_error', message = 'Something went wrong') =>
  new AppError(500, code, message)

/**
 * Wraps an async route handler so a rejected promise reaches Express's error
 * middleware. Express 4 does not await handlers, so without this an async throw
 * becomes an unhandled rejection and the request hangs until it times out.
 */
export const asyncHandler = (fn) => (req, res, next) => {
  Promise.resolve(fn(req, res, next)).catch(next)
}
