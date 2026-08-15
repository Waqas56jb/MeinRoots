import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import Icon from './Icon.jsx'
import { useI18n } from '../context/I18nContext.jsx'
import { formatNumber, formatRelative } from '../lib/format.js'

/**
 * The operational components the console pages are assembled from.
 *
 * Separate from ui.jsx, which holds the small primitives — a badge, a score, a
 * pager. These are the larger pieces that carry meaning: what needs attention,
 * what the pipeline did, how a number ranks against the others.
 *
 * Nothing here computes a figure the API did not return. Where a ratio is
 * shown, both sides of it come from the same counted set.
 */

/* ------------------------------- surfaces -------------------------------- */

/**
 * A section surface.
 *
 * Deliberately not a card with a shadow. An operations console shows a lot of
 * panels at once and stacking elevation on all of them turns the page into
 * confetti; a single hairline and a flat ground keeps the eye on the numbers.
 */
export function Panel({ icon, title, hint, actions, children, className = '', as: Tag = 'section' }) {
  return (
    <Tag className={`panel ${className}`}>
      {(title || actions) && (
        <header className="panel__head">
          <div className="panel__title">
            {title && (
              <h2>
                {icon && <Icon name={icon} size={16} />}
                {title}
              </h2>
            )}
            {hint && <p>{hint}</p>}
          </div>
          {actions && <div className="panel__actions">{actions}</div>}
        </header>
      )}
      <div className="panel__body">{children}</div>
    </Tag>
  )
}

/* --------------------------------- KPIs ---------------------------------- */

/**
 * One number.
 *
 * `size` is the whole point of this component: an operations console has to
 * make "1 candidate needs review" louder than "157.9K AI tokens", and the only
 * way to do that is to stop giving every metric the same card. Primary numbers
 * get the large treatment, supporting ones get a compact row.
 */
export function Kpi({ icon, label, value, hint, tone, to, size = 'md' }) {
  const body = (
    <>
      <span className="kpi__top">
        <span className="kpi__icon"><Icon name={icon} size={size === 'sm' ? 15 : 17} /></span>
        <span className="kpi__label">{label}</span>
        {to && <Icon name="chevronRight" size={15} className="kpi__go" />}
      </span>
      <strong className="kpi__value num">{value}</strong>
      {hint && <span className="kpi__hint">{hint}</span>}
    </>
  )
  const className = `kpi kpi--${size} ${tone ? `kpi--${tone}` : ''} ${to ? 'kpi--link' : ''}`
  return to ? <Link to={to} className={className}>{body}</Link> : <div className={className}>{body}</div>
}

/* ------------------------------- attention -------------------------------- */

/**
 * What needs a person, at the top of the page, or a plain statement that
 * nothing does.
 *
 * The all-clear state is a real state and not a lesser one — an admin opening
 * this console at 9am most often needs to learn "nothing broke overnight" and
 * then close it. That answer deserves to be as legible as the alarm.
 *
 * Items are passed in; this component decides nothing about what is urgent.
 */
export function Attention({ items = [] }) {
  const { t } = useI18n()
  const live = items.filter((i) => i.count > 0)

  if (!live.length) {
    return (
      <section className="attn attn--clear" aria-live="polite">
        <span className="attn__icon"><Icon name="checkCircle" size={20} /></span>
        <div className="attn__body">
          <h2>{t('overview.clear.title')}</h2>
          <p>{t('overview.clear.text')}</p>
        </div>
      </section>
    )
  }

  return (
    <section className={`attn attn--${live.some((i) => i.tone === 'bad') ? 'bad' : 'warn'}`} aria-live="polite">
      <span className="attn__icon"><Icon name="warning" size={20} /></span>
      <div className="attn__body">
        <h2>{t('overview.attention.title')}</h2>
        <ul className="attn__list">
          {live.map((item) => (
            <li key={item.key} className={`attn__item attn__item--${item.tone}`}>
              <Link to={item.to}>
                <strong className="num">{item.count}</strong>
                <span>
                  <b>{item.label}</b>
                  <small>{item.text}</small>
                </span>
                <Icon name="chevronRight" size={16} />
              </Link>
            </li>
          ))}
        </ul>
      </div>
    </section>
  )
}

/* -------------------------------- pipeline -------------------------------- */

/**
 * The intake-to-outcome story, as counted values.
 *
 * The console's numbers were a list, which meant an admin had to hold the
 * relationship between them in their head: that uploads become analyses, that
 * analyses either clear themselves or land on someone's desk. Drawing that
 * relationship is most of what makes a dashboard an operations tool rather
 * than a scoreboard.
 *
 * Every stage is a figure the API counts directly. No stage is derived by
 * subtracting one bucket from another — the counts come from different tables
 * (documents vs profiles), so arithmetic across them would look precise and be
 * wrong.
 */
