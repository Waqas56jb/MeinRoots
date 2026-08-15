/**
 * The portal's only door to the API.
 *
 * Same contract as the candidate app and the console: cookies always sent, one
 * transparent refresh on a 401, and every failure arrives as an ApiError with a
 * stable `code` the UI translates itself. Deliberately the same shape rather
 * than a second HTTP layer — three apps that disagree about what an error looks
 * like is three sets of error handling to keep in step.
 */

const BASE = (import.meta.env.VITE_API_URL ?? '').replace(/\/$/, '')

export class ApiError extends Error {
  constructor({ status, code, message, details }) {
    super(message || code || 'request_failed')
    this.name = 'ApiError'
    this.status = status
    this.code = code || 'server_error'
    this.details = details || null
  }
}

/**
 * True when the endpoint does not exist yet.
 *
 * Milestone 2 builds the front end before the back end, so most of this portal
 * talks to routes that are not there. A 404 from an API path is a different
 * thing from a server error, and the pages say so — "not built yet" rather than
 * "something went wrong", which would send someone looking for a fault that is
 * not there.
 */
export const isNotImplemented = (err) => err instanceof ApiError && err.status === 404

export const isOffline = (err) => err instanceof ApiError && err.code === 'network_error'

let refreshing = null

const rawRequest = async (path, { method = 'GET', body, signal } = {}) => {
  const headers = {}
  if (body) headers['Content-Type'] = 'application/json'

  let response
  try {
    response = await fetch(`${BASE}${path}`, {
      method,
      headers,
      credentials: 'include',
      body: body ? JSON.stringify(body) : undefined,
      signal,
    })
  } catch (err) {
    if (err.name === 'AbortError') throw err
    throw new ApiError({ status: 0, code: 'network_error' })
  }

  if (response.status === 204) return null

  const text = await response.text()
  let payload = null
  try {
    payload = text ? JSON.parse(text) : null
  } catch {
    // An HTML error page from nginx rather than JSON: almost always a route the
    // API does not serve. Keep the status so the UI can tell the difference.
    throw new ApiError({ status: response.status, code: response.status === 404 ? 'not_found' : 'bad_response' })
  }

  if (!response.ok) {
    throw new ApiError({
      status: response.status,
      code: payload?.error?.code,
      message: payload?.error?.message,
      details: payload?.error?.details,
    })
  }

  if (payload && payload.meta !== undefined) return { data: payload.data, meta: payload.meta }
  return payload?.data ?? payload
}

const request = async (path, options = {}) => {
  try {
    return await rawRequest(path, options)
  } catch (err) {
    const isAuthCall = path.startsWith('/api/auth/')
    if (!(err instanceof ApiError) || err.status !== 401 || isAuthCall || options._retried) throw err

    // The dashboard fires several requests at once; sharing one refresh stops
    // them rotating the refresh token past each other and killing the session.
    if (!refreshing) {
      refreshing = rawRequest('/api/auth/refresh', { method: 'POST' }).finally(() => {
        refreshing = null
      })
    }
    try {
      await refreshing
    } catch {
      throw err
    }
    return rawRequest(path, { ...options, _retried: true })
  }
}

export const qs = (params) => {
  const search = new URLSearchParams()
  for (const [key, value] of Object.entries(params)) {
    if (value === undefined || value === null || value === '' || value === false) continue
    if (Array.isArray(value)) {
      if (!value.length) continue
      search.set(key, value.join(','))
    } else {
      search.set(key, String(value))
    }
  }
  const out = search.toString()
  return out ? `?${out}` : ''
}

export const api = {
  get: (path, options) => request(path, options),
  post: (path, body, options) => request(path, { ...options, method: 'POST', body }),
  patch: (path, body, options) => request(path, { ...options, method: 'PATCH', body }),
  put: (path, body, options) => request(path, { ...options, method: 'PUT', body }),
  del: (path, options) => request(path, { ...options, method: 'DELETE' }),
  fileUrl: (path) => `${BASE}${path}`,
}
