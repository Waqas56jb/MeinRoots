import { useCallback, useEffect, useState } from 'react'
import AppShell from '../components/app/AppShell.jsx'
import ErrorState from '../components/app/ErrorState.jsx'
import { ListSkeleton, Loading } from '../components/app/Skeletons.jsx'
import Icon from '../components/ui/Icon.jsx'
import { Badge, Note } from '../components/app/widgets.jsx'
import { useI18n } from '../context/I18nContext.jsx'
import { useAuth } from '../context/AuthContext.jsx'
import { useWorkspace } from '../context/WorkspaceContext.jsx'
import { recruitmentApi } from '../lib/api.js'
import { ApiError } from '../lib/api.js'

/**
 * Employers who have asked to speak to you.
 *
 * The candidate side of recruitment, and the tone is deliberately different
 * from the recruiter's: this is a person being approached about their career,
 * not a pipeline being worked. Every request states who is asking, what they
 * are asking for, and what happens if the answer is yes — before either button.
 *
 * The decision is genuinely theirs. Nothing here is presented as an obligation,
 * declining costs nothing, and no contact detail leaves MeinRoots until the
 * candidate has said so.
 *
 * The endpoints are Milestone 2 and do not exist yet, so the page distinguishes
 * "not built" from "nothing waiting" — telling someone no employer has been in
 * touch when the feature simply is not live would be a lie they might act on.
 */

const STATUS_TONE = {
  pending: 'warn', accepted: 'good', declined: 'neutral', completed: 'good',
  cancelled: 'neutral', expired: 'neutral',
}

const FILTERS = ['all', 'pending', 'accepted', 'declined']

export default function RecruitmentPage() {
  const { t, locale } = useI18n()
  const { user } = useAuth()
  const ws = useWorkspace()

  const [rows, setRows] = useState(null)
  const [error, setError] = useState(null)
  const [pending, setPending] = useState(false)
  const [filter, setFilter] = useState('all')
  const [busyId, setBusyId] = useState(null)

  const load = useCallback(async () => {
    setError(null)
    setPending(false)
    try {
      const data = await recruitmentApi.requests(filter === 'all' ? {} : { status: filter })
      setRows(data.data ?? [])
    } catch (err) {
      // 404 means the route is not written yet — a different thing from broken.
      if (err instanceof ApiError && err.status === 404) setPending(true)
      else setError(err.code ?? 'server_error')
      setRows([])
    }
  }, [filter])

  useEffect(() => {
    load()
  }, [load])

  const respond = async (request, accept) => {
    setBusyId(request.id)
    try {
      if (accept) await recruitmentApi.accept(request.id)
      else await recruitmentApi.decline(request.id)
      await load()
    } catch (err) {
      setError(err.code ?? 'server_error')
    } finally {
      setBusyId(null)
    }
  }

  const shell = {
    eyebrow: t('app.nav.recruitment'),
    title: t('app.recruitment.title'),
    subtitle: t('app.recruitment.subtitle'),
    badges: { questionnaire: ws.outstandingQuestions },
  }

  const waiting = (rows ?? []).filter((r) => r.status === 'pending').length

  return (
    <AppShell {...shell}>
      {/*
        Said once, at the top: this exists because they allowed it, and they can
        take that back. A candidate who has forgotten agreeing to be contacted
        should find the answer here rather than in a support email.
      */}
      <Note tone="info" icon="shield" title={t('app.recruitment.privacyTitle')}>
        {user?.consents?.employer_sharing
          ? t('app.recruitment.privacyOn')
          : t('app.recruitment.privacyOff')}
      </Note>

      <div className="rfilters" role="tablist" aria-label={t('app.recruitment.filter')}>
        {FILTERS.map((f) => (
          <button
            key={f}
            type="button"
            role="tab"
            aria-selected={filter === f}
            className={filter === f ? 'is-on' : ''}
            onClick={() => setFilter(f)}
          >
            {t(`app.recruitment.filters.${f}`)}
            {f === 'pending' && waiting > 0 && <em className="num">{waiting}</em>}
          </button>
        ))}
      </div>

      {rows === null ? (
        <Loading label={t('common.loading')}><ListSkeleton rows={3} /></Loading>
      ) : pending ? (
        <section className="rpanel rpanel--empty">
          <span className="rpanel__emptyIcon"><Icon name="clock" size={24} /></span>
          <h2>{t('app.recruitment.pendingTitle')}</h2>
          <p>{t('app.recruitment.pendingText')}</p>
        </section>
      ) : error ? (
        <ErrorState code={error} what={t('app.recruitment.loadError')} onRetry={load} />
      ) : !rows.length ? (
        <section className="rpanel rpanel--empty">
          <span className="rpanel__emptyIcon"><Icon name="mail" size={24} /></span>
          <h2>{t(filter === 'all' ? 'app.recruitment.emptyTitle' : 'app.recruitment.emptyFiltered')}</h2>
          <p>{t(filter === 'all' ? 'app.recruitment.emptyText' : 'app.recruitment.emptyFilteredText')}</p>
        </section>
      ) : (
        <ul className="rrequests">
          {rows.map((r) => (
            <li key={r.id} className={`rrequest rrequest--${r.status}`}>
              <div className="rrequest__head">
                <span className="rrequest__icon">
                  <Icon name={r.type === 'interview' ? 'clock' : 'mail'} size={19} />
                </span>
                <div className="rrequest__who">
                  <h3>{r.company?.name ?? t('app.recruitment.anEmployer')}</h3>
                  <p>
                    {t(`app.recruitment.types.${r.type}`)}
                    {r.createdAt && (
                      <>
                        {' · '}
                        {new Intl.DateTimeFormat(locale, { dateStyle: 'medium' }).format(new Date(r.createdAt))}
                      </>
                    )}
                  </p>
                </div>
                <Badge tone={STATUS_TONE[r.status] ?? 'neutral'}>
                  {t(`app.recruitment.status.${r.status}`)}
                </Badge>
              </div>

              {r.role && (
                <p className="rrequest__role">
                  <em>{t('app.recruitment.role')}</em>
                  {r.role}
                </p>
              )}

              {r.message && (
                <blockquote className="rrequest__message">
                  <Icon name="quote" size={14} />
                  {r.message}
                </blockquote>
              )}

              {/* What actually happens on yes, before the button that says yes. */}
              {r.status === 'pending' && (
                <>
                  <p className="rrequest__what">
                    <Icon name="info" size={14} />
                    {t(`app.recruitment.ifAccept.${r.type}`)}
                  </p>
                  <div className="rrequest__actions">
                    <button
                      type="button"
                      className="btn btn--primary"
                      disabled={busyId === r.id}
                      onClick={() => respond(r, true)}
                    >
                      <Icon name="check" size={16} /> {t('app.recruitment.accept')}
                    </button>
                    <button
                      type="button"
                      className="btn btn--ghost"
                      disabled={busyId === r.id}
                      onClick={() => respond(r, false)}
                    >
                      {t('app.recruitment.decline')}
                    </button>
                    <span className="rrequest__noPressure">{t('app.recruitment.noPressure')}</span>
                  </div>
                </>
              )}
            </li>
          ))}
        </ul>
      )}
    </AppShell>
  )
}
