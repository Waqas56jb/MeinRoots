import { useState } from 'react'
import { Link } from 'react-router-dom'
import AuthShell, { Field } from '../../components/AuthShell.jsx'
import Icon from '../../components/Icon.jsx'
import { authApi } from '../../services/index.js'
import { useI18n } from '../../context/I18nContext.jsx'

/**
 * Uses the shared reset endpoint, which already exists and already answers the
 * same way for a known and an unknown address — so this screen can show one
 * confirmation without leaking which addresses have accounts.
 */
export default function ForgotPasswordPage() {
  const { t } = useI18n()
  const [email, setEmail] = useState('')
  const [sent, setSent] = useState(false)
  const [busy, setBusy] = useState(false)

  const submit = async (e) => {
    e.preventDefault()
    setBusy(true)
    // The endpoint reports success either way; a failure here is a network
    // problem, and retrying is the same action.
    await authApi.requestReset(email.trim()).catch(() => {})
    setBusy(false)
    setSent(true)
  }

  if (sent) {
    return (
      <AuthShell>
        <div className="auth__done">
          <span className="auth__doneIcon"><Icon name="mail" size={26} /></span>
          <h1>{t('auth.forgot.sentTitle')}</h1>
          <p>{t('auth.forgot.sentText', { email: email.trim() })}</p>
          <Link to="/login" className="btn btn--ghost btn--block">{t('auth.forgot.backToLogin')}</Link>
        </div>
      </AuthShell>
    )
  }

  return (
    <AuthShell>
      <h1>{t('auth.forgot.title')}</h1>
      <p className="auth__sub">{t('auth.forgot.subtitle')}</p>

      <form onSubmit={submit} noValidate>
        <Field
          label={t('auth.email')} name="email" type="email" value={email}
          onChange={setEmail} autoComplete="username" required
        />
        <button type="submit" className="btn btn--primary btn--block btn--lg" disabled={busy || !email.trim()}>
          {busy ? t('common.loading') : t('auth.forgot.submit')}
        </button>
      </form>

      <p className="auth__switch">
        <Link to="/login">{t('auth.forgot.backToLogin')}</Link>
      </p>
    </AuthShell>
  )
}
