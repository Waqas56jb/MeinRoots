import { useState } from 'react'
import { Link } from 'react-router-dom'
import AppShell from '../components/app/AppShell.jsx'
import Icon from '../components/ui/Icon.jsx'
import { Badge, Card, Empty, Meter, Note, Ring, ScoreBadge, Skeleton, band } from '../components/app/widgets.jsx'
import { useI18n } from '../context/I18nContext.jsx'
import { useWorkspace } from '../context/WorkspaceContext.jsx'
import { profileApi } from '../lib/api.js'
import { useApiMessage } from '../lib/apiMessage.js'

const FACTOR_TONE = { strong: 'good', adequate: undefined, weak: 'warn', unknown: 'bad' }
const GAP_TONE = { critical: 'bad', important: 'warn', nice_to_have: 'brand' }

/**
 * Readiness, per objective.
 *
 * The score is never shown alone. Every card answers three questions in order:
 * where am I, what is it based on, and what would move it — which is the whole
 * reason the assessment stores its factors alongside the number.
 */
export default function ReadinessPage() {
  const { t } = useI18n()
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

  return (
    <AppShell
      eyebrow={t('app.nav.readiness')}
      title={t('app.readiness.title')}
      subtitle={t('app.readiness.hint')}
      badges={{ questionnaire: ws.outstandingQuestions }}
      actions={
        assessments.length > 0 && (
          <button type="button" className="btn btn--ghost btn--sm" onClick={recalculate} disabled={busy}>
            <Icon name="refresh" size={15} />
            <span className="hide-xs">{busy ? t('app.readiness.recalculating') : t('app.readiness.recalculate')}</span>
          </button>
        )
      }
    >
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

      {ws.loading ? (
        <Skeleton rows={3} />
      ) : !assessments.length ? (
        <Card>
          <Empty
            icon="target"
            title={t('app.readiness.empty')}
            text={t('app.readiness.emptyText')}
            action={<Link to="/cv" className="btn btn--primary">{t('nav.cta')} <Icon name="arrowRight" /></Link>}
          />
        </Card>
      ) : (
        <div className="wgrid wgrid--2">
          {assessments.map((a) => (
            <Card key={a.id} className={`readiness readiness--${band(a.score)}`}>
              <div className="readiness__head">
                <Ring value={a.score} size={104} stroke={9} sublabel={t('app.readiness.of100')} />
                <div>
                  <span className="readiness__goal">
                    <Icon name="target" size={14} />{t(`goals.items.${a.goal}.title`)}
                  </span>
                  <h2>{t(`app.readiness.bands.${a.band}`)}</h2>
                  <ScoreBadge score={a.score} />
                </div>
              </div>

              {a.summary && <p className="readiness__summary">{a.summary}</p>}

              {a.factors?.length > 0 && (
                <>
                  <h3 className="readiness__sub">{t('app.readiness.factorsTitle')}</h3>
                  <div className="readiness__factors">
                    {a.factors.map((f) => (
                      <Meter
                        key={f.key + f.label}
                        label={f.label}
                        value={f.score}
                        tone={FACTOR_TONE[f.status]}
                        note={f.detail}
                      />
                    ))}
                  </div>
                </>
              )}

              {a.gaps?.length > 0 && (
                <>
                  <h3 className="readiness__sub">{t('app.readiness.gapsTitle')}</h3>
                  <ul className="gaps">
                    {a.gaps.map((g) => (
                      <li key={g.id} className={`gap gap--${g.importance}`}>
                        <div className="gap__head">
                          <strong>{g.skill}</strong>
                          <Badge tone={GAP_TONE[g.importance]}>
                            {t(`app.readiness.importance.${g.importance}`)}
                          </Badge>
                          {g.estimatedWeeks ? (
                            <span className="gap__weeks">
                              <Icon name="clock" size={12} />
                              {t('app.readiness.weeks', { count: g.estimatedWeeks })}
                            </span>
                          ) : null}
                        </div>
                        {(g.currentLevel || g.targetLevel) && (
                          <p className="gap__levels">
                            <span>{g.currentLevel ?? '—'}</span>
                            <Icon name="arrowRight" size={13} />
                            <strong>{g.targetLevel ?? '—'}</strong>
                          </p>
                        )}
                        {g.why && <p className="gap__why">{g.why}</p>}
                        {g.howToClose && (
                          <p className="gap__action">
                            <Icon name="bolt" size={13} />{g.howToClose}
                          </p>
                        )}
                      </li>
                    ))}
                  </ul>
                </>
              )}
            </Card>
          ))}
        </div>
      )}
    </AppShell>
  )
}
