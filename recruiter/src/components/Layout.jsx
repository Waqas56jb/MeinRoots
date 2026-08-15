import { useEffect, useRef, useState } from 'react'
import { Link, NavLink, useLocation, useNavigate } from 'react-router-dom'
import Icon from './Icon.jsx'
import { PlanBadge } from './ui.jsx'
import logo from '../assets/logo.png'
import { useI18n } from '../context/I18nContext.jsx'
import { useAuth } from '../context/AuthContext.jsx'
import { useAccount } from '../context/AccountContext.jsx'

/**
 * The portal shell.
 *
 * Deliberately not the console's shell. The review console is a dark, dense
 * operations tool for staff; this is a light, roomier workspace a customer pays
 * for and spends their day in. They share the brand and the spacing scale and
 * nothing else — three products that look identical are three products nobody
 * can tell apart when they have all three open.
 *
 * Three layouts from one markup:
 *   ≥1080px  fixed sidebar
 *   <1080px  sidebar becomes a drawer behind the menu button
 *   <760px   plus a bottom bar for the four things reached most often
 */

const GROUPS = [
  {
    key: 'discover',
    items: [
      { to: '/dashboard', key: 'dashboard', icon: 'gauge', end: true, primary: true },
      { to: '/candidates', key: 'candidates', icon: 'search', primary: true },
      { to: '/saved', key: 'saved', icon: 'bookmark', primary: true },
    ],
  },
  {
    key: 'recruitment',
    items: [
      { to: '/requests', key: 'requests', icon: 'message', primary: true },
      { to: '/pipeline', key: 'pipeline', icon: 'workflow' },
    ],
  },
  {
    key: 'company',
    items: [
      { to: '/company', key: 'company', icon: 'company' },
      { to: '/team', key: 'team', icon: 'users' },
    ],
  },
  {
    key: 'billing',
    items: [
      { to: '/billing', key: 'billing', icon: 'card' },
      { to: '/plans', key: 'plans', icon: 'layers' },
    ],
  },
]

const SETTINGS = { to: '/settings', key: 'settings', icon: 'settings' }

/** The bottom bar carries only what a thumb reaches for most. */
const TABS = GROUPS.flatMap((g) => g.items).filter((i) => i.primary)

export default function Layout({ title, subtitle, actions, meta, narrow, children }) {
  const { t } = useI18n()
  const { user, logout } = useAuth()
  const { company, subscription, isTrial, trialDaysLeft, plan } = useAccount()
  const navigate = useNavigate()
  const location = useLocation()
  const [drawer, setDrawer] = useState(false)
  const [menu, setMenu] = useState(false)
  const menuRef = useRef(null)

  useEffect(() => setDrawer(false), [location.pathname])

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

  const onLogout = async () => {
    await logout()
    navigate('/login', { replace: true })
  }

  const initials = (user?.name ?? '')
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0].toUpperCase())
    .join('')

  const sidebar = (
    <>
      <Link to="/dashboard" className="side__brand">
        <img src={logo} alt="" width="32" height="32" />
        <span>
          <strong>MeinRoots</strong>
          <small>{t('app.portal')}</small>
        </span>
      </Link>

      <nav className="side__nav" aria-label={t('nav.label')}>
        {GROUPS.map((group) => (
          <div key={group.key} className="side__group">
            <p className="side__groupLabel">{t(`nav.groups.${group.key}`)}</p>
            {group.items.map((item) => (
              <NavLink
                key={item.to}
                to={item.to}
                end={item.end}
                className={({ isActive }) => (isActive ? 'is-active' : '')}
              >
                <Icon name={item.icon} size={18} />
                <span>{t(`nav.${item.key}`)}</span>
              </NavLink>
            ))}
          </div>
        ))}
        <div className="side__group side__group--last">
          <NavLink to={SETTINGS.to} className={({ isActive }) => (isActive ? 'is-active' : '')}>
            <Icon name={SETTINGS.icon} size={18} />
            <span>{t(`nav.${SETTINGS.key}`)}</span>
          </NavLink>
        </div>
      </nav>

      <div className="side__foot">
        {/* The company this seat belongs to. A recruiter with two employers on
            one machine should never have to guess which one they are in. */}
        {company?.legalName && (
          <div className="side__company">
            <span className="side__companyIcon"><Icon name="company" size={15} /></span>
            <span className="side__companyName">{company.tradingName || company.legalName}</span>
          </div>
        )}
        {plan && (
          <div className="side__plan">
            <PlanBadge plan={plan} status={subscription?.status} />
            {isTrial && trialDaysLeft !== null && (
              <span className="side__trialDays num">{t('billing.daysLeft', { count: trialDaysLeft })}</span>
            )}
          </div>
        )}
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

          <div className="topbar__actions">
            {meta}
            {actions}

            <div className="accountmenu" ref={menuRef}>
              <button
                type="button"
                className="accountmenu__trigger"
                onClick={() => setMenu((v) => !v)}
                aria-haspopup="true"
                aria-expanded={menu}
                aria-label={t('nav.account')}
              >
                <span className="avatar" aria-hidden="true">{initials || 'R'}</span>
                <Icon name="chevronDown" size={15} />
              </button>

              <div className={`accountmenu__pop ${menu ? 'is-open' : ''}`} role="menu">
                <div className="accountmenu__head">
                  <strong>{user?.name}</strong>
                  <small>{user?.email}</small>
                </div>
                <Link to="/settings" role="menuitem" onClick={() => setMenu(false)}>
                  <Icon name="settings" size={16} />{t('nav.settings')}
                </Link>
                <Link to="/company" role="menuitem" onClick={() => setMenu(false)}>
                  <Icon name="company" size={16} />{t('nav.company')}
                </Link>
                <button type="button" role="menuitem" onClick={onLogout}>
                  <Icon name="logout" size={16} />{t('common.logout')}
                </button>
              </div>
            </div>
          </div>
        </header>

        <main className={narrow ? 'main main--narrow' : 'main'} id="main">
          <TrialBanner />
          {children}
        </main>

        <nav className="tabbar" aria-label={t('nav.label')}>
          {TABS.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.end}
              className={({ isActive }) => (isActive ? 'is-active' : '')}
            >
              <Icon name={item.icon} size={19} />
              <span>{t(`nav.${item.key}`)}</span>
            </NavLink>
          ))}
        </nav>
      </div>
    </div>
  )
}

/**
 * How much trial is left, on every page.
 *
 * Only while it is genuinely running, and it never uses colour alone to say so:
 * the number of days is written out, because "your trial is nearly over" is
 * information a customer is entitled to read rather than infer from an amber
 * background.
 */
function TrialBanner() {
  const { t } = useI18n()
  const { isTrial, trialDaysLeft, subscription } = useAccount()
  const { locale } = useI18n()

  if (!isTrial || trialDaysLeft === null) return null
  const urgent = trialDaysLeft <= 2

  return (
    <div className={`trialbar ${urgent ? 'trialbar--urgent' : ''}`}>
      <span className="trialbar__icon"><Icon name="clock" size={17} /></span>
      <div className="trialbar__body">
        <strong>{t('billing.trialDaysLeft', { count: trialDaysLeft })}</strong>
        <span>
          {subscription?.trialEndsAt
            ? t('billing.trialEnds', {
                date: new Intl.DateTimeFormat(locale, { dateStyle: 'long' }).format(
                  new Date(subscription.trialEndsAt),
                ),
              })
            : t('billing.trialIncludes')}
        </span>
      </div>
      <Link to="/plans" className="btn btn--primary btn--sm">{t('billing.viewPlans')}</Link>
    </div>
  )
}
