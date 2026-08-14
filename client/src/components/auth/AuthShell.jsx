import { Link } from 'react-router-dom'
import Icon from '../ui/Icon.jsx'
import LanguageSwitcher from '../LanguageSwitcher.jsx'
import { useI18n } from '../../context/I18nContext.jsx'

/**
 * Shared frame for login / signup / reset / verify.
 *
 * Desktop: the form on the left where the eye starts, a quiet brand panel on
 * the right. Phone: the panel goes entirely and the form gets the screen —
 * every pixel spent on atmosphere is a pixel not spent on the fields, and this
 * is where most candidates arrive.
 *
 * The panel is drawn rather than photographed. A full-bleed Ken Burns image was
 * costing real frames on mid-range Android for decoration nobody reads.
 */
export default function AuthShell({ asidePath, children }) {
  const { t } = useI18n()

  return (
    <div className="auth">
      <div className="auth__main">
        <header className="auth__bar">
          <Link to="/" className="auth__brand">
            <img src="/logo.png" alt="" width="36" height="36" />
            <span>
              <strong>MeinRoots</strong>
              <small>{t('auth.tagline')}</small>
            </span>
          </Link>
          <LanguageSwitcher />
        </header>

        <main className="auth__body">
          <div className="auth__card">{children}</div>
        </main>

        <footer className="auth__foot">
          <Link to="/" className="auth__back">
            <Icon name="arrowRight" size={15} className="is-flipped" />
            {t('auth.backHome')}
          </Link>
          <span className="auth__trust">
            <Icon name="shield" size={14} />
            {t('trust.items.gdpr')}
          </span>
        </footer>
      </div>

      <aside className="auth__aside" aria-hidden="true">
        <span className="auth__glow" />
        <div className="auth__asideInner">
          <span className="auth__asideMark"><Icon name="sparkle" size={24} /></span>
          <h2>{t(`${asidePath}.title`)}</h2>
          <p>{t(`${asidePath}.text`)}</p>
          <ul>
            {t(`${asidePath}.points`).map((point) => (
              <li key={point}>
                <Icon name="checkCircle" size={17} />
                {point}
              </li>
            ))}
          </ul>
        </div>
        <div className="auth__asideFoot">
          <span><Icon name="shield" size={14} />{t('trust.items.gdpr')}</span>
          <span><Icon name="lock" size={14} />{t('trust.items.encrypted')}</span>
        </div>
      </aside>
    </div>
  )
}
