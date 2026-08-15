import { Link } from 'react-router-dom'
import Icon from './Icon.jsx'
import { Badge, Readiness, RequestStatus } from './ui.jsx'
import { useI18n } from '../context/I18nContext.jsx'

/**
 * One candidate, as a recruiter is allowed to see them.
 *
 * The card renders whatever the server sent and nothing more. There is no
 * "hidden" name held in a prop and covered over — anything a recruiter is not
 * entitled to see never reaches the browser, so the reference number is not a
 * mask over an identity, it is the identity as far as this application knows.
 *
 * That is the only version of this that protects anybody. A blurred name in the
 * DOM is a name anyone can read with the developer tools open.
 */

const monthsToYears = (months, t) => {
  if (months === null || months === undefined) return null
  const years = Math.floor(months / 12)
  return years >= 1 ? t('candidates.yearsExp', { count: years }) : t('candidates.underYear')
}

export default function CandidateCard({ candidate: c, onSave, onRequest, saving }) {
  const { t } = useI18n()
  const experience = monthsToYears(c.experienceMonths, t)

  return (
    <article className="ccard">
      <div className="ccard__top">
        <div className="ccard__id">
          {/* The reference is the candidate's public handle, so it is set as an
              identifier rather than as body text. */}
          <span className="ccard__ref">{c.reference ?? `#${c.id}`}</span>
          <h3>{c.profession ?? t('candidates.professionUnknown')}</h3>
          {c.specialisation && <p className="ccard__spec">{c.specialisation}</p>}
        </div>
        <Readiness value={c.readiness} />
      </div>

      <dl className="ccard__facts">
        {experience && (
          <div>
            <dt>{t('candidates.experience')}</dt>
            <dd>{experience}</dd>
          </div>
        )}
        {c.germanLevel && (
          <div>
            <dt>{t('candidates.german')}</dt>
            <dd>{c.germanLevel}</dd>
          </div>
        )}
        {c.location && (
          <div>
            <dt>{t('candidates.location')}</dt>
            <dd>{c.location}</dd>
          </div>
        )}
        {c.workAuthorisation && (
          <div>
            <dt>{t('candidates.workAuth')}</dt>
            <dd>{t(`candidates.auth.${c.workAuthorisation}`)}</dd>
          </div>
        )}
      </dl>

      {c.skills?.length > 0 && (
        <ul className="ccard__skills">
          {c.skills.slice(0, 6).map((s) => (
            <li key={typeof s === 'string' ? s : s.name}>{typeof s === 'string' ? s : s.name}</li>
          ))}
          {c.skills.length > 6 && <li className="is-more">+{c.skills.length - 6}</li>}
        </ul>
      )}

      {c.goals?.length > 0 && (
        <div className="ccard__goals">
          {c.goals.map((g) => (
            <Badge key={g} icon="target">{t(`goals.${g}`)}</Badge>
          ))}
        </div>
      )}

      <div className="ccard__foot">
        <Link to={`/candidates/${c.id}`} className="btn btn--ghost btn--sm">
          {t('candidates.viewProfile')}
        </Link>

        {c.requestState ? (
          <RequestStatus status={c.requestState} />
        ) : (
          onRequest && (
            <button type="button" className="btn btn--primary btn--sm" onClick={() => onRequest(c)}>
              <Icon name="message" size={15} /> {t('candidates.requestContact')}
            </button>
          )
        )}

        {onSave && (
          <button
            type="button"
            className={`ccard__save ${c.isSaved ? 'is-on' : ''}`}
            onClick={() => onSave(c)}
            disabled={saving}
            aria-pressed={Boolean(c.isSaved)}
            aria-label={t(c.isSaved ? 'candidates.unsave' : 'candidates.save')}
            title={t(c.isSaved ? 'candidates.unsave' : 'candidates.save')}
          >
            <Icon name="bookmark" size={17} />
          </button>
        )}
      </div>
    </article>
  )
}
