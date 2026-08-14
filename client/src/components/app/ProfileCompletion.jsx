import { Link } from 'react-router-dom'
import Icon from '../ui/Icon.jsx'
import { completenessChecks } from './insight.js'
import { useI18n } from '../../context/I18nContext.jsx'

/**
 * How complete the profile is, and what would finish it.
 *
 * The percentage on its own tells a candidate they are unfinished without
 * telling them what to do, so the missing items are named. Only the missing
 * ones: listing the eight things already done turns a nudge into a chore list,
 * and the candidate came here to find the two things they can act on.
 *
 * The checks are the server's own, so the count always agrees with the number.
 */
export default function ProfileCompletion({ profile, outstandingQuestions, compact = false }) {
  const { t } = useI18n()
  const checks = completenessChecks({ profile, outstandingQuestions })
  const missing = checks.filter((c) => !c.done)
  const value = Math.max(0, Math.min(100, Number(profile?.completeness) || 0))
  const tone = value >= 80 ? 'ok' : value >= 50 ? 'brand' : 'warn'

  return (
    <section className={`pcomp pcomp--${tone}`}>
      <div className="pcomp__top">
        <div>
          <h2 className="pcomp__title">{t('app.dash.completeTitle')}</h2>
          <p className="pcomp__read">
            {t(
              value >= 100
                ? 'app.complete.read.done'
                : value >= 80
                  ? 'app.complete.read.almost'
                  : value >= 50
                    ? 'app.complete.read.half'
                    : 'app.complete.read.early',
            )}
          </p>
        </div>
        <strong className="pcomp__value num">
          {value}
          <small>%</small>
        </strong>
      </div>

      <div
        className="pcomp__track"
        role="progressbar"
        aria-valuenow={value}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-label={t('app.dash.completeTitle')}
      >
        <span className="pcomp__fill" style={{ width: `${Math.max(2, value)}%` }} />
      </div>

      {missing.length > 0 ? (
        <>
          <h3 className="pcomp__sub">
            {t('app.complete.missingTitle', { count: missing.length })}
          </h3>
          <ul className="pcomp__list">
            {(compact ? missing.slice(0, 3) : missing).map((c) => (
              <li key={c.key}>
                <Link to={c.to}>
                  <span className="pcomp__mark" aria-hidden="true" />
                  <span>{t(`app.complete.checks.${c.key}`)}</span>
                  <Icon name="chevronRight" size={15} />
                </Link>
              </li>
            ))}
          </ul>
          {compact && missing.length > 3 && (
            <p className="pcomp__more">{t('app.complete.more', { count: missing.length - 3 })}</p>
          )}
        </>
      ) : (
        <p className="pcomp__allDone">
          <Icon name="checkCircle" size={15} />
          {t('app.complete.allDone')}
        </p>
      )}
    </section>
  )
}
