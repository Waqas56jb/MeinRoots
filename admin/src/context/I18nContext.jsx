import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react'
import { DEFAULT_LOCALE, STORAGE_KEY, detectLocale, dictionaries, localeList, resolve } from '../i18n/index.js'

const I18nContext = createContext(null)

export function I18nProvider({ children }) {
  const [locale, setLocaleState] = useState(detectLocale)

  const dict = dictionaries[locale] || dictionaries[DEFAULT_LOCALE]
  const fallback = dictionaries[DEFAULT_LOCALE]

  useEffect(() => {
    document.documentElement.lang = locale
  }, [locale])

  const setLocale = useCallback((next) => {
    if (!dictionaries[next]) return
    setLocaleState(next)
    try {
      window.localStorage.setItem(STORAGE_KEY, next)
    } catch {
      /* the choice just won't persist */
    }
  }, [])

  /**
   * t('candidates.title') → string.
   * Falls back to English, then to the key itself so a missing string is loud
   * rather than silently blank. `{placeholders}` are substituted from vars.
   */
  const t = useCallback(
    (path, vars) => {
      let value = resolve(dict, path)
      if (value === undefined) value = resolve(fallback, path)
      if (value === undefined) return path
      if (typeof value === 'string' && vars) {
        return value.replace(/\{(\w+)\}/g, (m, k) => (vars[k] !== undefined ? vars[k] : m))
      }
      return value
    },
    [dict, fallback],
  )

  /** API error code → sentence, with a generic apology when it has no entry. */
  const tError = useCallback(
    (code) => {
      if (!code) return t('errors.generic')
      const message = t(`errors.${code}`)
      return message === `errors.${code}` ? t('errors.generic') : message
    },
    [t],
  )

  const value = useMemo(
    () => ({ locale, setLocale, t, tError, locales: localeList }),
    [locale, setLocale, t, tError],
  )

  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>
}

export function useI18n() {
  const ctx = useContext(I18nContext)
  if (!ctx) throw new Error('useI18n must be used inside <I18nProvider>')
  return ctx
}
