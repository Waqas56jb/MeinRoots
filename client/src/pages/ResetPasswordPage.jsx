import { useState } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import AuthShell from '../components/auth/AuthShell.jsx'
import Field from '../components/auth/Field.jsx'
import PasswordMeter from '../components/auth/PasswordMeter.jsx'
import Icon from '../components/ui/Icon.jsx'
import { images } from '../data/content.js'
import { useI18n } from '../context/I18nContext.jsx'
import { useAuth } from '../context/AuthContext.jsx'
import { useApiMessage } from '../lib/apiMessage.js'

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/

/**
 * Two screens behind one route.
 *
 * Without ?token= it asks for an address and always claims success — the API
 * refuses to say whether an account exists, and the UI must not undo that by
 * behaving differently for known and unknown addresses.
 * With ?token= it is the "choose a new password" form the emailed link opens.
 */
export default function ResetPasswordPage() {
  const { t } = useI18n()
  const { requestReset, resetPassword, busy } = useAuth()
  const [params] = useSearchParams()
  const navigate = useNavigate()
  const apiMessage = useApiMessage()

  const token = params.get('token')

  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [errors, setErrors] = useState({})
  const [sent, setSent] = useState(false)
  const [done, setDone] = useState(false)

  const onRequest = async (event) => {
    event.preventDefault()
    if (!email.trim()) return setErrors({ email: t('auth.errors.emailRequired') })
    if (!EMAIL_RE.test(email.trim())) return setErrors({ email: t('auth.errors.emailInvalid') })

    const result = await requestReset(email)
    if (!result.ok) return setErrors({ form: apiMessage(result.error) })
    return setSent(true)
  }

  const onReset = async (event) => {
    event.preventDefault()
    const next = {}
    if (password.length < 8) next.password = t('auth.errors.passwordShort')
    if (confirm !== password) next.confirm = t('auth.errors.mismatch')
    setErrors(next)
    if (Object.keys(next).length) return

    const result = await resetPassword({ token, password })
    if (!result.ok) return setErrors({ form: apiMessage(result.error) })

    setDone(true)
    // Every other session was revoked server-side, so signing in again is the
    // only sensible next step.
    setTimeout(() => navigate('/login', { replace: true }), 2500)
    return undefined
  }

  if (token) {
    return (
      <AuthShell image={images.resetBackdrop} asidePath="auth.reset.aside">
        {done ? (
          <div className="sent">
            <span className="sent__icon"><Icon name="checkCircle" size={28} /></span>
            <h1>{t('auth.reset.doneTitle')}</h1>
            <p className="auth__sub">{t('auth.reset.doneText')}</p>
            <Link to="/login" className="btn btn--primary btn--block btn--lg">
              {t('auth.reset.backToLogin')}
            </Link>
          </div>
        ) : (
          <>
            <h1>{t('auth.reset.newTitle')}</h1>
            <p className="auth__sub">{t('auth.reset.newSubtitle')}</p>

            <form onSubmit={onReset} noValidate>
              {errors.form && (
                <p className="auth__alert"><Icon name="alert" size={16} />{errors.form}</p>
              )}

              <Field
                label={t('auth.password')}
                icon="lock"
                type="password"
                name="password"
                value={password}
                onChange={(v) => { setPassword(v); setErrors((s) => ({ ...s, password: undefined })) }}
                placeholder={t('auth.passwordPlaceholder')}
                autoComplete="new-password"
                error={errors.password}
              />
              <PasswordMeter value={password} />

              <Field
                label={t('auth.confirm')}
                icon="lock"
                type="password"
                name="confirm"
                value={confirm}
                onChange={(v) => { setConfirm(v); setErrors((s) => ({ ...s, confirm: undefined })) }}
                placeholder={t('auth.passwordPlaceholder')}
                autoComplete="new-password"
                error={errors.confirm}
              />

              <button type="submit" className="btn btn--primary btn--block btn--lg" disabled={busy}>
                {busy ? t('auth.processing') : t('auth.reset.newSubmit')}
                {!busy && <Icon name="arrowRight" />}
              </button>
            </form>
          </>
        )}
      </AuthShell>
    )
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

          <form onSubmit={onRequest} noValidate>
            {errors.form && (
              <p className="auth__alert"><Icon name="alert" size={16} />{errors.form}</p>
            )}

            <Field
              label={t('auth.email')}
              icon="mail"
              type="email"
              name="email"
              value={email}
              onChange={(v) => { setEmail(v); setErrors({}) }}
              placeholder={t('auth.emailPlaceholder')}
              autoComplete="email"
              error={errors.email}
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
