import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react'

/**
 * Front-end auth for Milestone 1.
 *
 * There is no backend yet, so accounts live in localStorage and the "password"
 * is stored as a non-reversible digest only so the demo can compare logins.
 * When the API lands, swap the four functions below for real fetch calls —
 * nothing else in the app touches storage.
 */

const USERS_KEY = 'meinroots.users'
const SESSION_KEY = 'meinroots.session'

const AuthContext = createContext(null)

const read = (key, fallback) => {
  try {
    const raw = window.localStorage.getItem(key)
    return raw ? JSON.parse(raw) : fallback
  } catch {
    return fallback
  }
}

const write = (key, value) => {
  try {
    window.localStorage.setItem(key, JSON.stringify(value))
  } catch {
    /* private mode — the session simply won't survive a reload */
  }
}

/** Stand-in for server-side hashing. Never use this for real credentials. */
const digest = (value) => {
  let h = 5381
  for (let i = 0; i < value.length; i += 1) h = ((h << 5) + h + value.charCodeAt(i)) | 0
  return `d${(h >>> 0).toString(36)}`
}

const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms))

const publicUser = ({ id, name, email, goals, createdAt }) => ({ id, name, email, goals, createdAt })

export function AuthProvider({ children }) {
  const [user, setUser] = useState(() => read(SESSION_KEY, null))
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    if (user) write(SESSION_KEY, user)
    else window.localStorage.removeItem(SESSION_KEY)
  }, [user])

  const signup = useCallback(async ({ name, email, password, goals = [] }) => {
    setBusy(true)
    await wait(650) // stands in for the network round-trip
    try {
      const users = read(USERS_KEY, [])
      const normalised = email.trim().toLowerCase()
      if (users.some((u) => u.email === normalised)) {
        return { ok: false, error: 'exists' }
      }
      const created = {
        id: `u_${Date.now().toString(36)}`,
        name: name.trim(),
        email: normalised,
        password: digest(password),
        goals,
        createdAt: new Date().toISOString(),
      }
      write(USERS_KEY, [...users, created])
      setUser(publicUser(created))
      return { ok: true, user: publicUser(created) }
    } finally {
      setBusy(false)
    }
  }, [])

  const login = useCallback(async ({ email, password }) => {
    setBusy(true)
    await wait(650)
    try {
      const users = read(USERS_KEY, [])
      const normalised = email.trim().toLowerCase()
      const found = users.find((u) => u.email === normalised && u.password === digest(password))
      if (!found) return { ok: false, error: 'credentials' }
      setUser(publicUser(found))
      return { ok: true, user: publicUser(found) }
    } finally {
      setBusy(false)
    }
  }, [])

  const requestReset = useCallback(async (email) => {
    setBusy(true)
    await wait(700)
    setBusy(false)
    // Always reports success: revealing whether an address exists leaks accounts.
    return { ok: true, email: email.trim().toLowerCase() }
  }, [])

  const logout = useCallback(() => setUser(null), [])

  const value = useMemo(
    () => ({ user, isAuthenticated: Boolean(user), busy, signup, login, logout, requestReset }),
    [user, busy, signup, login, logout, requestReset],
  )

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used inside <AuthProvider>')
  return ctx
}
