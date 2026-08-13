import Icon from './Icon.jsx'
import { useI18n } from '../context/I18nContext.jsx'

/** Small shared primitives. Kept together so the console stays visually consistent. */

export function Spinner({ full = false, label }) {
  const { t } = useI18n()
  return (
    <div className={`spinner ${full ? 'spinner--full' : ''}`} role="status" aria-live="polite">
      <span className="spinner__ring" aria-hidden="true" />
      <span className="sr-only">{label ?? t('common.loading')}</span>
    </div>
  )
}

/**
 * Placeholder rows shaped like the content that is coming.
 *
 * A skeleton beats a spinner on a list because the layout does not jump when
 * the data lands — the admin's eye is already in the right place.
 */
export function Skeleton({ rows = 5 }) {
  return (
    <div className="skeleton" aria-hidden="true">
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} className="skeleton__row" style={{ animationDelay: `${i * 60}ms` }} />
      ))}
    </div>
  )
}

export function Empty({ icon = 'search', title, text, action }) {
  return (
    <div className="empty">
      <span className="empty__icon"><Icon name={icon} size={24} /></span>
      <h3>{title}</h3>
      {text && <p>{text}</p>}
      {action}
    </div>
  )
}

export function ErrorNote({ message, onRetry }) {
  const { t } = useI18n()
  if (!message) return null
  return (
    <div className="note note--bad">
      <Icon name="alert" size={17} />
      <span>{message}</span>
      {onRetry && (
        <button type="button" className="btn btn--ghost btn--sm" onClick={onRetry}>
          {t('common.retry')}
        </button>
      )}
    </div>
  )
}

const REVIEW_TONE = {
  approved: 'good',
  auto_cleared: 'good',
  flagged: 'warn',
  rejected: 'bad',
  pending: 'neutral',
}

export function ReviewBadge({ status }) {
  const { t } = useI18n()
  if (!status) return <span className="badge badge--neutral">{t('common.none')}</span>
  return <span className={`badge badge--${REVIEW_TONE[status] ?? 'neutral'}`}>{t(`review.${status}`)}</span>
}

const CV_TONE = { analysed: 'good', processing: 'info', uploaded: 'info', failed: 'bad' }

export function CvBadge({ status }) {
  const { t } = useI18n()
  if (!status) return <span className="badge badge--neutral">{t('candidates.noCv')}</span>
  return (
    <span className={`badge badge--${CV_TONE[status] ?? 'neutral'}`}>
      {status === 'processing' && <span className="badge__pulse" aria-hidden="true" />}
      {t(`cvStatus.${status}`)}
    </span>
  )
}

/** Readiness 0–100, coloured by band. */
export function Score({ value }) {
  if (value === null || value === undefined) return <span className="muted">—</span>
  const band = value >= 80 ? 'great' : value >= 60 ? 'good' : value >= 40 ? 'warn' : 'bad'
  return <span className={`score score--${band}`}>{value}</span>
}

/**
 * Extraction confidence. Below 0.6 the profile is flagged for a human, so that
 * is the threshold the colour change marks — the number and the queue agree.
 */
export function Confidence({ value }) {
  const { t } = useI18n()
  if (value === null || value === undefined) return <span className="muted">—</span>
  const low = value < 0.6
  return (
    <span className={`conf ${low ? 'conf--low' : ''}`} title={low ? t('profile.lowConfidence') : undefined}>
      {low && <Icon name="alert" size={12} />}
      {Math.round(value * 100)}%
    </span>
  )
}

export function Progress({ value }) {
  return (
    <span className="progressbar" role="img" aria-label={`${value}%`}>
      <span style={{ width: `${Math.max(2, Math.min(100, value))}%` }} />
    </span>
  )
}

export function Pager({ offset, limit, total, onChange }) {
  const { t } = useI18n()
  if (!total) return null
  const from = offset + 1
  const to = Math.min(offset + limit, total)

  return (
    <nav className="pager" aria-label="Pagination">
      <button
        type="button"
        className="btn btn--ghost btn--sm"
        disabled={offset === 0}
        onClick={() => onChange(Math.max(0, offset - limit))}
      >
        <Icon name="chevronLeft" size={15} /> {t('common.prev')}
      </button>
      <span>{t('common.showing', { from, to, total })}</span>
      <button
        type="button"
        className="btn btn--ghost btn--sm"
        disabled={to >= total}
        onClick={() => onChange(offset + limit)}
      >
        {t('common.next')} <Icon name="chevronRight" size={15} />
      </button>
    </nav>
  )
}
