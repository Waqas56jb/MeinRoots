import { Link, NavLink, useNavigate } from 'react-router-dom'
import Icon from '../ui/Icon.jsx'
import LanguageSwitcher from '../LanguageSwitcher.jsx'
import { Brand } from '../Navbar.jsx'
import { useI18n } from '../../context/I18nContext.jsx'
import { useAuth } from '../../context/AuthContext.jsx'

/**
 * Header for the signed-in screens.
 *
 * Separate from the marketing Navbar on purpose: that one is built around
 * anchor links into the landing page, which do not exist once someone is inside
 * the product.
 *
 * There is deliberately no link to the review console here, or anywhere else in
 * this application. The console is internal tooling on its own origin, and a
 * link would advertise its address to every candidate who signs in.
 */
export default function AppHeader() {
  const { t } = useI18n()
  const { user, logout } = useAuth()
  const navigate = useNavigate()

  const onLogout = async () => {
    await logout()
    navigate('/', { replace: true })
  }

  return (
    <header className="upload__bar">
      <div className="container upload__barInner">
        <Brand />

        <nav className="appnav" aria-label={t('app.nav.label')}>
          <NavLink to="/dashboard" className={({ isActive }) => (isActive ? 'is-active' : '')}>
            <Icon name="gauge" size={16} /> {t('app.nav.dashboard')}
          </NavLink>
          <NavLink to="/questionnaire" className={({ isActive }) => (isActive ? 'is-active' : '')}>
            <Icon name="clipboard" size={16} /> {t('app.nav.questionnaire')}
          </NavLink>
          <NavLink to="/upload" className={({ isActive }) => (isActive ? 'is-active' : '')}>
            <Icon name="upload" size={16} /> {t('app.nav.cv')}
          </NavLink>
        </nav>

        <div className="upload__barActions">
          <LanguageSwitcher />
          <Link to="/dashboard" className="upload__who">
            <span className="nav__avatar" aria-hidden="true">
              {user?.name?.trim().charAt(0).toUpperCase() || 'M'}
            </span>
            <span>
              <small>{t('auth.upload.signedInAs')}</small>
              <strong>{user?.name}</strong>
            </span>
          </Link>
          <button type="button" className="upload__logout" onClick={onLogout} aria-label={t('nav.logout')}>
            <Icon name="logout" size={18} />
          </button>
        </div>
      </div>
    </header>
  )
}
