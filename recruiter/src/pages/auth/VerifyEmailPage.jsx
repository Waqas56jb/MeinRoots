import { useEffect, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import AuthShell from '../../components/AuthShell.jsx'
import Icon from '../../components/Icon.jsx'
import { authApi } from '../../services/index.js'
import { useI18n } from '../../context/I18nContext.jsx'

/** Opened from the confirmation email. Shared M1 endpoint — already live. */
export default function VerifyEmailPage() {
  const { t, tError } = useI18n()
  const [params] = useSearchParams()
  const token = params.get('token') ?? ''
  const [state, setState] = useState(token ? 'working' : 'missing')
  const [error, setError] = useState('')

  useEffect(() => {
    if (!token) return
    let cancelled = false
    authApi
      .verifyEmail(token)
      .then(() => !cancelled && setState('done'))
      .catch((err) => {
        if (cancelled) return
        setError(tError(err.code))
        setState('failed')
      })
    return () => { cancelled = true }
  }, [token, tError])

  const icon = { working: 'clock', done: 'checkCircle', failed: 'alert', missing: 'alert' }[state]

  return (
    <AuthShell>
      <div className="auth__done">
        <span className={`auth__doneIcon auth__doneIcon--${state}`}><Icon name={icon} size={26} /></span>
        <h1>{t(`auth.verify.${state}.title`)}</h1>
        <p>{state === 'failed' && error ? error : t(`auth.verify.${state}.text`)}</p>
        <Link to="/dashboard" className="btn btn--primary btn--block">{t('auth.verify.continue')}</Link>
      </div>
    </AuthShell>
  )
}
