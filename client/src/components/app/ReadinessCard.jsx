import Icon from '../ui/Icon.jsx'
import { useI18n } from '../../context/I18nContext.jsx'

const BAND_TONE = {
  not_ready: 'bad',
  developing: 'warn',
  nearly_ready: 'good',
  ready: 'great',
}

const STATUS_ICON = { strong: 'checkCircle', adequate: 'check', weak: 'alert', unknown: 'info' }
const IMPORTANCE_TONE = { critical: 'bad', important: 'warn', nice_to_have: 'info' }

/**
 * One goal's readiness, as an explainable breakdown rather than a bare number.
 *
 * The factors and gaps come straight from the assessment stored with the score,
 * so what the candidate reads is the same reasoning the score was derived from —
 * the SRS is explicit that this must not be a black box.
 */
export default function ReadinessCard({ assessment }) {
  const { t } = useI18n()
  const tone = BAND_TONE[assessment.band] ?? 'warn'

  return (
    <article className={`readiness card readiness--${tone}`}>
      <header className="readiness__head">
        <div>
          <span className="readiness__goal">
            <Icon name="target" size={15} />
            {t(`goals.items.${assessment.goal}.title`)}
          </span>
          <h3>{t(`app.readiness.bands.${assessment.band}`)}</h3>
        </div>

        <div className="readiness__score" role="img" aria-label={t('app.readiness.scoreLabel', { score: assessment.score })}>
          <svg viewBox="0 0 44 44" aria-hidden="true">
            <circle className="readiness__track" cx="22" cy="22" r="19" />
            <circle
              className="readiness__value"
              cx="22"
              cy="22"
              r="19"
              // 2πr ≈ 119.4 — the dash gap is the unfilled remainder
              strokeDasharray={`${(assessment.score / 100) * 119.4} 119.4`}
            />
          </svg>
          <strong>{assessment.score}</strong>
        </div>
      </header>

      {assessment.summary && <p className="readiness__summary">{assessment.summary}</p>}

      {assessment.factors.length > 0 && (
        <div className="readiness__factors">
          <h4>{t('app.readiness.factorsTitle')}</h4>
          <ul>
            {assessment.factors.map((factor) => (
              <li key={factor.key + factor.label} className={`factor factor--${factor.status}`}>
                <span className="factor__head">
                  <Icon name={STATUS_ICON[factor.status] ?? 'info'} size={15} />
                  <strong>{factor.label}</strong>
                  <em>{Math.round(factor.score)}</em>
                </span>
                <span className="factor__bar">
                  <span style={{ width: `${Math.max(2, Math.min(100, factor.score))}%` }} />
                </span>
                <span className="factor__detail">{factor.detail}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {assessment.gaps.length > 0 && (
        <div className="readiness__gaps">
          <h4>{t('app.readiness.gapsTitle')}</h4>
          <ul>
            {assessment.gaps.map((gap) => (
              <li key={gap.id} className={`gap gap--${IMPORTANCE_TONE[gap.importance] ?? 'info'}`}>
                <div className="gap__head">
                  <strong>{gap.skill}</strong>
                  <span className="gap__tag">{t(`app.readiness.importance.${gap.importance}`)}</span>
                  {gap.estimatedWeeks ? (
                    <span className="gap__weeks">
                      <Icon name="clock" size={13} />
                      {t('app.readiness.weeks', { count: gap.estimatedWeeks })}
                    </span>
                  ) : null}
                </div>
                {(gap.currentLevel || gap.targetLevel) && (
                  <p className="gap__levels">
                    {gap.currentLevel && <span>{gap.currentLevel}</span>}
                    <Icon name="arrowRight" size={13} />
                    {gap.targetLevel && <strong>{gap.targetLevel}</strong>}
                  </p>
                )}
                {gap.why && <p className="gap__why">{gap.why}</p>}
                {gap.howToClose && (
                  <p className="gap__action">
                    <Icon name="bolt" size={14} />
                    {gap.howToClose}
                  </p>
                )}
              </li>
            ))}
          </ul>
        </div>
      )}
    </article>
  )
}
