import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react'
import { ApiError, authApi } from '../lib/api.js'

const AuthContext = createContext(null)

const isAdminRole = (role) => role === 'admin' || role === 'super_admin'

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null)
  const [ready, setReady] = useState(false)
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    let cancelled = false
    authApi
      .me()
      .then((data) => {
        // The API would happily hand a candidate their own /me; this console is
        // not for them, so a non-admin session is treated as no session.
        if (!cancelled) setUser(isAdminRole(data.user.role) ? data.user : null)
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
      if (!isAdminRole(data.user.role)) {
        // Signed in, but not as staff. End the session rather than leaving a
        // candidate logged into the console's origin.
        await authApi.logout().catch(() => {})
        return { ok: false, error: 'not_admin' }
      }
      setUser(data.user)
      return { ok: true, user: data.user }
    } catch (err) {
      return { ok: false, error: err instanceof ApiError ? err.code : 'server_error' }
    } finally {
      setBusy(false)
    }
  }, [])

  const logout = useCallback(async () => {
    try {
      await authApi.logout()
    } finally {
      setUser(null)
    }
  }, [])

  const syncLocale = useCallback((locale) => {
    authApi.updateLocale(locale).catch(() => {})
  }, [])

  const value = useMemo(
    () => ({
      user,
      ready,
      busy,
      isAuthenticated: Boolean(user),
      isSuperAdmin: user?.role === 'super_admin',
      login,
      logout,
      syncLocale,
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
