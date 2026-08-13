import { Link } from 'react-router-dom'
import AppShell from '../components/app/AppShell.jsx'
import VerifyBanner from '../components/app/VerifyBanner.jsx'
import UploadCard from '../components/app/UploadCard.jsx'
import AnalysisProgress from '../components/app/AnalysisProgress.jsx'
import Icon from '../components/ui/Icon.jsx'
import {
  Badge, Card, Facts, Meter, Note, Ring, ScoreBadge, SectionHead, Skeleton, Stat, band,
} from '../components/app/widgets.jsx'
import { useI18n } from '../context/I18nContext.jsx'
import { useAuth } from '../context/AuthContext.jsx'
import { buildRecommendations, useWorkspace } from '../context/WorkspaceContext.jsx'
import { useApiMessage } from '../lib/apiMessage.js'

const monthsToYears = (months) => {
  if (months === null || months === undefined) return null
  const years = Math.floor(months / 12)
  const rest = months % 12
  if (!years) return `${rest}m`
  return rest ? `${years}y ${rest}m` : `${years}y`
}

export default function DashboardPage() {
  const { t, locale } = useI18n()
  const { user } = useAuth()
  const apiMessage = useApiMessage()
  const ws = useWorkspace()

  const firstName = user?.name?.split(' ')[0] ?? ''
  const best = (ws.profile?.assessments ?? []).reduce(
    (acc, a) => (acc === null || a.score > acc.score ? a : acc),
    null,
  )
  const recommendations = buildRecommendations({
    profile: ws.profile,
    document: ws.document,
    outstandingQuestions: ws.outstandingQuestions,
    user,
  })

  return (
    <AppShell
      eyebrow={t('app.nav.dashboard')}
      title={t('app.dash.greeting', { name: firstName })}
      subtitle={ws.profile?.headline ?? t('app.dash.subtitle')}
      badges={{ questionnaire: ws.outstandingQuestions }}
    >
      {ws.error && <Note tone="bad" title={t('errors.generic')}>{apiMessage(ws.error)}</Note>}
      <VerifyBanner />

      {ws.loading ? (
        <Skeleton rows={4} />
      ) : !ws.document ? (
        /* ------------------------------ onboarding ------------------------ */
        <div className="wgrid wgrid--main">
          <UploadCard onDone={ws.reload} />

          <Card icon="sparkle" title={t('app.dash.nextTitle')} hint={t('app.dash.nextHint')}>
            <ol className="wsteps">
              {['read', 'structure', 'gaps', 'readiness'].map((key, i) => (
                <li key={key}>
                  <span className="wsteps__mark">{i + 1}</span>
                  <span>{t(`app.dash.next.${key}`)}</span>
                </li>
              ))}
            </ol>
            <p className="wcard__hint" style={{ marginTop: 'var(--s-4)', marginBottom: 0 }}>
              <Icon name="lock" size={13} /> {t('cta.legal')}
            </p>
          </Card>
        </div>
      ) : ws.analysing ? (
        /* ------------------------------ processing ------------------------ */
        <AnalysisProgress />
      ) : ws.failed ? (
        <Note
          tone="bad"
          title={t('app.dash.failedTitle')}
          action={<Link to="/cv" className="btn btn--primary btn--sm">{t('app.upload.tryAgain')}</Link>}
        >
          {t('app.dash.failedText')}
        </Note>
      ) : (
        /* -------------------------------- overview ------------------------ */
        <>
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

          <div className="wgrid wgrid--3">
            <Stat
              icon="gauge"
              value={`${ws.profile?.completeness ?? 0}%`}
              label={t('app.dash.stat.completeness')}
              hint={t('app.dash.stat.completenessHint')}
              tone={band(ws.profile?.completeness ?? 0) === 'great' ? 'good' : undefined}
            />
            <Stat
              icon="target"
              value={best ? `${best.score}` : '—'}
              label={t('app.dash.stat.readiness')}
              hint={best ? t(`goals.items.${best.goal}.title`) : t('app.dash.stat.readinessHint')}
            />
            <Stat
              icon="sparkle"
              value={ws.profile?.skills?.length ?? 0}
              label={t('app.dash.stat.skills')}
              hint={t('app.dash.stat.skillsHint', {
                count: (ws.profile?.skills ?? []).filter((s) => s.isEvidenced).length,
              })}
            />
            <Stat
              icon="briefcase"
              value={monthsToYears(ws.profile?.totalExperienceMonths) ?? '—'}
              label={t('app.dash.stat.experience')}
              hint={t('app.dash.stat.experienceHint', { count: ws.profile?.experiences?.length ?? 0 })}
            />
          </div>

          <div className="wgrid wgrid--main">
            <div className="wsection">
              <Card
                icon="target"
                title={t('app.readiness.title')}
                actions={<Link to="/readiness" className="btn btn--ghost btn--sm">{t('app.dash.viewAll')} <Icon name="arrowRight" size={14} /></Link>}
                hint={t('app.readiness.hint')}
              >
                {ws.profile?.assessments?.length ? (
                  <div className="wgrid wgrid--2">
                    {ws.profile.assessments.map((a) => (
                      <div key={a.id} className="readsum">
                        <Ring value={a.score} size={86} tone={band(a.score)} sublabel={t('app.readiness.of100')} />
                        <div>
                          <strong>{t(`goals.items.${a.goal}.title`)}</strong>
                          <ScoreBadge score={a.score} />
                          <p>{a.summary}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="wcard__hint">{t('app.readiness.empty')}</p>
                )}
              </Card>

              <Card
                icon="userCircle"
                title={t('app.dash.profileTitle')}
                actions={<Link to="/profile" className="btn btn--ghost btn--sm">{t('app.dash.viewAll')} <Icon name="arrowRight" size={14} /></Link>}
              >
                <Facts
                  items={[
                    {
                      label: t('app.profile.domain'),
                      value: ws.profile?.classification ? (
                        <Badge tone="brand" icon="compass">{ws.profile.classification.label}</Badge>
                      ) : null,
                    },
                    { label: t('app.profile.specialisation'), value: ws.profile?.classification?.specialisation },
                    { label: t('app.profile.experience'), value: monthsToYears(ws.profile?.totalExperienceMonths) },
                    { label: t('app.profile.location'), value: [ws.profile?.city, ws.profile?.country].filter(Boolean).join(', ') },
                    { label: t('app.profile.education'), value: ws.profile?.education?.length || null },
                    { label: t('app.profile.languages'), value: (ws.profile?.languages ?? []).map((l) => `${l.language}${l.level ? ` ${l.level}` : ''}`).join(' · ') || null },
                  ]}
                />
              </Card>
            </div>

            <div className="wsection">
              <Card icon="listChecks" title={t('app.dash.completeTitle')}>
                <Ring
                  value={ws.profile?.completeness ?? 0}
                  size={128}
                  stroke={10}
                  sublabel={t('app.dash.complete')}
                />
                <p className="wcard__hint" style={{ marginTop: 'var(--s-4)' }}>
                  {t('app.dash.completeHint')}
                </p>
                <div className="wlist" style={{ marginTop: 'var(--s-3)' }}>
                  <Meter
                    label={t('app.dash.stat.completeness')}
                    value={ws.profile?.completeness ?? 0}
                    tone={band(ws.profile?.completeness ?? 0) === 'great' ? 'good' : undefined}
                  />
                </div>
              </Card>

              <Card
                icon="listChecks"
                title={t('app.recommendations.title')}
                actions={<Link to="/recommendations" className="btn btn--ghost btn--sm">{t('app.dash.viewAll')} <Icon name="arrowRight" size={14} /></Link>}
              >
                {recommendations.length ? (
                  <ul className="wlist">
                    {recommendations.slice(0, 3).map((r, i) => (
                      <li key={`${r.key}-${i}`} className="wlist__item">
                        <span className="wstat__icon"><Icon name={r.icon} size={16} /></span>
                        <div>
                          <strong>
                            {r.gap ? r.gap.skill : t(`app.recommendations.items.${r.key}.title`, { count: r.count })}
                          </strong>
                          <span>
                            {r.gap ? r.gap.howToClose : t(`app.recommendations.items.${r.key}.text`)}
                          </span>
                        </div>
                        <Link to={r.to} className="btn btn--ghost btn--sm" aria-label={t('app.dash.viewAll')}>
                          <Icon name="arrowRight" size={15} />
                        </Link>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="wcard__hint">{t('app.recommendations.allDone')}</p>
                )}
              </Card>
            </div>
          </div>
        </>
      )}
    </AppShell>
  )
}
