import { Link } from 'react-router-dom'
import Layout from '../../components/Layout.jsx'
import Icon from '../../components/Icon.jsx'
import { EmptyState, ErrorState, PendingState, Skeleton } from '../../components/ui.jsx'
import { useResource } from '../../hooks/useResource.js'
import { pipelineApi } from '../../services/index.js'
import { useI18n } from '../../context/I18nContext.jsx'

/**
 * Where each candidate stands in a recruitment process.
 *
 * The stages come from the server, not from a list written here. A hiring
 * pipeline gains steps — a second interview, a visa check, a start date — and
 * hard-coding today's set would mean a front-end release every time one is
 * added. An unrecognised stage still renders with its own label; only the
 * translation falls back.
 */
export default function PipelinePage() {
  const { t, locale } = useI18n()
  const { data, loading, error, pending, reload } = useResource(() => pipelineApi.list(), [])

  const stages = data?.stages ?? []
  const entries = data?.entries ?? []

  return (
    <Layout title={t('pipeline.title')} subtitle={t('pipeline.subtitle')}>
      {loading ? (
        <Skeleton variant="rows" rows={6} />
      ) : pending ? (
        <PendingState
          endpoint="GET /api/recruiter/pipeline"
          title={t('pipeline.pendingTitle')}
          text={t('pipeline.pendingText')}
        />
      ) : error ? (
        <ErrorState message={t('pipeline.loadError')} onRetry={reload} />
      ) : !entries.length ? (
        <EmptyState
          icon="workflow"
          title={t('pipeline.emptyTitle')}
          text={t('pipeline.emptyText')}
          action={<Link to="/candidates" className="btn btn--primary btn--sm">{t('saved.findCandidates')}</Link>}
        />
      ) : (
        <>
          {/* A count per stage, so the shape of the pipeline reads before the rows. */}
          {stages.length > 0 && (
            <ol className="stagebar">
              {stages.map((s) => (
                <li key={s.key}>
                  <strong className="num">{s.count ?? 0}</strong>
                  <span>{s.label ?? t(`pipeline.stages.${s.key}`)}</span>
                </li>
              ))}
            </ol>
          )}

          <ul className="pipelist">
            {entries.map((e) => (
              <li key={e.id}>
                <Link to={`/candidates/${e.candidateId ?? e.candidate?.id}`}>
                  <span className="pipelist__ref">
                    {e.candidate?.reference ?? e.candidateReference ?? `#${e.candidateId}`}
                  </span>
                  <span className="pipelist__body">
                    <strong>{e.candidate?.profession ?? t('candidates.professionUnknown')}</strong>
                    <small>
                      {e.stageLabel ?? t(`pipeline.stages.${e.stage}`)}
                      {e.updatedAt && (
                        <>
                          {' · '}
                          {new Intl.DateTimeFormat(locale, { dateStyle: 'medium' }).format(new Date(e.updatedAt))}
                        </>
                      )}
                    </small>
                  </span>
                  <span className={`pipelist__stage pipelist__stage--${e.stage}`}>
                    {e.stageLabel ?? t(`pipeline.stages.${e.stage}`)}
                  </span>
                  <Icon name="chevronRight" size={16} />
                </Link>
              </li>
            ))}
          </ul>
        </>
      )}
    </Layout>
  )
}
