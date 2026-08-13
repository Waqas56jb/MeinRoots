import { useState } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import AuthShell from '../components/auth/AuthShell.jsx'
import Field from '../components/auth/Field.jsx'
import Icon from '../components/ui/Icon.jsx'
import { images } from '../data/content.js'
import { useI18n } from '../context/I18nContext.jsx'
import { useAuth } from '../context/AuthContext.jsx'
import { useApiMessage } from '../lib/apiMessage.js'

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/

export default function LoginPage() {
  const { t } = useI18n()
  const { login, busy } = useAuth()
  const navigate = useNavigate()
  const [params] = useSearchParams()
  const apiMessage = useApiMessage()

  const next = params.get('next') || '/dashboard'
  const gated = params.get('gate') === 'cv'

  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [errors, setErrors] = useState({})

  const validate = () => {
    const e = {}
    if (!email.trim()) e.email = t('auth.errors.emailRequired')
    else if (!EMAIL_RE.test(email.trim())) e.email = t('auth.errors.emailInvalid')
    if (!password) e.password = t('auth.errors.passwordRequired')
    setErrors(e)
    return Object.keys(e).length === 0
  }

  const onSubmit = async (event) => {
    event.preventDefault()
    if (!validate()) return
    const result = await login({ email, password })
    if (!result.ok) {
      setErrors({ form: apiMessage(result.error) })
      return
    }
    navigate(next, { replace: true })
  }

  return (
    <AuthShell image={images.authBackdrop} asidePath="auth.login.aside">
      {gated && (
        <div className="gate">
          <span className="gate__icon"><Icon name="lock" size={18} /></span>
          <div>
            <strong>{t('auth.gate.title')}</strong>
            <p>{t('auth.gate.text')}</p>
          </div>
        </div>
      )}

      <h1>{t('auth.login.title')}</h1>
      <p className="auth__sub">{t('auth.login.subtitle')}</p>

      <form onSubmit={onSubmit} noValidate>
        {errors.form && (
          <p className="auth__alert"><Icon name="alert" size={16} />{errors.form}</p>
        )}

        <Field
          label={t('auth.email')}
          icon="mail"
          type="email"
          name="email"
          value={email}
          onChange={(v) => { setEmail(v); setErrors((s) => ({ ...s, email: undefined, form: undefined })) }}
          placeholder={t('auth.emailPlaceholder')}
          autoComplete="email"
          error={errors.email}
        />

        <Field
          label={t('auth.password')}
          icon="lock"
          type="password"
          name="password"
          value={password}
          onChange={(v) => { setPassword(v); setErrors((s) => ({ ...s, password: undefined, form: undefined })) }}
          placeholder={t('auth.passwordPlaceholder')}
          autoComplete="current-password"
          error={errors.password}
        />

        <div className="auth__row">
          <label className="checkbox">
            <input type="checkbox" defaultChecked />
            <span className="checkbox__box"><Icon name="check" size={13} /></span>
            {t('auth.remember')}
          </label>
          <Link to="/reset-password" className="auth__link">{t('auth.login.forgot')}</Link>
        </div>

        <button type="submit" className="btn btn--primary btn--block btn--lg" disabled={busy}>
          {busy ? t('auth.processing') : t('auth.login.submit')}
          {!busy && <Icon name="arrowRight" />}
        </button>
      </form>

      <p className="auth__switch">
        {t('auth.login.noAccount')}{' '}
        <Link to={`/signup${next !== '/' ? `?next=${encodeURIComponent(next)}` : ''}`}>
          {t('auth.login.signupLink')}
        </Link>
      </p>
    </AuthShell>
  )
}
