import en from './en.js'
import de from './de.js'
import fr from './fr.js'

/** Every dictionary mirrors en.js exactly — en is the fallback for missing keys. */
export const dictionaries = { en, de, fr }

/** Display order of the language switcher. */
export const localeList = [en, de, fr].map(({ code, name, native, flag }) => ({
  code,
  name,
  native,
  flag,
}))

/** Language codes shown as chips next to CV uploads: EN · DE · FR */
export const localeCodes = localeList.map((l) => l.code.toUpperCase())

export const DEFAULT_LOCALE = 'en'
export const STORAGE_KEY = 'meinroots.locale'

/** Resolves a dotted path ("hero.stats.speed.label") inside a dictionary. */
export function resolve(dict, path) {
  return path.split('.').reduce((acc, key) => (acc == null ? undefined : acc[key]), dict)
}

/**
 * English is the default for every visitor. Only an explicit choice from the
 * language switcher (persisted in localStorage) changes it — the browser's
 * own language is deliberately ignored.
 */
export function detectLocale() {
  if (typeof window === 'undefined') return DEFAULT_LOCALE
  try {
    const stored = window.localStorage.getItem(STORAGE_KEY)
    if (stored && dictionaries[stored]) return stored
  } catch {
    /* storage unavailable — fall through to English */
  }
  return DEFAULT_LOCALE
}
