import Icon from '../ui/Icon.jsx'
import { useI18n } from '../../context/I18nContext.jsx'

/** "2021-03-01" → "Mar 2021", in the reader's language. Null becomes "present". */
const useDateRange = () => {
  const { locale, t } = useI18n()
  return (start, end, isCurrent) => {
    const fmt = (value) => {
      if (!value) return null
      const [year, month] = value.split('-')
      const date = new Date(Number(year), Number(month) - 1, 1)
      return new Intl.DateTimeFormat(locale, { month: 'short', year: 'numeric' }).format(date)
    }
    const from = fmt(start)
    const to = isCurrent ? t('app.profile.present') : fmt(end)
    if (!from && !to) return t('app.profile.datesUnknown')
    return [from ?? '?', to ?? '?'].join(' – ')
  }
}

/**
 * A confidence badge, shown only when the extraction was genuinely unsure.
 * Decorating every line with a percentage would train people to ignore it.
 */
function Confidence({ value }) {
  const { t } = useI18n()
  if (value === null || value === undefined || value >= 0.7) return null
  return (
    <span className="conf" title={t('app.profile.lowConfidenceHint')}>
      <Icon name="alert" size={12} />
      {Math.round(value * 100)}%
    </span>
  )
}

export function ExperienceList({ items }) {
  const { t } = useI18n()
  const range = useDateRange()
  if (!items.length) return null

  return (
    <section className="pblock card">
      <h2><Icon name="layers" size={18} />{t('app.profile.experience')}</h2>
      <ol className="timeline">
        {items.map((item) => (
          <li key={item.id}>
            <span className="timeline__dot" aria-hidden="true" />
            <div className="timeline__body">
              <h3>
                {item.role}
                <Confidence value={item.confidence} />
              </h3>
              <p className="timeline__meta">
                {[item.company, item.location].filter(Boolean).join(' · ')}
                {item.company || item.location ? ' — ' : ''}
                {range(item.startDate, item.endDate, item.isCurrent)}
              </p>
              {item.description && <p className="timeline__text">{item.description}</p>}
              {item.skills?.length > 0 && (
                <ul className="chips chips--sm">
                  {item.skills.slice(0, 8).map((skill) => (
                    <li key={skill}>{skill}</li>
                  ))}
                </ul>
              )}
            </div>
          </li>
        ))}
      </ol>
    </section>
  )
}

export function EducationList({ items, certifications }) {
  const { t } = useI18n()
  if (!items.length && !certifications.length) return null

  return (
    <section className="pblock card">
      <h2><Icon name="graduation" size={18} />{t('app.profile.education')}</h2>

      {items.length > 0 && (
        <ul className="plain">
          {items.map((item) => (
            <li key={item.id}>
              <strong>
                {item.degree || t('app.profile.unnamedDegree')}
                {item.field ? ` — ${item.field}` : ''}
                <Confidence value={item.confidence} />
              </strong>
              <span>
                {[item.institution, item.country].filter(Boolean).join(' · ')}
                {item.endYear ? ` · ${item.startYear ? `${item.startYear}–` : ''}${item.endYear}` : ''}
              </span>
              {/* Recognition of a foreign degree decides a lot in Germany, so
                  the platform's best guess is surfaced rather than buried. */}
              {item.likelyRecognisedInGermany === true && (
                <span className="pill pill--good">
                  <Icon name="check" size={12} />{t('app.profile.recognised')}
                </span>
              )}
              {item.likelyRecognisedInGermany === false && (
                <span className="pill pill--warn">
                  <Icon name="info" size={12} />{t('app.profile.recognitionUnclear')}
                </span>
              )}
            </li>
          ))}
        </ul>
      )}

      {certifications.length > 0 && (
        <>
          <h3 className="pblock__sub">{t('app.profile.certifications')}</h3>
          <ul className="plain">
            {certifications.map((c) => (
              <li key={c.id}>
                <strong>{c.name}<Confidence value={c.confidence} /></strong>
                <span>{[c.issuer, c.issuedOn?.slice(0, 4)].filter(Boolean).join(' · ')}</span>
              </li>
            ))}
          </ul>
        </>
      )}
    </section>
  )
}

export function SkillsBlock({ skills }) {
  const { t } = useI18n()
  if (!skills.length) return null

  const evidenced = skills.filter((s) => s.isEvidenced)
  const claimed = skills.filter((s) => !s.isEvidenced)

  return (
    <section className="pblock card">
      <h2><Icon name="sparkle" size={18} />{t('app.profile.skills')}</h2>

      {evidenced.length > 0 && (
        <>
          <p className="pblock__hint">{t('app.profile.evidencedHint')}</p>
          <ul className="chips">
            {evidenced.map((s) => (
              <li key={s.id} className="is-evidenced" title={s.evidence || undefined}>
                <Icon name="check" size={12} />
                {s.name}
                {s.years ? <em>{t('app.profile.years', { count: s.years })}</em> : null}
              </li>
            ))}
          </ul>
        </>
      )}

      {claimed.length > 0 && (
        <>
          <p className="pblock__hint">{t('app.profile.claimedHint')}</p>
          <ul className="chips">
            {claimed.map((s) => (
              <li key={s.id}>{s.name}</li>
            ))}
          </ul>
        </>
      )}
    </section>
  )
}

export function LanguagesBlock({ languages }) {
  const { t } = useI18n()
  if (!languages.length) return null

  return (
    <section className="pblock card">
      <h2><Icon name="translate" size={18} />{t('app.profile.languages')}</h2>
      <ul className="langs">
        {languages.map((l) => (
          <li key={l.id}>
            <strong>{l.language}</strong>
            <span className={`pill ${l.level ? 'pill--good' : 'pill--warn'}`}>
              {l.level ?? t('app.profile.levelUnknown')}
            </span>
            {l.certificate && <em>{l.certificate}</em>}
            {!l.certificate && l.level && (
              <em className="langs__self">{t('app.profile.selfReported')}</em>
            )}
          </li>
        ))}
      </ul>
    </section>
  )
}
