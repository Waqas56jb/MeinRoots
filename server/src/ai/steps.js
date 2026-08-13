import config from '../config.js'
import { many } from '../db/pool.js'
import { complete, trimForModel } from './client.js'
import {
  classificationSchema,
  cvExtractionSchema,
  questionnaireSchema,
  readinessSchema,
  translationSchema,
} from './schemas.js'

/**
 * The AI half of the qualification pipeline.
 *
 * Every step returns data, never prose, and every step is independently
 * re-runnable — a failed translation must not cost the extraction that
 * preceded it.
 */

const GOAL_CONTEXT = {
  germany:
    'Employment in Germany with relocation. Visa/work authorisation, recognition of foreign qualifications ' +
    '(Anerkennung) and German language level are decisive. Most non-IT roles expect B1–B2 German.',
  remote:
    'Remote employment with European teams, no relocation. Time-zone overlap, asynchronous working, ' +
    'documented English and demonstrable independent delivery matter most. German is usually not required.',
  freelance:
    'Project-based freelance engagements. Evidence of delivery, a clear specialisation, rate/availability ' +
    'clarity and client-facing skill matter more than formal qualifications.',
  ausbildung:
    'German dual vocational training (Ausbildung): paid training at a company combined with vocational ' +
    'school. Typically requires German A2–B1 at minimum (B1–B2 for care and customer-facing trades), a ' +
    'school leaving certificate, and willingness to train for 2–3.5 years on trainee pay. Prior senior ' +
    'experience is not required and is sometimes a disadvantage — motivation and language are decisive.',
}

const goalBrief = (goals) =>
  goals.map((g) => `- ${g}: ${GOAL_CONTEXT[g] ?? ''}`).join('\n')

// ------------------------------ 1. extraction --------------------------------

const EXTRACTION_SYSTEM = `You extract structured data from CVs for a German recruitment platform.

Rules you must not break:
- Extract only what the document actually says. Never invent an employer, a date, a certificate or a skill.
- When something is absent, return null. A null is a correct answer; a plausible guess is not.
- Dates: return YYYY-MM-DD. When only a month is given use the 1st, when only a year is given use January 1st.
- "isEvidenced" is true only when a role, project or achievement demonstrates the skill. A skill that only
  appears in a keyword list is not evidenced.
- Confidence is your genuine reading confidence for that block, not a politeness score. Use low values freely
  for anything ambiguous — a human reviews everything below 0.6, so under-reporting is safe and over-reporting
  is not.
- Preserve the original wording of job titles; do not translate them at this stage.`

export const extractProfile = async ({ text, languageHint, jobId, userId }) => {
  const user = `Extract this CV.${languageHint ? `\n\nA simple word-frequency check suggests the language is "${languageHint}" — verify it yourself and override if wrong.` : ''}

--- CV TEXT START ---
${trimForModel(text)}
--- CV TEXT END ---`

  return complete({
    purpose: 'cv_extraction',
    system: EXTRACTION_SYSTEM,
    user,
    schema: cvExtractionSchema,
    schemaName: 'cv_extraction',
    maxTokens: 8000,
    jobId,
    userId,
  })
}

// ---------------------------- 2. classification ------------------------------

export const classifyProfile = async ({ extraction, jobId, userId }) => {
  const domains = await many('SELECT code, label_en, description FROM domains WHERE is_active ORDER BY sort_order')
  const list = domains.map((d) => `- ${d.code}: ${d.label_en} — ${d.description}`).join('\n')

  const summary = {
    headline: extraction.headline,
    currentRole: extraction.currentRole,
    totalExperienceMonths: extraction.totalExperienceMonths,
    experiences: (extraction.experiences ?? []).slice(0, 8).map((e) => ({
      role: e.role,
      company: e.company,
      description: e.description,
    })),
    education: (extraction.education ?? []).map((e) => ({ degree: e.degree, field: e.field })),
    skills: (extraction.skills ?? []).slice(0, 40).map((s) => s.name),
  }

  return complete({
    purpose: 'classification',
    system: `You place a candidate into exactly one professional domain from a fixed list.

Choose by what the candidate has actually done most recently and most substantially, not by what they studied
years ago. Use "other" only when nothing fits — a wrong-but-specific domain is worse than "other" because it
sends the profile to the wrong recruiter.

Available domains:
${list}`,
    user: `Classify this candidate.\n\n${JSON.stringify(summary, null, 2)}`,
    schema: classificationSchema,
    schemaName: 'classification',
    maxTokens: 800,
    jobId,
    userId,
  })
}

// ------------------------------ 3. readiness ---------------------------------

