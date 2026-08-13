import { useCallback, useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import Layout from '../components/Layout.jsx'
import Icon from '../components/Icon.jsx'
import { Empty, ErrorNote, Skeleton } from '../components/ui.jsx'
import { useI18n } from '../context/I18nContext.jsx'
import { adminApi } from '../lib/api.js'
import { compactNumber, formatNumber } from '../lib/format.js'

/**
 * Horizontal bar list.
 *
 * Bars rather than a pie: comparing thirteen domains by angle is guesswork, and
 * these are counts, which read most directly as lengths against a shared
 * baseline. No chart library for two of these.
 */
function BarList({ items, total }) {
  const { locale, t } = useI18n()
  const max = Math.max(...items.map((i) => i.value), 1)
  const withValues = items.filter((i) => i.value > 0)

  if (!withValues.length) return <p className="muted small">{t('overview.noData')}</p>

  return (
    <ul className="bars">
      {withValues.map((item) => (
        <li key={item.key}>
          <span className="bars__label">{item.label}</span>
          <span className="bars__track">
            <span className="bars__fill" style={{ width: `${(item.value / max) * 100}%` }} />
          </span>
          <span className="bars__value">
            {formatNumber(item.value, locale)}
            {total ? <em>{Math.round((item.value / total) * 100)}%</em> : null}
          </span>
        </li>
      ))}
    </ul>
  )
}

function Stat({ icon, label, value, hint, tone, to }) {
  const body = (
    <>
      <span className="stat__icon"><Icon name={icon} size={18} /></span>
      <strong>{value}</strong>
      <span className="stat__label">{label}</span>
      {hint && <em>{hint}</em>}
    </>
  )
  const className = `stat ${tone ? `stat--${tone}` : ''} ${to ? 'stat--link' : ''}`
  return to ? <Link to={to} className={className}>{body}</Link> : <div className={className}>{body}</div>
}

export default function OverviewPage() {
  const { t, tError, locale } = useI18n()
  const [stats, setStats] = useState(null)
  const [error, setError] = useState('')

  const load = useCallback(async () => {
    setError('')
    try {
      setStats(await adminApi.stats())
    } catch (err) {
      setError(tError(err.code))
    }
  }, [tError])

  useEffect(() => {
    load()
  }, [load])

  const c = stats?.counts

  return (
    <Layout
      title={t('overview.title')}
      subtitle={t('overview.subtitle')}
      actions={
        <button type="button" className="btn btn--ghost btn--sm" onClick={load}>
          <Icon name="refresh" size={16} /> <span className="hide-sm">{t('common.refresh')}</span>
        </button>
      }
    >
      <ErrorNote message={error} onRetry={load} />

      {!stats ? (
        <Skeleton rows={4} />
      ) : (
        <>
          <div className="stats">
            <Stat
              icon="users"
              label={t('overview.stats.candidates')}
              value={formatNumber(c.candidates, locale)}
              hint={t('overview.stats.candidatesHint', { count: c.candidates_7d })}
              to="/candidates"
            />
            <Stat
              icon="file"
              label={t('overview.stats.analysed')}
              value={formatNumber(c.analysed, locale)}
              hint={t('overview.stats.analysedHint', { count: c.documents })}
            />
            <Stat
              icon="sparkle"
              label={t('overview.stats.automation')}
              value={`${stats.automationRate}%`}
              hint={t('overview.stats.automationHint')}
              tone={stats.automationRate >= 70 ? 'good' : 'warn'}
            />
            <Stat
              icon="warning"
              label={t('overview.stats.flagged')}
              value={formatNumber(c.flagged, locale)}
              hint={t('overview.stats.flaggedHint')}
              tone={c.flagged > 0 ? 'warn' : 'good'}
              to="/candidates?flagged=1"
            />
            <Stat
              icon="alert"
              label={t('overview.stats.failed')}
              value={formatNumber(c.failed, locale)}
              hint={t('overview.stats.failedHint')}
              tone={c.failed > 0 ? 'bad' : 'good'}
              to="/queue?status=dead"
            />
            <Stat
              icon="layers"
              label={t('overview.stats.queue')}
              value={formatNumber(c.jobs_queued + c.jobs_running, locale)}
              hint={t('overview.stats.queueHint', { dead: c.jobs_dead })}
              tone={c.jobs_dead > 0 ? 'bad' : 'neutral'}
              to="/queue"
            />
            <Stat
              icon="brain"
              label={t('overview.stats.tokens')}
              value={compactNumber(c.tokens_30d, locale)}
              hint={t('overview.stats.tokensHint')}
            />
          </div>

          <section className="card callout">
            <div>
              <h2>{t('overview.needsYou')}</h2>
              {c.flagged > 0 ? (
                <p>{t('overview.stats.flaggedHint')}</p>
              ) : (
                <p className="muted">{t('overview.needsYouEmpty')}</p>
              )}
            </div>
            <div className="callout__side">
              <strong className={c.flagged > 0 ? 'is-warn' : 'is-good'}>{c.flagged}</strong>
              <Link to="/candidates?flagged=1" className="btn btn--primary btn--sm">
                {t('overview.openQueue')} <Icon name="arrowRight" size={15} />
              </Link>
            </div>
          </section>

          <div className="grid2">
            <section className="card">
              <h2><Icon name="compass" size={17} />{t('overview.byDomain')}</h2>
              <BarList
                total={c.candidates}
                items={(stats.byDomain ?? []).map((d) => ({
                  key: d.code,
                  label: d.label_en,
                  value: d.candidates,
                }))}
              />
            </section>

            <section className="card">
              <h2><Icon name="target" size={17} />{t('overview.byGoal')}</h2>
              {stats.byGoal?.length ? (
                <BarList
                  items={stats.byGoal.map((g) => ({
                    key: g.goal,
                    label: t(`goals.${g.goal}`),
                    value: g.candidates,
                  }))}
                />
              ) : (
                <Empty icon="target" title={t('overview.noData')} />
              )}
            </section>
          </div>
        </>
      )}
    </Layout>
  )
}
