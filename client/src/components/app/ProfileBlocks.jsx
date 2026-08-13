import { useState } from 'react'
import Icon from '../ui/Icon.jsx'
import EditableSection from './EditableSection.jsx'
import { SECTION_FIELDS, toFormValues } from './sectionFields.js'
import { useI18n } from '../../context/I18nContext.jsx'
import { profileApi } from '../../lib/api.js'

/** "2021-03-01" → "Mar 2021", in the reader's language. Null becomes "present". */
const useDateRange = () => {
  const { locale, t } = useI18n()
  return (start, end, isCurrent) => {
    const fmt = (value) => {
      if (!value) return null
      const [year, month] = String(value).split('-')
      if (!year) return null
      return new Intl.DateTimeFormat(locale, { month: 'short', year: 'numeric' }).format(
        new Date(Number(year), Number(month || 1) - 1, 1),
      )
    }
    const from = fmt(start)
    const to = isCurrent ? t('app.profile.present') : fmt(end)
    if (!from && !to) return t('app.profile.datesUnknown')
    return [from ?? '?', to ?? '?'].join(' – ')
  }
}

/**
 * A confidence badge, shown only when the extraction was genuinely unsure, and
 * never on a row a person has already corrected — at that point the extractor's
 * uncertainty is no longer about anything.
 */
function Provenance({ row }) {
  const { t } = useI18n()
  if (row.source === 'candidate') {
    return (
      <span className="prov prov--mine" title={t('app.edit.editedHint')}>
        <Icon name="check" size={11} />{t('app.edit.edited')}
      </span>
    )
  }
  if (row.confidence === null || row.confidence === undefined || row.confidence >= 0.7) return null
  return (
    <span className="prov prov--low" title={t('app.profile.lowConfidenceHint')}>
      <Icon name="alert" size={11} />{Math.round(row.confidence * 100)}%
    </span>
  )
}

/**
 * Shared wrapper: renders the section, its add button, and the inline form when
 * something is being edited. `editable` is false on the admin side, where the
 * same blocks are read-only.
 */
function Section({ icon, title, section, editable, onSaved, children, empty }) {
  const { t } = useI18n()
  const [adding, setAdding] = useState(false)

  return (
    <section className="pblock card">
      <div className="pblock__head">
        <h2><Icon name={icon} size={18} />{title}</h2>
        {editable && !adding && (
          <button type="button" className="btn btn--ghost btn--sm" onClick={() => setAdding(true)}>
            <Icon name="plus" size={15} /> {t('app.edit.add')}
          </button>
        )}
      </div>

      {adding && (
        <EditableSection
          section={section}
          fields={SECTION_FIELDS[section]}
          initial={null}
          onCancel={() => setAdding(false)}
          onSaved={(profile) => {
            setAdding(false)
            onSaved(profile)
          }}
        />
      )}

      {children}
      {empty && !adding && <p className="pblock__hint">{empty}</p>}
    </section>
  )
}

/** Edit / delete controls for one row. */
function RowActions({ section, row, onSaved, onEdit }) {
  const { t } = useI18n()
  const [confirming, setConfirming] = useState(false)
  const [busy, setBusy] = useState(false)

  const remove = async () => {
    setBusy(true)
    try {
      await profileApi.deleteEntry(section, row.id)
      // Delete returns 204, so there is no profile to re-render from — ask for it.
      const data = await profileApi.me()
      onSaved(data.profile)
    } finally {
      setBusy(false)
    }
  }

  if (confirming) {
    return (
      <span className="rowact rowact--confirm">
        <span>{t('app.edit.confirmDelete')}</span>
        <button type="button" className="btn btn--ghost btn--sm" onClick={() => setConfirming(false)} disabled={busy}>
          {t('app.edit.cancel')}
        </button>
        <button type="button" className="btn btn--danger btn--sm" onClick={remove} disabled={busy}>
          {t('app.edit.delete')}
        </button>
      </span>
    )
  }

  return (
    <span className="rowact">
      <button type="button" onClick={onEdit} aria-label={t('app.edit.edit')} title={t('app.edit.edit')}>
        <Icon name="pencil" size={15} />
      </button>
      <button type="button" onClick={() => setConfirming(true)} aria-label={t('app.edit.delete')} title={t('app.edit.delete')}>
        <Icon name="trash" size={15} />
      </button>
    </span>
  )
}

