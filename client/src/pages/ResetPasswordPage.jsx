import { useState } from 'react'
import { Link } from 'react-router-dom'
import AuthShell from '../components/auth/AuthShell.jsx'
import Field from '../components/auth/Field.jsx'
import Icon from '../components/ui/Icon.jsx'
import { images } from '../data/content.js'
import { useI18n } from '../context/I18nContext.jsx'
import { useAuth } from '../context/AuthContext.jsx'

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/

export default function ResetPasswordPage() {
  const { t } = useI18n()
  const { requestReset, busy } = useAuth()
  const [email, setEmail] = useState('')
  const [error, setError] = useState('')
  const [sent, setSent] = useState(false)

  const onSubmit = async (event) => {
    event.preventDefault()
    if (!email.trim()) {
      setError(t('auth.errors.emailRequired'))
      return
    }
    if (!EMAIL_RE.test(email.trim())) {
      setError(t('auth.errors.emailInvalid'))
      return
    }
    await requestReset(email)
    setSent(true)
  }

  return (
    <AuthShell image={images.resetBackdrop} asidePath="auth.reset.aside">
      {sent ? (
        <div className="sent">
          <span className="sent__icon"><Icon name="mail" size={28} /></span>
          <h1>{t('auth.reset.sentTitle')}</h1>
          <p className="auth__sub">{t('auth.reset.sentText', { email: email.trim() })}</p>

          <Link to="/login" className="btn btn--primary btn--block btn--lg">
            {t('auth.reset.backToLogin')}
          </Link>
          <button type="button" className="btn btn--ghost btn--block" onClick={() => setSent(false)}>
            {t('auth.reset.resend')}
          </button>
        </div>
      ) : (
        <>
          <h1>{t('auth.reset.title')}</h1>
          <p className="auth__sub">{t('auth.reset.subtitle')}</p>

          <form onSubmit={onSubmit} noValidate>
            <Field
              label={t('auth.email')}
              icon="mail"
              type="email"
              name="email"
              value={email}
              onChange={(v) => { setEmail(v); setError('') }}
              placeholder={t('auth.emailPlaceholder')}
              autoComplete="email"
              error={error}
            />

            <button type="submit" className="btn btn--primary btn--block btn--lg" disabled={busy}>
              {busy ? t('auth.processing') : t('auth.reset.submit')}
              {!busy && <Icon name="arrowRight" />}
            </button>
          </form>

          <p className="auth__switch">
            <Link to="/login" className="link-arrow link-arrow--back">
              <Icon name="arrowRight" className="is-flipped" /> {t('auth.reset.backToLogin')}
            </Link>
          </p>
        </>
      )}
    </AuthShell>
  )
}
