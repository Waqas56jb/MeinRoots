import { Link } from 'react-router-dom'
import Icon from '../ui/Icon.jsx'
import { band } from './widgets.jsx'
import { splitFactors } from './insight.js'
import { useI18n } from '../../context/I18nContext.jsx'

/**
 * Readiness, as a number the candidate can argue with.
 *
 * Deliberately not a gauge. A dial gives a score the look of an instrument
 * reading — precise, measured, final — when it is really a judgement about how
 * well a profile matches an objective. So the score is set as a number, placed
 * on the same 0–100 scale the assessment itself uses, and immediately followed
 * by the factors it was built from.
 *
 * The scale below the number carries the real band boundaries (40 / 60 / 80,
 * the same ones the server assigns bands with), which is what turns "72" from a
 * bare figure into "near the top of nearly ready".
 */

const FACTOR_ICON = {
  experience: 'briefcase',
  skills: 'sparkle',
  language: 'translate',
  education: 'graduation',
  authorisation: 'shield',
  evidence: 'checkCircle',
}

const STATUS_TONE = { strong: 'ok', adequate: 'brand', weak: 'warn', unknown: 'muted' }

/** One factor: what it is, how it stands, and why — never a bar on its own. */
function Factor({ factor }) {
  const { t } = useI18n()
  const value = Math.max(0, Math.min(100, Number(factor.score) || 0))
  const tone = STATUS_TONE[factor.status] ?? 'muted'

  return (
    <div className={`rfactor rfactor--${tone}`}>
      <div className="rfactor__top">
        <span className="rfactor__icon">
          <Icon name={FACTOR_ICON[factor.key] ?? 'dot'} size={15} />
        </span>
        <strong>{factor.label}</strong>
        {/* The status word carries the meaning; the colour only reinforces it,
            so the factor still reads correctly in greyscale. */}
        <em className="rfactor__status">{t(`app.readiness.factorStatus.${factor.status}`)}</em>
      </div>
      <div className="rfactor__track">
        <span className="rfactor__fill" style={{ width: `${Math.max(3, value)}%` }} />
      </div>
      {factor.detail && <p className="rfactor__detail">{factor.detail}</p>}
    </div>
  )
}

/**
 * The score itself: the figure, the band it falls in, and the scale that shows
 * what the figure is being measured against.
 */
function Score({ score, bandKey }) {
  const { t } = useI18n()
  const value = Math.max(0, Math.min(100, Number(score) || 0))

  return (
    <div className={`rscore rscore--${band(value)}`}>
      <div className="rscore__figure">
        <strong className="num">{Math.round(value)}</strong>
        <span className="rscore__of">{t('app.readiness.of100')}</span>
      </div>
      <p className="rscore__band">{t(`app.readiness.bands.${bandKey}`)}</p>

      <div className="rscore__scale" aria-hidden="true">
        <div className="rscore__scaleTrack">
          <span className="rscore__scaleFill" style={{ width: `${value}%` }} />
          {[40, 60, 80].map((mark) => (
            <span key={mark} className="rscore__mark" style={{ left: `${mark}%` }} />
          ))}
        </div>
        <div className="rscore__scaleLabels">
          <span>0</span>
          <span>40</span>
          <span>60</span>
          <span>80</span>
          <span>100</span>
        </div>
      </div>
      <p className="sr-only">{t('app.readiness.scoreLabel', { score: Math.round(value) })}</p>
    </div>
  )
}

