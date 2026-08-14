import { Link } from 'react-router-dom'
import Icon from '../ui/Icon.jsx'
import { useI18n } from '../../context/I18nContext.jsx'

/**
 * The one thing to do next.
 *
 * A list of fifteen equally-weighted suggestions is a way of not deciding. The
 * candidate arrives wanting to know what to do, so one action is given the
 * weight of a decision — with the reason attached, because an instruction
 * without a reason is just a chore — and the rest are demoted to a quiet
 * secondary list.
 *
 * Every item comes from buildRecommendations(), which derives them from fields
 * that are genuinely empty and gaps the assessment genuinely produced. Nothing
 * here is generated to fill the space.
 */

/** Where the action leads decides what the button says. */
const CTA_FOR = {
  '/cv': 'cv',
  '/profile': 'profile',
  '/readiness': 'readiness',
  '/questionnaire': 'questionnaire',
  '/settings': 'settings',
}

const useCopy = () => {
  const { t } = useI18n()
  return (r) => ({
    title: r.gap
      ? t('app.recommendations.items.close_gap.title', { skill: r.gap.skill })
      : t(`app.recommendations.items.${r.key}.title`, { count: r.count }),
    // A gap explains itself; a missing field is explained by the dictionary.
    why: r.gap ? r.gap.why || r.gap.howToClose : t(`app.recommendations.items.${r.key}.text`, { count: r.count }),
    action: r.gap ? r.gap.howToClose : null,
    cta: t(`app.next.goto.${CTA_FOR[r.to] ?? 'profile'}`),
  })
}

export default function NextBestAction({ items = [], limit = 3 }) {
  const { t } = useI18n()
  const copy = useCopy()

  if (!items.length) {
    return (
      <section className="nba nba--done">
        <span className="nba__doneIcon"><Icon name="checkCircle" size={22} /></span>
        <div>
          <h2>{t('app.recommendations.allDone')}</h2>
          <p>{t('app.recommendations.allDoneText')}</p>
        </div>
        <Link to="/readiness" className="btn btn--ghost btn--sm">
          {t('app.next.goto.readiness')} <Icon name="arrowRight" size={14} />
        </Link>
      </section>
    )
  }

  const [primary, ...rest] = items
  const secondary = rest.slice(0, limit)
  const first = copy(primary)

  return (
    <section className={`nba nba--${primary.priority}`}>
      <div className="nba__lead">
        <span className="nba__eyebrow">
          <Icon name="bolt" size={13} />
          {t('app.next.title')}
        </span>
        <h2>{first.title}</h2>

        {first.why && (
          <div className="nba__why">
            <strong>{t('app.next.why')}</strong>
            <p>{first.why}</p>
          </div>
        )}

        {/* A gap carries its own remedy; showing it turns the panel from a
            diagnosis into an instruction. */}
        {first.action && first.action !== first.why && (
          <p className="nba__action">
            <Icon name="arrowUpRight" size={14} />
            {first.action}
          </p>
        )}

        <Link to={primary.to} className="btn btn--primary nba__cta">
          {first.cta} <Icon name="arrowRight" size={16} />
        </Link>
      </div>

      {secondary.length > 0 && (
        <div className="nba__rest">
          <h3 className="nba__restTitle">{t('app.next.alsoTitle')}</h3>
          <ul>
            {secondary.map((r, i) => {
              const c = copy(r)
              return (
                <li key={`${r.key}-${i}`}>
                  <Link to={r.to}>
                    <span className={`nba__dot nba__dot--${r.priority}`} aria-hidden="true" />
                    <span className="nba__restBody">
                      <strong>{c.title}</strong>
                      <small>{c.why}</small>
                    </span>
                    <Icon name="chevronRight" size={16} />
                  </Link>
                </li>
              )
            })}
          </ul>
        </div>
      )}
    </section>
  )
}
