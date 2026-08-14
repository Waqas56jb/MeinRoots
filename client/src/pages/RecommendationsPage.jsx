import { Link } from 'react-router-dom'
import AppShell from '../components/app/AppShell.jsx'
import ErrorState from '../components/app/ErrorState.jsx'
import { ListSkeleton, Loading } from '../components/app/Skeletons.jsx'
import Icon from '../components/ui/Icon.jsx'
import { useI18n } from '../context/I18nContext.jsx'
import { useAuth } from '../context/AuthContext.jsx'
import { buildRecommendations, useWorkspace } from '../context/WorkspaceContext.jsx'

/**
 * What to do next, as one ordered plan.
 *
 * Grouping these into three equal-looking columns made every item feel equally
 * urgent, which is the same as none of them being urgent. They are numbered
 * instead, in the order they are worth doing — the numbers are a claim about
 * sequence, not decoration, and they only earn their place because the priority
 * ordering behind them is real.
 *
 * Each item is derived from the candidate's own data: a field that is genuinely
 * empty, a question genuinely unanswered, or a gap the assessment itself
 * produced. Every one links somewhere that can resolve it; there are no buttons
 * here that do nothing.
 */

const ORDER = { critical: 0, important: 1, nice_to_have: 2 }
const TONE = { critical: 'bad', important: 'warn', nice_to_have: 'brand' }

const CTA_FOR = {
  '/cv': 'cv',
  '/profile': 'profile',
  '/readiness': 'readiness',
  '/questionnaire': 'questionnaire',
  '/settings': 'settings',
}

export default function RecommendationsPage() {
  const { t } = useI18n()
  const { user } = useAuth()
  const ws = useWorkspace()

  const items = buildRecommendations({
    profile: ws.profile,
    document: ws.document,
    outstandingQuestions: ws.outstandingQuestions,
    user,
  }).sort((a, b) => ORDER[a.priority] - ORDER[b.priority])

  const blocking = items.filter((i) => i.priority === 'critical').length

  const shell = {
    eyebrow: t('app.nav.recommendations'),
    title: t('app.recommendations.title'),
    subtitle: t('app.recommendations.subtitle'),
    badges: { questionnaire: ws.outstandingQuestions },
  }

  if (ws.loading) {
    return (
      <AppShell {...shell}>
        <Loading label={t('common.loading')}>
          <ListSkeleton rows={5} />
        </Loading>
      </AppShell>
    )
  }

  if (ws.error) {
    return (
      <AppShell {...shell}>
        <ErrorState code={ws.error} what={t('app.error.recommendations')} onRetry={ws.reload} />
      </AppShell>
    )
  }

  if (!items.length) {
    return (
      <AppShell {...shell}>
        <section className="plan__done">
          <span className="plan__doneIcon"><Icon name="checkCircle" size={28} /></span>
          <h2>{t('app.recommendations.allDone')}</h2>
          <p>{t('app.recommendations.allDoneText')}</p>
          <Link to="/readiness" className="btn btn--primary">
            {t('app.next.goto.readiness')} <Icon name="arrowRight" size={16} />
          </Link>
        </section>
      </AppShell>
    )
  }

  return (
    <AppShell {...shell}>
      <div className="plan">
        <header className="plan__head">
          <h2>{t('app.next.planTitle')}</h2>
          <p>
            {blocking > 0
              ? t('app.next.planBlocking', { count: blocking })
              : t('app.next.planClear', { count: items.length })}
          </p>
        </header>

        <ol className="plan__list">
          {items.map((r, i) => {
            const title = r.gap
              ? t('app.recommendations.items.close_gap.title', { skill: r.gap.skill })
              : t(`app.recommendations.items.${r.key}.title`, { count: r.count })
            const why = r.gap ? r.gap.why : t(`app.recommendations.items.${r.key}.text`, { count: r.count })
            const action = r.gap ? r.gap.howToClose : null

            return (
              <li key={`${r.key}-${i}`} className={`plan__item plan__item--${r.priority}`}>
                <span className="plan__num num" aria-hidden="true">
                  {String(i + 1).padStart(2, '0')}
                </span>

                <div className="plan__body">
                  <div className="plan__top">
                    <h3>{title}</h3>
                    <span className={`wbadge wbadge--${TONE[r.priority]}`}>
                      {t(`app.recommendations.priority.${r.priority}`)}
                    </span>
                  </div>

                  {why && (
                    <p className="plan__why">
                      <em>{t('app.next.why')}</em>
                      {why}
                    </p>
                  )}

                  {action && action !== why && (
                    <p className="plan__action">
                      <Icon name="arrowUpRight" size={14} />
                      <span>
                        <em>{t('app.readiness.nextAction')}</em>
                        {action}
                      </span>
                    </p>
                  )}

                  <div className="plan__foot">
                    {r.gap?.estimatedWeeks ? (
                      <span className="plan__meta">
                        <Icon name="clock" size={13} />
                        {t('app.readiness.weeks', { count: r.gap.estimatedWeeks })}
                      </span>
                    ) : null}
                    {r.gap?.currentLevel || r.gap?.targetLevel ? (
                      <span className="plan__meta">
                        {r.gap.currentLevel ?? t('common.none')}
                        <Icon name="arrowRight" size={12} />
                        <strong>{r.gap.targetLevel ?? t('common.none')}</strong>
                      </span>
                    ) : null}
                    <Link to={r.to} className="btn btn--ghost btn--sm plan__go">
                      {t(`app.next.goto.${CTA_FOR[r.to] ?? 'profile'}`)}
                      <Icon name="arrowRight" size={14} />
                    </Link>
                  </div>
                </div>
              </li>
            )
          })}
        </ol>
      </div>
    </AppShell>
  )
}
