import { Link } from 'react-router-dom'
import Icon from './Icon.jsx'
import logo from '../assets/logo.png'
import { useI18n } from '../context/I18nContext.jsx'

/**
 * The frame around every signed-out screen.
 *
 * A two-column split on a wide screen, one column on a phone — and the aside is
 * the half that goes, not the form. Whatever a marketing panel is worth, it is
 * worth less than the field someone is trying to type into on a 360px screen.
 */
export default function AuthShell({ children, wide = false }) {
  const { t, locale, setLocale, locales } = useI18n()

  return (
    <div className={`auth ${wide ? 'auth--wide' : ''}`}>
      <div className="auth__panel">
        <div className="auth__inner">
          <Link to="/login" className="auth__brand">
            <img src={logo} alt="" width="34" height="34" />
            <span>
              <strong>MeinRoots</strong>
              <small>{t('app.portal')}</small>
            </span>
          </Link>

          {children}

          <div className="auth__langs" role="group" aria-label={t('common.language')}>
            {locales.map((l) => (
              <button
                key={l.code}
                type="button"
                className={l.code === locale ? 'is-on' : ''}
                onClick={() => setLocale(l.code)}
                aria-pressed={l.code === locale}
              >
                {l.code.toUpperCase()}
              </button>
            ))}
          </div>
        </div>
      </div>

      <aside className="auth__aside" aria-hidden="true">
        <div className="auth__asideInner">
          <p className="auth__asideEyebrow">{t('auth.aside.eyebrow')}</p>
          <h2>{t('auth.aside.title')}</h2>
          <ul className="auth__points">
            {['reach', 'ready', 'consent'].map((key) => (
              <li key={key}>
                <span><Icon name="check" size={14} /></span>
                <div>
                  <strong>{t(`auth.aside.points.${key}.title`)}</strong>
                  <p>{t(`auth.aside.points.${key}.text`)}</p>
                </div>
              </li>
            ))}
          </ul>
        </div>
      </aside>
    </div>
  )
}

/** One labelled field, with its own error slot so the layout never jumps. */
export function Field({
  label, name, type = 'text', value, onChange, error, hint, required,
  autoComplete, placeholder, inputMode, maxLength, children,
}) {
  const id = `f-${name}`
  return (
    <label className={`field ${error ? 'has-error' : ''}`} htmlFor={id}>
      <span className="field__label">
        {label}
        {required && <em aria-hidden="true">*</em>}
      </span>
      {children ?? (
        <input
          id={id}
          name={name}
          type={type}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          autoComplete={autoComplete}
          placeholder={placeholder}
          inputMode={inputMode}
          maxLength={maxLength}
          aria-invalid={error ? 'true' : undefined}
          aria-describedby={error ? `${id}-err` : hint ? `${id}-hint` : undefined}
        />
      )}
      {hint && !error && <span className="field__hint" id={`${id}-hint`}>{hint}</span>}
      {/* The icon means the message is not carried by colour alone. */}
      {error && (
        <span className="field__err" id={`${id}-err`}>
          <Icon name="alert" size={13} />{error}
        </span>
      )}
    </label>
  )
}
