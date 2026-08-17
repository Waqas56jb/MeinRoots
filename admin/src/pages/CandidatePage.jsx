import { useCallback, useEffect, useRef, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import Layout from '../components/Layout.jsx'
import Icon from '../components/Icon.jsx'
import { Confidence, CvBadge, Empty, ErrorNote, Progress, ReviewBadge, Score, Skeleton } from '../components/ui.jsx'
import { useI18n } from '../context/I18nContext.jsx'
import { useAuth } from '../context/AuthContext.jsx'
import { useToast } from '../context/ToastContext.jsx'
import { adminApi } from '../lib/api.js'
import { formatBytes, formatDate, formatDateTime, formatExperience, formatMonth } from '../lib/format.js'
import { renderMarkdown } from '../lib/markdown.js'

const TABS = ['profile', 'readiness', 'answers', 'documents', 'consents', 'history']

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

  const { candidate, profile, documents, questionnaire, reviews, cvVersions, consents, consentLog, cleanup } = data
  const maySharePro = Boolean(consents?.employer_sharing)
  const primaryDoc = documents?.[0]
  const openFlags = profile?.flags ?? []
  const bestScore = (profile?.assessments ?? []).reduce(
    (best, a) => (best === null || a.score > best ? a.score : best),
    null,
  )
  const needsReview = profile?.reviewStatus === 'flagged' || openFlags.length > 0

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

      {/*
        The state of the candidate, on one line, before anything else. An
        admin arriving from the queue needs to know whether this one still
        needs them without reading a page or scrolling to find out.
      */}
      <section className="cstatus">
        <div className="cstatus__row">
          <span className="cstatus__item">
            <span className="cstatus__label">{t('detail.meta.status')}</span>
            <ReviewBadge status={profile?.reviewStatus} />
          </span>
          <span className="cstatus__item">
            <span className="cstatus__label">{t('candidates.table.cv')}</span>
            <CvBadge status={primaryDoc?.status} />
          </span>
          <span className="cstatus__item">
            <span className="cstatus__label">{t('detail.meta.confidence')}</span>
            <Confidence value={profile?.extractionConfidence} />
          </span>
          <span className="cstatus__item">
            <span className="cstatus__label">{t('candidates.table.readiness')}</span>
            <Score value={bestScore} />
          </span>
          <span className="cstatus__item cstatus__item--grow">
            <span className="cstatus__label">{t('detail.meta.completeness')}</span>
            {profile ? (
              <span className="withbar">
                <Progress value={profile.completeness} />
                <em className="num">{profile.completeness}%</em>
              </span>
            ) : '—'}
          </span>
        </div>

        {/*
          Whether this profile may go to an employer, stated on the status line
          rather than buried in a tab. A reviewer deciding what to do with a
          candidate should not have to go looking for the one permission that
          governs it — and should certainly not have to assume.
        */}
        <p className={`sharing sharing--${maySharePro ? 'ok' : 'no'}`}>
          <Icon name={maySharePro ? 'checkCircle' : 'ban'} size={15} />
          <strong>{t(maySharePro ? 'detail.sharing.allowed' : 'detail.sharing.denied')}</strong>
          <span>{t(maySharePro ? 'detail.sharing.allowedText' : 'detail.sharing.deniedText')}</span>
        </p>

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
      </section>

      {/*
        Why this one is here, stated before the buttons that resolve it. A
        decision panel with no reason attached asks the reviewer to go and find
        the reason themselves, which is the slow part of the job.
      */}
      {needsReview && (
        <section className="review review--required">
          <header className="review__head">
            <span className="review__icon"><Icon name="warning" size={19} /></span>
            <div>
              <h2>{t('detail.review.requiredTitle')}</h2>
              <p>{t('detail.review.requiredText')}</p>
            </div>
          </header>

          {openFlags.length > 0 && (
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
          )}
        </section>
      )}

      {/* The three actions that end a review, always in the same place. */}
      <section className="decide">
        <div className="decide__head">
          <h2><Icon name="checks" size={16} />{t('detail.review.title')}</h2>
          <span className="decide__meta">
            {t('detail.meta.registered')}: {formatDate(candidate.createdAt, locale)}
            {' · '}
            {t('detail.meta.locale')}: {candidate.locale?.toUpperCase() ?? '—'}
            {' · '}
            {candidate.gdprConsentAt ? (
              <span className="is-good">{t('detail.meta.consent')} {formatDate(candidate.gdprConsentAt, locale)}</span>
            ) : (
              <span className="is-bad">{t('detail.meta.noConsent')}</span>
            )}
          </span>
        </div>

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

      {/* An account with no CV is on its way out, and the reason an empty
          profile is empty is worth saying on the page rather than leaving an
          administrator to wonder where the record went a day later. Both the
          flag and the date come from the server, which derives them from the
          same two facts the cleanup job uses. */}
      {cleanup?.eligible && <CleanupNotice cleanup={cleanup} />}

      {!profile && tab !== 'documents' && tab !== 'history' ? (
        <Empty icon="file" title={t('detail.noProfile')} />
      ) : null}

      {tab === 'profile' && profile && <ProfileTab profile={profile} />}
      {tab === 'readiness' && profile && <ReadinessTab assessments={profile.assessments} />}
      {tab === 'answers' && profile && <AnswersTab questionnaire={questionnaire} />}
      {tab === 'documents' && (
        <DocumentsTab
          documents={documents}
          versions={cvVersions}
          onApprove={approveVersion}
          maySharePro={maySharePro}
        />
      )}
      {tab === 'consents' && <ConsentsTab consents={consents} log={consentLog} />}
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
          reference={candidate.reference}
          userId={candidate.id}
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

/**
 * Says that this account has no CV and will be removed, and when.
 *
 * Once the due date has passed the wording stops giving a date — the account is
 * already eligible and goes at the next sweep, and a timestamp in the past
 * reads as a promise that was missed rather than one about to be kept.
 */
function CleanupNotice({ cleanup }) {
  const { t, locale } = useI18n()
  const due = cleanup.dueAt ? new Date(cleanup.dueAt) : null
  const overdue = due ? due.getTime() <= Date.now() : true

  return (
    <section className="notice notice--warn">
      <span className="notice__icon"><Icon name="clock" size={17} /></span>
      <div>
        <strong>{t('detail.cleanup.title')}</strong>
        <p>
          {t('detail.cleanup.text', {
            when: overdue
              ? t('detail.cleanup.overdue')
              : t('detail.cleanup.due', {
                  date: new Intl.DateTimeFormat(locale, { dateStyle: 'medium', timeStyle: 'short' }).format(due),
                }),
          })}
        </p>
      </div>
    </section>
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
                      {/* A corrected row is no longer the AI's reading, so the
                          extractor's confidence is not shown for it. */}
                      {e.source === 'candidate' ? (
                        <span className="lowconf lowconf--mine">
                          <Icon name="user" size={11} />{t('profile.editedByCandidate')}
                        </span>
                      ) : e.confidence !== null && e.confidence < 0.7 ? (
                        <span className="lowconf"><Icon name="alert" size={11} />{Math.round(e.confidence * 100)}%</span>
                      ) : null}
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

/**
 * The consent record: what they answered, and the trail behind it.
 *
 * The current state is what a reviewer needs to make a decision today. The log
 * underneath is what the company needs when someone asks it to prove consent
 * was held — including the rows that say no, and the rows where a permission
 * was later withdrawn.
 */
function ConsentsTab({ consents, log }) {
  const { t, locale } = useI18n()
  const REQUIRED = ['terms', 'privacy', 'data_processing']
  const OPTIONAL = ['employer_sharing', 'job_alerts', 'marketing']

  const row = (key) => (
    <li key={key}>
      <span className={`badge badge--${consents?.[key] ? 'good' : 'neutral'}`}>
        <Icon name={consents?.[key] ? 'check' : 'close'} size={12} />
        {t(consents?.[key] ? 'detail.consents.given' : 'detail.consents.notGiven')}
      </span>
      <span className="consentrow__label">{t(`detail.consents.types.${key}`)}</span>
    </li>
  )

  return (
    <div className="grid2">
      <section className="card">
        <h2><Icon name="shield" size={17} />{t('detail.consents.current')}</h2>
        <h3 className="sub">{t('detail.consents.required')}</h3>
        <ul className="consentrows">{REQUIRED.map(row)}</ul>
        <h3 className="sub">{t('detail.consents.optional')}</h3>
        <ul className="consentrows">{OPTIONAL.map(row)}</ul>
        {consents?.acceptedVersion && (
          <p className="muted small consentrows__foot">
            <Icon name="file" size={13} />
            {t('detail.consents.version', { version: consents.acceptedVersion })}
          </p>
        )}
      </section>

      <section className="card">
        <h2><Icon name="history" size={17} />{t('detail.consents.log')}</h2>
        {log?.length ? (
          <ol className="consentlog">
            {log.map((entry, i) => (
              <li key={`${entry.type}-${entry.at}-${i}`} className={entry.granted ? 'is-on' : 'is-off'}>
                <span className="consentlog__mark" aria-hidden="true" />
                <div>
                  <strong>
                    {t(`detail.consents.types.${entry.type}`)}
                    <em>{t(entry.granted ? 'detail.consents.granted' : 'detail.consents.withdrawn')}</em>
                  </strong>
                  <span className="muted small">
                    {formatDateTime(entry.at, locale)}
                    {' · '}
                    {t(`detail.consents.source.${entry.source}`)}
                    {' · v'}{entry.version}
                  </span>
                </div>
              </li>
            ))}
          </ol>
        ) : (
          <p className="muted small">{t('detail.consents.noLog')}</p>
        )}
      </section>
    </div>
  )
}

function DocumentsTab({ documents, versions, onApprove, maySharePro }) {
  const { t, locale } = useI18n()
  if (!documents?.length) return <Empty icon="file" title={t('detail.documents.empty')} />

  return (
    <div className="grid2">
      <section className="card">
        <h2><Icon name="file" size={17} />{t('detail.documents.original')}</h2>

        {/*
          Downloading is the only way a CV actually leaves MeinRoots, so it is
          where the sharing permission stops being a stored preference. Not
          blocked — reviewing runs on the service contract, not on this consent,
          and blocking it would break the review the platform exists to do — but
          said plainly, and the server records the download under a distinct
          audit action when consent is absent.
        */}
        {!maySharePro && (
          <p className="note note--warn docs__consent">
            <Icon name="warning" size={16} />
            <span>{t('detail.documents.noSharingConsent')}</span>
          </p>
        )}
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
          <VersionReader versions={versions} onApprove={onApprove} />
        ) : (
          <p className="muted small">{t('detail.documents.empty')}</p>
        )}
      </section>
    </div>
  )
}

/**
 * Reads the CV in each language it exists in.
 *
 * The console used to list the three languages and put a "mark reviewed"
 * button next to each, with no way to open any of them — asking a reviewer to
 * certify a translation they had never seen. Since approving is the one thing
 * this section is for, the text has to be here.
 *
 * It opens in the console's own language, and follows it when that changes.
 * Milestone 1 asked for the CV to be readable in the language the person is
 * working in; defaulting to the source instead meant a reviewer working in
 * German was handed an English document and had to go looking for the German
 * one. The source is still one tap away and still labelled as the original.
 */
function VersionReader({ versions, onApprove }) {
  const { t, locale } = useI18n()
  const ordered = ['en', 'de', 'fr'].filter((code) => versions.some((v) => v.language === code))
  const preferred = (want) =>
    (versions.some((v) => v.language === want) ? want : null) ??
    versions.find((v) => v.isSource)?.language ??
    ordered[0]

  const [active, setActive] = useState(() => preferred(locale))

  // Switching the console's language moves the CV with it. Guarded on the
  // locale actually changing so a version the reviewer opened by hand is not
  // snatched back on an unrelated re-render.
  const lastLocale = useRef(locale)
  useEffect(() => {
    if (lastLocale.current === locale) return
    lastLocale.current = locale
    setActive(preferred(locale))
  })

  const current = versions.find((v) => v.language === active)

  return (
    <>
      <div className="cvtabs" role="tablist" aria-label={t('detail.documents.versions')}>
        {ordered.map((code) => {
          const v = versions.find((x) => x.language === code)
          return (
            <button
              key={code}
              type="button"
              role="tab"
              aria-selected={active === code}
              className={`cvtabs__tab ${active === code ? 'is-on' : ''}`}
              onClick={() => setActive(code)}
            >
              {code.toUpperCase()}
              {v.isSource && <span className="cvtabs__flag">{t('detail.documents.source')}</span>}
              {!v.isSource && v.reviewed && <Icon name="check" size={13} />}
            </button>
          )
        })}
      </div>

      {current && (
        <>
          <div className="cvversion__bar">
            <span className={`badge ${current.isSource ? 'badge--neutral' : current.reviewed ? 'badge--good' : 'badge--warn'}`}>
              {current.isSource
                ? t('detail.documents.source')
                : current.reviewed
                  ? t('detail.documents.reviewed')
                  : t('detail.documents.aiGenerated')}
            </span>
            {/* Only a translation can be approved, and only once. The source is
                the candidate's own document — there is nothing to sign off. */}
            {!current.isSource && !current.reviewed && (
              <button type="button" className="btn btn--ghost btn--sm" onClick={() => onApprove(current.id)}>
                <Icon name="check" size={15} /> {t('detail.documents.markReviewed')}
              </button>
            )}
          </div>

          <div
            className="cvdoc"
            /* Model output, escaped inside renderMarkdown before any tag is
               added to it. */
            dangerouslySetInnerHTML={{ __html: renderMarkdown(current.content) }}
          />
        </>
      )}
    </>
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
 * Confirms an irreversible deletion by naming the record, not by dictation.
 *
 * This used to make the administrator retype the candidate's email address. The
 * reasoning was that a yes/no dialog is muscle memory — fair — but the check
 * only ever ran in the browser, so it stopped nobody who meant it and slowed
 * down everybody who did. It also made getting rid of someone's personal data
 * begin with copying that data out of the record, which is the wrong direction.
 *
 * What replaces it is the identification, shown large: the reference the rest of
 * the console uses, the id, and a plain sentence about what disappears. The
 * operator reads who is being deleted instead of proof-reading their own typing.
 * The destructive button is not the default focus, and the dialog closes on
 * Escape like every other one.
 */
function EraseDialog({ reference, userId, onClose, onConfirm }) {
  const { t, tError } = useI18n()
  const toast = useToast()
  const [busy, setBusy] = useState(false)
  const cancelRef = useRef(null)

  useEffect(() => {
    cancelRef.current?.focus()
    const onKey = (e) => e.key === 'Escape' && !busy && onClose()
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [busy, onClose])

  const submit = async (e) => {
    e.preventDefault()
    if (busy) return
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
        <p className="small">{t('detail.danger.aboutTo')}</p>

        <dl className="erasetarget">
          <div>
            <dt>{t('detail.danger.reference')}</dt>
            <dd className="num">{reference || <em>{t('detail.danger.noReference')}</em>}</dd>
          </div>
          <div>
            <dt>{t('detail.danger.id')}</dt>
            <dd className="num erasetarget__id">{userId}</dd>
          </div>
        </dl>

        <p className="small">{t('detail.danger.removes')}</p>
        <p className="small erasetarget__warn">
          <Icon name="warning" size={14} /> {t('detail.danger.irreversible')}
        </p>

        <div className="modal__act">
          <button type="button" className="btn btn--ghost" ref={cancelRef} onClick={onClose} disabled={busy}>
            {t('common.cancel')}
          </button>
          <button type="submit" className="btn btn--danger" disabled={busy}>
            <Icon name="trash" size={16} /> {busy ? t('common.loading') : t('detail.danger.button')}
          </button>
        </div>
      </form>
    </div>
  )
}
