import { useState } from 'react'
import Icon from '../components/Icon.jsx'
import { LanguageSwitcher } from '../components/Layout.jsx'
import { useI18n } from '../context/I18nContext.jsx'
import { useAuth } from '../context/AuthContext.jsx'
import logo from '../assets/logo.png'

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/

/**
 * The console's front door.
 *
 * Two panels on a desktop, one on a phone. The decorative panel is the first
 * thing to go when space is short — the form is the page, and on a 360px screen
 * every pixel spent on atmosphere is a pixel not spent on the fields.
 */
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
    // On success the login route redirects; navigating from here as well would
    // produce two navigations on one tick.
  }

  return (
    <div className="login">
      <div className="login__panel">
        <header className="login__top">
          <span className="login__brand">
            <img src={logo} alt="" width="38" height="38" />
            <span>
              <strong>{t('app.name')}</strong>
              <small>{t('app.console')}</small>
            </span>
          </span>
          {/* Anchored right and opening downward: the trigger sits at the top
              of the screen, where an upward list would be off-viewport. */}
          <LanguageSwitcher drop="down" align="right" />
        </header>

        <main className="login__form">
          <span className="login__badge">
            <Icon name="shield" size={14} />
            {t('login.internal')}
          </span>

          <h1>{t('login.title')}</h1>
          <p className="login__sub">{t('login.subtitle')}</p>

          <form onSubmit={onSubmit} noValidate>
            {errors.form && (
              <p className="note note--bad" role="alert">
                <Icon name="alert" size={16} />
                {errors.form}
              </p>
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
                  enterKeyHint="next"
                  onChange={(e) => {
                    setEmail(e.target.value)
                    setErrors((s) => ({ ...s, email: undefined, form: undefined }))
                  }}
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
                  enterKeyHint="go"
                  onChange={(e) => {
                    setPassword(e.target.value)
                    setErrors((s) => ({ ...s, password: undefined, form: undefined }))
                  }}
                  placeholder="••••••••"
                />
                <button
                  type="button"
                  className="field__reveal"
                  onClick={() => setShow((v) => !v)}
                  aria-label={show ? t('login.hidePassword') : t('login.showPassword')}
                >
                  <Icon name={show ? 'eyeOff' : 'eye'} size={18} />
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
            <Icon name="scroll" size={14} />
            {t('login.footnote')}
          </p>
        </main>
      </div>

      <aside className="login__aside" aria-hidden="true">
        <span className="login__glow" />
        <div className="login__asideInner">
          <span className="login__asideIcon"><Icon name="checks" size={26} /></span>
          <p>{t('login.aside')}</p>
          <ul className="login__points">
            <li><Icon name="sparkle" size={15} />{t('login.point1')}</li>
            <li><Icon name="shield" size={15} />{t('login.point2')}</li>
            <li><Icon name="scroll" size={15} />{t('login.point3')}</li>
          </ul>
        </div>
      </aside>
    </div>
  )
}
