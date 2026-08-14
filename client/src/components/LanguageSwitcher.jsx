import { useEffect, useRef, useState } from 'react'
import Icon from './ui/Icon.jsx'
import { useI18n } from '../context/I18nContext.jsx'

/**
 * Language selector. `variant="menu"` renders the dropdown used in headers,
 * `variant="inline"` renders a flat list for the mobile drawer and footer.
 *
 * `onChange` fires after the language is applied. The signed-in workspace uses
 * it to store the choice on the account as well as in the browser, so the
 * emails we send follow the language the candidate is actually reading — before
 * this existed, switching language in the header changed the interface but left
 * the account still set to the old one.
 */
export default function LanguageSwitcher({ variant = 'menu', align = 'right', onChange }) {
  const { locale, setLocale, locales, t } = useI18n()
  const [open, setOpen] = useState(false)
  const wrapRef = useRef(null)

  const choose = (code) => {
    setLocale(code)
    onChange?.(code)
  }

  useEffect(() => {
    if (!open) return undefined
    const onClick = (e) => {
      if (!wrapRef.current?.contains(e.target)) setOpen(false)
    }
    const onKey = (e) => e.key === 'Escape' && setOpen(false)
    document.addEventListener('mousedown', onClick)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('mousedown', onClick)
      document.removeEventListener('keydown', onKey)
    }
  }, [open])

  const active = locales.find((l) => l.code === locale) || locales[0]

  if (variant === 'inline') {
    return (
      <div className="lang-inline" role="group" aria-label={t('nav.language')}>
        {locales.map((l) => (
          <button
            key={l.code}
            type="button"
            className={l.code === locale ? 'is-active' : ''}
            onClick={() => choose(l.code)}
            aria-pressed={l.code === locale}
          >
            <span className="lang-inline__flag" aria-hidden="true">{l.flag}</span>
            {l.native}
          </button>
        ))}
      </div>
    )
  }

  return (
    <div className={`lang-menu ${align === 'left' ? 'lang-menu--left' : ''}`} ref={wrapRef}>
      <button
        type="button"
        className="lang-menu__trigger"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        aria-haspopup="listbox"
        aria-label={t('nav.language')}
      >
        <Icon name="globe" size={17} />
        <span className="lang-menu__code">{active.code.toUpperCase()}</span>
        <Icon name="chevronDown" size={15} className={open ? 'is-flipped' : ''} />
      </button>

      <div className={`lang-menu__pop ${open ? 'is-open' : ''}`} role="listbox" aria-label={t('nav.language')}>
        {locales.map((l) => (
          <button
            key={l.code}
            type="button"
            role="option"
            aria-selected={l.code === locale}
            className={l.code === locale ? 'is-active' : ''}
            onClick={() => {
              choose(l.code)
              setOpen(false)
            }}
          >
            <span className="lang-menu__flag" aria-hidden="true">{l.flag}</span>
            <span className="lang-menu__names">
              <strong>{l.native}</strong>
              <small>{l.name}</small>
            </span>
            {l.code === locale && <Icon name="check" size={16} />}
          </button>
        ))}
      </div>
    </div>
  )
}
