import { Link } from 'react-router-dom'
import AppShell from '../components/app/AppShell.jsx'
import VerifyBanner from '../components/app/VerifyBanner.jsx'
import UploadCard from '../components/app/UploadCard.jsx'
import AnalysisProgress from '../components/app/AnalysisProgress.jsx'
import ErrorState from '../components/app/ErrorState.jsx'
import JourneyProgress from '../components/app/JourneyProgress.jsx'
import NextBestAction from '../components/app/NextBestAction.jsx'
import ObjectiveBadge from '../components/app/ObjectiveBadge.jsx'
import ProfileCompletion from '../components/app/ProfileCompletion.jsx'
import ReadinessPanel, { ReadinessHighlights, ReadinessLink } from '../components/app/ReadinessPanel.jsx'
import { DashboardSkeleton, Loading } from '../components/app/Skeletons.jsx'
import Icon from '../components/ui/Icon.jsx'
import { Badge, Note, band } from '../components/app/widgets.jsx'
import { bestAssessment, formatMonths, greetingKey } from '../components/app/insight.js'
import { useI18n } from '../context/I18nContext.jsx'
import { useAuth } from '../context/AuthContext.jsx'
import { buildRecommendations, useWorkspace } from '../context/WorkspaceContext.jsx'

/**
 * The dashboard.
 *
 * Not a set of statistics. Four numbers in a row is an easy page to build and a
 * hard one to use — it tells a candidate what is measurable about them without
 * telling them anything they can do. So this page is arranged as one argument,
 * read top to bottom:
 *
 *   what am I aiming at        the objective
 *   how close am I             readiness, with the reasons under it
 *   what should I do now       one action, with why it matters
 *   what is still missing      completeness, naming the gaps
 *   where am I in the process   the journey
 *
 * The two columns on a wide screen come from grid areas rather than from the
 * markup order, so a phone gets that same sequence — objective, readiness,
 * action — instead of the desktop left column followed by the desktop right
 * column. Reading order and visual order stay the same thing at every width.
 */
