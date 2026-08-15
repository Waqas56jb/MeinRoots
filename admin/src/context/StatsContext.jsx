import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react'
import { adminApi } from '../lib/api.js'

/**
 * One read of /api/admin/stats for the whole console.
 *
 * Three places want it: the overview draws the page from it, the candidates
 * filter needs the domain list out of it, and the sidebar shows how many things
 * are waiting. Each was fetching it separately, so opening the candidates page
 * cost two requests for one answer.
 *
 * It also refreshes on a timer. An operations console that silently shows
 * ten-minute-old counts is worse than one that shows none, because the admin
 * has no way to tell — which is also why `fetchedAt` is exposed and rendered.
 */

const StatsContext = createContext(null)

const REFRESH_MS = 60000

export function StatsProvider({ children }) {
  const [stats, setStats] = useState(null)
  const [error, setError] = useState('')
  const [fetchedAt, setFetchedAt] = useState(null)
  const [loading, setLoading] = useState(true)
  const inFlight = useRef(false)

  const load = useCallback(async ({ quiet = false } = {}) => {
    // A manual refresh landing on top of the timer would otherwise race and
    // apply whichever response happened to be slower.
    if (inFlight.current) return
    inFlight.current = true
    if (!quiet) setLoading(true)
    try {
      const next = await adminApi.stats()
      setStats(next)
      setFetchedAt(Date.now())
      setError('')
    } catch (err) {
      // A failed background refresh must not blank a page that is already
      // showing good data; the error surfaces, the numbers stay.
      setError(err.code ?? 'server_error')
    } finally {
      inFlight.current = false
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    load()
  }, [load])

  useEffect(() => {
    const id = setInterval(() => load({ quiet: true }), REFRESH_MS)
    // Coming back to a tab that has been in the background is exactly when the
    // numbers are most likely to be stale and most likely to be trusted.
    const onVisible = () => {
      if (document.visibilityState === 'visible') load({ quiet: true })
    }
    document.addEventListener('visibilitychange', onVisible)
    return () => {
      clearInterval(id)
      document.removeEventListener('visibilitychange', onVisible)
    }
  }, [load])

  const value = useMemo(() => {
    const c = stats?.counts
    return {
      stats,
      counts: c ?? null,
      domains: stats?.byDomain ?? [],
      error,
      loading,
      fetchedAt,
      reload: load,
      /* What the sidebar puts a badge on: things a person has to deal with. */
      badges: {
        candidates: c?.flagged ?? 0,
        queue: c?.jobs_dead ?? 0,
      },
    }
  }, [stats, error, loading, fetchedAt, load])

  return <StatsContext.Provider value={value}>{children}</StatsContext.Provider>
}

export function useStats() {
  const ctx = useContext(StatsContext)
  if (!ctx) throw new Error('useStats must be used inside <StatsProvider>')
  return ctx
}
