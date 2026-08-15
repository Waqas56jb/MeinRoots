import { Link } from 'react-router-dom'
import Layout from '../../components/Layout.jsx'
import Icon from '../../components/Icon.jsx'
import CandidateCard from '../../components/CandidateCard.jsx'
import {
  EmptyState, ErrorState, PendingState, Panel, PlanBadge, Skeleton,
} from '../../components/ui.jsx'
import { useResource } from '../../hooks/useResource.js'
import { requestApi, savedApi, searchApi } from '../../services/index.js'
import { useI18n } from '../../context/I18nContext.jsx'
import { useAuth } from '../../context/AuthContext.jsx'
import { useAccount } from '../../context/AccountContext.jsx'

/**
 * The recruiter's landing screen.
 *
 * Ordered by what a recruiter actually opens it to find out, not by what is
 * easiest to count: where my subscription stands, then what needs answering,
 * then who is worth looking at. A row of totals would be quicker to build and
 * would answer none of those.
 *
 * Every figure comes from an endpoint. Where the endpoint does not exist yet,
 * the panel says so and names it — it does not show a zero, because a zero is a
 * claim about reality and this one would be false.
 */
export default function DashboardPage() {
  const { t, locale } = useI18n()
  const { user } = useAuth()
  const { subscription, plan, isTrial, trialDaysLeft, pending: accountPending } = useAccount()

  const firstName = user?.name?.split(' ')[0] ?? ''

  const requests = useResource(() => requestApi.list({ status: 'pending', limit: 5 }), [])
  const saved = useResource(() => savedApi.list({ limit: 3 }), [])
  const suggestions = useResource(() => searchApi.candidates({ limit: 3, sort: 'readiness' }), [])

  const openRequests = requests.data?.meta?.total ?? requests.data?.data?.length ?? null

  return (
    <Layout
      title={t('dashboard.greeting', { name: firstName }).trim()}
      subtitle={t('dashboard.subtitle')}
      meta={plan ? <PlanBadge plan={plan} status={subscription?.status} /> : null}
      actions={
        <Link to="/candidates" className="btn btn--primary btn--sm">
          <Icon name="search" size={16} /> {t('dashboard.findCandidates')}
        </Link>
      }
    >
      {/* ------------------------- subscription state ----------------------- */}
      {accountPending ? (
        <PendingState
          endpoint="GET /api/recruiter/me"
          title={t('dashboard.accountPendingTitle')}
          text={t('dashboard.accountPendingText')}
        />
      ) : (
        subscription && (
          <Panel className="panel--plan">
            <div className="planstate">
              <div>
                <span className="planstate__label">{t('dashboard.yourPlan')}</span>
                <strong>{t(`billing.plans.${plan}.name`)}</strong>
                <p>
                  {isTrial && trialDaysLeft !== null
                    ? t('billing.trialDaysLeft', { count: trialDaysLeft })
                    : subscription.renewsAt
                      ? t('billing.renewsOn', {
                          date: new Intl.DateTimeFormat(locale, { dateStyle: 'long' }).format(
                            new Date(subscription.renewsAt),
                          ),
                        })
                      : t(`billing.status.${subscription.status}`)}
                </p>
              </div>
              <Link to="/billing" className="btn btn--ghost btn--sm">
                {t('dashboard.managePlan')} <Icon name="arrowRight" size={14} />
              </Link>
            </div>
          </Panel>
        )
      )}

      {/* --------------------------- needs an answer ------------------------ */}
      <Panel
        icon="message"
        title={t('dashboard.needsAttention')}
        hint={t('dashboard.needsAttentionHint')}
        actions={
          <Link to="/requests" className="btn btn--ghost btn--sm">
            {t('dashboard.allRequests')} <Icon name="arrowRight" size={14} />
          </Link>
        }
      >
        {requests.loading ? (
          <Skeleton variant="rows" rows={3} />
        ) : requests.pending ? (
          <PendingState endpoint="GET /api/recruiter/requests" />
        ) : requests.error ? (
          <ErrorState message={t('dashboard.requestsError')} onRetry={requests.reload} />
        ) : !openRequests ? (
          <EmptyState
            icon="checkCircle"
            title={t('dashboard.noRequests')}
            text={t('dashboard.noRequestsText')}
          />
        ) : (
          <ul className="reqlist">
            {(requests.data.data ?? []).map((r) => (
              <li key={r.id}>
                <Link to={`/requests?id=${r.id}`}>
                  <span className={`reqlist__type reqlist__type--${r.type}`}>
                    <Icon name={r.type === 'interview' ? 'calendar' : 'message'} size={15} />
                  </span>
                  <span className="reqlist__body">
                    <strong>{r.candidate?.reference ?? r.candidateReference ?? t('requests.candidate')}</strong>
                    <small>{t(`requests.types.${r.type}`)}</small>
                  </span>
                  <Icon name="chevronRight" size={16} />
                </Link>
              </li>
            ))}
          </ul>
        )}
      </Panel>

      <div className="dashgrid">
        {/* ------------------------------ saved ----------------------------- */}
        <Panel
          icon="bookmark"
          title={t('dashboard.saved')}
          actions={
            <Link to="/saved" className="btn btn--ghost btn--sm">
              {t('common.viewAll')} <Icon name="arrowRight" size={14} />
            </Link>
          }
        >
          {saved.loading ? (
            <Skeleton variant="rows" rows={2} />
          ) : saved.pending ? (
            <PendingState endpoint="GET /api/recruiter/saved" />
          ) : saved.error ? (
            <ErrorState message={t('dashboard.savedError')} onRetry={saved.reload} />
          ) : !(saved.data?.data ?? []).length ? (
            <EmptyState
              icon="bookmark"
              title={t('dashboard.noSaved')}
              text={t('dashboard.noSavedText')}
              action={
                <Link to="/candidates" className="btn btn--ghost btn--sm">
                  {t('dashboard.findCandidates')}
                </Link>
              }
            />
          ) : (
            <ul className="minicards">
              {saved.data.data.map((c) => (
                <li key={c.id}>
                  <Link to={`/candidates/${c.id}`}>
                    <strong>{c.reference ?? `#${c.id}`}</strong>
                    <span>{c.profession}</span>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </Panel>

        {/* --------------------------- worth a look ------------------------- */}
        <Panel
          icon="spark"
          title={t('dashboard.suggested')}
          hint={t('dashboard.suggestedHint')}
        >
          {suggestions.loading ? (
            <Skeleton variant="cards" rows={2} />
          ) : suggestions.pending ? (
            <PendingState endpoint="GET /api/recruiter/candidates" />
          ) : suggestions.error ? (
            <ErrorState message={t('dashboard.suggestedError')} onRetry={suggestions.reload} />
          ) : !(suggestions.data?.data ?? []).length ? (
            <EmptyState icon="search" title={t('dashboard.noSuggestions')} />
          ) : (
            <div className="cardgrid cardgrid--compact">
              {suggestions.data.data.map((c) => (
                <CandidateCard key={c.id} candidate={c} />
              ))}
            </div>
          )}
        </Panel>
      </div>
    </Layout>
  )
}
