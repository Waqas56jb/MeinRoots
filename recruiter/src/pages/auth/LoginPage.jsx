import { useState } from 'react'
import { Link, useNavigate, useLocation } from 'react-router-dom'
import AuthShell, { Field } from '../../components/AuthShell.jsx'
import Icon from '../../components/Icon.jsx'
import { useI18n } from '../../context/I18nContext.jsx'
import { useAuth } from '../../context/AuthContext.jsx'

export default function LoginPage() {
  const { t, tError } = useI18n()
  const { login, busy } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()

  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [show, setShow] = useState(false)
  const [error, setError] = useState('')

  const submit = async (e) => {
    e.preventDefault()
    setError('')
    const result = await login({ email: email.trim(), password })
    if (!result.ok) {
      // A candidate or an admin signing in here gets told plainly which door
      // they are at, rather than "wrong password" for a password that was right.
      setError(result.error === 'not_a_recruiter' ? t('auth.errors.notRecruiter') : tError(result.error))
      return
    }
    navigate(location.state?.from ?? '/dashboard', { replace: true })
  }

  return (
    <AuthShell>
      <h1>{t('auth.login.title')}</h1>
      <p className="auth__sub">{t('auth.login.subtitle')}</p>

      <form onSubmit={submit} noValidate>
        {error && <p className="auth__alert" role="alert"><Icon name="alert" size={16} />{error}</p>}

        <Field
          label={t('auth.email')}
          name="email"
          type="email"
          value={email}
          onChange={(v) => { setEmail(v); setError('') }}
          autoComplete="username"
          placeholder={t('auth.emailPlaceholder')}
          required
        />

        <Field label={t('auth.password')} name="password" required>
          <span className="field__box">
            <input
              id="f-password"
              name="password"
              type={show ? 'text' : 'password'}
              value={password}
              onChange={(e) => { setPassword(e.target.value); setError('') }}
              autoComplete="current-password"
            />
            <button
              type="button"
              className="field__reveal"
              onClick={() => setShow((v) => !v)}
              aria-label={t(show ? 'auth.hidePassword' : 'auth.showPassword')}
            >
              <Icon name={show ? 'eyeOff' : 'eye'} size={17} />
            </button>
          </span>
        </Field>

        <div className="auth__row">
          <Link to="/forgot-password">{t('auth.login.forgot')}</Link>
        </div>

        <button type="submit" className="btn btn--primary btn--block btn--lg" disabled={busy}>
          {busy ? t('common.loading') : t('auth.login.submit')}
          {!busy && <Icon name="arrowRight" size={17} />}
        </button>
      </form>

      <p className="auth__switch">
        {t('auth.login.noAccount')} <Link to="/register">{t('auth.login.registerLink')}</Link>
      </p>
    </AuthShell>
  )
}
