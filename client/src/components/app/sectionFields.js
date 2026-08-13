/**
 * Field definitions for the editable profile sections.
 *
 * Kept as data next to the form that renders it, so adding a field is one entry
 * here rather than a new form component — and so the API schema and the UI stay
 * legibly in step.
 */

const CEFR = ['A1', 'A2', 'B1', 'B2', 'C1', 'C2', 'native'].map((v) => ({ value: v, label: v }))

const EMPLOYMENT_TYPES = [
  'full_time',
  'part_time',
  'contract',
  'internship',
  'apprenticeship',
  'freelance',
].map((v) => ({ value: v, labelKey: `app.edit.employment.${v}` }))

const SKILL_CATEGORIES = ['technical', 'tool', 'domain', 'soft', 'other'].map((v) => ({
  value: v,
  labelKey: `app.edit.skillCategory.${v}`,
}))

export const SECTION_FIELDS = {
  experiences: [
    { name: 'role', label: 'app.edit.f.role', required: true, maxLength: 160, wide: true },
    { name: 'company', label: 'app.edit.f.company', maxLength: 160 },
    { name: 'employmentType', label: 'app.edit.f.employmentType', type: 'select', options: EMPLOYMENT_TYPES },
    { name: 'location', label: 'app.edit.f.location', maxLength: 120 },
    { name: 'country', label: 'app.edit.f.country', maxLength: 80 },
    { name: 'startDate', label: 'app.edit.f.startDate', type: 'date' },
    { name: 'endDate', label: 'app.edit.f.endDate', type: 'date' },
    { name: 'isCurrent', label: 'app.edit.f.isCurrent', type: 'checkbox', hint: 'app.edit.f.isCurrentHint', wide: true },
    { name: 'description', label: 'app.edit.f.description', type: 'textarea', maxLength: 4000, wide: true },
    { name: 'skills', label: 'app.edit.f.skills', type: 'tags', wide: true },
  ],

  education: [
    { name: 'degree', label: 'app.edit.f.degree', maxLength: 160, wide: true },
    { name: 'field', label: 'app.edit.f.field', maxLength: 160, wide: true },
    { name: 'institution', label: 'app.edit.f.institution', maxLength: 160, wide: true },
    { name: 'country', label: 'app.edit.f.country', maxLength: 80 },
    { name: 'startYear', label: 'app.edit.f.startYear', type: 'number' },
    { name: 'endYear', label: 'app.edit.f.endYear', type: 'number' },
  ],

  certifications: [
    { name: 'name', label: 'app.edit.f.certName', required: true, maxLength: 200, wide: true },
    { name: 'issuer', label: 'app.edit.f.issuer', maxLength: 160, wide: true },
    { name: 'issuedOn', label: 'app.edit.f.issuedOn', type: 'date' },
    { name: 'expiresOn', label: 'app.edit.f.expiresOn', type: 'date' },
    { name: 'credentialId', label: 'app.edit.f.credentialId', maxLength: 120, wide: true },
  ],

  skills: [
    { name: 'name', label: 'app.edit.f.skillName', required: true, maxLength: 120, wide: true },
    { name: 'category', label: 'app.edit.f.category', type: 'select', options: SKILL_CATEGORIES },
    { name: 'years', label: 'app.edit.f.years', type: 'number' },
    { name: 'evidence', label: 'app.edit.f.evidence', type: 'textarea', maxLength: 500, wide: true },
  ],

  languages: [
    { name: 'language', label: 'app.edit.f.language', required: true, maxLength: 60, wide: true },
    { name: 'level', label: 'app.edit.f.level', type: 'select', options: CEFR },
    { name: 'certificate', label: 'app.edit.f.certificate', maxLength: 160 },
  ],
}

/** Turns an API row back into the form's value shape. */
export const toFormValues = (section, row) => {
  if (!row) return null
  const fields = SECTION_FIELDS[section] ?? []
  const values = { id: row.id }
  for (const f of fields) {
    const raw = row[f.name]
    if (f.type === 'checkbox') values[f.name] = Boolean(raw)
    else if (f.type === 'tags') values[f.name] = Array.isArray(raw) ? raw : []
    // A date input needs YYYY-MM-DD and nothing else; the API already returns
    // calendar dates as strings, so this only guards against a stray timestamp.
    else if (f.type === 'date') values[f.name] = raw ? String(raw).slice(0, 10) : ''
    else values[f.name] = raw ?? ''
  }
  return values
}
