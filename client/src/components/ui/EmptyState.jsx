import { Link } from 'react-router-dom'
import Icon from './Icon.jsx'

/**
 * The third state every async screen needs, alongside loading and error.
 * Without it a candidate who has not uploaded a CV sees a page of empty boxes
 * and no idea what to do next.
 */
export default function EmptyState({ icon = 'file', title, text, actionLabel, actionTo, onAction, tone }) {
  return (
    <div className={`empty ${tone ? `empty--${tone}` : ''}`}>
      <span className="empty__icon"><Icon name={icon} size={26} /></span>
      <h3>{title}</h3>
      {text && <p>{text}</p>}
      {actionLabel && actionTo && (
        <Link to={actionTo} className="btn btn--primary">
          {actionLabel} <Icon name="arrowRight" />
        </Link>
      )}
      {actionLabel && onAction && !actionTo && (
        <button type="button" className="btn btn--primary" onClick={onAction}>
          {actionLabel} <Icon name="arrowRight" />
        </button>
      )}
    </div>
  )
}
