import { useCallback } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext.jsx'

/**
 * The upload rule, in one place.
 *
 * A CV is personal data, so it can only be uploaded by a signed-in candidate.
 * Any "upload your CV" control on the public site calls this handler:
 *   signed in      → straight to /cv
 *   not signed in  → /login?next=/cv&gate=cv, which shows the gate notice
 *                    and returns the candidate to /cv after authenticating.
 */
export function useCvGate(target = '/cv') {
  const { isAuthenticated } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()

  return useCallback(
    (event) => {
      event?.preventDefault?.()
      if (isAuthenticated) {
        navigate(target)
        return
      }
      navigate(`/login?next=${encodeURIComponent(target)}&gate=cv`, {
        state: { from: location.pathname + location.hash },
      })
    },
    [isAuthenticated, navigate, target, location.pathname, location.hash],
  )
}
