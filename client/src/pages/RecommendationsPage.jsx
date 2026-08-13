import { Link } from 'react-router-dom'
import AppShell from '../components/app/AppShell.jsx'
import Icon from '../components/ui/Icon.jsx'
import { Badge, Card, Empty, Skeleton } from '../components/app/widgets.jsx'
import { useI18n } from '../context/I18nContext.jsx'
import { useAuth } from '../context/AuthContext.jsx'
import { buildRecommendations, useWorkspace } from '../context/WorkspaceContext.jsx'

const TONE = { critical: 'bad', important: 'warn', nice_to_have: 'brand' }
const ORDER = { critical: 0, important: 1, nice_to_have: 2 }

/**
 * What to do next.
 *
 * Every item is derived from the candidate's own data — a field that is
 * genuinely empty, a question genuinely unanswered, or a gap the assessment
 * itself produced. Each one links somewhere that can actually resolve it; there
 * are no buttons here that do nothing.
 */
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

  const grouped = {
    critical: items.filter((i) => i.priority === 'critical'),
    important: items.filter((i) => i.priority === 'important'),
    nice_to_have: items.filter((i) => i.priority === 'nice_to_have'),
  }

  return (
    <AppShell
      eyebrow={t('app.nav.recommendations')}
      title={t('app.recommendations.title')}
      subtitle={t('app.recommendations.subtitle')}
      badges={{ questionnaire: ws.outstandingQuestions }}
    >
      {ws.loading ? (
        <Skeleton rows={4} />
      ) : !items.length ? (
        <Card>
          <Empty
            icon="check"
            title={t('app.recommendations.allDone')}
            text={t('app.recommendations.allDoneText')}
            action={<Link to="/readiness" className="btn btn--primary">{t('app.nav.readiness')} <Icon name="arrowRight" /></Link>}
          />
        </Card>
      ) : (
        Object.entries(grouped)
          .filter(([, list]) => list.length)
          .map(([priority, list]) => (
            <Card
              key={priority}
              icon={priority === 'critical' ? 'alert' : priority === 'important' ? 'trendingUp' : 'sparkle'}
              title={t(`app.recommendations.priority.${priority}`)}
              hint={t(`app.recommendations.priorityHint.${priority}`)}
            >
              <ul className="recs">
                {list.map((r, i) => (
                  <li key={`${r.key}-${i}`} className={`rec rec--${r.priority}`}>
                    <span className="rec__icon"><Icon name={r.icon} size={18} /></span>
                    <div className="rec__body">
                      <div className="rec__top">
                        <strong>
                          {r.gap
                            ? t('app.recommendations.items.close_gap.title', { skill: r.gap.skill })
                            : t(`app.recommendations.items.${r.key}.title`, { count: r.count })}
                        </strong>
                        <Badge tone={TONE[r.priority]}>{t(`app.recommendations.priority.${r.priority}`)}</Badge>
                      </div>
                      <p>
                        {r.gap
                          ? r.gap.howToClose || r.gap.why
                          : t(`app.recommendations.items.${r.key}.text`, { count: r.count })}
                      </p>
                      {r.gap?.estimatedWeeks ? (
                        <span className="rec__meta">
                          <Icon name="clock" size={12} />
                          {t('app.readiness.weeks', { count: r.gap.estimatedWeeks })}
                        </span>
                      ) : null}
                    </div>
                    <Link to={r.to} className="btn btn--ghost btn--sm rec__go">
                      {t('app.recommendations.go')} <Icon name="arrowRight" size={14} />
                    </Link>
                  </li>
                ))}
              </ul>
            </Card>
          ))
      )}
    </AppShell>
  )
}