export function Pipeline({ stages = [], outcomes = [] }) {
  const { t, locale } = useI18n()

  return (
    <Panel icon="activity" title={t('overview.pipeline.title')} hint={t('overview.pipeline.hint')} className="panel--pipeline">
      <ol className="flow">
        {stages.map((stage, i) => (
          <li key={stage.key} className="flow__stage">
            {i > 0 && <span className="flow__arrow" aria-hidden="true"><Icon name="chevronRight" size={16} /></span>}
            <span className="flow__box">
              <span className="flow__label">{stage.label}</span>
              <strong className="flow__value num">{formatNumber(stage.value, locale)}</strong>
              {stage.hint && <span className="flow__hint">{stage.hint}</span>}
            </span>
          </li>
        ))}
      </ol>

      {outcomes.length > 0 && (
        <>
          <p className="flow__split">
            <span>{t('overview.pipeline.resolves')}</span>
          </p>
          <ul className="outcomes">
            {outcomes.map((o) => (
              <li key={o.key} className={`outcome outcome--${o.tone}`}>
                {o.to ? (
                  <Link to={o.to}>
                    <OutcomeBody outcome={o} locale={locale} />
                    <Icon name="chevronRight" size={15} />
                  </Link>
                ) : (
                  <span><OutcomeBody outcome={o} locale={locale} /></span>
                )}
              </li>
            ))}
          </ul>
        </>
      )}
    </Panel>
  )
}

function OutcomeBody({ outcome, locale }) {
  return (
    <>
      <span className="outcome__mark" aria-hidden="true" />
      <span className="outcome__body">
        <strong className="num">{formatNumber(outcome.value, locale)}</strong>
        <span>{outcome.label}</span>
      </span>
    </>
  )
}

/* --------------------------------- bars ----------------------------------- */

/**
 * Horizontal bar list.
 *
 * Bars rather than a pie: comparing thirteen domains by angle is guesswork, and
 * these are counts, which read most directly as lengths against a shared
 * baseline. No chart library for two of these.
 *
 * Zero-count rows are dropped rather than drawn as empty tracks — the domain
 * table returns every configured domain whether or not anyone landed in it,
 * and a column of empty bars says nothing while taking a screenful to say it.
 */
export function BarList({ items, total, max: maxItems }) {
  const { locale, t } = useI18n()
  const withValues = items.filter((i) => i.value > 0).sort((a, b) => b.value - a.value)
  const shown = maxItems ? withValues.slice(0, maxItems) : withValues
  const max = Math.max(...withValues.map((i) => i.value), 1)

  if (!withValues.length) return <p className="muted small">{t('overview.noData')}</p>

  return (
    <>
      <ul className="bars">
        {shown.map((item) => (
          <li key={item.key}>
            <span className="bars__label" title={item.label}>{item.label}</span>
            <span className="bars__track">
              <span className="bars__fill" style={{ width: `${Math.max(2, (item.value / max) * 100)}%` }} />
            </span>
            <span className="bars__value num">
              {formatNumber(item.value, locale)}
              {total ? <em>{Math.round((item.value / total) * 100)}%</em> : null}
            </span>
          </li>
        ))}
      </ul>
      {maxItems && withValues.length > maxItems && (
        <p className="bars__more">{t('overview.moreDomains', { count: withValues.length - maxItems })}</p>
      )}
    </>
  )
}

/* ------------------------------- freshness -------------------------------- */

/**
 * When the console last fetched.
 *
 * The API returns no "as of" timestamp, so this is the client's own record of
 * when it asked — which is the honest claim, and the one an operator actually
 * wants before trusting a zero. It re-renders on a timer so the label does not
 * sit reading "just now" ten minutes later.
 */
export function Freshness({ at }) {
  const { t, locale } = useI18n()
  const [, tick] = useState(0)

  useEffect(() => {
    if (!at) return undefined
    const id = setInterval(() => tick((n) => n + 1), 30000)
    return () => clearInterval(id)
  }, [at])

  if (!at) return null
  return (
    <span className="fresh" title={new Date(at).toLocaleString(locale)}>
      <Icon name="clock" size={13} />
      {t('common.updated', { when: formatRelative(at, locale) })}
    </span>
  )
}

/* ------------------------------- skeletons -------------------------------- */

/** A table-shaped placeholder, so the columns do not jump when rows land. */
export function TableSkeleton({ rows = 8, cols = 6 }) {
  return (
    <div className="tskel" aria-hidden="true">
      <div className="tskel__head">
        {Array.from({ length: cols }).map((_, i) => (
          <span key={i} style={{ width: `${[38, 22, 18, 14, 14, 10][i % 6]}%` }} />
        ))}
      </div>
      {Array.from({ length: rows }).map((_, r) => (
        <div key={r} className="tskel__row">
          {Array.from({ length: cols }).map((_, i) => (
            <span key={i} style={{ width: `${[46, 26, 20, 16, 18, 12][i % 6]}%` }} />
          ))}
        </div>
      ))}
    </div>
  )
}

/** The overview's own loading shape: attention strip, flow, then the panels. */
export function OverviewSkeleton() {
  return (
    <div className="oskel" aria-hidden="true">
      <span className="oskel__attn" />
      <span className="oskel__flow" />
      <div className="oskel__kpis">
        {Array.from({ length: 4 }).map((_, i) => <span key={i} />)}
      </div>
      <div className="oskel__cols">
        <span />
        <span />
      </div>
    </div>
  )
}
