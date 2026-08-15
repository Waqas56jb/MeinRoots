import { useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import Layout from '../../components/Layout.jsx'
import Icon from '../../components/Icon.jsx'
import RequestSheet from '../../components/RequestSheet.jsx'
import {
  AccessRestricted, Badge, ErrorState, Panel, PendingState, Readiness, RequestStatus, Skeleton,
} from '../../components/ui.jsx'
import { useResource } from '../../hooks/useResource.js'
import { savedApi, searchApi } from '../../services/index.js'
import { useI18n } from '../../context/I18nContext.jsx'
import { useToast } from '../../context/ToastContext.jsx'

/**
 * One candidate, in as much detail as this recruiter is entitled to.
 *
 * The page is built in two halves that are never mixed: what the server sent,
 * and an explanation of what it did not. Restricted information is absent from
 * the response and therefore absent from the DOM — there is no hidden field
 * behind a blur, because a blur is a decoration over data anyone can read with
 * the developer tools open.
 */
export default function CandidateDetailPage() {
  const { id } = useParams()
  const { t } = useI18n()
  const toast = useToast()
  const [requestType, setRequestType] = useState(null)
  const [saving, setSaving] = useState(false)

  const { data, loading, error, pending, reload, setData } = useResource(
    () => searchApi.candidate(id),
    [id],
  )

  const c = data?.candidate ?? null
  const access = data?.access ?? { level: 'anonymous' }

  const toggleSave = async () => {
    setSaving(true)
    try {
      if (c.isSaved) await savedApi.unsave(c.id)
      else await savedApi.save(c.id)
      setData((cur) => (cur ? { ...cur, candidate: { ...cur.candidate, isSaved: !cur.candidate.isSaved } } : cur))
      toast.success(t(c.isSaved ? 'candidates.unsaved' : 'candidates.saved'))
    } catch {
      toast.error(t('candidates.saveFailed'))
    } finally {
      setSaving(false)
    }
  }

  const shell = {
    title: c?.reference ?? t('candidates.candidate'),
    subtitle: c?.profession ?? undefined,
    actions: (
      <Link to="/candidates" className="btn btn--ghost btn--sm">
        <Icon name="arrowLeft" size={16} /> <span className="hide-sm">{t('common.back')}</span>
      </Link>
    ),
  }

  if (loading) {
    return <Layout {...shell}><Skeleton variant="detail" /></Layout>
  }
  if (pending) {
    return (
      <Layout {...shell}>
        <PendingState
          endpoint={`GET /api/recruiter/candidates/${id}`}
          title={t('candidates.detailPendingTitle')}
          text={t('candidates.detailPendingText')}
        />
      </Layout>
    )
  }
  if (error || !c) {
    return (
      <Layout {...shell}>
        <ErrorState message={t('candidates.detailError')} onRetry={reload} />
      </Layout>
    )
  }

  return (
    <Layout {...shell}>
      {/* ------------------------------ summary ---------------------------- */}
      <section className="cdetail">
        <div className="cdetail__head">
          <div className="cdetail__id">
            <span className="cdetail__ref">{c.reference ?? `#${c.id}`}</span>
            <h2>{c.profession ?? t('candidates.professionUnknown')}</h2>
            {c.specialisation && <p>{c.specialisation}</p>}
            <div className="cdetail__tags">
              {(c.goals ?? []).map((g) => <Badge key={g} icon="target">{t(`goals.${g}`)}</Badge>)}
              {c.workAuthorisation && (
                <Badge icon="shield">{t(`candidates.auth.${c.workAuthorisation}`)}</Badge>
              )}
            </div>
          </div>
          <Readiness value={c.readiness} />
        </div>

        <div className="cdetail__actions">
          {c.requestState ? (
            <RequestStatus status={c.requestState} />
          ) : (
            <>
              <button type="button" className="btn btn--primary" onClick={() => setRequestType('contact')}>
                <Icon name="message" size={16} /> {t('candidates.requestContact')}
              </button>
              <button type="button" className="btn btn--ghost" onClick={() => setRequestType('interview')}>
                <Icon name="calendar" size={16} /> {t('candidates.requestInterview')}
              </button>
            </>
          )}
          <button
            type="button"
            className={`btn btn--ghost ${c.isSaved ? 'is-on' : ''}`}
            onClick={toggleSave}
            disabled={saving}
            aria-pressed={Boolean(c.isSaved)}
          >
            <Icon name="bookmark" size={16} />
            {t(c.isSaved ? 'candidates.unsave' : 'candidates.save')}
          </button>
        </div>
      </section>

      {/* --------------------------- what is hidden ------------------------- */}
      {access.level !== 'granted' && (
        <AccessRestricted
          level={access.level}
          requestState={c.requestState}
          onRequest={c.requestState ? undefined : () => setRequestType('contact')}
        />
      )}

      <div className="cdetail__grid">
        <div className="cdetail__main">
          {c.summary && (
            <Panel icon="user" title={t('candidates.summary')}>
              <p className="lead">{c.summary}</p>
            </Panel>
          )}

          <Panel icon="briefcase" title={t('candidates.experienceTitle')}>
            {c.experiences?.length ? (
              <ol className="timeline">
                {c.experiences.map((e, i) => (
                  <li key={e.id ?? i}>
                    <span className="timeline__dot" aria-hidden="true" />
                    <div>
                      <h3>{e.role}</h3>
                      <p className="muted small">
                        {[e.company, e.location].filter(Boolean).join(' · ')}
                        {e.period ? ` — ${e.period}` : ''}
                      </p>
                      {e.description && <p className="small">{e.description}</p>}
                    </div>
                  </li>
                ))}
              </ol>
            ) : (
              <p className="muted small">{t('candidates.noneRecorded')}</p>
            )}
          </Panel>

          <Panel icon="graduation" title={t('candidates.educationTitle')}>
            {c.education?.length ? (
              <ul className="plain">
                {c.education.map((e, i) => (
                  <li key={e.id ?? i}>
                    <strong>{[e.degree, e.field].filter(Boolean).join(' — ')}</strong>
                    <span className="muted small">{[e.institution, e.country, e.endYear].filter(Boolean).join(' · ')}</span>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="muted small">{t('candidates.noneRecorded')}</p>
            )}
          </Panel>
        </div>

        <div className="cdetail__side">
          <Panel icon="spark" title={t('candidates.skills')}>
            {c.skills?.length ? (
              <ul className="taglist">
                {c.skills.map((s) => {
                  const name = typeof s === 'string' ? s : s.name
                  const proven = typeof s === 'object' && s.isEvidenced
                  return (
                    <li key={name} className={proven ? 'is-proven' : ''}>
                      {proven && <Icon name="check" size={12} />}
                      {name}
                    </li>
                  )
                })}
              </ul>
            ) : (
              <p className="muted small">{t('candidates.noneRecorded')}</p>
            )}
          </Panel>

          <Panel icon="translate" title={t('candidates.languages')}>
            {c.languages?.length ? (
              <ul className="langlist">
                {c.languages.map((l, i) => (
                  <li key={l.language ?? i}>
                    <strong>{l.language}</strong>
                    <Badge tone={l.level ? 'good' : 'neutral'}>{l.level ?? t('candidates.levelUnknown')}</Badge>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="muted small">{t('candidates.noneRecorded')}</p>
            )}
          </Panel>

          {/*
            Only rendered when the assessment actually produced it. A match
            score the backend does not send is not estimated here — a number
            invented on this side would look exactly as authoritative as a real
            one and be worth nothing.
          */}
          {c.readinessDetail?.factors?.length > 0 && (
            <Panel icon="trending" title={t('candidates.fit')}>
              <ul className="factorlist">
                {c.readinessDetail.factors.map((f) => (
                  <li key={f.key ?? f.label}>
                    <span className="factorlist__top">
                      <strong>{f.label}</strong>
                      <em className="num">{Math.round(f.score)}</em>
                    </span>
                    <span className="factorlist__track">
                      <span style={{ width: `${Math.max(2, Math.min(100, f.score))}%` }} />
                    </span>
                  </li>
                ))}
              </ul>
            </Panel>
          )}
        </div>
      </div>

      <RequestSheet
        candidate={requestType ? c : null}
        type={requestType ?? 'contact'}
        onClose={() => setRequestType(null)}
        onSent={() => {
          setRequestType(null)
          reload()
        }}
      />
    </Layout>
  )
}
