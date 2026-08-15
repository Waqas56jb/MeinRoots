import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react'
import { isNotImplemented } from '../lib/api.js'
import { recruiterApi } from '../services/index.js'

/**
 * The company, the subscription and what this account is allowed to do.
 *
 * Every page needs some of this — the trial banner, the feature gates, the
 * company name in the sidebar — so it is read once here rather than four times
 * per navigation.
 *
 * The important rule is in `can()`. Entitlements come from the server's
 * `features` map and are never computed from the plan name on this side. A
 * front end that works out its own permissions is a front end that can be
 * talked out of them by anyone who opens the console, and it also drifts the
 * moment a plan changes. The gates here are for showing the right thing; the
 * server decides what actually happens.
 *
 * `pending` is true while the Milestone 2 endpoint does not exist yet. It is
 * kept separate from `error` on purpose: "not built" and "broken" look the same
 * to a fetch and completely different to a person.
 */

const AccountContext = createContext(null)

export function AccountProvider({ children }) {
  const [account, setAccount] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [pending, setPending] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const data = await recruiterApi.me()
      setAccount(data)
      setError(null)
      setPending(false)
    } catch (err) {
      if (isNotImplemented(err)) {
        setPending(true)
        setError(null)
      } else {
        setError(err.code ?? 'server_error')
        setPending(false)
      }
      setAccount(null)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    load()
  }, [load])

  const value = useMemo(() => {
    const subscription = account?.subscription ?? null
    const features = account?.features ?? {}

    /** Days left on a trial, or null when this is not a trial. */
    let trialDaysLeft = null
    if (subscription?.status === 'trialing' && subscription.trialEndsAt) {
      const ms = new Date(subscription.trialEndsAt).getTime() - Date.now()
      trialDaysLeft = Math.max(0, Math.ceil(ms / 86400000))
    }

    return {
      account,
      company: account?.company ?? null,
      subscription,
      features,
      loading,
      error,
      // No backend yet. Pages show a "not available yet" state rather than an
      // error, and never a fabricated number.
      pending,
      reload: load,
      trialDaysLeft,
      isTrial: subscription?.status === 'trialing',
      plan: subscription?.plan ?? null,
      /**
       * Whether a feature is available. Unknown means no: an entitlement the
       * server has not granted is one this portal must not offer.
       */
      can: (feature) => features[feature] === true,
    }
  }, [account, loading, error, pending, load])

  return <AccountContext.Provider value={value}>{children}</AccountContext.Provider>
}

export function useAccount() {
  const ctx = useContext(AccountContext)
  if (!ctx) throw new Error('useAccount must be used inside <AccountProvider>')
  return ctx
}
