import { useState } from 'react'
import { Link } from 'react-router-dom'
import Layout from '../../components/Layout.jsx'
import Icon from '../../components/Icon.jsx'
import CandidateCard from '../../components/CandidateCard.jsx'
import RequestSheet from '../../components/RequestSheet.jsx'
import { EmptyState, ErrorState, Pager, PendingState, Skeleton } from '../../components/ui.jsx'
import { useResource } from '../../hooks/useResource.js'
import { savedApi } from '../../services/index.js'
import { useI18n } from '../../context/I18nContext.jsx'
import { useToast } from '../../context/ToastContext.jsx'

const LIMIT = 12

/**
 * The candidates this recruiter kept.
 *
 * Deliberately one flat list rather than named shortlists. Shortlists are a
 * real feature with a real data model behind them, and building the folders
 * before the backend can store them would produce an interface that forgets
 * everything on reload. The list ships now; the grouping arrives with the
 * endpoint that can hold it.
 */
export default function SavedPage() {
  const { t } = useI18n()
  const toast = useToast()
  const [offset, setOffset] = useState(0)
  const [requestFor, setRequestFor] = useState(null)

  const { data, loading, error, pending, reload, setData } = useResource(
    () => savedApi.list({ limit: LIMIT, offset }),
    [offset],
  )

  const rows = data?.data ?? []
  const total = data?.meta?.total ?? rows.length

  const unsave = async (candidate) => {
    try {
      await savedApi.unsave(candidate.id)
      // Drop it from the list rather than refetching: it is the saved list, and
      // an unsaved candidate has no business still being on screen.
      setData((cur) => (cur ? { ...cur, data: cur.data.filter((c) => c.id !== candidate.id) } : cur))
      toast.success(t('candidates.unsaved'))
    } catch {
      toast.error(t('candidates.saveFailed'))
    }
  }

  return (
    <Layout
      title={t('saved.title')}
      subtitle={t('saved.subtitle')}
      meta={total > 0 ? <span className="topbar__count num">{t('saved.count', { count: total })}</span> : null}
    >
      {loading ? (
        <div className="cardgrid"><Skeleton variant="cards" rows={6} /></div>
      ) : pending ? (
        <PendingState endpoint="GET /api/recruiter/saved" />
      ) : error ? (
        <ErrorState message={t('saved.loadError')} onRetry={reload} />
      ) : !rows.length ? (
        <EmptyState
          icon="bookmark"
          title={t('saved.emptyTitle')}
          text={t('saved.emptyText')}
          action={
            <Link to="/candidates" className="btn btn--primary btn--sm">
              <Icon name="search" size={15} /> {t('saved.findCandidates')}
            </Link>
          }
        />
      ) : (
        <>
          <div className="cardgrid">
            {rows.map((c) => (
              <CandidateCard
                key={c.id}
                candidate={{ ...c, isSaved: true }}
                onSave={unsave}
                onRequest={setRequestFor}
              />
            ))}
          </div>
          <Pager offset={offset} limit={LIMIT} total={total} onChange={setOffset} />
        </>
      )}

      <RequestSheet
        candidate={requestFor}
        type="contact"
        onClose={() => setRequestFor(null)}
        onSent={() => { setRequestFor(null); reload() }}
      />
    </Layout>
  )
}
