import { useState } from 'react'
import Icon from '../components/Icon.jsx'
import { LanguageSwitcher } from '../components/Layout.jsx'
import logo from '../assets/logo.png'
import { useI18n } from '../context/I18nContext.jsx'
import { useAuth } from '../context/AuthContext.jsx'

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/

export default function LoginPage() {
  const { t, tError } = useI18n()
  const { login, busy } = useAuth()

  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [show, setShow] = useState(false)
  const [errors, setErrors] = useState({})

  const onSubmit = async (event) => {
    event.preventDefault()
    const next = {}
    if (!email.trim()) next.email = t('errors.email_required')
    else if (!EMAIL_RE.test(email.trim())) next.email = t('errors.email_invalid')
    if (!password) next.password = t('errors.password_required')
    setErrors(next)
    if (Object.keys(next).length) return

    const result = await login({ email, password })
    if (!result.ok) {
      setErrors({ form: result.error === 'not_admin' ? t('login.notAdmin') : tError(result.error) })
    }
    // On success there is nothing to do here: the session state changes and the
    // login route redirects. Navigating from this component as well is what
    // produced two navigations on one tick.
  }

  return (
    <div className="login">
      <div className="login__panel">
        <div className="login__top">
          <div className="login__brand">
            <img src={logo} alt="" width="38" height="38" />
            <span>
              <strong>{t('app.name')}</strong>
              <small>{t('app.console')}</small>
            </span>
          </div>
          <LanguageSwitcher />
        </div>

        <div className="login__form">
          <h1>{t('login.title')}</h1>
          <p className="login__sub">{t('login.subtitle')}</p>

          <form onSubmit={onSubmit} noValidate>
            {errors.form && (
              <p className="note note--bad"><Icon name="alert" size={16} />{errors.form}</p>
            )}

            <label className="field">
              <span className="field__label">{t('login.email')}</span>
              <span className={`field__box ${errors.email ? 'has-error' : ''}`}>
                <Icon name="mail" size={17} />
                <input
                  type="email"
                  name="email"
                  value={email}
                  autoComplete="username"
                  autoCapitalize="none"
                  autoCorrect="off"
                  spellCheck="false"
                  onChange={(e) => { setEmail(e.target.value); setErrors((s) => ({ ...s, email: undefined, form: undefined })) }}
                  placeholder="admin@meinroots.com"
                />
              </span>
              {errors.email && <span className="field__err">{errors.email}</span>}
            </label>

            <label className="field">
              <span className="field__label">{t('login.password')}</span>
              <span className={`field__box ${errors.password ? 'has-error' : ''}`}>
                <Icon name="lock" size={17} />
                <input
                  type={show ? 'text' : 'password'}
                  name="password"
                  value={password}
                  autoComplete="current-password"
                  onChange={(e) => { setPassword(e.target.value); setErrors((s) => ({ ...s, password: undefined, form: undefined })) }}
                  placeholder="••••••••"
                />
                <button
                  type="button"
                  className="field__reveal"
                  onClick={() => setShow((v) => !v)}
                  aria-label={show ? 'Hide password' : 'Show password'}
                >
                  <Icon name={show ? 'eyeOff' : 'eye'} size={17} />
                </button>
              </span>
              {errors.password && <span className="field__err">{errors.password}</span>}
            </label>

            <button type="submit" className="btn btn--primary btn--block btn--lg" disabled={busy}>
              {busy ? t('login.working') : t('login.submit')}
              {!busy && <Icon name="arrowRight" size={18} />}
            </button>
          </form>

          <p className="login__foot">
            <Icon name="shield" size={14} />
            {t('login.footnote')}
          </p>
        </div>
      </div>

      <aside className="login__aside" aria-hidden="true">
        <div className="login__asideInner">
          <Icon name="checks" size={30} />
          <p>{t('login.aside')}</p>
        </div>
      </aside>
    </div>
  )
}