export function ExperienceList({ items, editable = false, onSaved }) {
  const { t } = useI18n()
  const range = useDateRange()
  const [editingId, setEditingId] = useState(null)

  return (
    <Section
      icon="layers"
      title={t('app.profile.experience')}
      section="experiences"
      editable={editable}
      onSaved={onSaved}
      empty={items.length ? null : t('app.edit.emptyExperience')}
    >
      {items.length > 0 && (
        <ol className="timeline">
          {items.map((item) => (
            <li key={item.id}>
              <span className="timeline__dot" aria-hidden="true" />
              {editingId === item.id ? (
                <EditableSection
                  section="experiences"
                  fields={SECTION_FIELDS.experiences}
                  initial={toFormValues('experiences', item)}
                  onCancel={() => setEditingId(null)}
                  onSaved={(profile) => {
                    setEditingId(null)
                    onSaved(profile)
                  }}
                />
              ) : (
                <div className="timeline__body">
                  <h3>
                    {item.role}
                    <Provenance row={item} />
                    {editable && (
                      <RowActions section="experiences" row={item} onSaved={onSaved} onEdit={() => setEditingId(item.id)} />
                    )}
                  </h3>
                  <p className="timeline__meta">
                    {[item.company, item.location].filter(Boolean).join(' · ')}
                    {item.company || item.location ? ' — ' : ''}
                    {range(item.startDate, item.endDate, item.isCurrent)}
                  </p>
                  {item.description && <p className="timeline__text">{item.description}</p>}
                  {item.skills?.length > 0 && (
                    <ul className="chips chips--sm">
                      {item.skills.slice(0, 10).map((skill) => (
                        <li key={skill}>{skill}</li>
                      ))}
                    </ul>
                  )}
                </div>
              )}
            </li>
          ))}
        </ol>
      )}
    </Section>
  )
}

export function EducationList({ items, certifications, editable = false, onSaved }) {
  const { t } = useI18n()
  const [editing, setEditing] = useState(null) // { section, id }

  const renderRow = (section, row, primary, secondary, extra) =>
    editing?.section === section && editing?.id === row.id ? (
      <li key={row.id}>
        <EditableSection
          section={section}
          fields={SECTION_FIELDS[section]}
          initial={toFormValues(section, row)}
          onCancel={() => setEditing(null)}
          onSaved={(profile) => {
            setEditing(null)
            onSaved(profile)
          }}
        />
      </li>
    ) : (
      <li key={row.id}>
        <strong>
          {primary}
          <Provenance row={row} />
          {editable && (
            <RowActions section={section} row={row} onSaved={onSaved} onEdit={() => setEditing({ section, id: row.id })} />
          )}
        </strong>
        <span>{secondary}</span>
        {extra}
      </li>
    )

  return (
    <>
      <Section
        icon="graduation"
        title={t('app.profile.education')}
        section="education"
        editable={editable}
        onSaved={onSaved}
        empty={items.length ? null : t('app.edit.emptyEducation')}
      >
        {items.length > 0 && (
          <ul className="plain">
            {items.map((item) =>
              renderRow(
                'education',
                item,
                `${item.degree || t('app.profile.unnamedDegree')}${item.field ? ` — ${item.field}` : ''}`,
                [item.institution, item.country, item.endYear].filter(Boolean).join(' · '),
                <>
                  {item.likelyRecognisedInGermany === true && (
                    <span className="pill pill--good"><Icon name="check" size={12} />{t('app.profile.recognised')}</span>
                  )}
                  {item.likelyRecognisedInGermany === false && (
                    <span className="pill pill--warn"><Icon name="info" size={12} />{t('app.profile.recognitionUnclear')}</span>
                  )}
                </>,
              ),
            )}
          </ul>
        )}
      </Section>

      <Section
        icon="clipboard"
        title={t('app.profile.certifications')}
        section="certifications"
        editable={editable}
        onSaved={onSaved}
        empty={certifications.length ? null : t('app.edit.emptyCertifications')}
      >
        {certifications.length > 0 && (
          <ul className="plain">
            {certifications.map((c) =>
              renderRow(
                'certifications',
                c,
                c.name,
                [c.issuer, c.issuedOn?.slice(0, 4)].filter(Boolean).join(' · '),
              ),
            )}
          </ul>
        )}
      </Section>
    </>
  )
}

