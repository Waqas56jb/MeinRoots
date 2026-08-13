/**
 * Locale-aware formatting.
 *
 * Every helper takes the active locale rather than reading a global, so a date
 * rendered in the German console reads "13. Aug. 2026" and the same component
 * in French reads "13 août 2026" without either knowing about the other.
 */

export const formatDate = (value, locale) => {
  if (!value) return '—'
  return new Intl.DateTimeFormat(locale, { day: 'numeric', month: 'short', year: 'numeric' }).format(
    new Date(value),
  )
}

export const formatDateTime = (value, locale) => {
  if (!value) return '—'
  return new Intl.DateTimeFormat(locale, {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(value))
}

/** "3 min ago" style, for the audit log where exact seconds rarely matter. */
export const formatRelative = (value, locale) => {
  if (!value) return '—'
  const diffMs = new Date(value).getTime() - Date.now()
  const abs = Math.abs(diffMs)
  const rtf = new Intl.RelativeTimeFormat(locale, { numeric: 'auto' })

  const units = [
    ['year', 31536000000],
    ['month', 2592000000],
    ['day', 86400000],
    ['hour', 3600000],
    ['minute', 60000],
    ['second', 1000],
  ]
  for (const [unit, ms] of units) {
    if (abs >= ms || unit === 'second') return rtf.format(Math.round(diffMs / ms), unit)
  }
  return ''
}

export const formatNumber = (value, locale) =>
  new Intl.NumberFormat(locale).format(Number(value) || 0)

/** 41624 → "41.6k". Token counts get long and the exact digit is never the point. */
export const compactNumber = (value, locale) =>
  new Intl.NumberFormat(locale, { notation: 'compact', maximumFractionDigits: 1 }).format(
    Number(value) || 0,
  )

/** Months of experience → "6 yrs 3 mo" in the reader's language-neutral short form. */
export const formatExperience = (months) => {
  if (months === null || months === undefined) return '—'
  const years = Math.floor(months / 12)
  const rest = months % 12
  if (!years) return `${rest}m`
  return rest ? `${years}y ${rest}m` : `${years}y`
}

export const formatBytes = (bytes) => {
  if (!bytes) return '—'
  const mb = bytes / 1024 / 1024
  return mb >= 1 ? `${mb.toFixed(1)} MB` : `${Math.round(bytes / 1024)} KB`
}

/** "2021-03-01" → "Mar 2021"; a CV date is a calendar date, never an instant. */
export const formatMonth = (value, locale) => {
  if (!value) return null
  const [year, month] = String(value).split('-')
  if (!year) return null
  const date = new Date(Number(year), Number(month || 1) - 1, 1)
  return new Intl.DateTimeFormat(locale, { month: 'short', year: 'numeric' }).format(date)
}
