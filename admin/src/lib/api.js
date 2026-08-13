/**
 * The console's only door to the API.
 *
 * Same contract as the candidate app: cookies always sent, one transparent
 * refresh on a 401, and every failure arrives as an ApiError with a stable code
 * the UI translates itself.
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
    throw new ApiError({ status: response.status, code: 'bad_response' })
  }

  if (!response.ok) {
    throw new ApiError({
      status: response.status,
      code: payload?.error?.code,
      message: payload?.error?.message,
      details: payload?.error?.details,
    })
  }

  // Paginated endpoints keep their { data, meta } envelope; unwrapping to the
  // array alone would drop the total the pager needs.
  if (payload && payload.meta !== undefined) return { data: payload.data, meta: payload.meta }
  return payload?.data ?? payload
}

const request = async (path, options = {}) => {
  try {
    return await rawRequest(path, options)
  } catch (err) {
    const isAuthCall = path.startsWith('/api/auth/')
    if (!(err instanceof ApiError) || err.status !== 401 || isAuthCall || options._retried) throw err

    // The overview fires several requests at once; sharing one refresh stops
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

const qs = (params) => {
  const search = new URLSearchParams(
    Object.entries(params).filter(([, v]) => v !== undefined && v !== null && v !== '' && v !== false),
  ).toString()
  return search ? `?${search}` : ''
}

export const api = {
  get: (path, options) => request(path, options),
  post: (path, body, options) => request(path, { ...options, method: 'POST', body }),
  del: (path, options) => request(path, { ...options, method: 'DELETE' }),
  fileUrl: (path) => `${BASE}${path}`,
}

export const authApi = {
  login: (payload) => api.post('/api/auth/login', payload),
  logout: () => api.post('/api/auth/logout'),
  me: () => api.get('/api/auth/me'),
  updateLocale: (locale) => request('/api/auth/locale', { method: 'PATCH', body: { locale } }),
}

export const adminApi = {
  stats: () => api.get('/api/admin/stats'),
  candidates: (params = {}) => api.get(`/api/admin/candidates${qs(params)}`),
  candidate: (userId) => api.get(`/api/admin/candidates/${userId}`),
  review: (userId, payload) => api.post(`/api/admin/candidates/${userId}/review`, payload),
  resolveFlag: (flagId) => api.post(`/api/admin/flags/${flagId}/resolve`),
  approveVersion: (versionId) => api.post(`/api/admin/cv-versions/${versionId}/approve`),
  erase: (userId) => api.del(`/api/admin/candidates/${userId}`),
  jobs: (params = {}) => api.get(`/api/admin/jobs${qs(params)}`),
  retryJob: (jobId) => api.post(`/api/admin/jobs/${jobId}/retry`),
  audit: (params = {}) => api.get(`/api/admin/audit${qs(params)}`),
  cvDownloadUrl: (documentId) => api.fileUrl(`/api/admin/documents/${documentId}/file`),
}
