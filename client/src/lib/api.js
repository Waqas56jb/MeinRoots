/**
 * The single door to the API.
 *
 * Nothing else in the app calls fetch. That keeps three concerns in one place:
 * cookies are always sent, an expired access token is transparently refreshed
 * once, and every failure arrives as an ApiError with a stable `code` the UI can
 * translate — never a raw English sentence from the server.
 */

/**
 * Where the API lives.
 *
 * An explicitly empty VITE_API_URL means same-origin — the deployment where
 * nginx serves this build and proxies /api to the Node process. `??` rather
 * than `||` so that empty string survives instead of falling back to localhost.
 */
const BASE = (import.meta.env.VITE_API_URL ?? 'http://localhost:4000').replace(/\/$/, '')

export class ApiError extends Error {
  constructor({ status, code, message, details }) {
    super(message || code || 'request_failed')
    this.name = 'ApiError'
    this.status = status
    this.code = code || 'server_error'
    this.details = details || null
  }
}

/** True when the browser could not reach the API at all. */
export const isOffline = (err) => err instanceof ApiError && err.code === 'network_error'

let refreshing = null

const rawRequest = async (path, { method = 'GET', body, isForm = false, signal } = {}) => {
  const headers = {}
  if (body && !isForm) headers['Content-Type'] = 'application/json'

  let response
  try {
    response = await fetch(`${BASE}${path}`, {
      method,
      headers,
      // Session lives in httpOnly cookies, so every call must carry them.
      credentials: 'include',
      body: isForm ? body : body ? JSON.stringify(body) : undefined,
      signal,
    })
  } catch (err) {
    if (err.name === 'AbortError') throw err
    throw new ApiError({ status: 0, code: 'network_error', message: 'Could not reach the server' })
  }

  if (response.status === 204) return null

  const text = await response.text()
  let payload = null
  try {
    payload = text ? JSON.parse(text) : null
  } catch {
    throw new ApiError({ status: response.status, code: 'bad_response', message: 'Malformed response' })
  }

  if (!response.ok) {
    throw new ApiError({
      status: response.status,
      code: payload?.error?.code,
      message: payload?.error?.message,
      details: payload?.error?.details,
    })
  }

  // Paginated endpoints answer { data: [...], meta: {...} }. Unwrapping to the
  // array alone would silently drop the total the pager needs, so those keep
  // their envelope and everything else is unwrapped.
  if (payload && payload.meta !== undefined) return { data: payload.data, meta: payload.meta }
  return payload?.data ?? payload
}

/**
 * Retries once through /auth/refresh when the access token has expired.
 *
 * Concurrent 401s share one refresh — otherwise a dashboard that fires four
 * requests at mount would rotate the refresh token four times and invalidate
 * its own session.
 */
const request = async (path, options = {}) => {
  try {
    return await rawRequest(path, options)
  } catch (err) {
    const isAuthCall = path.startsWith('/api/auth/')
    if (!(err instanceof ApiError) || err.status !== 401 || isAuthCall || options._retried) throw err

    if (!refreshing) {
      refreshing = rawRequest('/api/auth/refresh', { method: 'POST' }).finally(() => {
        refreshing = null
      })
    }

    try {
      await refreshing
    } catch {
      throw err // refresh failed — the original 401 is the honest answer
    }
    return rawRequest(path, { ...options, _retried: true })
  }
}

export const api = {
  get: (path, options) => request(path, options),
  post: (path, body, options) => request(path, { ...options, method: 'POST', body }),
  patch: (path, body, options) => request(path, { ...options, method: 'PATCH', body }),
  put: (path, body, options) => request(path, { ...options, method: 'PUT', body }),
  del: (path, options) => request(path, { ...options, method: 'DELETE' }),
  upload: (path, formData, options) =>
    // No Content-Type header: the browser must set the multipart boundary.
    request(path, { ...options, method: 'POST', body: formData, isForm: true }),
  fileUrl: (path) => `${BASE}${path}`,
}

// ------------------------------- endpoints ----------------------------------

export const authApi = {
  register: (payload) => api.post('/api/auth/register', payload),
  login: (payload) => api.post('/api/auth/login', payload),
  logout: () => api.post('/api/auth/logout'),
  me: () => api.get('/api/auth/me'),
  requestReset: (email) => api.post('/api/auth/password/reset-request', { email }),
  resetPassword: (payload) => api.post('/api/auth/password/reset', payload),
  updateGoals: (goals) => api.patch('/api/auth/goals', { goals }),
  updateLocale: (locale) => api.patch('/api/auth/locale', { locale }),
  verifyEmail: (token) => api.post('/api/auth/email/verify', { token }),
  resendVerification: () => api.post('/api/auth/email/verify/resend'),
  updateNotifications: (notifyByEmail) => api.patch('/api/auth/notifications', { notifyByEmail }),
  // Only the optional three are writable; withdrawing a required consent is
  // closing the account, which is a different endpoint on purpose.
  updateConsents: (consents) => api.patch('/api/auth/consents', consents),
  changePassword: (payload) => api.post('/api/auth/password/change', payload),
  deleteAccount: (password) => request('/api/auth/account', { method: 'DELETE', body: { password } }),
}

