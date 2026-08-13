/**
 * JSON schemas for OpenAI structured outputs.
 *
 * Strict mode has rules that are easy to trip over and produce a 400 at call
 * time rather than a bad result:
 *   * every object needs additionalProperties: false
 *   * every declared property must appear in `required` — "optional" is
 *     expressed as a nullable type, not by leaving it out
 *   * no format/pattern keywords, so dates are described in the prompt instead
 *
 * Confidence is asked for on every extracted block. It is what lets the admin
 * console show only the profiles that actually need a human, which is the
 * point of Milestone 1.
 */

const nullableString = { type: ['string', 'null'] }
const nullableNumber = { type: ['number', 'null'] }
const nullableBoolean = { type: ['boolean', 'null'] }
const confidence = { type: 'number', description: '0.0–1.0 confidence in this block' }

const obj = (properties) => ({
  type: 'object',
  additionalProperties: false,
  required: Object.keys(properties),
  properties,
})

// ------------------------------ CV extraction --------------------------------

export const cvExtractionSchema = obj({
  detectedLanguage: {
    type: 'string',
    enum: ['en', 'de', 'fr', 'other'],
    description: 'Language the CV is actually written in',
  },
  languageConfidence: confidence,
  fullName: nullableString,
  headline: { ...nullableString, description: 'Short professional title, e.g. "Registered Nurse"' },
  summary: { ...nullableString, description: '2–3 sentence factual summary. No marketing language.' },
  currentRole: nullableString,
  currentEmployer: nullableString,
  country: { ...nullableString, description: 'Country the candidate currently lives in' },
  city: nullableString,
  totalExperienceMonths: {
    ...nullableNumber,
    description: 'Total professional experience in months, excluding internships and study',
  },
  experiences: {
    type: 'array',
    description: 'Work history, most recent first',
    items: obj({
      role: { type: 'string' },
      company: nullableString,
      employmentType: {
        type: ['string', 'null'],
        description: 'full_time, part_time, contract, internship, apprenticeship (Ausbildung), freelance',
      },
      location: nullableString,
      country: nullableString,
      startDate: { ...nullableString, description: 'YYYY-MM-DD; use the 1st when only a month is given' },
      endDate: { ...nullableString, description: 'YYYY-MM-DD, or null when this is the current role' },
      isCurrent: { type: 'boolean' },
      description: { ...nullableString, description: 'What they actually did, condensed to 1–3 sentences' },
      skills: { type: 'array', items: { type: 'string' }, description: 'Skills evidenced by this role' },
      confidence,
    }),
  },
  education: {
    type: 'array',
    items: obj({
      institution: nullableString,
      degree: nullableString,
      field: nullableString,
      country: nullableString,
      startYear: nullableNumber,
      endYear: nullableNumber,
      likelyRecognisedInGermany: {
        ...nullableBoolean,
        description: 'Best guess whether this qualification is likely recognisable in Germany. Null if unsure.',
      },
      confidence,
    }),
  },
  certifications: {
    type: 'array',
    items: obj({
      name: { type: 'string' },
      issuer: nullableString,
      issuedOn: { ...nullableString, description: 'YYYY-MM-DD or null' },
      expiresOn: { ...nullableString, description: 'YYYY-MM-DD or null' },
      credentialId: nullableString,
      confidence,
    }),
  },
  skills: {
    type: 'array',
    description: 'Deduplicated. Prefer specific ("Kubernetes") over vague ("cloud").',
    items: obj({
      name: { type: 'string' },
      category: { type: 'string', enum: ['technical', 'tool', 'domain', 'soft', 'other'] },
      years: nullableNumber,
      evidence: {
        ...nullableString,
        description: 'Where in the CV this is demonstrated. Null when it is only claimed in a skills list.',
      },
      isEvidenced: {
        type: 'boolean',
        description: 'True only when a role or project actually demonstrates it',
      },
      confidence,
    }),
  },
  languages: {
    type: 'array',
    items: obj({
      language: { type: 'string', description: 'English name of the language, e.g. "German"' },
      level: { type: ['string', 'null'], enum: ['A1', 'A2', 'B1', 'B2', 'C1', 'C2', 'native', null] },
      certificate: nullableString,
      isSelfReported: { type: 'boolean' },
      confidence,
    }),
  },
  overallConfidence: { ...confidence, description: 'How well this CV could be read overall' },
  readabilityIssues: {
    type: 'array',
    items: { type: 'string' },
    description: 'Anything that blocked extraction: missing dates, scanned pages, unclear roles',
  },
})

