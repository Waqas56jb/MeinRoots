import { useState } from 'react'
import Icon from '../ui/Icon.jsx'
import { useI18n } from '../../context/I18nContext.jsx'
import { useAuth } from '../../context/AuthContext.jsx'
import { useApiMessage } from '../../lib/apiMessage.js'

/**
 * Shown until the candidate confirms their address.
 *
 * Deliberately not a blocker: they can still use the platform. Losing the
 * account because an address had a typo is the actual risk, and nagging about
 * it is a better answer than locking someone out of a profile they just built.
 */
export default function VerifyBanner() {
  const { t } = useI18n()
  const { user, resendVerification } = useAuth()
  const apiMessage = useApiMessage()

  const [state, setState] = useState('idle') // idle | sending | sent | error
  const [error, setError] = useState('')

  if (!user || user.emailVerified) return null

  const resend = async () => {
    setState('sending')
    const result = await resendVerification()
    if (result.ok) {
      setState('sent')
    } else {
      setError(apiMessage(result.error))
      setState('error')
    }
  }

  return (
    <div className="banner banner--warn">
      <Icon name="mail" size={18} />
      <div>
        <strong>{t('app.verify.title')}</strong>
        <p>
          {state === 'sent'
            ? t('app.verify.resent', { email: user.email })
            : t('app.verify.text', { email: user.email })}
        </p>
        {state === 'error' && <p className="is-bad">{error}</p>}
      </div>
      {state !== 'sent' && (
        <button type="button" className="btn btn--ghost btn--sm" onClick={resend} disabled={state === 'sending'}>
          {state === 'sending' ? t('auth.processing') : t('app.verify.resend')}
        </button>
      )}
    </div>
  )
}
