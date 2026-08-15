import { useCallback, useEffect, useState } from 'react'
import Layout from '../components/Layout.jsx'
import Icon from '../components/Icon.jsx'
import { Empty, ErrorNote, Pager } from '../components/ui.jsx'
import { Freshness, TableSkeleton } from '../components/console.jsx'
import { useI18n } from '../context/I18nContext.jsx'
import { adminApi } from '../lib/api.js'
import { formatDateTime, formatRelative } from '../lib/format.js'

const LIMIT = 50

/** Actions worth filtering by, in the order an admin usually cares about them. */
const ACTIONS = [
  'cv.upload',
  'admin.candidate_view',
  'admin.review.approved',
  'admin.review.rejected',
  'admin.review.flagged',
  'admin.cv_download',
  'admin.gdpr_erasure',
  'auth.login',
  'auth.register',
]

const TONE = (action) => {
  if (action.startsWith('admin.gdpr')) return 'bad'
  if (action.startsWith('admin.review.rejected')) return 'bad'
  if (action.startsWith('admin.review.approved')) return 'good'
  if (action.startsWith('admin.')) return 'brand'
  if (action.startsWith('cv.')) return 'info'
  return 'neutral'
}

/** Events that change or expose someone's data, which a reader should not miss. */
const isSensitive = (action) =>
  action.startsWith('admin.gdpr') || action === 'admin.cv_download' || action.startsWith('admin.review.')

/**
 * The activity log.
 *
 * A table rather than a decorated timeline: this is a record read by someone
 * looking for a specific event, usually with a date and an actor already in
 * mind, and columns are what make that scannable. Sensitive events — erasure,
 * CV downloads, review decisions — carry a marker so they stand out of a long
 * run of routine logins.
 */
export default function AuditPage() {
  const { t, tError, locale } = useI18n()
  const [rows, setRows] = useState(null)
  const [meta, setMeta] = useState({ total: 0 })
  const [action, setAction] = useState('')
  const [offset, setOffset] = useState(0)
  const [error, setError] = useState('')
  const [fetchedAt, setFetchedAt] = useState(null)

  const load = useCallback(async () => {
    setRows(null)
    setError('')
    try {
      const response = await adminApi.audit({ action: action || undefined, limit: LIMIT, offset })
      setRows(response.data ?? [])
      setMeta(response.meta ?? { total: 0 })
      setFetchedAt(Date.now())
    } catch (err) {
      setError(tError(err.code))
      setRows([])
    }
  }, [action, offset, tError])

  useEffect(() => {
    load()
  }, [load])

  return (
    <Layout
      title={t('audit.title')}
      subtitle={t('audit.subtitle')}
      meta={<Freshness at={fetchedAt} />}
      actions={
        <button type="button" className="btn btn--ghost btn--sm" onClick={load}>
          <Icon name="refresh" size={16} /> <span className="hide-sm">{t('common.refresh')}</span>
        </button>
      }
    >
      <div className="filterbar">
        <div className="filterbar__controls">
          <select
            value={action}
            onChange={(e) => { setOffset(0); setAction(e.target.value) }}
            aria-label={t('audit.filterAction')}
          >
            <option value="">{t('audit.filterAction')}</option>
            {ACTIONS.map((a) => (
              <option key={a} value={a}>{t(`actions.${a}`)}</option>
            ))}
          </select>
          {action && (
            <button type="button" className="chip" onClick={() => { setOffset(0); setAction('') }}>
              {t(`actions.${action}`)}
              <Icon name="close" size={13} />
            </button>
          )}
        </div>
      </div>

      <ErrorNote message={error} onRetry={load} />

      {rows === null ? (
        <TableSkeleton rows={10} cols={4} />
      ) : rows.length === 0 ? (
        <Empty
          icon="scroll"
          title={t('audit.empty')}
          text={action ? t('audit.emptyFilteredText') : undefined}
        />
      ) : (
        <>
          <div className="tablewrap hide-md">
            <table className="table table--audit">
              <thead>
                <tr>
                  <th>{t('audit.table.when')}</th>
                  <th>{t('audit.table.event')}</th>
                  <th>{t('audit.table.actor')}</th>
                  <th>{t('audit.table.entity')}</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((row) => (
                  <tr key={row.id} className={isSensitive(row.action) ? 'is-sensitive' : ''}>
                    <td className="table__when">
                      <time dateTime={row.created_at} title={formatDateTime(row.created_at, locale)}>
                        {formatRelative(row.created_at, locale)}
                      </time>
                      <span className="muted small">{formatDateTime(row.created_at, locale)}</span>
                    </td>
                    <td>
                      <span className={`badge badge--${TONE(row.action)}`}>{t(`actions.${row.action}`)}</span>
                    </td>
                    <td>
                      <strong>{row.actor_name ?? t('audit.system')}</strong>
                      {row.ip && <div className="muted small">{row.ip}</div>}
                    </td>
                    <td className="muted small">{row.entity_type ?? '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <ul className="audit show-md">
            {rows.map((row) => (
              <li key={row.id} className={isSensitive(row.action) ? 'is-sensitive' : ''}>
                <span className={`badge badge--${TONE(row.action)}`}>{t(`actions.${row.action}`)}</span>
                <div className="audit__body">
                  <strong>{row.actor_name ?? t('audit.system')}</strong>
                  <span className="muted small">
                    {[row.entity_type, row.ip].filter(Boolean).join(' · ')}
                  </span>
                </div>
                <time dateTime={row.created_at} title={formatDateTime(row.created_at, locale)}>
                  {formatRelative(row.created_at, locale)}
                </time>
              </li>
            ))}
          </ul>

          <Pager offset={offset} limit={LIMIT} total={meta.total} onChange={setOffset} />
        </>
      )}
    </Layout>
  )
}
