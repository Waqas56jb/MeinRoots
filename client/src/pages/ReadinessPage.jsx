import { useState } from 'react'
import { Link } from 'react-router-dom'
import AppShell from '../components/app/AppShell.jsx'
import ErrorState from '../components/app/ErrorState.jsx'
import ReadinessPanel, { SkillGap } from '../components/app/ReadinessPanel.jsx'
import { Loading, ReadinessSkeleton } from '../components/app/Skeletons.jsx'
import Icon from '../components/ui/Icon.jsx'
import { Note } from '../components/app/widgets.jsx'
import { useI18n } from '../context/I18nContext.jsx'
import { useWorkspace } from '../context/WorkspaceContext.jsx'
import { profileApi } from '../lib/api.js'
import { useApiMessage } from '../lib/apiMessage.js'

/**
 * Readiness, per objective.
 *
 * The page answers one question — how ready am I, and why — and it answers the
 * "why" before the candidate has to ask. The number never appears alone: it is
 * followed immediately by what it measures, then by the factors it was built
 * from, then by the specific things that would move it.
 *
 * A score people cannot interrogate is a score they cannot trust, and this is a
 * screen someone reads while deciding whether to move countries.
 */
export default function ReadinessPage() {
  const { t, locale } = useI18n()
  const apiMessage = useApiMessage()
  const ws = useWorkspace()

  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [done, setDone] = useState(false)

  const recalculate = async () => {
    setBusy(true)
    setError('')
    setDone(false)
    try {
      const data = await profileApi.refreshReadiness()
      ws.setProfile((p) => (p ? { ...p, assessments: data.assessments } : p))
      setDone(true)
    } catch (err) {
      setError(apiMessage(err.code))
    } finally {
      setBusy(false)
    }
  }

  const assessments = ws.profile?.assessments ?? []

  const shell = {
    eyebrow: t('app.nav.readiness'),
    title: t('app.readiness.title'),
    subtitle: t('app.readiness.hint'),
    badges: { questionnaire: ws.outstandingQuestions },
    actions: assessments.length > 0 && (
      <button type="button" className="btn btn--ghost btn--sm" onClick={recalculate} disabled={busy}>
        <Icon name="refresh" size={15} />
        <span className="hide-xs">
          {busy ? t('app.readiness.recalculating') : t('app.readiness.recalculate')}
        </span>
      </button>
    ),
  }

  if (ws.loading) {
    return (
      <AppShell {...shell}>
        <Loading label={t('common.loading')}>
          <ReadinessSkeleton panels={2} />
        </Loading>
      </AppShell>
    )
  }

  if (ws.error) {
    return (
      <AppShell {...shell}>
        <ErrorState code={ws.error} what={t('app.error.readiness')} onRetry={ws.reload} />
      </AppShell>
    )
  }

  return (
    <AppShell {...shell}>
      {error && <Note tone="bad">{error}</Note>}
      {done && <Note tone="good" icon="check">{t('app.readiness.recalculated')}</Note>}

      {ws.outstandingQuestions > 0 && (
        <Note
          tone="warn"
          icon="clipboard"
          title={t('app.readiness.answerFirstTitle')}
          action={
            <Link to="/questionnaire" className="btn btn--primary btn--sm">
              {t('app.dash.answerNow')} <Icon name="arrowRight" size={15} />
            </Link>
          }
        >
          {t('app.readiness.answerFirstText', { count: ws.outstandingQuestions })}
        </Note>
      )}

      {!assessments.length ? (
        <section className="rpanel rpanel--empty">
          <span className="rpanel__emptyIcon"><Icon name="target" size={24} /></span>
          <h2>{t('app.readiness.empty')}</h2>
          <p>{t('app.readiness.emptyText')}</p>
          <Link to="/cv" className="btn btn--primary">
            {t('nav.cta')} <Icon name="arrowRight" size={16} />
          </Link>
        </section>
      ) : (
        <div className="rlist">
          {assessments.map((a) => (
            <article key={a.id} className="rentry">
              <ReadinessPanel assessment={a} variant="full">
                {a.gaps?.length > 0 && (
                  <div className="rpanel__group">
                    <h3 className="rpanel__sub">
                      <Icon name="bolt" size={13} />
                      {t('app.readiness.gapsTitle')}
                    </h3>
                    <ul className="sgaps">
                      {a.gaps.map((g) => (
                        <SkillGap key={g.id} gap={g} />
                      ))}
                    </ul>
                  </div>
                )}

                <div className="rpanel__foot">
                  {a.createdAt && (
                    <span className="rpanel__stamp">
                      <Icon name="clock" size={13} />
                      {t('app.readiness.assessed', {
                        date: new Intl.DateTimeFormat(locale, { dateStyle: 'medium' }).format(
                          new Date(a.createdAt),
                        ),
                      })}
                    </span>
                  )}
                  <Link to="/recommendations" className="btn btn--ghost btn--sm">
                    {t('app.nav.recommendations')} <Icon name="arrowRight" size={14} />
                  </Link>
                </div>
              </ReadinessPanel>
            </article>
          ))}

          {/* Said once, at the end, rather than repeated under every panel:
              a readiness score describes a profile, not an outcome. */}
          <p className="rlist__caveat">
            <Icon name="info" size={14} />
            {t('app.readiness.caveat')}
          </p>
        </div>
      )}
    </AppShell>
  )
}
