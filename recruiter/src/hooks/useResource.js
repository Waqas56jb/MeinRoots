import { useCallback, useEffect, useRef, useState } from 'react'
import { isNotImplemented } from '../lib/api.js'

/**
 * Loads something from the API and reports which of four things happened.
 *
 * Every Milestone 2 page needs the same four states, and the fourth is the one
 * that matters here: the endpoint does not exist yet. A fetch cannot tell the
 * difference between "no results", "broken" and "not written", but a person
 * absolutely can, and showing the wrong one sends them either hunting a bug
 * that is not there or believing a list is genuinely empty.
 *
 * So `pending` is separate from `error`, and neither is `data`.
 *
 * Returns { data, loading, error, pending, reload, setData }.
 */
export function useResource(fetcher, deps = [], { skip = false } = {}) {
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(!skip)
  const [error, setError] = useState(null)
  const [pending, setPending] = useState(false)

  // A stale response from an abandoned filter must not overwrite a fresh one.
  const generation = useRef(0)

  const load = useCallback(async () => {
    if (skip) return
    const mine = ++generation.current
    setLoading(true)
    try {
      const result = await fetcher()
      if (mine !== generation.current) return
      setData(result)
      setError(null)
      setPending(false)
    } catch (err) {
      if (mine !== generation.current) return
      if (isNotImplemented(err)) {
        setPending(true)
        setError(null)
      } else {
        setError(err.code ?? 'server_error')
        setPending(false)
      }
      setData(null)
    } finally {
      if (mine === generation.current) setLoading(false)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps)

  useEffect(() => {
    load()
  }, [load])

  return { data, loading, error, pending, reload: load, setData }
}

/**
 * Debounces a value.
 *
 * Search must not fire a request per keystroke, and 300ms is about one query
 * per word typed — long enough to stop the storm, short enough that the results
 * still feel like they are keeping up.
 */
export function useDebounced(value, ms = 300) {
  const [debounced, setDebounced] = useState(value)
  useEffect(() => {
    const id = setTimeout(() => setDebounced(value), ms)
    return () => clearTimeout(id)
  }, [value, ms])
  return debounced
}