export const assessReadiness = async ({ extraction, classification, goal, answers = [], jobId, userId }) => {
  const answered = answers.length
    ? `\n\nThe candidate also answered these questions:\n${answers
        .map((a) => `- ${a.question} → ${JSON.stringify(a.value)}`)
        .join('\n')}`
    : ''

  const profile = {
    headline: extraction.headline,
    country: extraction.country,
    totalExperienceMonths: extraction.totalExperienceMonths,
    domain: classification?.domain,
    specialisation: classification?.specialisation,
    seniority: classification?.seniority,
    experiences: (extraction.experiences ?? []).slice(0, 10),
    education: extraction.education ?? [],
    certifications: extraction.certifications ?? [],
    skills: (extraction.skills ?? []).map((s) => ({ name: s.name, evidenced: s.isEvidenced, years: s.years })),
    languages: extraction.languages ?? [],
  }

  return complete({
    purpose: `readiness_${goal}`,
    system: `You assess how ready a candidate is for one specific goal, and say exactly what would move them forward.

Goal being assessed:
${goalBrief([goal])}

Rules:
- The score must follow from the factors. If every factor is weak the score cannot be 70.
- Weight factors by what actually decides this goal. For "germany" and "ausbildung", German language level is
  heavily weighted. For "remote", it is nearly irrelevant.
- Unknown is a real status. If the CV never states work authorisation, mark it unknown rather than assuming.
- Gaps must be closeable and specific: "German B1 (currently A2)" not "improve German". Give a first action a
  person could take this week.
- Address the candidate as "you". Be direct and kind; never flattering, never discouraging.
- Bands: not_ready 0–39, developing 40–59, nearly_ready 60–79, ready 80–100.`,
    user: `Assess this candidate for the goal "${goal}".\n\n${JSON.stringify(profile, null, 2)}${answered}`,
    schema: readinessSchema,
    schemaName: 'readiness',
    maxTokens: 4000,
    jobId,
    userId,
  })
}

// ---------------------------- 4. questionnaire -------------------------------

export const generateQuestionnaire = async ({ extraction, classification, goals, jobId, userId }) => {
  const known = {
    hasCountry: Boolean(extraction.country),
    languages: (extraction.languages ?? []).map((l) => `${l.language} ${l.level ?? '?'}`),
    totalExperienceMonths: extraction.totalExperienceMonths,
    domain: classification?.domain,
    education: (extraction.education ?? []).map((e) => e.degree).filter(Boolean),
    certifications: (extraction.certifications ?? []).map((c) => c.name),
    readabilityIssues: extraction.readabilityIssues ?? [],
  }

  return complete({
    purpose: 'questionnaire',
    system: `You write a short qualification questionnaire for a candidate who has just uploaded their CV.

The platform's promise is "no long forms before you see value" — so ask only what the CV genuinely did not
establish, and never more than 8 questions. Fewer is better.

Always cover, when the CV did not already answer it:
- work authorisation / right to work in the EU (decisive for the germany and ausbildung goals)
- German language level, if any goal involves Germany
- earliest availability / notice period
- willingness to relocate, when relocation is implied by the goal
- salary or rate expectation, when the goal is freelance

Never ask something already present in the extracted profile. Every question carries a "reason" explaining why
it is being asked. Use single_select with concrete options wherever a free-text answer would be hard to compare
across candidates — CEFR levels, yes/no/in-progress, time ranges.

Candidate goals:
${goalBrief(goals)}`,
    user: `Already known from the CV:\n${JSON.stringify(known, null, 2)}\n\nWrite the questions still worth asking.`,
    schema: questionnaireSchema,
    schemaName: 'questionnaire',
    maxTokens: 3000,
    jobId,
    userId,
  })
}

// ----------------------------- 5. translation --------------------------------

const LANGUAGE_NAMES = { en: 'English', de: 'German', fr: 'French' }

export const translateCv = async ({ text, targetLanguage, sourceLanguage, jobId, userId }) =>
  complete({
    purpose: `translate_${targetLanguage}`,
    system: `You produce a clean ${LANGUAGE_NAMES[targetLanguage]} version of a CV for a German recruitment platform.

- Translate meaning, not words. A German employer must recognise the roles described.
- Keep proper nouns as they are: names, employers, universities, cities, product names.
- Keep German terms of art in German even in the English and French versions — Ausbildung, Fachkraft,
  Meister, Abitur — because that is what employers search for. Add a short gloss in brackets the first time.
- Never add experience, dates, or qualifications that are not in the source. Never remove any either.
- Output markdown with these sections, omitting any that have no content: Summary, Experience, Education,
  Certifications, Skills, Languages.
- This is a derived rendering, not a replacement: the candidate's original file is kept untouched.`,
    user: `Source language: ${LANGUAGE_NAMES[sourceLanguage] ?? sourceLanguage}. Target: ${LANGUAGE_NAMES[targetLanguage]}.

--- CV TEXT START ---
${trimForModel(text, 20000)}
--- CV TEXT END ---`,
    schema: translationSchema,
    schemaName: 'translation',
    model: config.openai.translationModel,
    temperature: 0.3,
    maxTokens: 8000,
    jobId,
    userId,
  })
