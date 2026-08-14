import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react'
import {
  DEFAULT_LOCALE,
  STORAGE_KEY,
  detectLocale,
  dictionaries,
  localeList,
  resolve,
} from '../i18n/index.js'

const I18nContext = createContext(null)

export function I18nProvider({ children, initialLocale }) {
  // initialLocale forces a language (tests, future SSR); otherwise we use the
  // stored choice, then the browser's preferred language, then English.
  const [locale, setLocaleState] = useState(() =>
    initialLocale && dictionaries[initialLocale] ? initialLocale : detectLocale(),
  )

  const dict = dictionaries[locale] || dictionaries[DEFAULT_LOCALE]
  const fallback = dictionaries[DEFAULT_LOCALE]

  // Keep <html lang/dir>, the tab title and the meta description in sync.
  useEffect(() => {
    const html = document.documentElement
    html.lang = locale
    html.dir = dict.dir || 'ltr'
    document.title = dict.meta.title
    document
      .querySelector('meta[name="description"]')
      ?.setAttribute('content', dict.meta.description)
  }, [locale, dict])

  const setLocale = useCallback((next) => {
    if (!dictionaries[next]) return
    setLocaleState(next)
    try {
      window.localStorage.setItem(STORAGE_KEY, next)
    } catch {
      /* storage can be unavailable in private mode — the choice just won't persist */
    }
  }, [])

  /**
   * t('home.hero.lead') → string | array | object.
   * Falls back to English, then to the key itself so a missing string is obvious.
   * Pass vars to substitute {placeholders}: t('auth.reset.sentText', { email }).
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

  const value = useMemo(
    () => ({ locale, setLocale, t, dict, locales: localeList }),
    [locale, setLocale, t, dict],
  )

  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>
}

export function useI18n() {
  const ctx = useContext(I18nContext)
  if (!ctx) throw new Error('useI18n must be used inside <I18nProvider>')
  return ctx
}

/**
 * Renders a translated string that contains inline <b> emphasis.
 * The strings come from our own dictionaries, never from user input.
 */
export function RichText({ path, vars, as: Tag = 'span', ...rest }) {
  const { t } = useI18n()
  const html = String(t(path, vars)).replace(/<b>/g, '<strong>').replace(/<\/b>/g, '</strong>')
  return <Tag dangerouslySetInnerHTML={{ __html: html }} {...rest} />
}
