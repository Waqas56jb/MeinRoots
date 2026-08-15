import { useCallback, useEffect, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import Layout from '../components/Layout.jsx'
import Icon from '../components/Icon.jsx'
import { Empty, ErrorNote, Pager } from '../components/ui.jsx'
import { Freshness, TableSkeleton } from '../components/console.jsx'
import { ApiError, adminApi } from '../lib/api.js'
import { useI18n } from '../context/I18nContext.jsx'
import { formatDateTime, formatRelative } from '../lib/format.js'

const LIMIT = 50
const TYPES = ['contact', 'interview']
const STATUSES = ['pending', 'accepted', 'declined', 'completed', 'cancelled']
const TONE = { pending: 'info', accepted: 'good', declined: 'bad', completed: 'good', cancelled: 'neutral' }

/**
 * Every approach a company has made to a candidate.
 *
 * This is the compliance view as much as the operational one: it is the record
 * of who asked to contact whom, and what the candidate said. The candidate
 * reference is shown rather than their name — staff monitoring request volume
 * do not need to know which person each row is, and a screen that shows it
 * anyway is a screen that leaks by default.
 */
export default function RequestsPage() {
  const { t, tError, locale } = useI18n()
  const [params, setParams] = useSearchParams()

  const [rows, setRows] = useState(null)
  const [meta, setMeta] = useState({ total: 0 })
  const [error, setError] = useState('')
  const [pending, setPending] = useState(false)
  const [fetchedAt, setFetchedAt] = useState(null)

  const type = params.get('type') ?? ''
  const status = params.get('status') ?? ''
  const offset = Number(params.get('offset') ?? 0)

  const update = (patch, resetOffset = true) => {
    const next = new URLSearchParams(params)
    for (const [k, v] of Object.entries(patch)) {
      if (!v) next.delete(k)
      else next.set(k, String(v))
    }
    if (resetOffset) next.delete('offset')
    setParams(next, { replace: true })
  }

  const load = useCallback(async () => {
    setRows(null)
    setError('')
    setPending(false)
    try {
      const res = await adminApi.requests({ type, status, limit: LIMIT, offset })
      setRows(res.data ?? [])
      setMeta(res.meta ?? { total: 0 })
      setFetchedAt(Date.now())
    } catch (err) {
      if (err instanceof ApiError && err.status === 404) setPending(true)
      else setError(tError(err.code))
      setRows([])
    }
  }, [type, status, offset, tError])

  useEffect(() => {
    load()
  }, [load])

  return (
    <Layout
      title={t('adminRequests.title')}
      subtitle={t('adminRequests.subtitle')}
      meta={<Freshness at={fetchedAt} />}
      actions={
        <button type="button" className="btn btn--ghost btn--sm" onClick={load}>
          <Icon name="refresh" size={16} /> <span className="hide-sm">{t('common.refresh')}</span>
        </button>
      }
    >
      <div className="chipbar" role="tablist" aria-label={t('adminRequests.title')}>
        <button type="button" role="tab" aria-selected={!type} className={!type ? 'is-on' : ''} onClick={() => update({ type: '' })}>
          {t('common.all')}
        </button>
        {TYPES.map((tp) => (
          <button key={tp} type="button" role="tab" aria-selected={type === tp} className={type === tp ? 'is-on' : ''} onClick={() => update({ type: tp })}>
            {t(`adminRequests.types.${tp}`)}
          </button>
        ))}
      </div>

      <div className="filterbar">
        <div className="filterbar__controls">
          <select value={status} onChange={(e) => update({ status: e.target.value })} aria-label={t('adminRequests.filterStatus')}>
            <option value="">{t('adminRequests.filterStatus')}</option>
            {STATUSES.map((s) => <option key={s} value={s}>{t(`adminRequests.status.${s}`)}</option>)}
          </select>
        </div>
      </div>

      <ErrorNote message={error} onRetry={load} />

      {rows === null ? (
        <TableSkeleton rows={10} cols={5} />
      ) : pending ? (
        <section className="allclear allclear--pending">
          <span className="allclear__icon"><Icon name="clock" size={24} /></span>
          <div>
            <h2>{t('adminRequests.pendingTitle')}</h2>
            <p>{t('adminRequests.pendingText')}</p>
            <code>GET /api/admin/requests</code>
          </div>
        </section>
      ) : !rows.length ? (
        <Empty icon="message" title={t('adminRequests.emptyTitle')} text={t('adminRequests.emptyText')} />
      ) : (
        <>
          <div className="tablewrap hide-md">
            <table className="table">
              <thead>
                <tr>
                  <th>{t('adminRequests.table.when')}</th>
                  <th>{t('adminRequests.table.company')}</th>
                  <th>{t('adminRequests.table.candidate')}</th>
                  <th>{t('adminRequests.table.type')}</th>
                  <th>{t('adminRequests.table.status')}</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => (
                  <tr key={r.id}>
                    <td className="table__when">
                      <time dateTime={r.createdAt} title={formatDateTime(r.createdAt, locale)}>
                        {formatRelative(r.createdAt, locale)}
                      </time>
                    </td>
                    <td><strong>{r.company?.name ?? '—'}</strong></td>
                    {/* The reference, never the candidate's name. */}
                    <td className="muted small">{r.candidateReference ?? r.candidate?.reference ?? '—'}</td>
                    <td>{t(`adminRequests.types.${r.type}`)}</td>
                    <td><span className={`badge badge--${TONE[r.status] ?? 'neutral'}`}>{t(`adminRequests.status.${r.status}`)}</span></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <Pager offset={offset} limit={LIMIT} total={meta.total} onChange={(o) => update({ offset: o || '' }, false)} />
        </>
      )}
    </Layout>
  )
}
