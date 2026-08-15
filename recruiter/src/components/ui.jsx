import { useEffect, useRef } from 'react'
import { Link } from 'react-router-dom'
import Icon from './Icon.jsx'
import { useI18n } from '../context/I18nContext.jsx'
import { useAccount } from '../context/AccountContext.jsx'

/** The primitives every recruiter screen is built from. */

/* -------------------------------- loading -------------------------------- */

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
 * Placeholders shaped like the thing that is coming.
 *
 * `variant` picks the shape: a grid of candidate cards looks nothing like a
 * dashboard, and a skeleton that does not match makes the page jump when the
 * data lands — which is the one problem a skeleton exists to solve.
 */
export function Skeleton({ variant = 'rows', rows = 5 }) {
  const shapes = {
    rows: Array.from({ length: rows }).map((_, i) => <span key={i} className="sk__row" />),
    cards: Array.from({ length: rows }).map((_, i) => <span key={i} className="sk__card" />),
    kpis: Array.from({ length: 4 }).map((_, i) => <span key={i} className="sk__kpi" />),
    detail: (
      <>
        <span className="sk__head" />
        <span className="sk__row" />
        <span className="sk__row" />
        <span className="sk__block" />
      </>
    ),
  }
  return (
    <div className={`sk sk--${variant}`} aria-hidden="true">
      {shapes[variant] ?? shapes.rows}
    </div>
  )
}

/* --------------------------------- states -------------------------------- */

export function EmptyState({ icon = 'search', title, text, action }) {
  return (
    <div className="state state--empty">
      <span className="state__icon"><Icon name={icon} size={24} /></span>
      <h3>{title}</h3>
      {text && <p>{text}</p>}
      {action}
    </div>
  )
}

export function ErrorState({ title, message, onRetry }) {
  const { t } = useI18n()
  return (
    <div className="state state--error" role="alert">
      <span className="state__icon"><Icon name="alert" size={24} /></span>
      <h3>{title ?? t('common.errorTitle')}</h3>
      {message && <p>{message}</p>}
      {onRetry && (
        <button type="button" className="btn btn--ghost" onClick={onRetry}>
          <Icon name="refresh" size={16} /> {t('common.retry')}
        </button>
      )}
    </div>
  )
}

/**
 * The state that says this part of the product is not built yet.
 *
 * Milestone 2 puts the interface in front of the API on purpose, so most of
 * this portal talks to routes that do not answer. Showing "something went
 * wrong" would send someone hunting a fault that does not exist; showing an
 * empty list would be a lie about there being no data. This says the true
 * thing, and names the endpoint so whoever builds it knows what is being
 * waited on.
 */
export function PendingState({ endpoint, title, text }) {
  const { t } = useI18n()
  return (
    <div className="state state--pending">
      <span className="state__icon"><Icon name="clock" size={24} /></span>
      <h3>{title ?? t('common.pendingTitle')}</h3>
      <p>{text ?? t('common.pendingText')}</p>
      {endpoint && <code className="state__endpoint">{endpoint}</code>}
    </div>
  )
}

/* -------------------------------- badges --------------------------------- */

export function Badge({ tone = 'neutral', icon, children }) {
  return (
    <span className={`badge badge--${tone}`}>
      {icon && <Icon name={icon} size={12} />}
      {children}
    </span>
  )
}

const REQUEST_TONE = {
  pending: 'info',
  accepted: 'good',
  declined: 'bad',
  completed: 'good',
  cancelled: 'neutral',
  expired: 'neutral',
}

/** A request's state. The word carries it; the colour only agrees. */
export function RequestStatus({ status }) {
  const { t } = useI18n()
  if (!status) return <Badge>{t('common.none')}</Badge>
  return <Badge tone={REQUEST_TONE[status] ?? 'neutral'}>{t(`requests.status.${status}`)}</Badge>
}

export function PlanBadge({ plan, status }) {
  const { t } = useI18n()
  if (!plan) return null
  const tone = status === 'trialing' ? 'info' : plan === 'premium' ? 'brand' : 'neutral'
  return (
    <span className={`planbadge planbadge--${tone}`}>
      {status === 'trialing' ? t('billing.trial') : t(`billing.plans.${plan}.name`)}
    </span>
  )
}

/** Readiness 0–100, banded exactly as the rest of the platform bands it. */
export function Readiness({ value }) {
  const { t } = useI18n()
  if (value === null || value === undefined) return <span className="muted">—</span>
  const band = value >= 80 ? 'ready' : value >= 60 ? 'nearly_ready' : value >= 40 ? 'developing' : 'not_ready'
  return (
    <span className={`readiness readiness--${band}`} title={t(`candidates.bands.${band}`)}>
      <strong className="num">{value}</strong>
      <em>{t(`candidates.bands.${band}`)}</em>
    </span>
  )
}

/* ------------------------------ access gates ------------------------------ */

/**
 * Shows its children only when the account actually holds the entitlement.
 *
 * The decision comes from the server's feature map, never from the plan name.
 * When it is refused the fallback explains what unlocks it — a control that is
 * simply missing teaches nothing, and one that is visible but dead is worse.
 */
export function FeatureGate({ feature, children, fallback }) {
  const { can, pending } = useAccount()
  // With no backend there are no entitlements to check, so gating everything
  // off would hide the entire portal from its own reviewers.
  if (pending) return children
  if (can(feature)) return children
  return fallback ?? null
}

