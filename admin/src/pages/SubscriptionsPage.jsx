import { useCallback, useEffect, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import Layout from '../components/Layout.jsx'
import Icon from '../components/Icon.jsx'
import { Empty, ErrorNote } from '../components/ui.jsx'
import { Freshness, Panel, TableSkeleton } from '../components/console.jsx'
import { ApiError, adminApi } from '../lib/api.js'
import { useI18n } from '../context/I18nContext.jsx'
import { formatDate } from '../lib/format.js'

const STATUSES = ['trialing', 'active', 'past_due', 'cancelled', 'expired']
const TONE = { trialing: 'info', active: 'good', past_due: 'warn', cancelled: 'neutral', expired: 'bad' }

/**
 * Subscriptions and the plan configuration behind them.
 *
 * The plan table is read from the API, never from a constant in this file.
 * A price typed into a component is a price that will be wrong the first time
 * someone changes it — and wrong on the screen the team uses to answer billing
 * questions. A plan the backend has not priced shows "not set" rather than a
 * number invented here.
 */
export default function SubscriptionsPage() {
  const { t, tError, locale } = useI18n()
  const [params, setParams] = useSearchParams()

  const [rows, setRows] = useState(null)
  const [plans, setPlans] = useState(null)
  const [error, setError] = useState('')
  const [pending, setPending] = useState(false)
  const [fetchedAt, setFetchedAt] = useState(null)

  const status = params.get('status') ?? ''

  const load = useCallback(async () => {
    setRows(null)
    setError('')
    setPending(false)
    try {
      const [subs, planData] = await Promise.all([
        adminApi.subscriptions({ status: status || undefined }),
        adminApi.plans().catch(() => null),
      ])
      setRows(subs.data ?? [])
      setPlans(planData?.plans ?? null)
      setFetchedAt(Date.now())
    } catch (err) {
      if (err instanceof ApiError && err.status === 404) setPending(true)
      else setError(tError(err.code))
      setRows([])
    }
  }, [status, tError])

  useEffect(() => {
    load()
  }, [load])

  const money = (amount, currency) =>
    amount === null || amount === undefined
      ? t('subscriptions.priceNotSet')
      : new Intl.NumberFormat(locale, { style: 'currency', currency: currency ?? 'EUR', maximumFractionDigits: 0 }).format(amount)

  return (
    <Layout
      title={t('subscriptions.title')}
      subtitle={t('subscriptions.subtitle')}
      meta={<Freshness at={fetchedAt} />}
      actions={
        <button type="button" className="btn btn--ghost btn--sm" onClick={load}>
          <Icon name="refresh" size={16} /> <span className="hide-sm">{t('common.refresh')}</span>
        </button>
      }
    >
      {/* ---------------------------- plan config -------------------------- */}
      <Panel icon="layers" title={t('subscriptions.plansTitle')} hint={t('subscriptions.plansHint')}>
        {plans === null ? (
          <p className="muted small">
            {t('subscriptions.plansPending')} <code>GET /api/admin/plans</code>
          </p>
        ) : (
          <div className="tablewrap">
            <table className="table">
              <thead>
                <tr>
                  <th>{t('subscriptions.plan')}</th>
                  <th className="table__num">{t('subscriptions.price')}</th>
                  <th>{t('subscriptions.interval')}</th>
                  <th className="table__num">{t('subscriptions.trialDays')}</th>
                  <th>{t('subscriptions.enabled')}</th>
                </tr>
              </thead>
              <tbody>
                {plans.map((p) => (
                  <tr key={p.key}>
                    <td><strong>{p.name}</strong></td>
                    <td className="table__num num">{money(p.price, p.currency)}</td>
                    <td>{p.interval ? t(`subscriptions.intervals.${p.interval}`) : '—'}</td>
                    <td className="table__num num">{p.trialDays ?? '—'}</td>
                    <td>
                      <span className={`badge badge--${p.enabled ? 'good' : 'neutral'}`}>
                        {t(p.enabled ? 'subscriptions.on' : 'subscriptions.off')}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Panel>

      {/* ---------------------------- the accounts ------------------------- */}
      <div className="chipbar" role="tablist" aria-label={t('subscriptions.title')}>
        <button type="button" role="tab" aria-selected={!status} className={!status ? 'is-on' : ''} onClick={() => setParams({}, { replace: true })}>
          {t('common.all')}
        </button>
        {STATUSES.map((s) => (
          <button
            key={s}
            type="button"
            role="tab"
            aria-selected={status === s}
            className={status === s ? 'is-on' : ''}
            onClick={() => setParams({ status: s }, { replace: true })}
          >
            {t(`subscriptions.status.${s}`)}
          </button>
        ))}
      </div>

      <ErrorNote message={error} onRetry={load} />

      {rows === null ? (
        <TableSkeleton rows={8} cols={5} />
      ) : pending ? (
        <section className="allclear allclear--pending">
          <span className="allclear__icon"><Icon name="clock" size={24} /></span>
          <div>
            <h2>{t('subscriptions.pendingTitle')}</h2>
            <p>{t('subscriptions.pendingText')}</p>
            <code>GET /api/admin/subscriptions</code>
          </div>
        </section>
      ) : !rows.length ? (
        <Empty icon="card" title={t('subscriptions.emptyTitle')} text={t('subscriptions.emptyText')} />
      ) : (
        <div className="tablewrap">
          <table className="table">
            <thead>
              <tr>
                <th>{t('subscriptions.company')}</th>
                <th>{t('subscriptions.plan')}</th>
                <th>{t('subscriptions.statusLabel')}</th>
                <th className="table__num">{t('subscriptions.trialEnds')}</th>
                <th className="table__num">{t('subscriptions.renews')}</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((s) => (
                <tr key={s.id} className={s.status === 'past_due' ? 'is-flagged' : ''}>
                  <td><strong>{s.company?.name ?? '—'}</strong></td>
                  <td>{s.plan ? t(`recruiters.plans.${s.plan}`) : '—'}</td>
                  <td><span className={`badge badge--${TONE[s.status] ?? 'neutral'}`}>{t(`subscriptions.status.${s.status}`)}</span></td>
                  <td className="table__num muted small">{s.trialEndsAt ? formatDate(s.trialEndsAt, locale) : '—'}</td>
                  <td className="table__num muted small">{s.renewsAt ? formatDate(s.renewsAt, locale) : '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </Layout>
  )
}
