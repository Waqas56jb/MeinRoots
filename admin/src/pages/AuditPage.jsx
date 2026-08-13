import { useCallback, useEffect, useState } from 'react'
import Layout from '../components/Layout.jsx'
import Icon from '../components/Icon.jsx'
import { Empty, ErrorNote, Pager, Skeleton } from '../components/ui.jsx'
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

export default function AuditPage() {
  const { t, tError, locale } = useI18n()
  const [rows, setRows] = useState(null)
  const [meta, setMeta] = useState({ total: 0 })
  const [action, setAction] = useState('')
  const [offset, setOffset] = useState(0)
  const [error, setError] = useState('')

  const load = useCallback(async () => {
    setRows(null)
    setError('')
    try {
      const response = await adminApi.audit({ action: action || undefined, limit: LIMIT, offset })
      setRows(response.data ?? [])
      setMeta(response.meta ?? { total: 0 })
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
      actions={
        <button type="button" className="btn btn--ghost btn--sm" onClick={load}>
          <Icon name="refresh" size={16} /> <span className="hide-sm">{t('common.refresh')}</span>
        </button>
      }
    >
      <div className="filters">
        <div className="filters__row">
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
        </div>
      </div>

      <ErrorNote message={error} onRetry={load} />

      {rows === null ? (
        <Skeleton rows={8} />
      ) : rows.length === 0 ? (
        <Empty icon="scroll" title={t('audit.empty')} />
      ) : (
        <>
          <ul className="audit">
            {rows.map((row) => (
              <li key={row.id}>
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
