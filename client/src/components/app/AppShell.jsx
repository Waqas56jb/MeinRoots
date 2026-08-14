import { useEffect, useRef, useState } from 'react'
import { Link, NavLink, useLocation, useNavigate } from 'react-router-dom'
import Icon from '../ui/Icon.jsx'
import LanguageSwitcher from '../LanguageSwitcher.jsx'
import { useI18n } from '../../context/I18nContext.jsx'
import { useAuth } from '../../context/AuthContext.jsx'

/**
 * The signed-in workspace.
 *
 * Three layouts from one markup:
 *   ≥1180px  full sidebar, labels visible
 *   ≥900px   sidebar collapses to icons — a tablet keeps the navigation, it
 *            just stops spending 240px on it
 *   <900px   sidebar becomes a drawer behind the header button
 *
 * Only routes that exist are listed. Nothing here links to the review console:
 * that is a separate application on its own origin.
 */

const NAV = [
  { to: '/dashboard', key: 'dashboard', icon: 'layoutDashboard', end: true },
  { to: '/cv', key: 'cv', icon: 'fileText' },
  { to: '/profile', key: 'profile', icon: 'userCircle' },
  { to: '/readiness', key: 'readiness', icon: 'target' },
  { to: '/recommendations', key: 'recommendations', icon: 'listChecks' },
  { to: '/questionnaire', key: 'questionnaire', icon: 'clipboard' },
]

const SETTINGS = { to: '/settings', key: 'settings', icon: 'settings' }

/** Persisted so the choice survives a reload — it is a workspace preference. */
const COLLAPSE_KEY = 'meinroots.nav.collapsed'