export default function ReadinessPanel({ assessment, variant = 'full', children }) {
  const { t } = useI18n()
  const { strengths, opportunities } = splitFactors(assessment.factors)
  const compact = variant === 'compact'

  return (
    <section className={`rpanel rpanel--${variant} rpanel--${band(assessment.score)}`}>
      <header className="rpanel__head">
        <span className="rpanel__goal">
          <Icon name="target" size={13} />
          {t(`goals.items.${assessment.goal}.title`)}
        </span>
        <Score score={assessment.score} bandKey={assessment.band} />
        {/* §24 — the number never appears without saying what it measures. */}
        <p className="rpanel__meaning">{t('app.readiness.meaning')}</p>
        {assessment.summary && <p className="rpanel__summary">{assessment.summary}</p>}
      </header>

      {compact ? (
        assessment.factors?.length > 0 && (
          <div className="rpanel__factors">
            {assessment.factors.slice(0, 4).map((f) => (
              <Factor key={`${f.key}-${f.label}`} factor={f} />
            ))}
          </div>
        )
      ) : (
        <>
          {strengths.length > 0 && (
            <div className="rpanel__group">
              <h3 className="rpanel__sub">
                <Icon name="check" size={13} />
                {t('app.readiness.strengths')}
              </h3>
              <div className="rpanel__factors">
                {strengths.map((f) => (
                  <Factor key={`${f.key}-${f.label}`} factor={f} />
                ))}
              </div>
            </div>
          )}

          {opportunities.length > 0 && (
            <div className="rpanel__group">
              <h3 className="rpanel__sub">
                <Icon name="trendingUp" size={13} />
                {t('app.readiness.opportunities')}
              </h3>
              <div className="rpanel__factors">
                {opportunities.map((f) => (
                  <Factor key={`${f.key}-${f.label}`} factor={f} />
                ))}
              </div>
            </div>
          )}
        </>
      )}

      {children}
    </section>
  )
}

/**
 * A skill gap stated as a move: where you are, where the objective needs you to
 * be, why it matters and what closes it. A gap with no next action is only bad
 * news, so the action is part of the component rather than an optional extra.
 */
export function SkillGap({ gap }) {
  const { t } = useI18n()
  const tone = { critical: 'risk', important: 'warn', nice_to_have: 'brand' }[gap.importance] ?? 'brand'

  return (
    <li className={`sgap sgap--${tone}`}>
      <div className="sgap__head">
        <strong>{gap.skill}</strong>
        <span className={`wbadge wbadge--${tone === 'risk' ? 'bad' : tone === 'warn' ? 'warn' : 'brand'}`}>
          {t(`app.readiness.importance.${gap.importance}`)}
        </span>
        {gap.estimatedWeeks ? (
          <span className="sgap__weeks">
            <Icon name="clock" size={12} />
            {t('app.readiness.weeks', { count: gap.estimatedWeeks })}
          </span>
        ) : null}
      </div>

      {(gap.currentLevel || gap.targetLevel) && (
        <p className="sgap__levels">
          <span className="sgap__level">
            <em>{t('app.readiness.current')}</em>
            {gap.currentLevel ?? t('common.none')}
          </span>
          <Icon name="arrowRight" size={14} />
          <span className="sgap__level sgap__level--target">
            <em>{t('app.readiness.target')}</em>
            {gap.targetLevel ?? t('common.none')}
          </span>
        </p>
      )}

      {gap.why && (
        <p className="sgap__why">
          <em>{t('app.readiness.whyItMatters')}</em>
          {gap.why}
        </p>
      )}

      {gap.howToClose && (
        <p className="sgap__action">
          <Icon name="bolt" size={13} />
          <span>
            <em>{t('app.readiness.nextAction')}</em>
            {gap.howToClose}
          </span>
        </p>
      )}
    </li>
  )
}

/** The readiness summary the dashboard shows, with a way through to the detail. */
export function ReadinessLink({ to = '/readiness', label }) {
  const { t } = useI18n()
  return (
    <Link to={to} className="btn btn--ghost btn--sm">
      {label ?? t('app.readiness.explain')} <Icon name="arrowRight" size={14} />
    </Link>
  )
}

/**
 * The two facts a candidate should be able to take from the dashboard in the
 * time it takes to glance at it: what is carrying them, and what is holding
 * them back. Both are named factors from the assessment, not a summary of it.
 */
export function ReadinessHighlights({ factors = [] }) {
  const { t } = useI18n()
  const { strengths, opportunities } = splitFactors(factors)
  const best = strengths[0]
  const worst = opportunities[0]

  if (!best && !worst) return null

  return (
    <div className="rhigh">
      {best && (
        <div className="rhigh__item rhigh__item--ok">
          <span className="rhigh__label">
            <Icon name="check" size={12} />
            {t('app.readiness.strongest')}
          </span>
          <strong>{best.label}</strong>
        </div>
      )}
      {worst && (
        <div className="rhigh__item rhigh__item--warn">
          <span className="rhigh__label">
            <Icon name="trendingUp" size={12} />
            {t('app.readiness.opportunity')}
          </span>
          <strong>{worst.label}</strong>
        </div>
      )}
    </div>
  )
}
