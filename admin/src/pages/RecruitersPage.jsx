import { useCallback, useEffect, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import Layout from '../components/Layout.jsx'
import Icon from '../components/Icon.jsx'
import { Empty, ErrorNote, Pager } from '../components/ui.jsx'
import { Freshness, TableSkeleton } from '../components/console.jsx'
import { ApiError } from '../lib/api.js'
import { useI18n } from '../context/I18nContext.jsx'
import { adminApi } from '../lib/api.js'
import { formatDate, formatRelative } from '../lib/format.js'

const LIMIT = 25
const VERIFICATION = ['pending', 'verified', 'info_required', 'rejected']
const PLANS = ['trial', 'professional', 'premium']

const VERIFY_TONE = { verified: 'good', pending: 'info', info_required: 'warn', rejected: 'bad' }
const PLAN_TONE = { trial: 'info', professional: 'brand', premium: 'good' }

/**
 * The companies and recruiters on the platform.
 *
 * Verification is the first column that matters, not the last: an unverified
 * company that is already searching candidates is the thing this page exists to
 * surface, and burying it behind the name would defeat the point.
 *
 * The endpoint is Milestone 2. Until it exists the page says so and names it,
 * rather than rendering an empty table — "no recruiters have signed up" and
 * "this is not built" look identical in a table and are not the same fact.
 */
export default function RecruitersPage() {
  const { t, tError, locale } = useI18n()
  const [params, setParams] = useSearchParams()

  const [rows, setRows] = useState(null)
  const [meta, setMeta] = useState({ total: 0 })
  const [error, setError] = useState('')
  const [pending, setPending] = useState(false)
  const [fetchedAt, setFetchedAt] = useState(null)
  const [search, setSearch] = useState(params.get('q') ?? '')

  const filters = {
    q: params.get('q') ?? '',
    verification: params.get('verification') ?? '',
    plan: params.get('plan') ?? '',
    offset: Number(params.get('offset') ?? 0),
  }

  const update = (patch, resetOffset = true) => {
    const next = new URLSearchParams(params)
    for (const [k, v] of Object.entries(patch)) {
      if (!v) next.delete(k)
      else next.set(k, String(v))
    }
    if (resetOffset) next.delete('offset')
    setParams(next, { replace: true })
  }

  useEffect(() => {
    const id = setTimeout(() => {
      if (search !== filters.q) update({ q: search })
    }, 350)
    return () => clearTimeout(id)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [search])

  const load = useCallback(async () => {
    setRows(null)
    setError('')
    setPending(false)
    try {
      const res = await adminApi.companies({ ...filters, limit: LIMIT })
      setRows(res.data ?? [])
      setMeta(res.meta ?? { total: 0 })
      setFetchedAt(Date.now())
    } catch (err) {
      // 404 means the route is not written yet, which is not an error.
      if (err instanceof ApiError && err.status === 404) setPending(true)
      else setError(tError(err.code))
      setRows([])
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [params, tError])

  useEffect(() => {
    load()
  }, [load])

  const active = [
    filters.q && { key: 'q', label: filters.q, clear: { q: '' } },
    filters.verification && { key: 'v', label: t(`recruiters.verification.${filters.verification}`), clear: { verification: '' } },
    filters.plan && { key: 'p', label: t(`recruiters.plans.${filters.plan}`), clear: { plan: '' } },
  ].filter(Boolean)

  return (
    <Layout
      title={t('recruiters.title')}
      subtitle={t('recruiters.subtitle')}
      meta={<Freshness at={fetchedAt} />}
      actions={
        <button type="button" className="btn btn--ghost btn--sm" onClick={load}>
          <Icon name="refresh" size={16} /> <span className="hide-sm">{t('common.refresh')}</span>
        </button>
      }
    >
      <div className="filterbar">
        <div className="filterbar__search">
          <Icon name="search" size={17} />
          <input
            type="search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder={t('recruiters.searchPlaceholder')}
            aria-label={t('common.search')}
          />
          {search && (
            <button type="button" onClick={() => setSearch('')} aria-label={t('common.close')}>
              <Icon name="close" size={15} />
            </button>
          )}
        </div>
        <div className="filterbar__controls">
          <select
            value={filters.verification}
            onChange={(e) => update({ verification: e.target.value })}
            aria-label={t('recruiters.filterVerification')}
          >
            <option value="">{t('recruiters.filterVerification')}</option>
            {VERIFICATION.map((v) => <option key={v} value={v}>{t(`recruiters.verification.${v}`)}</option>)}
          </select>
          <select value={filters.plan} onChange={(e) => update({ plan: e.target.value })} aria-label={t('recruiters.filterPlan')}>
            <option value="">{t('recruiters.filterPlan')}</option>
            {PLANS.map((p) => <option key={p} value={p}>{t(`recruiters.plans.${p}`)}</option>)}
          </select>
        </div>
        {active.length > 0 && (
          <div className="filterbar__chips">
            <span className="filterbar__chipsLabel">{t('candidates.filters.activeCount', { count: active.length })}</span>
            {active.map((c) => (
              <button key={c.key} type="button" className="chip" onClick={() => update(c.clear)}>
                {c.label}<Icon name="close" size={13} />
              </button>
            ))}
          </div>
        )}
      </div>

      <ErrorNote message={error} onRetry={load} />

      {rows === null ? (
        <TableSkeleton rows={8} cols={5} />
      ) : pending ? (
        <section className="allclear allclear--pending">
          <span className="allclear__icon"><Icon name="clock" size={24} /></span>
          <div>
            <h2>{t('recruiters.pendingTitle')}</h2>
            <p>{t('recruiters.pendingText')}</p>
            <code>GET /api/admin/companies</code>
          </div>
        </section>
      ) : !rows.length ? (
        <Empty
          icon="company"
          title={active.length ? t('recruiters.emptyFiltered') : t('recruiters.emptyTitle')}
          text={active.length ? t('recruiters.emptyFilteredText') : t('recruiters.emptyText')}
        />
      ) : (
        <>
          <div className="tablewrap hide-md">
            <table className="table">
              <thead>
                <tr>
                  <th>{t('recruiters.table.company')}</th>
                  <th>{t('recruiters.table.verification')}</th>
                  <th>{t('recruiters.table.plan')}</th>
                  <th className="table__num">{t('recruiters.table.seats')}</th>
                  <th className="table__num">{t('recruiters.table.requests')}</th>
                  <th className="table__num">{t('recruiters.table.registered')}</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((c) => (
                  <tr key={c.id} className={c.verificationStatus !== 'verified' ? 'is-flagged' : ''}>
                    <td>
                      <span className="who">
                        <strong>{c.tradingName || c.legalName}</strong>
                        <span>{[c.city, c.country].filter(Boolean).join(', ')}</span>
                      </span>
                    </td>
                    <td>
                      <span className={`badge badge--${VERIFY_TONE[c.verificationStatus] ?? 'neutral'}`}>
                        {t(`recruiters.verification.${c.verificationStatus}`)}
                      </span>
                    </td>
                    <td>
                      <span className={`badge badge--${PLAN_TONE[c.plan] ?? 'neutral'}`}>
                        {t(`recruiters.plans.${c.plan}`)}
                      </span>
                    </td>
                    <td className="table__num num">{c.seats ?? '—'}</td>
                    <td className="table__num num">{c.requestCount ?? '—'}</td>
                    <td className="table__num">
                      <time className="muted small" dateTime={c.createdAt} title={formatDate(c.createdAt, locale)}>
                        {formatRelative(c.createdAt, locale)}
                      </time>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <ul className="cardlist show-md">
            {rows.map((c) => (
              <li key={c.id}>
                <div className="ccard">
                  <div className="ccard__head">
                    <div>
                      <strong>{c.tradingName || c.legalName}</strong>
                      <span className="muted small">{[c.city, c.country].filter(Boolean).join(', ')}</span>
                    </div>
                  </div>
                  <div className="ccard__badges">
                    <span className={`badge badge--${VERIFY_TONE[c.verificationStatus] ?? 'neutral'}`}>
                      {t(`recruiters.verification.${c.verificationStatus}`)}
                    </span>
                    <span className={`badge badge--${PLAN_TONE[c.plan] ?? 'neutral'}`}>
                      {t(`recruiters.plans.${c.plan}`)}
                    </span>
                  </div>
                </div>
              </li>
            ))}
          </ul>

          <Pager offset={filters.offset} limit={LIMIT} total={meta.total} onChange={(o) => update({ offset: o || '' }, false)} />
        </>
      )}
    </Layout>
  )
}
