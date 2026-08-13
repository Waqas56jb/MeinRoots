/**
 * Database rows → API shapes.
 *
 * Kept in one file so the wire format is a deliberate contract rather than
 * whatever a SELECT * happened to return. Nothing snake_case ever reaches the
 * front end, and nothing internal (raw model names, extracted text) leaks with
 * it.
 */

export const presentSkill = (row) => ({
  id: row.id,
  name: row.name,
  category: row.category,
  years: row.years,
  evidence: row.evidence,
  isEvidenced: row.is_evidenced,
  confidence: row.confidence,
})

export const presentExperience = (row) => ({
  id: row.id,
  role: row.role,
  company: row.company,
  employmentType: row.employment_type,
  location: row.location,
  country: row.country,
  startDate: row.start_date,
  endDate: row.end_date,
  isCurrent: row.is_current,
  description: row.description,
  skills: row.skills ?? [],
  confidence: row.confidence,
})

export const presentEducation = (row) => ({
  id: row.id,
  institution: row.institution,
  degree: row.degree,
  field: row.field,
  country: row.country,
  startYear: row.start_year,
  endYear: row.end_year,
  likelyRecognisedInGermany: row.likely_recognised_in_de,
  confidence: row.confidence,
})

export const presentCertification = (row) => ({
  id: row.id,
  name: row.name,
  issuer: row.issuer,
  issuedOn: row.issued_on,
  expiresOn: row.expires_on,
  credentialId: row.credential_id,
  confidence: row.confidence,
})

export const presentLanguage = (row) => ({
  id: row.id,
  language: row.language,
  level: row.level,
  isSelfReported: row.is_self_reported,
  certificate: row.certificate,
  confidence: row.confidence,
})

export const presentGap = (row) => ({
  id: row.id,
  skill: row.skill,
  importance: row.importance,
  currentLevel: row.current_level,
  targetLevel: row.target_level,
  why: row.why,
  howToClose: row.how_to_close,
  estimatedWeeks: row.est_weeks,
  resourceHint: row.resource_hint,
})

export const presentAssessment = (row) => ({
  id: row.id,
  goal: row.goal,
  score: row.score,
  band: row.band,
  summary: row.summary,
  factors: row.factors ?? [],
  gaps: (row.gaps ?? []).map(presentGap),
  createdAt: row.created_at,
})

export const presentFlag = (row) => ({
  id: row.id,
  code: row.code,
  severity: row.severity,
  detail: row.detail,
  createdAt: row.created_at,
})

export const presentFullProfile = (data, locale = 'en') => {
  if (!data) return null
  const { profile } = data

  const domainLabel =
    { en: profile.domain_label_en, de: profile.domain_label_de, fr: profile.domain_label_fr }[locale] ??
    profile.domain_label_en

  return {
    id: profile.id,
    headline: profile.headline,
    summary: profile.summary,
    currentRole: profile.current_title,
    currentEmployer: profile.current_employer,
    totalExperienceMonths: profile.total_experience_months,
    country: profile.country,
    city: profile.city,
    willingToRelocate: profile.willing_to_relocate,
    noticePeriodWeeks: profile.notice_period_weeks,
    completeness: profile.completeness,
    reviewStatus: profile.review_status,
    extractionConfidence: profile.extraction_confidence,
    classification: profile.domain
      ? {
          domain: profile.domain,
          label: domainLabel,
          specialisation: profile.specialisation,
          seniority: profile.seniority,
          rationale: profile.classification_rationale,
          confidence: profile.classification_confidence,
        }
      : null,
    experiences: data.experiences.map(presentExperience),
    education: data.education.map(presentEducation),
    certifications: data.certifications.map(presentCertification),
    skills: data.skills.map(presentSkill),
    languages: data.languages.map(presentLanguage),
    assessments: data.assessments.map(presentAssessment),
    flags: data.flags.map(presentFlag),
    updatedAt: profile.updated_at,
  }
}

export const presentQuestion = (row) => ({
  id: row.id,
  key: row.key,
  question: row.question,
  helpText: row.help_text,
  inputType: row.input_type,
  options: row.options ?? [],
  isRequired: row.is_required,
  reason: row.reason,
  answer: row.answer ?? null,
  answeredAt: row.answered_at ?? null,
})
