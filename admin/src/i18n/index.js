import en from './en.js'
import de from './de.js'
import fr from './fr.js'

/** Every dictionary mirrors en.js exactly — en is the fallback for missing keys. */
export const dictionaries = { en, de, fr }

export const localeList = [en, de, fr].map(({ code, name, native, flag }) => ({
  code,
  name,
  native,
  flag,
}))

export const DEFAULT_LOCALE = 'en'
export const STORAGE_KEY = 'meinroots.admin.locale'

/** Resolves a dotted path, tolerating keys that contain dots themselves. */
export function resolve(dict, path) {
  // Audit action codes are keys like "admin.review.approved", so a plain split
  // would look for a nested object that does not exist. Try the whole tail as a
  // literal key first.
  const [head, ...rest] = path.split('.')
  if (!rest.length) return dict?.[head]
  const branch = dict?.[head]
  if (branch === undefined) return undefined
  const tail = rest.join('.')
  if (branch[tail] !== undefined) return branch[tail]
  return resolve(branch, tail)
}

export function detectLocale() {
  if (typeof window === 'undefined') return DEFAULT_LOCALE
  try {
    const stored = window.localStorage.getItem(STORAGE_KEY)
    if (stored && dictionaries[stored]) return stored
  } catch {
    /* private mode — fall through */
  }
  return DEFAULT_LOCALE
}