export function UpgradePrompt({ feature, compact = false }) {
  const { t } = useI18n()
  return (
    <div className={`upsell ${compact ? 'upsell--compact' : ''}`}>
      <span className="upsell__icon"><Icon name="lock" size={compact ? 15 : 18} /></span>
      <div>
        <strong>{t(`features.${feature}.locked`)}</strong>
        {!compact && <p>{t(`features.${feature}.lockedText`)}</p>}
      </div>
      <Link to="/plans" className="btn btn--primary btn--sm">{t('billing.viewPlans')}</Link>
    </div>
  )
}

/**
 * Why a piece of candidate information is not on screen.
 *
 * Never a blur over real data: anything the recruiter is not entitled to see
 * was never sent to the browser, so there is nothing here to reveal. This
 * component only explains the absence.
 */
export function AccessRestricted({ level = 'anonymous', onRequest, requestState }) {
  const { t } = useI18n()
  return (
    <div className="restricted">
      <span className="restricted__icon"><Icon name="shield" size={18} /></span>
      <div className="restricted__body">
        <strong>{t(`access.${level}.title`)}</strong>
        <p>{t(`access.${level}.text`)}</p>
      </div>
      {onRequest && !requestState && (
        <button type="button" className="btn btn--primary btn--sm" onClick={onRequest}>
          <Icon name="message" size={15} /> {t('candidates.requestContact')}
        </button>
      )}
      {requestState && <RequestStatus status={requestState} />}
    </div>
  )
}

/* -------------------------------- overlays -------------------------------- */

/**
 * A modal on a wide screen, a bottom sheet on a phone.
 *
 * One component rather than two because the behaviour is identical and only the
 * geometry differs — and because two would drift. Escape closes it, focus moves
 * in and is returned on close, and the page behind it stops scrolling.
 */
export function Sheet({ open, onClose, title, children, actions, labelledBy = 'sheet-title' }) {
  const { t } = useI18n()
  const panelRef = useRef(null)
  const returnTo = useRef(null)

  useEffect(() => {
    if (!open) return undefined
    returnTo.current = document.activeElement
    document.body.classList.add('is-locked')

    const onKey = (e) => {
      if (e.key === 'Escape') onClose()
      if (e.key !== 'Tab') return
      // Keep tabbing inside the panel; a dialog you can tab out of is a dialog
      // a keyboard user loses.
      const focusable = panelRef.current?.querySelectorAll(
        'a[href], button:not([disabled]), input:not([disabled]), select, textarea, [tabindex]:not([tabindex="-1"])',
      )
      if (!focusable?.length) return
      const first = focusable[0]
      const last = focusable[focusable.length - 1]
      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault()
        last.focus()
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault()
        first.focus()
      }
    }

    document.addEventListener('keydown', onKey)
    const id = setTimeout(() => panelRef.current?.querySelector('button, input, a')?.focus(), 40)
    return () => {
      document.removeEventListener('keydown', onKey)
      document.body.classList.remove('is-locked')
      clearTimeout(id)
      returnTo.current?.focus?.()
    }
  }, [open, onClose])

  if (!open) return null

  return (
    <div className="sheet" role="dialog" aria-modal="true" aria-labelledby={labelledBy}>
      <button type="button" className="sheet__scrim" onClick={onClose} aria-label={t('common.close')} />
      <div className="sheet__panel" ref={panelRef}>
        <header className="sheet__head">
          <h2 id={labelledBy}>{title}</h2>
          <button type="button" className="sheet__close" onClick={onClose} aria-label={t('common.close')}>
            <Icon name="close" size={18} />
          </button>
        </header>
        <div className="sheet__body">{children}</div>
        {actions && <footer className="sheet__foot">{actions}</footer>}
      </div>
    </div>
  )
}

/* ------------------------------- pagination ------------------------------- */

export function Pager({ offset, limit, total, onChange }) {
  const { t } = useI18n()
  if (!total || total <= limit) return null
  const from = offset + 1
  const to = Math.min(offset + limit, total)

  return (
    <nav className="pager" aria-label={t('common.pagination')}>
      <button
        type="button"
        className="btn btn--ghost btn--sm"
        disabled={offset === 0}
        onClick={() => onChange(Math.max(0, offset - limit))}
      >
        <Icon name="chevronLeft" size={15} /> {t('common.prev')}
      </button>
      <span className="num">{t('common.showing', { from, to, total })}</span>
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

/* -------------------------------- headings -------------------------------- */

export function PageHeader({ title, subtitle, actions, meta }) {
  return (
    <header className="pagehead">
      <div className="pagehead__text">
        <h1>{title}</h1>
        {subtitle && <p>{subtitle}</p>}
      </div>
      {(meta || actions) && (
        <div className="pagehead__side">
          {meta}
          {actions}
        </div>
      )}
    </header>
  )
}

export function Panel({ icon, title, hint, actions, children, className = '' }) {
  return (
    <section className={`panel ${className}`}>
      {(title || actions) && (
        <header className="panel__head">
          <div>
            {title && <h2>{icon && <Icon name={icon} size={16} />}{title}</h2>}
            {hint && <p>{hint}</p>}
          </div>
          {actions}
        </header>
      )}
      <div className="panel__body">{children}</div>
    </section>
  )
}
