import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react'
import { ApiError } from '../lib/api.js'
import { authApi } from '../services/index.js'

/**
 * Who is signed in to the portal.
 *
 * The session endpoints are the shared ones — a recruiter is a user like any
 * other as far as authentication goes. What this context adds is the role
 * check: the API would happily hand a candidate or an admin their own /me, and
 * neither belongs here, so any session that is not a recruiter is treated as no
 * session at all and ended.
 *
 * That is a usability guard, not a security control. The server decides what a
 * recruiter may actually read; this only keeps the wrong person from staring at
 * a portal that will refuse them anyway.
 */

const AuthContext = createContext(null)

const isRecruiter = (role) => role === 'recruiter' || role === 'company_admin'

const toResult = (err) => ({
  ok: false,
  error: err instanceof ApiError ? err.code : 'server_error',
  status: err instanceof ApiError ? err.status : 0,
  details: err instanceof ApiError ? err.details : null,
})

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null)
  const [ready, setReady] = useState(false)
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    let cancelled = false
    authApi
      .me()
      .then((data) => {
        if (!cancelled) setUser(isRecruiter(data.user?.role) ? data.user : null)
      })
      .catch(() => {
        if (!cancelled) setUser(null)
      })
      .finally(() => {
        if (!cancelled) setReady(true)
      })
    return () => {
      cancelled = true
    }
  }, [])

  const login = useCallback(async ({ email, password }) => {
    setBusy(true)
    try {
      const data = await authApi.login({ email, password })
      if (!isRecruiter(data.user?.role)) {
        // Signed in, but not as a recruiter. End the session rather than
        // leaving a candidate or an admin logged into this origin.
        await authApi.logout().catch(() => {})
        return { ok: false, error: 'not_a_recruiter' }
      }
      setUser(data.user)
      return { ok: true, user: data.user }
    } catch (err) {
      return toResult(err)
    } finally {
      setBusy(false)
    }
  }, [])

  const logout = useCallback(async () => {
    await authApi.logout().catch(() => {})
    setUser(null)
  }, [])

  /** Fire-and-forget: a failed locale sync must never interrupt the interface. */
  const syncLocale = useCallback((locale) => {
    authApi.updateLocale(locale).catch(() => {})
  }, [])

  const value = useMemo(
    () => ({
      user,
      isAuthenticated: Boolean(user),
      ready,
      busy,
      login,
      logout,
      syncLocale,
      setUser,
    }),
    [user, ready, busy, login, logout, syncLocale],
  )

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used inside <AuthProvider>')
  return ctx
}