export function SkillsBlock({ skills, editable = false, onSaved }) {
  const { t } = useI18n()
  const [editingId, setEditingId] = useState(null)

  const evidenced = skills.filter((s) => s.isEvidenced)
  const claimed = skills.filter((s) => !s.isEvidenced)
  const editingRow = skills.find((s) => s.id === editingId)

  const chip = (s) => (
    <li key={s.id} className={s.isEvidenced ? 'is-evidenced' : ''} title={s.evidence || undefined}>
      {s.isEvidenced && <Icon name="check" size={12} />}
      {s.name}
      {s.years ? <em>{t('app.profile.years', { count: s.years })}</em> : null}
      {editable && (
        <button
          type="button"
          className="chips__edit"
          onClick={() => setEditingId(s.id)}
          aria-label={t('app.edit.edit')}
        >
          <Icon name="pencil" size={11} />
        </button>
      )}
    </li>
  )

  return (
    <Section
      icon="sparkle"
      title={t('app.profile.skills')}
      section="skills"
      editable={editable}
      onSaved={onSaved}
      empty={skills.length ? null : t('app.edit.emptySkills')}
    >
      {editingRow && (
        <EditableSection
          section="skills"
          fields={SECTION_FIELDS.skills}
          initial={toFormValues('skills', editingRow)}
          onCancel={() => setEditingId(null)}
          onSaved={(profile) => {
            setEditingId(null)
            onSaved(profile)
          }}
        />
      )}

      {evidenced.length > 0 && (
        <>
          <p className="pblock__hint">{t('app.profile.evidencedHint')}</p>
          <ul className="chips">{evidenced.map(chip)}</ul>
        </>
      )}

      {claimed.length > 0 && (
        <>
          <p className="pblock__hint">{t('app.profile.claimedHint')}</p>
          <ul className="chips">{claimed.map(chip)}</ul>
        </>
      )}
    </Section>
  )
}

export function LanguagesBlock({ languages, editable = false, onSaved }) {
  const { t } = useI18n()
  const [editingId, setEditingId] = useState(null)

  return (
    <Section
      icon="translate"
      title={t('app.profile.languages')}
      section="languages"
      editable={editable}
      onSaved={onSaved}
      empty={languages.length ? null : t('app.edit.emptyLanguages')}
    >
      {languages.length > 0 && (
        <ul className="langs">
          {languages.map((l) =>
            editingId === l.id ? (
              <li key={l.id} className="langs__editing">
                <EditableSection
                  section="languages"
                  fields={SECTION_FIELDS.languages}
                  initial={toFormValues('languages', l)}
                  onCancel={() => setEditingId(null)}
                  onSaved={(profile) => {
                    setEditingId(null)
                    onSaved(profile)
                  }}
                />
              </li>
            ) : (
              <li key={l.id}>
                <strong>{l.language}</strong>
                <span className={`pill ${l.level ? 'pill--good' : 'pill--warn'}`}>
                  {l.level ?? t('app.profile.levelUnknown')}
                </span>
                {l.certificate && <em>{l.certificate}</em>}
                {!l.certificate && l.level && <em className="langs__self">{t('app.profile.selfReported')}</em>}
                {editable && (
                  <RowActions section="languages" row={l} onSaved={onSaved} onEdit={() => setEditingId(l.id)} />
                )}
              </li>
            ),
          )}
        </ul>
      )}
    </Section>
  )
}
