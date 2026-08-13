import { useEffect, useRef, useState } from 'react'
import { NavLink, useLocation, useNavigate } from 'react-router-dom'
import Icon from './Icon.jsx'
// Imported rather than referenced by URL so Vite rewrites the path for whatever
// base the console is built for — root, a subpath, or another host entirely.
import logo from '../assets/logo.png'
import { useI18n } from '../context/I18nContext.jsx'
import { useAuth } from '../context/AuthContext.jsx'

const NAV = [
  { to: '/', key: 'overview', icon: 'gauge', end: true },
  { to: '/candidates', key: 'candidates', icon: 'users' },
  { to: '/queue', key: 'queue', icon: 'layers' },
  { to: '/audit', key: 'audit', icon: 'scroll' },
]

function LanguageSwitcher({ variant = 'menu' }) {
  const { locale, setLocale, locales, t } = useI18n()
  const { syncLocale } = useAuth()
  const [open, setOpen] = useState(false)
  const ref = useRef(null)

  useEffect(() => {
    if (!open) return undefined
    const onDown = (e) => {
      if (!ref.current?.contains(e.target)) setOpen(false)
    }
    const onKey = (e) => {
      if (e.key === 'Escape') setOpen(false)
    }
    document.addEventListener('pointerdown', onDown)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('pointerdown', onDown)
      document.removeEventListener('keydown', onKey)
    }
  }, [open])

  const choose = (code) => {
    setLocale(code)
    // Keep the account's language in step, so notification copy matches.
    syncLocale(code)
    setOpen(false)
  }

  if (variant === 'inline') {
    return (
      <div className="langinline">
        {locales.map((l) => (
          <button
            key={l.code}
            type="button"
            className={l.code === locale ? 'is-on' : ''}
            onClick={() => choose(l.code)}
          >
            <span aria-hidden="true">{l.flag}</span>
            {l.native}
          </button>
        ))}
      </div>
    )
  }

  const current = locales.find((l) => l.code === locale)

  return (
    <div className="langmenu" ref={ref}>
      <button
        type="button"
        className="langmenu__trigger"
        onClick={() => setOpen((v) => !v)}
        aria-haspopup="true"
        aria-expanded={open}
        aria-label={t('common.language')}
      >
        <span aria-hidden="true">{current?.flag}</span>
        <span className="langmenu__code">{locale.toUpperCase()}</span>
        <Icon name="chevronDown" size={14} className={open ? 'is-flipped' : ''} />
      </button>
      <div className={`langmenu__pop ${open ? 'is-open' : ''}`} role="menu">
        {locales.map((l) => (
          <button
            key={l.code}
            type="button"
            role="menuitem"
            className={l.code === locale ? 'is-active' : ''}
            onClick={() => choose(l.code)}
          >
            <span aria-hidden="true">{l.flag}</span>
            {l.native}
            {l.code === locale && <Icon name="check" size={15} />}
          </button>
        ))}
      </div>
    </div>
  )
}

/**
 * The console shell.
 *
 * Three layouts from one markup, because an admin reviewing a flagged profile
 * on a phone between meetings should not get a shrunken desktop table:
 *   ≥1100px  fixed sidebar
 *   <1100px  sidebar becomes a slide-in drawer behind the burger
 *   <760px   plus a bottom tab bar, which is where a thumb actually reaches
 */
export default function Layout({ title, subtitle, actions, children }) {
  const { t } = useI18n()
  const { user, logout, isSuperAdmin } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()
  const [drawer, setDrawer] = useState(false)

  // Any navigation closes the drawer, including the browser's back button.
  useEffect(() => setDrawer(false), [location.pathname])

  // Locking the body stops iOS scrolling the page underneath the open drawer.
  useEffect(() => {
    document.body.classList.toggle('is-locked', drawer)
    return () => document.body.classList.remove('is-locked')
  }, [drawer])

  const onLogout = async () => {
    await logout()
    navigate('/login', { replace: true })
  }

  const initials = (user?.name ?? '')
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0].toUpperCase())
    .join('')

  const sidebar = (
    <>
      <div className="side__brand">
        <img src={logo} alt="" width="34" height="34" />
        <span>
          <strong>{t('app.name')}</strong>
          <small>{t('app.console')}</small>
        </span>
      </div>

      <nav className="side__nav" aria-label={t('nav.label')}>
        {NAV.map((item) => (
          <NavLink key={item.to} to={item.to} end={item.end} className={({ isActive }) => (isActive ? 'is-active' : '')}>
            <Icon name={item.icon} size={19} />
            <span>{t(`nav.${item.key}`)}</span>
          </NavLink>
        ))}
        {/* Deliberately no link to the candidate site. The two applications
            stay unlinked in both directions so neither advertises the other. */}
      </nav>

      <div className="side__foot">
        <div className="side__user">
          <span className="avatar" aria-hidden="true">{initials || 'M'}</span>
          <span className="side__userText">
            <strong>{user?.name}</strong>
            <small>{isSuperAdmin ? 'Super admin' : 'Admin'}</small>
          </span>
        </div>
        <div className="side__footRow">
          <LanguageSwitcher />
          <button type="button" className="btn btn--ghost btn--sm" onClick={onLogout}>
            <Icon name="logout" size={16} /> {t('common.logout')}
          </button>
        </div>
      </div>
    </>
  )

  return (
    <div className="shell">
      <a className="skip" href="#main">{t('common.skip')}</a>

      <aside className="side side--fixed">{sidebar}</aside>

      <div className={`drawer ${drawer ? 'is-open' : ''}`}>
        <aside className="side side--drawer">{sidebar}</aside>
        <button
          type="button"
          className="drawer__scrim"
          onClick={() => setDrawer(false)}
          aria-label={t('common.close')}
          tabIndex={drawer ? 0 : -1}
        />
      </div>

      <div className="shell__body">
        <header className="topbar">
          <button
            type="button"
            className="topbar__burger"
            onClick={() => setDrawer(true)}
            aria-label={t('common.menu')}
            aria-expanded={drawer}
          >
            <Icon name="menu" size={20} />
          </button>

          <div className="topbar__title">
            <h1>{title}</h1>
            {subtitle && <p>{subtitle}</p>}
          </div>

          {actions && <div className="topbar__actions">{actions}</div>}
        </header>

        <main className="main" id="main">
          {children}
        </main>

        <nav className="tabbar" aria-label={t('nav.label')}>
          {NAV.map((item) => (
            <NavLink key={item.to} to={item.to} end={item.end} className={({ isActive }) => (isActive ? 'is-active' : '')}>
              <Icon name={item.icon} size={20} />
              <span>{t(`nav.${item.key}`)}</span>
            </NavLink>
          ))}
        </nav>
      </div>
    </div>
  )
}

export { LanguageSwitcher }
