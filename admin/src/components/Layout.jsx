import { useEffect, useRef, useState } from 'react'
import { NavLink, useLocation, useNavigate } from 'react-router-dom'
import Icon from './Icon.jsx'
// Imported rather than referenced by URL so Vite rewrites the path for whatever
// base the console is built for — root, a subpath, or another host entirely.
import logo from '../assets/logo.png'
import { useI18n } from '../context/I18nContext.jsx'
import { useAuth } from '../context/AuthContext.jsx'
import { useStats } from '../context/StatsContext.jsx'

/**
 * Navigation, grouped by what the admin is doing rather than listed flat.
 *
 * Only routes that exist appear here. There is no settings or analytics
 * section because the console has neither, and a navigation item that leads
 * nowhere is worse than a shorter menu.
 *
 * `badge` names the counter from the stats read that belongs on that item — the
 * flagged profiles waiting on the candidates page, the jobs that gave up on the
 * queue. It means an admin can see there is work without opening the page.
 */
const GROUPS = [
  {
    key: 'operations',
    items: [
      { to: '/', key: 'overview', icon: 'gauge', end: true, primary: true },
      { to: '/candidates', key: 'candidates', icon: 'users', badge: 'candidates', primary: true },
      { to: '/queue', key: 'queue', icon: 'layers', badge: 'queue', primary: true },
    ],
  },
  {
    // Milestone 2. Its own group: the candidate pipeline and the recruiter
    // ecosystem are different operations and mixing them into one list would
    // make neither scannable.
    key: 'market',
    items: [
      { to: '/recruiters', key: 'recruiters', icon: 'company', primary: true },
      { to: '/requests', key: 'requests', icon: 'message' },
      { to: '/subscriptions', key: 'subscriptions', icon: 'card' },
    ],
  },
  {
    key: 'insights',
    items: [{ to: '/audit', key: 'audit', icon: 'scroll' }],
  },
]

/**
 * The four the bar has room for. The rest are a tap away in the drawer.
 *
 * All seven used to go in, into a four-column grid, so the bar silently became
 * two rows — about 140px of a 667px phone. Nothing accounted for the second
 * row, so the last stretch of every page sat underneath it, and on the
 * candidate list that stretch is the pagination. The client reported it as a
 * missing next-page button; it was there, behind the navigation.
 */
const NAV = GROUPS.flatMap((g) => g.items).filter((i) => i.primary)

/**
 * @param drop  Which way the list opens. The sidebar footer sits at the bottom
 *              of the screen so it must open upward; anywhere near the top of a
 *              page it must open downward, or the list renders above the
 *              viewport and is simply invisible — which is exactly what
 *              happened on the login screen.
 */
function LanguageSwitcher({ variant = 'menu', drop = 'down', align = 'left' }) {
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
    <div className={`langmenu langmenu--${drop} langmenu--${align}`} ref={ref}>
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
export default function Layout({ title, subtitle, actions, meta, children }) {
  const { t } = useI18n()
  const { user, logout, isSuperAdmin } = useAuth()
  const { badges } = useStats()
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
        {GROUPS.map((group) => (
          <div key={group.key} className="side__group">
            <p className="side__groupLabel">{t(`nav.groups.${group.key}`)}</p>
            {group.items.map((item) => {
              const count = item.badge ? badges[item.badge] ?? 0 : 0
              return (
                <NavLink
                  key={item.to}
                  to={item.to}
                  end={item.end}
                  className={({ isActive }) => (isActive ? 'is-active' : '')}
                >
                  <Icon name={item.icon} size={18} />
                  <span>{t(`nav.${item.key}`)}</span>
                  {count > 0 && (
                    <span className="side__badge" aria-label={t('nav.waiting', { count })}>{count}</span>
                  )}
                </NavLink>
              )
            })}
          </div>
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
          {/* Bottom of the sidebar: the only place the list must open upward. */}
          <LanguageSwitcher drop="up" />
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
            {/*
              Two lines, then clip. The German page subtitles run considerably
              longer than the English, and a single clipped line turned several
              of them into a fragment and an ellipsis.
            */}
            {subtitle && <p>{subtitle}</p>}
          </div>

          {(meta || actions) && (
            <div className="topbar__actions">
              {meta}
              {actions}
            </div>
          )}
        </header>

        <main className="main" id="main">
          {children}
        </main>

        <nav className="tabbar" aria-label={t('nav.label')}>
          {NAV.map((item) => {
            const count = item.badge ? badges[item.badge] ?? 0 : 0
            return (
              <NavLink
                key={item.to}
                to={item.to}
                end={item.end}
                className={({ isActive }) => (isActive ? 'is-active' : '')}
              >
                <span className="tabbar__icon">
                  <Icon name={item.icon} size={19} />
                  {count > 0 && <span className="tabbar__dot" aria-label={t('nav.waiting', { count })} />}
                </span>
                <span>{t(`nav.${item.key}`)}</span>
              </NavLink>
            )
          })}
        </nav>
      </div>
    </div>
  )
}

export { LanguageSwitcher }
