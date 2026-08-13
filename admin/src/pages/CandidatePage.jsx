import { useCallback, useEffect, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import Layout from '../components/Layout.jsx'
import Icon from '../components/Icon.jsx'
import { Confidence, CvBadge, Empty, ErrorNote, Progress, ReviewBadge, Score, Skeleton } from '../components/ui.jsx'
import { useI18n } from '../context/I18nContext.jsx'
import { useAuth } from '../context/AuthContext.jsx'
import { useToast } from '../context/ToastContext.jsx'
import { adminApi } from '../lib/api.js'
import { formatBytes, formatDate, formatDateTime, formatExperience, formatMonth } from '../lib/format.js'

const TABS = ['profile', 'readiness', 'answers', 'documents', 'history']

export default function CandidatePage() {
  const { userId } = useParams()
  const { t, tError, locale } = useI18n()
  const { isSuperAdmin } = useAuth()
  const toast = useToast()
  const navigate = useNavigate()

  const [data, setData] = useState(null)
  const [error, setError] = useState('')
  const [tab, setTab] = useState('profile')
  const [note, setNote] = useState('')
  const [busy, setBusy] = useState(false)
  const [eraseOpen, setEraseOpen] = useState(false)

  const load = useCallback(async () => {
    setError('')
    try {
      setData(await adminApi.candidate(userId))
    } catch (err) {
      setError(tError(err.code))
      setData(false)
    }
  }, [userId, tError])

  useEffect(() => {
    load()
  }, [load])

  const review = async (status) => {
    if (status === 'rejected' && !window.confirm(t('detail.review.confirmReject'))) return
    setBusy(true)
    try {
      await adminApi.review(userId, { status, note: note.trim() || undefined })
      setNote('')
      toast.success(t('detail.review.saved'))
      await load()
    } catch (err) {
      toast.error(tError(err.code))
    } finally {
      setBusy(false)
    }
  }

  const resolveFlag = async (flagId) => {
    try {
      await adminApi.resolveFlag(flagId)
      toast.success(t('detail.flags.resolved'))
      await load()
    } catch (err) {
      toast.error(tError(err.code))
    }
  }

  const approveVersion = async (versionId) => {
    try {
      await adminApi.approveVersion(versionId)
      toast.success(t('detail.documents.versionApproved'))
      await load()
    } catch (err) {
      toast.error(tError(err.code))
    }
  }

  if (data === null) {
    return (
      <Layout title={t('candidates.title')}>
        <Skeleton rows={5} />
      </Layout>
    )
  }

  if (data === false) {
    return (
      <Layout title={t('detail.notFound')}>
        <ErrorNote message={error} onRetry={load} />
        <Link to="/candidates" className="btn btn--ghost">
          <Icon name="arrowLeft" size={16} /> {t('detail.back')}
        </Link>
      </Layout>
    )
  }

  const { candidate, profile, documents, questionnaire, reviews, cvVersions } = data
  const primaryDoc = documents?.[0]
  const openFlags = profile?.flags ?? []

  return (
    <Layout
      title={candidate.name}
      subtitle={candidate.email}
      actions={
        <Link to="/candidates" className="btn btn--ghost btn--sm">
          <Icon name="arrowLeft" size={16} /> <span className="hide-sm">{t('detail.back')}</span>
        </Link>
      }
    >
      <ErrorNote message={error} onRetry={load} />

      {/* Everything needed to decide, above the fold: status, confidence,
          the open exceptions, and the three buttons that end the review. */}
      <section className="card decide">
        <div className="decide__facts">
          <Fact label={t('detail.meta.status')} value={<ReviewBadge status={profile?.reviewStatus} />} />
          <Fact label={t('candidates.table.cv')} value={<CvBadge status={primaryDoc?.status} />} />
          <Fact label={t('detail.meta.confidence')} value={<Confidence value={profile?.extractionConfidence} />} />
          <Fact
            label={t('detail.meta.completeness')}
            value={
              profile ? (
                <span className="withbar">
                  <Progress value={profile.completeness} />
                  {profile.completeness}%
                </span>
              ) : '—'
            }
          />
          <Fact label={t('detail.meta.registered')} value={formatDate(candidate.createdAt, locale)} />
          <Fact label={t('detail.meta.lastLogin')} value={formatDate(candidate.lastLoginAt, locale)} />
          <Fact
            label={t('detail.meta.consent')}
            value={
              candidate.gdprConsentAt ? (
                <span className="is-good">{formatDate(candidate.gdprConsentAt, locale)}</span>
              ) : (
                <span className="is-bad">{t('detail.meta.noConsent')}</span>
              )
            }
          />
          <Fact label={t('detail.meta.locale')} value={candidate.locale?.toUpperCase()} />
        </div>

        <ul className="tags tags--lg">
          {(candidate.goals ?? []).map((g) => (
            <li key={g}><Icon name="target" size={13} />{t(`goals.${g}`)}</li>
          ))}
          {profile?.classification && (
            <li className="is-brand">
              <Icon name="compass" size={13} />
              {profile.classification.label}
              {profile.classification.specialisation ? ` · ${profile.classification.specialisation}` : ''}
            </li>
          )}
        </ul>

        <div className="decide__act">
          <textarea
            rows={2}
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder={t('detail.review.notePlaceholder')}
            aria-label={t('detail.review.notePlaceholder')}
          />
          <div className="decide__buttons">
            <button type="button" className="btn btn--primary" disabled={busy} onClick={() => review('approved')}>
              <Icon name="checkCircle" size={17} /> {t('detail.review.approve')}
            </button>
            <button type="button" className="btn btn--warn" disabled={busy} onClick={() => review('flagged')}>
              <Icon name="warning" size={17} /> {t('detail.review.flag')}
            </button>
            <button type="button" className="btn btn--danger" disabled={busy} onClick={() => review('rejected')}>
              <Icon name="ban" size={17} /> {t('detail.review.reject')}
            </button>
          </div>
        </div>
      </section>

      {openFlags.length > 0 && (
        <section className="card">
          <h2><Icon name="warning" size={17} />{t('detail.flags.title')}</h2>
          <ul className="flags">
            {openFlags.map((flag) => (
              <li key={flag.id} className={`flags__item flags__item--${flag.severity}`}>
                <div>
                  <strong>{t(`flags.${flag.code}`)}</strong>
                  {flag.detail && <span>{flag.detail}</span>}
                </div>
                <button type="button" className="btn btn--ghost btn--sm" onClick={() => resolveFlag(flag.id)}>
                  {t('detail.flags.resolve')}
                </button>
              </li>
            ))}
          </ul>
        </section>
      )}

      <div className="tabs" role="tablist">
        {TABS.map((key) => (
          <button
            key={key}
            type="button"
            role="tab"
            aria-selected={tab === key}
            className={tab === key ? 'is-on' : ''}
            onClick={() => setTab(key)}
          >
            {t(`detail.tabs.${key}`)}
          </button>
        ))}
      </div>

      {!profile && tab !== 'documents' && tab !== 'history' ? (
        <Empty icon="file" title={t('detail.noProfile')} />
      ) : null}

      {tab === 'profile' && profile && <ProfileTab profile={profile} />}
      {tab === 'readiness' && profile && <ReadinessTab assessments={profile.assessments} />}
      {tab === 'answers' && profile && <AnswersTab questionnaire={questionnaire} />}
      {tab === 'documents' && (
        <DocumentsTab documents={documents} versions={cvVersions} onApprove={approveVersion} />
      )}
      {tab === 'history' && <HistoryTab reviews={reviews} />}

      {isSuperAdmin && (
        <section className="card danger">
          <div>
            <h2><Icon name="trash" size={17} />{t('detail.danger.title')}</h2>
            <p>{t('detail.danger.text')}</p>
          </div>
          <button type="button" className="btn btn--danger" onClick={() => setEraseOpen(true)}>
            {t('detail.danger.button')}
          </button>
        </section>
      )}

      {eraseOpen && (
        <EraseDialog
          email={candidate.email}
          onClose={() => setEraseOpen(false)}
          onConfirm={async () => {
            await adminApi.erase(userId)
            toast.success(t('detail.danger.done'))
            navigate('/candidates', { replace: true })
          }}
        />
      )}
    </Layout>
  )
}

function Fact({ label, value }) {
  return (
    <div className="fact">
      <dt>{label}</dt>
      <dd>{value ?? '—'}</dd>
    </div>
  )
}

function ProfileTab({ profile }) {
  const { t, locale } = useI18n()

  const range = (start, end, isCurrent) => {
    const from = formatMonth(start, locale)
    const to = isCurrent ? t('profile.present') : formatMonth(end, locale)
    if (!from && !to) return t('profile.datesUnknown')
    return `${from ?? '?'} – ${to ?? '?'}`
  }

  const evidenced = profile.skills.filter((s) => s.isEvidenced)
  const claimed = profile.skills.filter((s) => !s.isEvidenced)

  return (
    <div className="grid2">
      <div className="stack">
        {profile.summary && (
          <section className="card">
            <h2><Icon name="user" size={17} />{profile.headline || t('detail.tabs.profile')}</h2>
            <p className="lead">{profile.summary}</p>
            <dl className="inlinefacts">
              <div><dt>{t('profile.experience')}</dt><dd>{formatExperience(profile.totalExperienceMonths)}</dd></div>
              {profile.country && <div><dt><Icon name="pin" size={13} /></dt><dd>{[profile.city, profile.country].filter(Boolean).join(', ')}</dd></div>}
              {profile.classification?.seniority && (
                <div><dt>Seniority</dt><dd>{profile.classification.seniority}</dd></div>
              )}
            </dl>
          </section>
        )}

        <section className="card">
          <h2><Icon name="briefcase" size={17} />{t('profile.experience')}</h2>
          {profile.experiences.length ? (
            <ol className="timeline">
              {profile.experiences.map((e) => (
                <li key={e.id}>
                  <span className="timeline__dot" aria-hidden="true" />
                  <div>
                    <h3>
                      {e.role}
                      {e.confidence !== null && e.confidence < 0.7 && (
                        <span className="lowconf"><Icon name="alert" size={11} />{Math.round(e.confidence * 100)}%</span>
                      )}
                    </h3>
                    <p className="muted small">
                      {[e.company, e.location].filter(Boolean).join(' · ')}
                      {e.company || e.location ? ' — ' : ''}
                      {range(e.startDate, e.endDate, e.isCurrent)}
                    </p>
                    {e.description && <p className="small">{e.description}</p>}
                    {e.skills?.length > 0 && (
                      <ul className="tags tags--sm">
                        {e.skills.slice(0, 8).map((s) => <li key={s}>{s}</li>)}
                      </ul>
                    )}
                  </div>
                </li>
              ))}
            </ol>
          ) : (
            <p className="muted small">{t('profile.empty')}</p>
          )}
        </section>

        <section className="card">
          <h2><Icon name="graduation" size={17} />{t('profile.education')}</h2>
          {profile.education.length ? (
            <ul className="plain">
              {profile.education.map((e) => (
                <li key={e.id}>
                  <strong>{[e.degree, e.field].filter(Boolean).join(' — ') || '—'}</strong>
                  <span className="muted small">
                    {[e.institution, e.country, e.endYear].filter(Boolean).join(' · ')}
                  </span>
                  {e.likelyRecognisedInGermany === true && (
                    <span className="badge badge--good">{t('profile.recognised')}</span>
                  )}
                  {e.likelyRecognisedInGermany === false && (
                    <span className="badge badge--warn">{t('profile.recognitionUnclear')}</span>
                  )}
                </li>
              ))}
            </ul>
          ) : (
            <p className="muted small">{t('profile.empty')}</p>
          )}

          {profile.certifications.length > 0 && (
            <>
              <h3 className="sub">{t('profile.certifications')}</h3>
              <ul className="plain">
                {profile.certifications.map((c) => (
                  <li key={c.id}>
                    <strong>{c.name}</strong>
                    <span className="muted small">{[c.issuer, c.issuedOn?.slice(0, 4)].filter(Boolean).join(' · ')}</span>
                  </li>
                ))}
              </ul>
            </>
          )}
        </section>
      </div>

      <div className="stack">
        <section className="card">
          <h2><Icon name="sparkle" size={17} />{t('profile.skills')}</h2>
          {evidenced.length > 0 && (
            <>
              <p className="muted small">{t('profile.evidenced')}</p>
              <ul className="tags tags--lg">
                {evidenced.map((s) => (
                  <li key={s.id} className="is-good" title={s.evidence || undefined}>
                    <Icon name="check" size={12} />{s.name}
                  </li>
                ))}
              </ul>
            </>
          )}
          {claimed.length > 0 && (
            <>
              <p className="muted small">{t('profile.claimed')}</p>
              <ul className="tags">
                {claimed.map((s) => <li key={s.id}>{s.name}</li>)}
              </ul>
            </>
          )}
          {!profile.skills.length && <p className="muted small">{t('profile.empty')}</p>}
        </section>

        <section className="card">
          <h2><Icon name="translate" size={17} />{t('profile.languages')}</h2>
          {profile.languages.length ? (
            <ul className="langs">
              {profile.languages.map((l) => (
                <li key={l.id}>
                  <strong>{l.language}</strong>
                  <span className={`badge ${l.level ? 'badge--good' : 'badge--warn'}`}>
                    {l.level ?? t('profile.levelUnknown')}
                  </span>
                  <em className="muted small">{l.certificate ?? (l.isSelfReported ? t('profile.selfReported') : '')}</em>
                </li>
              ))}
            </ul>
          ) : (
            <p className="muted small">{t('profile.empty')}</p>
          )}
        </section>

        {profile.classification?.rationale && (
          <section className="card">
            <h2><Icon name="compass" size={17} />{profile.classification.label}</h2>
            <p className="small">{profile.classification.rationale}</p>
            <p className="muted small">
              <Confidence value={profile.classification.confidence} />
            </p>
          </section>
        )}
      </div>
    </div>
  )
}

function ReadinessTab({ assessments }) {
  const { t } = useI18n()
  if (!assessments?.length) return <Empty icon="target" title={t('readiness.empty')} />

  return (
    <div className="grid2">
      {assessments.map((a) => (
        <section key={a.id} className="card">
          <header className="rhead">
            <div>
              <span className="muted small">{t(`goals.${a.goal}`)}</span>
              <h2>{t(`readiness.bands.${a.band}`)}</h2>
            </div>
            <Score value={a.score} />
          </header>

          {a.summary && <p className="small">{a.summary}</p>}

          {a.factors?.length > 0 && (
            <>
              <h3 className="sub">{t('readiness.factors')}</h3>
              <ul className="factors">
                {a.factors.map((f) => (
                  <li key={f.key + f.label} className={`factor--${f.status}`}>
                    <span className="factors__top">
                      <strong>{f.label}</strong>
                      <em>{Math.round(f.score)}</em>
                    </span>
                    <Progress value={f.score} />
                    <span className="muted small">{f.detail}</span>
                  </li>
                ))}
              </ul>
            </>
          )}

          {a.gaps?.length > 0 && (
            <>
              <h3 className="sub">{t('readiness.gaps')}</h3>
              <ul className="gaps">
                {a.gaps.map((g) => (
                  <li key={g.id} className={`gap--${g.importance}`}>
                    <div className="gaps__top">
                      <strong>{g.skill}</strong>
                      <span className="badge badge--neutral">{t(`readiness.importance.${g.importance}`)}</span>
                      {g.estimatedWeeks ? (
                        <span className="muted small"><Icon name="clock" size={12} />{t('readiness.weeks', { count: g.estimatedWeeks })}</span>
                      ) : null}
                    </div>
                    {(g.currentLevel || g.targetLevel) && (
                      <p className="muted small">{g.currentLevel} → <strong>{g.targetLevel}</strong></p>
                    )}
                    {g.why && <p className="small">{g.why}</p>}
                    {g.howToClose && <p className="small is-action"><Icon name="bolt" size={13} />{g.howToClose}</p>}
                  </li>
                ))}
              </ul>
            </>
          )}
        </section>
      ))}
    </div>
  )
}

function AnswersTab({ questionnaire }) {
  const { t } = useI18n()
  if (!questionnaire?.length) return <Empty icon="clipboard" title={t('detail.answers.empty')} />

  return (
    <section className="card">
      <h2><Icon name="clipboard" size={17} />{t('detail.answers.title')}</h2>
      <ul className="qa">
        {questionnaire.map((q) => (
          <li key={q.key}>
            <strong>{q.question}</strong>
            <span className={q.answer === null ? 'muted' : 'is-answer'}>
              {q.answer === null
                ? t('detail.answers.unanswered')
                : Array.isArray(q.answer)
                  ? q.answer.join(', ')
                  : String(q.answer)}
            </span>
            {q.reason && <span className="muted small">{t('detail.answers.why')}: {q.reason}</span>}
          </li>
        ))}
      </ul>
    </section>
  )
}

function DocumentsTab({ documents, versions, onApprove }) {
  const { t, locale } = useI18n()
  if (!documents?.length) return <Empty icon="file" title={t('detail.documents.empty')} />

  return (
    <div className="grid2">
      <section className="card">
        <h2><Icon name="file" size={17} />{t('detail.documents.original')}</h2>
        <ul className="docs">
          {documents.map((d) => (
            <li key={d.id}>
              <div>
                <strong>{d.filename}</strong>
                <span className="muted small">
                  {t('detail.documents.uploaded', { date: formatDateTime(d.uploadedAt, locale) })}
                  {' · '}{formatBytes(d.sizeBytes)}
                  {d.sourceLanguage ? ` · ${d.sourceLanguage.toUpperCase()}` : ''}
                </span>
                {d.error && <span className="is-bad small">{d.error}</span>}
              </div>
              <div className="docs__act">
                <CvBadge status={d.status} />
                <a className="btn btn--ghost btn--sm" href={adminApiDownload(d.id)}>
                  <Icon name="download" size={15} /> {t('detail.documents.download')}
                </a>
              </div>
            </li>
          ))}
        </ul>
      </section>

      <section className="card">
        <h2><Icon name="translate" size={17} />{t('detail.documents.versions')}</h2>
        {versions?.length ? (
          <ul className="docs">
            {versions.map((v) => (
              <li key={v.id}>
                <div>
                  <strong>{v.language.toUpperCase()}</strong>
                  <span className="muted small">
                    {v.isSource ? t('detail.documents.source') : t('detail.documents.aiGenerated')}
                  </span>
                </div>
                {v.isSource ? (
                  <span className="badge badge--neutral">{t('detail.documents.source')}</span>
                ) : v.reviewed ? (
                  <span className="badge badge--good"><Icon name="check" size={12} />{t('detail.documents.reviewed')}</span>
                ) : (
                  <button type="button" className="btn btn--ghost btn--sm" onClick={() => onApprove(v.id)}>
                    {t('detail.documents.markReviewed')}
                  </button>
                )}
              </li>
            ))}
          </ul>
        ) : (
          <p className="muted small">{t('detail.documents.empty')}</p>
        )}
      </section>
    </div>
  )
}

const adminApiDownload = (documentId) => adminApi.cvDownloadUrl(documentId)

function HistoryTab({ reviews }) {
  const { t, locale } = useI18n()
  if (!reviews?.length) return <Empty icon="history" title={t('detail.history.empty')} />

  return (
    <section className="card">
      <h2><Icon name="history" size={17} />{t('detail.history.title')}</h2>
      <ol className="timeline">
        {reviews.map((r) => (
          <li key={r.id}>
            <span className="timeline__dot" aria-hidden="true" />
            <div>
              <h3><ReviewBadge status={r.status} /></h3>
              <p className="muted small">{[r.reviewer, formatDateTime(r.createdAt, locale)].filter(Boolean).join(' · ')}</p>
              {r.note && <p className="small">{r.note}</p>}
            </div>
          </li>
        ))}
      </ol>
    </section>
  )
}

/**
 * Erasure is irreversible, so it asks the admin to type the candidate's email.
 * A yes/no dialog is muscle memory; retyping the address is not.
 */
function EraseDialog({ email, onClose, onConfirm }) {
  const { t, tError } = useI18n()
  const toast = useToast()
  const [value, setValue] = useState('')
  const [busy, setBusy] = useState(false)

  const matches = value.trim().toLowerCase() === email.toLowerCase()

  const submit = async (e) => {
    e.preventDefault()
    if (!matches) return
    setBusy(true)
    try {
      await onConfirm()
    } catch (err) {
      toast.error(tError(err.code))
      setBusy(false)
    }
  }

  return (
    <div className="modal" role="dialog" aria-modal="true" aria-label={t('detail.danger.title')}>
      <button type="button" className="modal__scrim" onClick={onClose} aria-label={t('common.close')} />
      <form className="modal__panel" onSubmit={submit}>
        <h2><Icon name="warning" size={18} />{t('detail.danger.title')}</h2>
        <p className="small">{t('detail.danger.text')}</p>

        <label className="field">
          <span className="field__label">{t('detail.danger.confirm')}</span>
          <span className="field__box">
            <input
              type="text"
              value={value}
              onChange={(e) => setValue(e.target.value)}
              placeholder={email}
              autoCapitalize="none"
              autoCorrect="off"
              spellCheck="false"
            />
          </span>
          {value && !matches && <span className="field__err">{t('detail.danger.mismatch')}</span>}
        </label>

        <div className="modal__act">
          <button type="button" className="btn btn--ghost" onClick={onClose}>{t('common.cancel')}</button>
          <button type="submit" className="btn btn--danger" disabled={!matches || busy}>
            <Icon name="trash" size={16} /> {t('detail.danger.button')}
          </button>
        </div>
      </form>
    </div>
  )
}
