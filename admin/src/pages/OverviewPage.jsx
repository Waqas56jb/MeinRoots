import Layout from '../components/Layout.jsx'
import Icon from '../components/Icon.jsx'
import { ErrorNote } from '../components/ui.jsx'
import {
  Attention, BarList, Freshness, Kpi, OverviewSkeleton, Panel, Pipeline,
} from '../components/console.jsx'
import { useI18n } from '../context/I18nContext.jsx'
import { useStats } from '../context/StatsContext.jsx'
import { compactNumber, formatNumber } from '../lib/format.js'

/**
 * The operations overview.
 *
 * Previously seven metric cards of identical weight, with the one thing that
 * needed a person sitting fifth on the page. An operations console has one job
 * before any other: say whether anything is wrong. So the page now opens with
 * that answer — an alarm or an all-clear — and only then shows the numbers.
 *
 * Below it the figures are arranged as the pipeline they describe: people
 * arrive, CVs are analysed, and each analysis either clears itself or lands on
 * someone's desk. That relationship was previously left for the admin to hold
 * in their head.
 *
 * Every figure is counted by the API. Nothing here is derived by subtracting
 * one bucket from another: the document counts and the profile counts come from
 * different tables, so arithmetic across them would look precise and be wrong.
 */
export default function OverviewPage() {
  const { t, tError, locale } = useI18n()
  const { stats, counts: c, error, loading, fetchedAt, reload } = useStats()

  const shell = {
    title: t('overview.title'),
    subtitle: t('overview.subtitle'),
    meta: <Freshness at={fetchedAt} />,
    actions: (
      <button type="button" className="btn btn--ghost btn--sm" onClick={() => reload()}>
        <Icon name="refresh" size={16} /> <span className="hide-sm">{t('common.refresh')}</span>
      </button>
    ),
  }

  if (loading && !stats) {
    return (
      <Layout {...shell}>
        <OverviewSkeleton />
      </Layout>
    )
  }

  if (!stats) {
    return (
      <Layout {...shell}>
        <ErrorNote message={tError(error)} onRetry={reload} />
      </Layout>
    )
  }

  /* ---------------------------- what needs a person --------------------- */

  const attention = [
    {
      key: 'flagged',
      count: c.flagged,
      tone: 'warn',
      label: t('overview.attention.flagged', { count: c.flagged }),
      text: t('overview.attention.flaggedText'),
      to: '/candidates?flagged=1',
    },
    {
      key: 'failed',
      count: c.failed,
      tone: 'bad',
      label: t('overview.attention.failed', { count: c.failed }),
      text: t('overview.attention.failedText'),
      to: '/queue?status=dead',
    },
    {
      key: 'dead',
      count: c.jobs_dead,
      tone: 'bad',
      label: t('overview.attention.dead', { count: c.jobs_dead }),
      text: t('overview.attention.deadText'),
      to: '/queue?status=dead',
    },
  ]

  const inFlight = c.jobs_queued + c.jobs_running

  return (
    <Layout {...shell}>
      {/* A refresh that failed while good numbers are on screen: say so, keep
          the numbers, offer the retry. Blanking the page would be worse. */}
      {error && <ErrorNote message={tError(error)} onRetry={reload} />}

      <Attention items={attention} />

      <Pipeline
        stages={[
          {
            key: 'candidates',
            label: t('overview.stats.candidates'),
            value: c.candidates,
            hint: t('overview.stats.candidatesHint', { count: c.candidates_7d }),
          },
          {
            key: 'documents',
            label: t('overview.pipeline.uploaded'),
            value: c.documents,
            hint: t('overview.pipeline.uploadedHint'),
          },
          {
            key: 'analysed',
            label: t('overview.stats.analysed'),
            value: c.analysed,
            hint: t('overview.pipeline.analysedHint', {
              percent: c.documents ? Math.round((c.analysed / c.documents) * 100) : 0,
            }),
          },
        ]}
        outcomes={[
          {
            key: 'auto',
            tone: 'good',
            value: c.auto_cleared,
            label: t('overview.pipeline.cleared'),
          },
          {
            key: 'flagged',
            tone: c.flagged > 0 ? 'warn' : 'neutral',
            value: c.flagged,
            label: t('overview.pipeline.flagged'),
            to: '/candidates?flagged=1',
          },
          {
            key: 'failed',
            tone: c.failed > 0 ? 'bad' : 'neutral',
            value: c.failed,
            label: t('overview.pipeline.failed'),
            to: '/queue?status=dead',
          },
        ]}
      />

      {/* --------------------------- supporting figures ------------------- */}
      <div className="kpirow">
        <Kpi
          size="lg"
          icon="sparkle"
          label={t('overview.stats.automation')}
          value={`${stats.automationRate}%`}
          hint={
            c.analysed > 0
              ? t('overview.automationOf', { cleared: c.auto_cleared, analysed: c.analysed })
              : t('overview.automationNone')
          }
          tone={c.analysed === 0 ? undefined : stats.automationRate >= 70 ? 'good' : 'warn'}
        />
        <Kpi
          size="sm"
          icon="layers"
          label={t('overview.stats.queue')}
          value={formatNumber(inFlight, locale)}
          hint={
            inFlight > 0
              ? t('overview.inFlightDetail', { queued: c.jobs_queued, running: c.jobs_running })
              : t('overview.inFlightIdle')
          }
          to="/queue"
        />
        <Kpi
          size="sm"
          icon="brain"
          label={t('overview.stats.tokens')}
          value={compactNumber(c.tokens_30d, locale)}
          hint={t('overview.stats.tokensHint')}
        />
      </div>

      {/* ----------------------------- distribution ----------------------- */}
      <div className="grid2">
        <Panel icon="compass" title={t('overview.byDomain')} hint={t('overview.byDomainHint')}>
          <BarList
            total={c.candidates}
            max={8}
            items={(stats.byDomain ?? []).map((d) => ({
              key: d.code,
              // The stats endpoint returns only the English label for a domain,
              // so this column stays English in every console language. Noted
              // rather than papered over with a client-side guess.
              label: d.label_en,
              value: d.candidates,
            }))}
          />
        </Panel>

        <Panel icon="target" title={t('overview.byGoal')} hint={t('overview.byGoalHint')}>
          <BarList
            total={c.candidates}
            items={(stats.byGoal ?? []).map((g) => ({
              key: g.goal,
              label: t(`goals.${g.goal}`),
              value: g.candidates,
            }))}
          />
        </Panel>
      </div>
    </Layout>
  )
}
