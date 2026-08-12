import { Link } from 'react-router-dom'
import Icon from '../ui/Icon.jsx'
import LanguageSwitcher from '../LanguageSwitcher.jsx'
import { Brand } from '../Navbar.jsx'
import { useI18n } from '../../context/I18nContext.jsx'

/**
 * Shared frame for login / signup / reset.
 * Left: the brand panel. Right: the form. Collapses to a single column on
 * tablets and phones, where the panel becomes a short banner above the form.
 */
export default function AuthShell({ image, asidePath, children }) {
  const { t } = useI18n()

  return (
    <div className="auth">
      <aside className="auth__aside">
        <img src={image} alt="" className="auth__asideImg" loading="eager" referrerPolicy="no-referrer" />
        <span className="auth__asideVeil" aria-hidden="true" />
        <span className="auth__asideAurora" aria-hidden="true"><i /><i /></span>

        <div className="auth__asideTop">
          <Brand to="/" />
        </div>

        <div className="auth__asideBody">
          <h2>{t(`${asidePath}.title`)}</h2>
          <p>{t(`${asidePath}.text`)}</p>
          <ul>
            {t(`${asidePath}.points`).map((p) => (
              <li key={p}><Icon name="checkCircle" size={17} />{p}</li>
            ))}
          </ul>
        </div>

        <div className="auth__asideFoot">
          <span><Icon name="shield" size={14} /> {t('footer.meta')[0]}</span>
          <span><Icon name="lock" size={14} /> {t('footer.meta')[2]}</span>
        </div>
      </aside>

      <div className="auth__form">
        <header className="auth__bar">
          <Link to="/" className="auth__back">
            <Icon name="arrowRight" size={16} className="is-flipped" />
            <span>{t('auth.backHome')}</span>
          </Link>
          <LanguageSwitcher />
        </header>

        <div className="auth__body">
          <div className="auth__card">{children}</div>
        </div>
      </div>
    </div>
  )
}