// ----------------------------- classification --------------------------------

export const classificationSchema = obj({
  domain: { type: 'string', description: 'One code from the provided list. Use "other" only as a last resort.' },
  specialisation: { ...nullableString, description: 'Narrower field, e.g. "Backend engineering", "Intensive care"' },
  seniority: { type: 'string', enum: ['entry', 'junior', 'mid', 'senior', 'lead', 'unknown'] },
  rationale: { type: 'string', description: 'One or two sentences citing the evidence used' },
  confidence,
})

// ------------------------------- readiness -----------------------------------

export const readinessSchema = obj({
  score: { type: 'number', description: 'Integer 0–100' },
  band: { type: 'string', enum: ['not_ready', 'developing', 'nearly_ready', 'ready'] },
  summary: { type: 'string', description: '2–3 sentences, addressed to the candidate, plain and specific' },
  factors: {
    type: 'array',
    description: 'The reasons behind the score. This is what the candidate is shown instead of a bare number.',
    items: obj({
      key: { type: 'string', enum: ['experience', 'skills', 'language', 'education', 'authorisation', 'evidence'] },
      label: { type: 'string' },
      weight: { type: 'number', description: '0.0–1.0, weights across all factors sum to about 1' },
      score: { type: 'number', description: '0–100 for this factor alone' },
      status: { type: 'string', enum: ['strong', 'adequate', 'weak', 'unknown'] },
      detail: { type: 'string', description: 'Why this factor scored as it did, citing the profile' },
    }),
  },
  gaps: {
    type: 'array',
    description: 'Concrete, closeable gaps. Never generic advice like "improve communication".',
    items: obj({
      skill: { type: 'string' },
      importance: { type: 'string', enum: ['critical', 'important', 'nice_to_have'] },
      currentLevel: nullableString,
      targetLevel: nullableString,
      why: { type: 'string', description: 'Why this blocks the chosen goal specifically' },
      howToClose: { type: 'string', description: 'A concrete first action' },
      estimatedWeeks: nullableNumber,
      resourceHint: { ...nullableString, description: 'Type of resource, not a URL' },
    }),
  },
})

// ----------------------------- questionnaire ---------------------------------

export const questionnaireSchema = obj({
  questions: {
    type: 'array',
    description: 'Only what the CV could not answer. Never ask for something already extracted.',
    items: obj({
      key: { type: 'string', description: 'snake_case identifier, stable across regenerations' },
      question: { type: 'string' },
      helpText: nullableString,
      inputType: {
        type: 'string',
        enum: ['text', 'long_text', 'single_select', 'multi_select', 'boolean', 'number', 'date'],
      },
      options: {
        type: 'array',
        items: obj({ value: { type: 'string' }, label: { type: 'string' } }),
        description: 'Empty unless inputType is single_select or multi_select',
      },
      isRequired: { type: 'boolean' },
      reason: { type: 'string', description: 'Shown to the candidate so the question never feels arbitrary' },
    }),
  },
})

// ------------------------------ translation ----------------------------------

export const translationSchema = obj({
  content: { type: 'string', description: 'The complete CV in the target language, as markdown' },
  notes: {
    type: 'array',
    items: { type: 'string' },
    description: 'Terms deliberately left untranslated, e.g. Ausbildung, or degree names',
  },
})
