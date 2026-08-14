import { Link, useLocation } from 'react-router-dom'
import Icon from '../components/ui/Icon.jsx'
import LanguageSwitcher from '../components/LanguageSwitcher.jsx'
import { useI18n } from '../context/I18nContext.jsx'
import { useAuth } from '../context/AuthContext.jsx'

/**
 * A real 404.
 *
 * Every unknown path used to redirect silently to the landing page, which makes
 * a broken link look like the site swallowed it — the visitor cannot tell
 * whether they mistyped, whether the page moved, or whether something failed.
 * Saying so plainly, and offering the two or three places they probably wanted,
 * is both more honest and more useful.
 */
export default function NotFoundPage() {
  const { t } = useI18n()
  const { isAuthenticated } = useAuth()
  const { pathname } = useLocation()

  return (
    <div className="nf">
      <header className="nf__bar">
        <Link to="/" className="auth__brand">
          <img src="/logo.png" alt="" width="36" height="36" />
          <span>
            <strong>MeinRoots</strong>
            <small>{t('auth.tagline')}</small>
          </span>
        </Link>
        <LanguageSwitcher />
      </header>

      <main className="nf__body">
        <span className="nf__code" aria-hidden="true">404</span>
        <h1>{t('notFound.title')}</h1>
        <p>{t('notFound.text')}</p>

        {/* The path is shown so a mistyped URL is obvious at a glance. */}
        <code className="nf__path">{pathname}</code>

        <div className="nf__actions">
          <Link to={isAuthenticated ? '/dashboard' : '/'} className="btn btn--primary btn--lg">
            {isAuthenticated ? t('app.nav.dashboard') : t('notFound.home')}
            <Icon name="arrowRight" size={17} />
          </Link>
          {isAuthenticated ? (
            <Link to="/cv" className="btn btn--ghost btn--lg">
              <Icon name="fileText" size={16} />
              {t('app.nav.cv')}
            </Link>
          ) : (
            <Link to="/login" className="btn btn--ghost btn--lg">
              {t('nav.login')}
            </Link>
          )}
        </div>
      </main>

      <footer className="nf__foot">
        <Icon name="shield" size={14} />
        {t('trust.items.gdpr')}
      </footer>
    </div>
  )
}
