import { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import Icon from './ui/Icon.jsx'
import LanguageSwitcher from './LanguageSwitcher.jsx'
import { navSections } from '../data/content.js'
import { useScrolled } from '../hooks/useReveal.js'
import { useI18n } from '../context/I18nContext.jsx'
import { useAuth } from '../context/AuthContext.jsx'
import { useCvGate } from '../hooks/useCvGate.js'

export function Brand({ compact = false, to = '/' }) {
  return (
    <Link to={to} className={`brand ${compact ? 'brand--compact' : ''}`} aria-label="MeinRoots">
      <span className="brand__markWrap">
        <img src="/logo.png" alt="" className="brand__mark" width="46" height="46" />
      </span>
      <span className="brand__text">
        {/* one unbroken word — never translated, never wrapped */}
        <span className="brand__name">Mein<span className="grad-text">Roots</span></span>
        <small>Recruiting &amp; IT Services</small>
      </span>
    </Link>
  )
}

export default function Navbar() {
  const scrolled = useScrolled(20)
  const [open, setOpen] = useState(false)
  const { t } = useI18n()
  const { user, isAuthenticated, logout } = useAuth()
  const openCv = useCvGate()
  const navigate = useNavigate()

  useEffect(() => {
    document.body.style.overflow = open ? 'hidden' : ''
    return () => { document.body.style.overflow = '' }
  }, [open])

  useEffect(() => {
    const onKey = (e) => e.key === 'Escape' && setOpen(false)
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  const onUpload = (e) => {
    setOpen(false)
    openCv(e)
  }

  return (
    <>
      <header className={`nav ${scrolled ? 'is-scrolled' : ''}`}>
        <div className="container nav__inner">
          <Brand />

          <nav className="nav__links" aria-label={t('common.primaryNav')}>
            {navSections.map((s) => (
              <a key={s.href} href={s.href}>{t(`nav.${s.key}`)}</a>
            ))}
          </nav>

          <div className="nav__actions">
            <LanguageSwitcher />
            {isAuthenticated ? (
              // Signed in on the marketing page: the useful link is into the
              // product, not out of the session.
              <Link to="/dashboard" className="nav__user">
                <span className="nav__avatar" aria-hidden="true">
                  {user.name?.trim().charAt(0).toUpperCase() || 'M'}
                </span>
                <span className="nav__login">{t('app.nav.dashboard')}</span>
              </Link>
            ) : (
              <Link to="/login" className="nav__login">{t('nav.login')}</Link>
            )}
            <button type="button" className="btn btn--primary btn--sm" onClick={onUpload}>
              {t('nav.cta')} <Icon name="arrowRight" />
            </button>
          </div>

          <button
            type="button"
            className="nav__burger"
            onClick={() => setOpen((v) => !v)}
            aria-label={t('nav.menu')}
            aria-expanded={open}
          >
            <span className={`burger ${open ? 'is-open' : ''}`}><i /><i /><i /></span>
          </button>
        </div>
      </header>

      <div className={`drawer ${open ? 'is-open' : ''}`} role="dialog" aria-modal="true" aria-label={t('nav.menu')}>
        <div className="drawer__panel">
          <nav className="drawer__links">
            {navSections.map((s, i) => (
              <a
                key={s.href}
                href={s.href}
                onClick={() => setOpen(false)}
                style={{ transitionDelay: `${70 + i * 45}ms` }}
              >
                <span>{t(`nav.${s.key}`)}</span>
                <Icon name="arrowRight" size={18} />
              </a>
            ))}
          </nav>

          <div className="drawer__foot">
            <span className="drawer__label">{t('nav.language')}</span>
            <LanguageSwitcher variant="inline" />
            {isAuthenticated ? (
              <>
                <button
                  type="button"
                  className="btn btn--ghost btn--block"
                  onClick={() => { setOpen(false); navigate('/dashboard') }}
                >
                  {t('app.nav.dashboard')}
                </button>
                <button
                  type="button"
                  className="btn btn--ghost btn--block"
                  onClick={() => { setOpen(false); logout() }}
                >
                  {t('nav.logout')}
                </button>
              </>
            ) : (
              <button
                type="button"
                className="btn btn--ghost btn--block"
                onClick={() => { setOpen(false); navigate('/login') }}
              >
                {t('nav.login')}
              </button>
            )}
            <button type="button" className="btn btn--primary btn--block" onClick={onUpload}>
              {t('nav.cta')} <Icon name="arrowRight" />
            </button>
          </div>
        </div>
        <button className="drawer__scrim" onClick={() => setOpen(false)} aria-label={t('common.close')} tabIndex={-1} />
      </div>
    </>
  )
}