export default function DashboardPage() {
  const { t } = useI18n()
  const { user } = useAuth()
  const ws = useWorkspace()

  const firstName = user?.name?.split(' ')[0] ?? ''
  const best = bestAssessment(ws.profile?.assessments)
  const others = (ws.profile?.assessments ?? []).filter((a) => a.id !== best?.id)
  const recommendations = buildRecommendations({
    profile: ws.profile,
    document: ws.document,
    outstandingQuestions: ws.outstandingQuestions,
    user,
  })

  // Separate strings rather than an interpolated empty name: "Good morning, "
  // with a dangling comma is worse than no name at all, and the punctuation
  // sits in a different place in each language.
  const part = greetingKey()
  const shell = {
    eyebrow: t('app.nav.dashboard'),
    title: firstName
      ? t(`app.dash.greeting.${part}`, { name: firstName })
      : t(`app.dash.greetingAnon.${part}`),
    subtitle: ws.profile?.headline ?? t('app.dash.subtitle'),
    badges: { questionnaire: ws.outstandingQuestions },
  }

  /* ------------------------------- loading -------------------------------- */
  if (ws.loading) {
    return (
      <AppShell {...shell}>
        <Loading label={t('common.loading')}>
          <DashboardSkeleton />
        </Loading>
      </AppShell>
    )
  }

  /* -------------------------------- failed -------------------------------- */
  if (ws.error) {
    return (
      <AppShell {...shell}>
        <ErrorState code={ws.error} what={t('app.error.dashboard')} onRetry={ws.reload} />
      </AppShell>
    )
  }

  /* ------------------------------ onboarding ------------------------------ */
  if (!ws.document) {
    return (
      <AppShell {...shell}>
        <VerifyBanner />

        <section className="welcome">
          <div className="welcome__body">
            <span className="welcome__eyebrow">
              <Icon name="sparkle" size={13} />
              {t('app.dash.welcomeEyebrow')}
            </span>
            <h2>
              {firstName ? t('app.dash.welcome', { name: firstName }) : t('app.dash.welcomeAnon')}
            </h2>
            <p>{t('app.dash.welcomeText')}</p>

            <ol className="welcome__steps">
              {['read', 'structure', 'gaps', 'readiness'].map((key, i) => (
                <li key={key}>
                  <span className="welcome__num num">{i + 1}</span>
                  <span>{t(`app.dash.next.${key}`)}</span>
                </li>
              ))}
            </ol>

            <p className="welcome__legal">
              <Icon name="lock" size={13} /> {t('cta.legal')}
            </p>
          </div>

          <div className="welcome__action">
            <UploadCard onDone={ws.reload} />
          </div>
        </section>
      </AppShell>
    )
  }

  /* ------------------------------- analysing ------------------------------ */
  if (ws.analysing) {
    return (
      <AppShell {...shell}>
        <VerifyBanner />
        <AnalysisProgress />
        <JourneyProgress
          user={user}
          profile={ws.profile}
          document={ws.document}
          questions={ws.questions}
          outstandingQuestions={ws.outstandingQuestions}
          hasProfileData={ws.hasProfileData}
        />
      </AppShell>
    )
  }

  /* -------------------------- the analysis failed ------------------------- */
  if (ws.failed) {
    return (
      <AppShell {...shell}>
        <VerifyBanner />
        <ErrorState
          what={t('app.dash.failedTitle')}
          code="analysis_failed"
          tone="warn"
          onRetry={null}
        />
        <p className="dash__failedText">{t('app.dash.failedText')}</p>
        <Link to="/cv" className="btn btn--primary dash__failedCta">
          {t('app.upload.tryAgain')} <Icon name="arrowRight" size={16} />
        </Link>
      </AppShell>
    )
  }

  /* -------------------------------- overview ------------------------------ */
  return (
    <AppShell {...shell}>
      <VerifyBanner />

      {ws.outstandingQuestions > 0 && (
        <Note
          tone="warn"
          icon="clipboard"
          title={t('app.dash.questionsTitle', { count: ws.outstandingQuestions })}
          action={
            <Link to="/questionnaire" className="btn btn--primary btn--sm">
              {t('app.dash.answerNow')} <Icon name="arrowRight" size={15} />
            </Link>
          }
        >
          {t('app.dash.questionsText')}
        </Note>
      )}

      <ObjectiveBadge goals={user?.goals ?? []} />

      <div className="dashgrid">
        {/* ---------------------------- readiness --------------------------- */}
        <div className="dashgrid__readiness">
          {best ? (
            <>
              <ReadinessPanel assessment={best} variant="compact">
                <ReadinessHighlights factors={best.factors} />
                <div className="rpanel__foot">
                  <ReadinessLink />
                </div>
              </ReadinessPanel>

              {others.length > 0 && (
                <div className="othergoals">
                  <h3 className="othergoals__title">{t('app.dash.otherObjectives')}</h3>
                  <ul>
                    {others.map((a) => (
                      <li key={a.id}>
                        <Link to="/readiness">
                          <span className={`othergoals__score othergoals__score--${band(a.score)} num`}>
                            {a.score}
                          </span>
                          <span className="othergoals__body">
                            <strong>{t(`goals.items.${a.goal}.title`)}</strong>
                            <small>{t(`app.readiness.bands.${a.band}`)}</small>
                          </span>
                          <Icon name="chevronRight" size={16} />
                        </Link>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </>
          ) : (
            <section className="rpanel rpanel--empty">
              <span className="rpanel__emptyIcon"><Icon name="target" size={24} /></span>
              <h2>{t('app.readiness.empty')}</h2>
              <p>{t('app.readiness.emptyText')}</p>
              {ws.outstandingQuestions > 0 && (
                <Link to="/questionnaire" className="btn btn--primary btn--sm">
                  {t('app.dash.answerNow')} <Icon name="arrowRight" size={15} />
                </Link>
              )}
            </section>
          )}
        </div>

        {/* -------------------------- next best action ---------------------- */}
        <div className="dashgrid__next">
          <NextBestAction items={recommendations} />
        </div>

        {/* ------------------------ professional identity ------------------- */}
        <div className="dashgrid__profile">
          <section className="ident">
            <div className="ident__head">
              <h2>{t('app.dash.profileTitle')}</h2>
              <Link to="/profile" className="btn btn--ghost btn--sm">
                {t('app.dash.viewAll')} <Icon name="arrowRight" size={14} />
              </Link>
            </div>

            {ws.profile?.classification ? (
              <div className="ident__domain">
                <span className="ident__domainIcon"><Icon name="compass" size={19} /></span>
                <div>
                  <span className="ident__domainLabel">{t('app.profile.domain')}</span>
                  <strong>{ws.profile.classification.label}</strong>
                  {ws.profile.classification.specialisation && (
                    <small>{ws.profile.classification.specialisation}</small>
                  )}
                </div>
              </div>
            ) : (
              <p className="ident__none">{t('app.dash.noDomain')}</p>
            )}

            <dl className="ident__facts">
              {[
                {
                  key: 'experience',
                  label: t('app.profile.experience'),
                  value: formatMonths(ws.profile?.totalExperienceMonths, t),
                },
                {
                  key: 'skills',
                  label: t('app.profile.skills'),
                  value: ws.profile?.skills?.length
                    ? t('app.dash.skillsValue', {
                        total: ws.profile.skills.length,
                        proven: ws.profile.skills.filter((s) => s.isEvidenced).length,
                      })
                    : null,
                },
                {
                  key: 'languages',
                  label: t('app.profile.languages'),
                  value:
                    (ws.profile?.languages ?? [])
                      .map((l) => `${l.language}${l.level ? ` ${l.level}` : ''}`)
                      .join(' · ') || null,
                },
                {
                  key: 'location',
                  label: t('app.profile.location'),
                  value: [ws.profile?.city, ws.profile?.country].filter(Boolean).join(', ') || null,
                },
              ]
                .filter((f) => f.value)
                .map((f) => (
                  <div key={f.key}>
                    <dt>{f.label}</dt>
                    <dd>{f.value}</dd>
                  </div>
                ))}
            </dl>

            {ws.profile?.flags?.length > 0 && (
              <p className="ident__flags">
                <Badge tone="warn" icon="info">{t('app.dash.flagsTitle')}</Badge>
                {ws.profile.flags.map((f) => t(`app.flags.${f.code}`)).join(' · ')}
              </p>
            )}
          </section>
        </div>

        {/* --------------------------- completeness ------------------------- */}
        <div className="dashgrid__complete">
          <ProfileCompletion
            profile={ws.profile}
            outstandingQuestions={ws.outstandingQuestions}
            compact
          />
        </div>

        {/* ----------------------------- journey ---------------------------- */}
        <div className="dashgrid__journey">
          <JourneyProgress
            user={user}
            profile={ws.profile}
            document={ws.document}
            questions={ws.questions}
            outstandingQuestions={ws.outstandingQuestions}
            hasProfileData={ws.hasProfileData}
          />
        </div>
      </div>
    </AppShell>
  )
}