export default function AppShell({ title, subtitle, eyebrow, actions, children, badges = {} }) {
  const { t } = useI18n()
  const { user, logout, syncLocale } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()

  const [drawer, setDrawer] = useState(false)
  const [collapsed, setCollapsed] = useState(() => {
    try {
      return window.localStorage.getItem(COLLAPSE_KEY) === '1'
    } catch {
      return false
    }
  })
  const [menu, setMenu] = useState(false)
  const menuRef = useRef(null)

  // Any navigation closes the drawer, including the browser's back button.
  useEffect(() => setDrawer(false), [location.pathname])

  // Locking the body stops iOS scrolling the page underneath the open drawer.
  useEffect(() => {
    document.body.classList.toggle('is-locked', drawer)
    return () => document.body.classList.remove('is-locked')
  }, [drawer])

  useEffect(() => {
    if (!menu) return undefined
    const onDown = (e) => {
      if (!menuRef.current?.contains(e.target)) setMenu(false)
    }
    const onKey = (e) => e.key === 'Escape' && setMenu(false)
    document.addEventListener('pointerdown', onDown)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('pointerdown', onDown)
      document.removeEventListener('keydown', onKey)
    }
  }, [menu])

  const toggleCollapse = () => {
    setCollapsed((v) => {
      try {
        window.localStorage.setItem(COLLAPSE_KEY, v ? '0' : '1')
      } catch {
        /* preference simply will not persist */
      }
      return !v
    })
  }

  const onLogout = async () => {
    await logout()
    navigate('/', { replace: true })
  }

  const initials = (user?.name ?? '')
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0].toUpperCase())
    .join('')

  const navItem = (item) => (
    <NavLink
      key={item.to}
      to={item.to}
      end={item.end}
      className={({ isActive }) => (isActive ? 'is-active' : '')}
      title={collapsed ? t(`app.nav.${item.key}`) : undefined}
    >
      <span className="ws__navIcon"><Icon name={item.icon} size={19} /></span>
      <span className="ws__navLabel">{t(`app.nav.${item.key}`)}</span>
      {badges[item.key] > 0 && <span className="ws__navBadge">{badges[item.key]}</span>}
    </NavLink>
  )

  /**
   * `inDrawer` exists for one reason: the top bar drops the language switcher on
   * a phone to keep the header uncluttered, which left changing language buried
   * in settings — a poor outcome for a product whose users may not read the
   * interface language well. The drawer carries it instead.
   */
  const sidebar = (inDrawer = false) => (
    <>
      <Link to="/dashboard" className="ws__brand">
        <img src="/logo.png" alt="" width="36" height="36" />
        <span className="ws__brandText">
          <strong>MeinRoots</strong>
          <small>{t('app.shell.workspace')}</small>
        </span>
      </Link>

      <nav className="ws__nav" aria-label={t('app.nav.label')}>
        {NAV.map(navItem)}
        <span className="ws__navSpacer" />
        {navItem(SETTINGS)}
      </nav>

      <div className="ws__foot">
        {inDrawer && (
          <div className="ws__drawerLang">
            <span className="ws__drawerLangLabel">{t('nav.language')}</span>
            {/* A flat list rather than a dropdown: at the bottom of a drawer a
                popup has nowhere to open into. */}
            <LanguageSwitcher variant="inline" onChange={syncLocale} />
          </div>
        )}

        <div className="ws__user">
          <span className="ws__avatar" aria-hidden="true">{initials || 'M'}</span>
          <span className="ws__userText">
            <strong>{user?.name}</strong>
            <small>{user?.email}</small>
          </span>
        </div>
        <button type="button" className="ws__logout" onClick={onLogout}>
          <Icon name="logout" size={17} />
          <span className="ws__navLabel">{t('nav.logout')}</span>
        </button>
      </div>
    </>
  )

  return (
    <div className={`ws ${collapsed ? 'is-collapsed' : ''}`}>
      <a className="skip-link" href="#main">{t('common.skip')}</a>

      <aside className="ws__side ws__side--fixed">{sidebar()}</aside>

      <div className={`ws__drawer ${drawer ? 'is-open' : ''}`}>
        <aside className="ws__side ws__side--drawer">{sidebar(true)}</aside>
        <button
          type="button"
          className="ws__scrim"
          onClick={() => setDrawer(false)}
          aria-label={t('common.close')}
          tabIndex={drawer ? 0 : -1}
        />
      </div>

      <div className="ws__body">
        <header className="ws__top">
          <button
            type="button"
            className="ws__burger"
            onClick={() => setDrawer(true)}
            aria-label={t('nav.menu')}
            aria-expanded={drawer}
          >
            <Icon name="menu" size={20} />
          </button>

          <button
            type="button"
            className="ws__collapse"
            onClick={toggleCollapse}
            aria-label={t(collapsed ? 'app.shell.expand' : 'app.shell.collapse')}
            title={t(collapsed ? 'app.shell.expand' : 'app.shell.collapse')}
          >
            <Icon name={collapsed ? 'panelOpen' : 'panelClose'} size={19} />
          </button>

          <div className="ws__title">
            {eyebrow && <span className="ws__eyebrow">{eyebrow}</span>}
            <h1>{title}</h1>
            {subtitle && <p>{subtitle}</p>}
          </div>

          <div className="ws__topActions">
            {actions}
            <LanguageSwitcher onChange={syncLocale} />

            <div className="ws__menu" ref={menuRef}>
              <button
                type="button"
                className="ws__menuTrigger"
                onClick={() => setMenu((v) => !v)}
                aria-haspopup="true"
                aria-expanded={menu}
                aria-label={t('nav.account')}
              >
                <span className="ws__avatar ws__avatar--sm" aria-hidden="true">{initials || 'M'}</span>
                <Icon name="chevronDown" size={15} />
              </button>

              <div className={`ws__menuPop ${menu ? 'is-open' : ''}`} role="menu">
                <div className="ws__menuHead">
                  <strong>{user?.name}</strong>
                  <small>{user?.email}</small>
                </div>
                <Link to="/profile" role="menuitem" onClick={() => setMenu(false)}>
                  <Icon name="userCircle" size={16} />{t('app.nav.profile')}
                </Link>
                <Link to="/settings" role="menuitem" onClick={() => setMenu(false)}>
                  <Icon name="settings" size={16} />{t('app.nav.settings')}
                </Link>
                <button type="button" role="menuitem" onClick={onLogout}>
                  <Icon name="logout" size={16} />{t('nav.logout')}
                </button>
              </div>
            </div>
          </div>
        </header>

        <main className="ws__main" id="main">
          {children}
        </main>
      </div>
    </div>
  )
}
