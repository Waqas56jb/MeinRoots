import { useCallback, useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import AppHeader from '../components/app/AppHeader.jsx'
import ReadinessCard from '../components/app/ReadinessCard.jsx'
import CvVersions from '../components/app/CvVersions.jsx'
import VerifyBanner from '../components/app/VerifyBanner.jsx'
import {
  EducationList,
  ExperienceList,
  LanguagesBlock,
  SkillsBlock,
} from '../components/app/ProfileBlocks.jsx'
import Icon from '../components/ui/Icon.jsx'
import Spinner from '../components/ui/Spinner.jsx'
import EmptyState from '../components/ui/EmptyState.jsx'
import { useI18n } from '../context/I18nContext.jsx'
import { useAuth } from '../context/AuthContext.jsx'
import { cvApi, profileApi, questionnaireApi } from '../lib/api.js'
import { useApiMessage } from '../lib/apiMessage.js'

const POLL_MS = 4000

export default function DashboardPage() {
  const { t } = useI18n()
  const { user } = useAuth()
  const apiMessage = useApiMessage()

  const [profile, setProfile] = useState(undefined) // undefined = loading, null = none yet
  const [document, setDocument] = useState(null)
  const [status, setStatus] = useState(null)
  const [questionnaire, setQuestionnaire] = useState(null)
  const [error, setError] = useState('')
  const [refreshing, setRefreshing] = useState(false)

  const load = useCallback(async () => {
    try {
      const [profileData, documentData, questionnaireData] = await Promise.all([
        profileApi.me(),
        cvApi.current(),
        questionnaireApi.current().catch(() => ({ questionnaire: null, questions: [] })),
      ])
      setProfile(profileData.profile)
      setDocument(documentData.document)
      setQuestionnaire(questionnaireData.questionnaire)
      return documentData.document
    } catch (err) {
      setError(apiMessage(err.code))
      setProfile(null)
      return null
    }
  }, [apiMessage])

  useEffect(() => {
    load()
  }, [load])

  // While a CV is still being analysed the dashboard is genuinely incomplete,
  // so it keeps polling rather than showing a stale empty profile.
  useEffect(() => {
    if (!document?.id) return undefined
    if (document.status === 'analysed' || document.status === 'failed') {
      // Still ask once: translations continue after the document is analysed.
      cvApi.status(document.id).then(setStatus).catch(() => {})
      return undefined
    }

    let cancelled = false
    const tick = async () => {
      try {
        const next = await cvApi.status(document.id)
        if (cancelled) return
        setStatus(next)
        if (next.done) load()
      } catch {
        /* transient — the next tick tries again */
      }
    }
    const timer = setInterval(tick, POLL_MS)
    tick()
    return () => {
      cancelled = true
      clearInterval(timer)
    }
  }, [document?.id, document?.status, load])

  const onRefreshReadiness = async () => {
    setRefreshing(true)
    setError('')
    try {
      const data = await profileApi.refreshReadiness()
      setProfile((p) => (p ? { ...p, assessments: data.assessments } : p))
    } catch (err) {
      setError(apiMessage(err.code))
    } finally {
      setRefreshing(false)
    }
  }

  if (profile === undefined) {
    return (
      <div className="app">
        <AppHeader />
        <Spinner full />
      </div>
    )
  }

  const analysing = document && document.status !== 'analysed' && document.status !== 'failed'
  const failed = document?.status === 'failed'
  const outstanding = questionnaire?.outstandingRequired ?? 0
  const hasProfileData = profile && (profile.experiences.length > 0 || profile.skills.length > 0)

  return (
    <div className="app">
      <AppHeader />

      <main className="app__main">
        <div className="container">
          <header className="dash__head">
            <div>
              <span className="eyebrow"><Icon name="gauge" />{t('app.nav.dashboard')}</span>
              <h1>{t('app.dash.greeting', { name: user?.name?.split(' ')[0] ?? '' })}</h1>
              {profile?.headline && <p className="lead">{profile.headline}</p>}
            </div>

            {profile && hasProfileData && (
              <div className="dash__meta">
                {profile.classification && (
                  <span className="pill pill--brand">
                    <Icon name="compass" size={14} />
                    {profile.classification.label}
                    {profile.classification.specialisation ? ` · ${profile.classification.specialisation}` : ''}
                  </span>
                )}
                <span className="dash__completeness">
                  <strong>{profile.completeness}%</strong>
                  {t('app.dash.complete')}
                </span>
              </div>
            )}
          </header>

          {error && (
            <p className="banner banner--bad"><Icon name="alert" size={16} />{error}</p>
          )}

          <VerifyBanner />

          {!document && (
            <EmptyState
              icon="upload"
              title={t('app.dash.noCvTitle')}
              text={t('app.dash.noCvText')}
              actionLabel={t('nav.cta')}
              actionTo="/upload"
            />
          )}

          {analysing && (
            <div className="banner banner--info">
              <Spinner />
              <div>
                <strong>{t('app.dash.analysingTitle')}</strong>
                <p>
                  {status?.job?.stage
                    ? t(`app.upload.stages.${status.job.stage}`)
                    : t('app.dash.analysingText')}
                </p>
              </div>
            </div>
          )}

          {failed && (
            <div className="banner banner--bad">
              <Icon name="alert" size={18} />
              <div>
                <strong>{t('app.dash.failedTitle')}</strong>
                <p>{t('app.dash.failedText')}</p>
              </div>
              <Link to="/upload" className="btn btn--ghost btn--sm">{t('app.upload.tryAgain')}</Link>
            </div>
          )}

          {outstanding > 0 && (
            <div className="banner banner--warn">
              <Icon name="clipboard" size={18} />
              <div>
                <strong>{t('app.dash.questionsTitle', { count: outstanding })}</strong>
                <p>{t('app.dash.questionsText')}</p>
              </div>
              <Link to="/questionnaire" className="btn btn--primary btn--sm">
                {t('app.dash.answerNow')} <Icon name="arrowRight" size={15} />
              </Link>
            </div>
          )}

          {profile?.flags?.length > 0 && (
            <div className="banner banner--warn">
              <Icon name="info" size={18} />
              <div>
                <strong>{t('app.dash.flagsTitle')}</strong>
                <ul className="banner__list">
                  {profile.flags.map((flag) => (
                    <li key={flag.id}>{t(`app.flags.${flag.code}`)}</li>
                  ))}
                </ul>
              </div>
            </div>
          )}

          {profile?.assessments?.length > 0 && (
            <section className="dash__section">
              <div className="dash__sectionHead">
                <h2>{t('app.readiness.title')}</h2>
                <button
                  type="button"
                  className="btn btn--ghost btn--sm"
                  onClick={onRefreshReadiness}
                  disabled={refreshing}
                >
                  <Icon name="activity" size={15} />
                  {refreshing ? t('app.readiness.recalculating') : t('app.readiness.recalculate')}
                </button>
              </div>
              <p className="dash__sectionHint">{t('app.readiness.hint')}</p>

              <div className="dash__grid">
                {profile.assessments.map((assessment) => (
                  <ReadinessCard key={assessment.id} assessment={assessment} />
                ))}
              </div>
            </section>
          )}

          {hasProfileData && (
            <section className="dash__section">
              <h2>{t('app.profile.title')}</h2>
              <p className="dash__sectionHint">{t('app.profile.editHint')}</p>

              <div className="dash__cols">
                <div>
                  <ExperienceList items={profile.experiences} editable onSaved={setProfile} />
                  <EducationList
                    items={profile.education}
                    certifications={profile.certifications}
                    editable
                    onSaved={setProfile}
                  />
                </div>
                <div>
                  <SkillsBlock skills={profile.skills} editable onSaved={setProfile} />
                  <LanguagesBlock languages={profile.languages} editable onSaved={setProfile} />
                  <CvVersions documentId={document?.id} pending={Boolean(status?.translationsPending)} />
                </div>
              </div>
            </section>
          )}
        </div>
      </main>
    </div>
  )
}