/**
 * PENDING (Milestone 2) — the candidate side of recruitment.
 *
 * These routes do not exist yet. They return 404 until the Milestone 2
 * backend ships, and the pages that call them say so rather than showing an
 * empty list, which would be a claim that no recruiter has been in touch.
 */
export const recruitmentApi = {
  /** PENDING — GET /api/recruitment/requests?status= → { data: [Request], meta } */
  requests: (params = {}) => {
    const search = new URLSearchParams(
      Object.entries(params).filter(([, v]) => v !== undefined && v !== null && v !== ''),
    ).toString()
    return api.get(`/api/recruitment/requests${search ? `?${search}` : ''}`)
  },
  /** PENDING — GET /api/recruitment/requests/:id */
  request: (id) => api.get(`/api/recruitment/requests/${id}`),
  /** PENDING — POST /api/recruitment/requests/:id/accept  body: { message? } */
  accept: (id, message) => api.post(`/api/recruitment/requests/${id}/accept`, { message }),
  /** PENDING — POST /api/recruitment/requests/:id/decline  body: { reason? } */
  decline: (id, reason) => api.post(`/api/recruitment/requests/${id}/decline`, { reason }),
}

export const cvApi = {
  upload: (file, onProgress) => {
    const form = new FormData()
    form.append('cv', file)
    // fetch cannot report upload progress, and a candidate on a phone uploading
    // a 9 MB PDF needs to see something move — so this one call uses XHR.
    if (!onProgress) return api.upload('/api/cv/upload', form)
    return uploadWithProgress('/api/cv/upload', form, onProgress)
  },
  current: () => api.get('/api/cv/documents/current'),
  list: () => api.get('/api/cv/documents'),
  status: (id) => api.get(`/api/cv/documents/${id}/status`),
  versions: (id) => api.get(`/api/cv/documents/${id}/versions`),
  reanalyse: (id) => api.post(`/api/cv/documents/${id}/reanalyse`),
  remove: (id) => api.del(`/api/cv/documents/${id}`),
  downloadUrl: (id) => api.fileUrl(`/api/cv/documents/${id}/file`),
}

export const profileApi = {
  me: () => api.get('/api/profile/me'),
  update: (payload) => api.patch('/api/profile/me', payload),
  refreshReadiness: () => api.post('/api/profile/me/readiness/refresh'),

  // Section editing. Every call returns the whole profile back, so the screen
  // re-renders from one source of truth instead of patching local state and
  // slowly drifting away from the server.
  createEntry: (section, payload) => api.post(`/api/profile/me/${section}`, payload),
  updateEntry: (section, id, payload) => api.put(`/api/profile/me/${section}/${id}`, payload),
  deleteEntry: (section, id) => api.del(`/api/profile/me/${section}/${id}`),
  edits: () => api.get('/api/profile/me/edits'),
}

export const questionnaireApi = {
  current: () => api.get('/api/questionnaire/current'),
  answer: (answers) => api.post('/api/questionnaire/answers', { answers }),
  complete: () => api.post('/api/questionnaire/complete'),
}

const uploadWithProgress = (path, formData, onProgress) =>
  new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest()
    xhr.open('POST', `${BASE}${path}`)
    xhr.withCredentials = true

    xhr.upload.addEventListener('progress', (event) => {
      if (event.lengthComputable) onProgress(Math.round((event.loaded / event.total) * 100))
    })

    xhr.addEventListener('load', () => {
      let payload = null
      try {
        payload = xhr.responseText ? JSON.parse(xhr.responseText) : null
      } catch {
        reject(new ApiError({ status: xhr.status, code: 'bad_response' }))
        return
      }
      if (xhr.status >= 200 && xhr.status < 300) resolve(payload?.data ?? payload)
      else
        reject(
          new ApiError({
            status: xhr.status,
            code: payload?.error?.code,
            message: payload?.error?.message,
            details: payload?.error?.details,
          }),
        )
    })

    xhr.addEventListener('error', () =>
      reject(new ApiError({ status: 0, code: 'network_error', message: 'Upload failed' })),
    )
    xhr.addEventListener('abort', () => reject(new ApiError({ status: 0, code: 'upload_aborted' })))

    xhr.send(formData)
  })
