import { Link } from 'react-router-dom'
import Icon from '../ui/Icon.jsx'
import { journeySteps } from './insight.js'
import { useI18n } from '../../context/I18nContext.jsx'

/**
 * Where the candidate is in the process.
 *
 * The people using this are often waiting on something they cannot see — an
 * analysis, a reviewer — and the anxiety in that gap is the interface's problem
 * to solve. Showing the whole sequence with a truthful state on each step turns
 * "nothing is happening" into "three of seven done, one in progress".
 *
 * Every state is proved by data. A step is never marked complete because the
 * step before it was.
 */

const STATE_ICON = { done: 'check', active: 'dot', attention: 'alert', pending: null }

export default function JourneyProgress({ steps: given, ...source }) {
  const { t } = useI18n()
  const steps = given ?? journeySteps(source)
  const done = steps.filter((s) => s.state === 'done').length

  return (
    <section className="journey">
      <div className="journey__head">
        <h2 className="journey__title">{t('app.journey.title')}</h2>
        <span className="journey__count num">
          {t('app.journey.progress', { done, total: steps.length })}
        </span>
      </div>

      <ol className="journey__list">
        {steps.map((step) => {
          const icon = STATE_ICON[step.state]
          const label = t(`app.journey.steps.${step.key}`)

          // The review step is the only one whose wording depends on an outcome
          // rather than on whether it has happened.
          const note =
            step.key === 'review' && step.status
              ? t(`app.journey.review.${step.status}`)
              : step.key === 'questions' && step.state === 'active'
                ? t('app.journey.questionsLeft', { count: step.count })
                : step.note

          const body = (
            <>
              <span className={`journey__mark journey__mark--${step.state}`} aria-hidden="true">
                {icon && <Icon name={icon} size={step.state === 'active' ? 9 : 13} />}
              </span>
              <span className="journey__body">
                <strong>{label}</strong>
                {note && <small>{note}</small>}
              </span>
              {/* The state is spelled out for anyone who cannot use the colour
                  or the icon shape to tell these apart. */}
              <span className="journey__state">{t(`app.journey.state.${step.state}`)}</span>
            </>
          )

          return (
            <li key={step.key} className={`journey__step is-${step.state}`}>
              {step.to ? (
                <Link to={step.to} className="journey__row">{body}</Link>
              ) : (
                <span className="journey__row">{body}</span>
              )}
            </li>
          )
        })}
      </ol>
    </section>
  )
}
