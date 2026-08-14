import Icon from '../ui/Icon.jsx'
import { useI18n } from '../../context/I18nContext.jsx'

/**
 * The small pieces every workspace page is built from.
 *
 * Kept together so a badge looks the same on the dashboard as on the CV page,
 * and so a status colour means one thing across the product. Anything larger
 * than this — readiness, the next action, completeness, the journey — has its
 * own file; these are the primitives those are assembled from.
 */

/** 0–100 → the four bands the platform uses everywhere. The thresholds are the
 *  assessment's own (0–39 / 40–59 / 60–79 / 80–100), not a second opinion. */
export const band = (score) =>
  score >= 80 ? 'great' : score >= 60 ? 'good' : score >= 40 ? 'warn' : 'bad'

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
 * Confidence as a percentage with a plain-language band.
 *
 * Never the raw decimal: 0.834729 means nothing to a person, and the number is
 * only useful as an answer to "should someone check this".
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

/** A short, dismissible-looking notice. Tone carries urgency; the icon and the
 *  wording carry the meaning, so it still reads without colour. */
export function Note({ tone = 'info', icon, title, children, action }) {
  return (
    <div className={`wnote wnote--${tone}`}>
      <Icon name={icon ?? (tone === 'bad' ? 'alert' : 'info')} size={18} />
      <div>
        {title && <strong>{title}</strong>}
        {children && <p>{children}</p>}
      </div>
      {action}
    </div>
  )
}
