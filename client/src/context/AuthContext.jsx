import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react'
import { ApiError, authApi } from '../lib/api.js'

/**
 * Session state, backed by the API.
 *
 * There is deliberately no token in localStorage: the access and refresh tokens
 * are httpOnly cookies the API sets, so no script — including an injected one —
 * can read them. What lives here is only the public user object, and it is
 * re-fetched on mount rather than trusted from storage.
 */

const AuthContext = createContext(null)

/** Turns any failure into the { ok, error } shape every form in the app expects. */
const toResult = (err) => {
  if (err instanceof ApiError) {
    return { ok: false, error: err.code, details: err.details, status: err.status }
  }
  return { ok: false, error: 'server_error' }
}

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null)
  const [busy, setBusy] = useState(false)
  // Distinct from `busy`: the app must not decide someone is signed out while
  // the first /me call is still in flight, or a refresh on /dashboard bounces
  // to the login page every time.
  const [ready, setReady] = useState(false)

  useEffect(() => {
    let cancelled = false
    authApi
      .me()
      .then((data) => {
        if (!cancelled) setUser(data.user)
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

  const run = useCallback(async (fn) => {
    setBusy(true)
    try {
      return await fn()
    } finally {
      setBusy(false)
    }
  }, [])

  const signup = useCallback(
    ({ name, email, password, goals, locale, gdprConsent }) =>
      run(async () => {
        try {
          const data = await authApi.register({ name, email, password, goals, locale, gdprConsent })
          setUser(data.user)
          return { ok: true, user: data.user }
        } catch (err) {
          return toResult(err)
        }
      }),
    [run],
  )

  const login = useCallback(
    ({ email, password }) =>
      run(async () => {
        try {
          const data = await authApi.login({ email, password })
          setUser(data.user)
          return { ok: true, user: data.user }
        } catch (err) {
          return toResult(err)
        }
      }),
    [run],
  )

  const logout = useCallback(
    () =>
      run(async () => {
        try {
          await authApi.logout()
        } finally {
          // Even if the call fails, the local session must end — otherwise the
          // UI claims someone is signed in when they asked not to be.
          setUser(null)
        }
      }),
    [run],
  )

  const requestReset = useCallback(
    (email) =>
      run(async () => {
        try {
          await authApi.requestReset(email)
          return { ok: true, email }
        } catch (err) {
          // A rate limit is worth surfacing; anything else still reports success,
          // because whether the address exists is not the caller's business.
          const result = toResult(err)
          return result.error === 'too_many_attempts' ? result : { ok: true, email }
        }
      }),
    [run],
  )

  const resetPassword = useCallback(
    ({ token, password }) =>
      run(async () => {
        try {
          await authApi.resetPassword({ token, password })
          return { ok: true }
        } catch (err) {
          return toResult(err)
        }
      }),
    [run],
  )

  const updateGoals = useCallback(async (goals) => {
    try {
      const data = await authApi.updateGoals(goals)
      setUser(data.user)
      return { ok: true, user: data.user }
    } catch (err) {
      return toResult(err)
    }
  }, [])

  /** Fire-and-forget: a failed locale sync must never interrupt the UI. */
  const syncLocale = useCallback((locale) => {
    authApi.updateLocale(locale).catch(() => {})
  }, [])

  const value = useMemo(
    () => ({
      user,
      isAuthenticated: Boolean(user),
      // No isAdmin here on purpose: this application has no admin surface at
      // all, so nothing in it should branch on staff roles.
      ready,
      busy,
      signup,
      login,
      logout,
      requestReset,
      resetPassword,
      updateGoals,
      syncLocale,
    }),
    [user, ready, busy, signup, login, logout, requestReset, resetPassword, updateGoals, syncLocale],
  )

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used inside <AuthProvider>')
  return ctx
}
