import { Link } from 'react-router-dom'
import Icon from '../ui/Icon.jsx'
import { goalKeys } from '../../data/content.js'
import { useI18n } from '../../context/I18nContext.jsx'

/**
 * What the candidate is aiming at.
 *
 * Everything downstream — which readiness assessments run, which gaps matter,
 * which questions get asked — follows from this, so it is stated at the top of
 * the workspace rather than buried in settings. A candidate who has not chosen
 * one is shown the choice, not an empty space.
 */

const ICON_FOR = Object.fromEntries(goalKeys.map((g) => [g.key, g.icon]))

export default function ObjectiveBadge({ goals = [], to = '/settings' }) {
  const { t } = useI18n()

  if (!goals.length) {
    return (
      <Link to={to} className="objective objective--empty">
        <Icon name="target" size={14} />
        {t('app.dash.noObjective')}
        <Icon name="chevronRight" size={14} />
      </Link>
    )
  }

  return (
    <div className="objective">
      <span className="objective__label">
        {t(goals.length > 1 ? 'app.dash.objectives' : 'app.dash.objective')}
      </span>
      <span className="objective__items">
        {goals.map((goal) => (
          <span key={goal} className="objective__item">
            <Icon name={ICON_FOR[goal] ?? 'target'} size={14} />
            {t(`goals.items.${goal}.title`)}
          </span>
        ))}
      </span>
      <Link to={to} className="objective__change" aria-label={t('app.dash.changeObjective')}>
        <Icon name="pencil" size={13} />
      </Link>
    </div>
  )
}
