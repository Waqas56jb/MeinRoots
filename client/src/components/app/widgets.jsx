import Icon from '../ui/Icon.jsx'
import { useI18n } from '../../context/I18nContext.jsx'

/**
 * The small pieces every workspace page is built from.
 *
 * Kept together so a metric card looks the same on the dashboard as on the
 * readiness page, and so a status colour means one thing across the product.
 */

/** 0–100 → the four bands the platform uses everywhere. */
export const band = (score) =>
  score >= 80 ? 'great' : score >= 60 ? 'good' : score >= 40 ? 'warn' : 'bad'

const TONE_FOR_BAND = { great: 'good', good: 'brand', warn: 'warn', bad: 'bad' }

export function Stat({ icon, value, label, hint, tone, action }) {
  return (
    <div className={`wstat ${tone ? `wstat--${tone}` : ''}`}>
      <div className="wstat__top">
        <span className="wstat__icon"><Icon name={icon} size={18} /></span>
        {action}
      </div>
      <strong>{value}</strong>
      <span>{label}</span>
      {hint && <em>{hint}</em>}
    </div>
  )
}

/**
 * Progress ring. Used for completeness and readiness — the two numbers a
 * candidate should be able to read at a glance from across the room.
 */
export function Ring({ value, size = 96, stroke = 8, label, sublabel, tone }) {
  const radius = (size - stroke) / 2
  const circumference = 2 * Math.PI * radius
  const shown = Math.max(0, Math.min(100, Number(value) || 0))
  const colour = {
    great: '#16a34a',
    good: 'var(--blue-600)',
    warn: '#d97706',
    bad: '#dc2626',
  }[tone ?? band(shown)]

  return (
    <div className="ring" style={{ width: size, height: size }}>
      <svg width={size} height={size} aria-hidden="true">
        <circle className="ring__track" cx={size / 2} cy={size / 2} r={radius} strokeWidth={stroke} />
        <circle
          className="ring__value"
          cx={size / 2}
          cy={size / 2}
          r={radius}
          strokeWidth={stroke}
          stroke={colour}
          strokeDasharray={`${(shown / 100) * circumference} ${circumference}`}
        />
      </svg>
      <span className="ring__label">
        <strong style={{ fontSize: size / 3.4 }}>{label ?? `${Math.round(shown)}%`}</strong>
        {sublabel && <small>{sublabel}</small>}
      </span>
    </div>
  )
}

export function Meter({ label, value, note, tone, suffix = '%' }) {
  const shown = Math.max(0, Math.min(100, Number(value) || 0))
  return (
    <div className={`meter ${tone ? `meter--${tone}` : ''}`}>
      <div className="meter__top">
        <span>{label}</span>
        <em>{Math.round(shown)}{suffix}</em>
      </div>
      <div className="meter__track">
        <span className="meter__fill" style={{ width: `${Math.max(2, shown)}%` }} />
      </div>
      {note && <span className="meter__note">{note}</span>}
    </div>
  )
}

export function Badge({ tone = 'neutral', icon, live, children }) {
  return (
    <span className={`wbadge wbadge--${tone}`}>
      {live && <span className="wbadge__dot wbadge__dot--live" aria-hidden="true" />}
      {icon && <Icon name={icon} size={12} />}
      {children}
    </span>
  )
}

/**
 * Readiness as a word plus a number, coloured by band. A bare score tells a
 * candidate nothing about whether it is good.
 */
export function ScoreBadge({ score }) {
  const { t } = useI18n()
  if (score === null || score === undefined) return <Badge>{t('common.none')}</Badge>
  const b = band(score)
  return (
    <Badge tone={TONE_FOR_BAND[b]}>
      {score}/100 · {t(`app.readiness.bands.${
        score >= 80 ? 'ready' : score >= 60 ? 'nearly_ready' : score >= 40 ? 'developing' : 'not_ready'
      }`)}
    </Badge>
  )
}

/**
 * Confidence as a percentage with a plain-language band.
 *
 * Never the raw decimal: 0.834729 means nothing to a person, and the number is
 * only useful as "should someone check this".
 */
export function ConfidenceBadge({ value, showLabel = true }) {
  const { t } = useI18n()
  if (value === null || value === undefined) return null
  const pct = Math.round(value * 100)
  const level = value >= 0.8 ? 'high' : value >= 0.6 ? 'medium' : 'low'
  const tone = { high: 'good', medium: 'warn', low: 'bad' }[level]
  return (
    <Badge tone={tone} icon={level === 'high' ? 'check' : 'alert'}>
      {pct}%{showLabel ? ` · ${t(`app.confidence.${level}`)}` : ''}
    </Badge>
  )
}

export function SectionHead({ title, subtitle, actions }) {
  return (
    <div className="wsection__head">
      <div>
        <h2>{title}</h2>
        {subtitle && <p>{subtitle}</p>}
      </div>
      {actions}
    </div>
  )
}

export function Card({ icon, title, hint, actions, children, className = '' }) {
  return (
    <section className={`wcard ${className}`}>
      {(title || actions) && (
        <div className="wcard__head">
          {title && (
            <h2>
              {icon && <Icon name={icon} size={17} />}
              {title}
            </h2>
          )}
          {actions}
        </div>
      )}
      {hint && <p className="wcard__hint">{hint}</p>}
      {children}
    </section>
  )
}

export function Empty({ icon = 'file', title, text, action }) {
  return (
    <div className="wempty">
      <span className="wempty__icon"><Icon name={icon} size={26} /></span>
      <h3>{title}</h3>
      {text && <p>{text}</p>}
      {action}
    </div>
  )
}

export function Skeleton({ rows = 3 }) {
  return (
    <div className="wskel" aria-hidden="true">
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} className="wskel__row" style={{ animationDelay: `${i * 70}ms` }} />
      ))}
    </div>
  )
}

export function Note({ tone = 'info', icon, title, children, action }) {
  return (
    <div className={`wnote wnote--${tone}`}>
      <Icon name={icon ?? (tone === 'bad' ? 'alert' : tone === 'warn' ? 'info' : 'info')} size={18} />
      <div>
        {title && <strong>{title}</strong>}
        {children && <p>{children}</p>}
      </div>
      {action}
    </div>
  )
}

export function Facts({ items }) {
  return (
    <dl className="wfacts">
      {items
        .filter((f) => f.value !== null && f.value !== undefined && f.value !== '')
        .map((f) => (
          <div key={f.label} className="wfact">
            <dt>{f.label}</dt>
            <dd>{f.value}</dd>
          </div>
        ))}
    </dl>
  )
}
