import { useCallback, useEffect, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import Layout from '../components/Layout.jsx'
import Icon from '../components/Icon.jsx'
import { Empty, ErrorNote, Skeleton } from '../components/ui.jsx'
import { useI18n } from '../context/I18nContext.jsx'
import { useToast } from '../context/ToastContext.jsx'
import { adminApi } from '../lib/api.js'
import { formatDateTime, formatRelative } from '../lib/format.js'

const STATUSES = ['queued', 'running', 'succeeded', 'failed', 'dead']
const TONE = { queued: 'info', running: 'info', succeeded: 'good', failed: 'warn', dead: 'bad' }
const REFRESH_MS = 8000

export default function QueuePage() {
  const { t, tError, locale } = useI18n()
  const toast = useToast()
  const [params, setParams] = useSearchParams()

  const [jobs, setJobs] = useState(null)
  const [error, setError] = useState('')
  const [busyId, setBusyId] = useState(null)

  const status = params.get('status') ?? ''

  const load = useCallback(
    async ({ quiet = false } = {}) => {
      if (!quiet) setJobs(null)
      setError('')
      try {
        const data = await adminApi.jobs({ status: status || undefined, limit: 50 })
        setJobs(data.jobs ?? [])
      } catch (err) {
        setError(tError(err.code))
        setJobs([])
      }
    },
    [status, tError],
  )

  useEffect(() => {
    load()
  }, [load])

  // Jobs move on their own, so the page refreshes itself — quietly, so the list
  // does not blink back to skeletons every eight seconds.
  useEffect(() => {
    const id = setInterval(() => load({ quiet: true }), REFRESH_MS)
    return () => clearInterval(id)
  }, [load])

  const retry = async (jobId) => {
    setBusyId(jobId)
    try {
      await adminApi.retryJob(jobId)
      toast.success(t('queue.retried'))
      await load({ quiet: true })
    } catch (err) {
      toast.error(tError(err.code))
    } finally {
      setBusyId(null)
    }
  }

  const setStatus = (next) => {
    const p = new URLSearchParams(params)
    if (next) p.set('status', next)
    else p.delete('status')
    setParams(p, { replace: true })
  }

  return (
    <Layout
      title={t('queue.title')}
      subtitle={t('queue.subtitle')}
      actions={
        <button type="button" className="btn btn--ghost btn--sm" onClick={() => load()}>
          <Icon name="refresh" size={16} /> <span className="hide-sm">{t('common.refresh')}</span>
        </button>
      }
    >
      <div className="chipbar" role="tablist">
        <button type="button" role="tab" aria-selected={!status} className={!status ? 'is-on' : ''} onClick={() => setStatus('')}>
          {t('common.all')}
        </button>
        {STATUSES.map((s) => (
          <button
            key={s}
            type="button"
            role="tab"
            aria-selected={status === s}
            className={status === s ? 'is-on' : ''}
            onClick={() => setStatus(s)}
          >
            {t(`queue.status.${s}`)}
          </button>
        ))}
      </div>

      <ErrorNote message={error} onRetry={load} />

      {jobs === null ? (
        <Skeleton rows={5} />
      ) : jobs.length === 0 ? (
        <Empty icon="layers" title={status ? t('queue.emptyFiltered') : t('queue.empty')} />
      ) : (
        <ul className="joblist">
          {jobs.map((job) => {
            const seconds =
              job.started_at && job.finished_at
                ? Math.round((new Date(job.finished_at) - new Date(job.started_at)) / 1000)
                : null
            return (
              <li key={job.id} className={`job job--${TONE[job.status] ?? 'neutral'}`}>
                <div className="job__main">
                  <div className="job__head">
                    <span className={`badge badge--${TONE[job.status] ?? 'neutral'}`}>
                      {job.status === 'running' && <span className="badge__pulse" aria-hidden="true" />}
                      {t(`queue.status.${job.status}`)}
                    </span>
                    <strong>{job.type}</strong>
                    <span className="muted small">{formatRelative(job.created_at, locale)}</span>
                  </div>

                  <div className="job__meta">
                    <span>{t('queue.attempts', { attempts: job.attempts, max: job.max_attempts })}</span>
                    {job.progress?.stage && <span>{t('queue.stage')}: {job.progress.stage}</span>}
                    {seconds !== null && <span>{t('queue.duration', { seconds })}</span>}
                    <span className="muted">{formatDateTime(job.created_at, locale)}</span>
                  </div>

                  {job.last_error && <p className="job__err">{job.last_error}</p>}
                </div>

                {(job.status === 'dead' || job.status === 'failed') && (
                  <button
                    type="button"
                    className="btn btn--ghost btn--sm"
                    disabled={busyId === job.id}
                    onClick={() => retry(job.id)}
                  >
                    <Icon name="retry" size={15} /> {t('queue.retry')}
                  </button>
                )}
              </li>
            )
          })}
        </ul>
      )}
    </Layout>
  )
}
