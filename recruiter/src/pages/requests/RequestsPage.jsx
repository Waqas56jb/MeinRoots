import { useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import Layout from '../../components/Layout.jsx'
import Icon from '../../components/Icon.jsx'
import { EmptyState, ErrorState, PendingState, RequestStatus, Skeleton } from '../../components/ui.jsx'
import { useResource } from '../../hooks/useResource.js'
import { requestApi } from '../../services/index.js'
import { useI18n } from '../../context/I18nContext.jsx'
import { useToast } from '../../context/ToastContext.jsx'

const TYPES = ['all', 'contact', 'interview']
const STATUSES = ['pending', 'accepted', 'declined', 'completed', 'cancelled']

/**
 * Every request this company has sent, and where each one got to.
 *
 * Statuses are rendered from whatever the server returns rather than from a
 * list fixed here, so a state added later shows up without a release. The
 * filter chips are the known set — those are a UI affordance, and an unknown
 * status still renders correctly in the rows.
 */
export default function RequestsPage() {
  const { t, locale } = useI18n()
  const toast = useToast()
  const [params, setParams] = useSearchParams()
  const [cancelling, setCancelling] = useState(null)

  const type = params.get('type') ?? 'all'
  const status = params.get('status') ?? ''

  const update = (patch) => {
    const next = new URLSearchParams(params)
    for (const [k, v] of Object.entries(patch)) {
      if (!v || v === 'all') next.delete(k)
      else next.set(k, v)
    }
    setParams(next, { replace: true })
  }

  const { data, loading, error, pending, reload } = useResource(
    () => requestApi.list({ type: type === 'all' ? undefined : type, status: status || undefined }),
    [type, status],
  )

  const rows = data?.data ?? []

  const cancel = async (id) => {
    setCancelling(id)
    try {
      await requestApi.cancel(id)
      toast.success(t('requests.cancelled'))
      await reload()
    } catch {
      toast.error(t('requests.cancelFailed'))
    } finally {
      setCancelling(null)
    }
  }

  return (
    <Layout title={t('requests.title')} subtitle={t('requests.subtitle')}>
      <div className="tabbar__inline" role="tablist" aria-label={t('requests.filterType')}>
        {TYPES.map((tp) => (
          <button
            key={tp}
            type="button"
            role="tab"
            aria-selected={type === tp}
            className={type === tp ? 'is-on' : ''}
            onClick={() => update({ type: tp })}
          >
            {t(`requests.types.${tp}`)}
          </button>
        ))}
      </div>

      <div className="chips chips--filters">
        {STATUSES.map((s) => (
          <button
            key={s}
            type="button"
            className={`chip ${status === s ? 'is-on' : ''}`}
            aria-pressed={status === s}
            onClick={() => update({ status: status === s ? '' : s })}
          >
            {t(`requests.status.${s}`)}
          </button>
        ))}
      </div>

      {loading ? (
        <Skeleton variant="rows" rows={5} />
      ) : pending ? (
        <PendingState
          endpoint="GET /api/recruiter/requests"
          title={t('requests.pendingTitle')}
          text={t('requests.pendingText')}
        />
      ) : error ? (
        <ErrorState message={t('requests.loadError')} onRetry={reload} />
      ) : !rows.length ? (
        <EmptyState
          icon="message"
          title={status || type !== 'all' ? t('requests.noneFiltered') : t('requests.noneTitle')}
          text={status || type !== 'all' ? t('requests.noneFilteredText') : t('requests.noneText')}
          action={
            <Link to="/candidates" className="btn btn--primary btn--sm">{t('saved.findCandidates')}</Link>
          }
        />
      ) : (
        <ul className="requestlist">
          {rows.map((r) => (
            <li key={r.id} className={`requestrow requestrow--${r.status}`}>
              <span className={`requestrow__type requestrow__type--${r.type}`}>
                <Icon name={r.type === 'interview' ? 'calendar' : 'message'} size={17} />
              </span>

              <div className="requestrow__body">
                <div className="requestrow__top">
                  <Link to={`/candidates/${r.candidateId ?? r.candidate?.id}`}>
                    <strong>{r.candidate?.reference ?? r.candidateReference ?? t('requests.candidate')}</strong>
                  </Link>
                  <RequestStatus status={r.status} />
                </div>
                <p className="requestrow__meta">
                  {t(`requests.types.${r.type}`)}
                  {r.createdAt && (
                    <>
                      {' · '}
                      <time dateTime={r.createdAt}>
                        {new Intl.DateTimeFormat(locale, { dateStyle: 'medium' }).format(new Date(r.createdAt))}
                      </time>
                    </>
                  )}
                </p>
                {r.message && <p className="requestrow__message">{r.message}</p>}
                {/* The candidate's own words, when they replied. */}
                {r.response && (
                  <p className="requestrow__response">
                    <Icon name="handshake" size={14} />
                    {r.response}
                  </p>
                )}
              </div>

              {r.status === 'pending' && (
                <button
                  type="button"
                  className="btn btn--ghost btn--sm"
                  onClick={() => cancel(r.id)}
                  disabled={cancelling === r.id}
                >
                  {cancelling === r.id ? t('common.loading') : t('requests.withdraw')}
                </button>
              )}
            </li>
          ))}
        </ul>
      )}
    </Layout>
  )
}
