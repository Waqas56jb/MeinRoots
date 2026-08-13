import { many, one, transaction } from '../../db/pool.js'

/** Postgres rejects '' for a date column; the model returns null or a real date. */
const dateOrNull = (value) => {
  if (!value || typeof value !== 'string') return null
  const match = value.match(/^(\d{4})-(\d{2})-(\d{2})$/)
  return match ? value : null
}

const clamp01 = (n) => {
  const num = Number(n)
  if (!Number.isFinite(num)) return null
  return Math.min(1, Math.max(0, Number(num.toFixed(3))))
}

const normaliseSkill = (name) =>
  String(name)
    .toLowerCase()
    .replace(/[\s._-]+/g, ' ')
    .replace(/[^a-z0-9+# ]/g, '')
    .trim()

const CEFR = new Set(['A1', 'A2', 'B1', 'B2', 'C1', 'C2', 'native'])

/**
 * Writes an extraction over a profile, replacing the previous structured rows.
 *
 * Replace rather than merge: a re-analysis of a newer CV must not leave the
 * previous CV's employers behind, which is exactly the kind of ghost data that
 * makes an admin stop trusting the console.
 */
export const saveExtraction = async ({ userId, documentId, extraction }) =>
  transaction(async (client) => {
    const { rows: profileRows } = await client.query(
      'SELECT id FROM candidate_profiles WHERE user_id = $1',
      [userId],
    )
    const profileId =
      profileRows[0]?.id ??
      (await client.query('INSERT INTO candidate_profiles (user_id) VALUES ($1) RETURNING id', [userId]))
        .rows[0].id

    // Only the AI's own rows are replaced. Anything the candidate wrote or
    // corrected survives a re-analysis — otherwise uploading a new CV would
    // silently destroy their corrections, which is the fastest way to make
    // someone stop trusting the profile.
    for (const table of [
      'profile_experiences',
      'profile_education',
      'profile_certifications',
      'profile_skills',
      'profile_languages',
    ]) {
      await client.query(`DELETE FROM ${table} WHERE profile_id = $1 AND source = 'ai'`, [profileId])
    }

    const experiences = extraction.experiences ?? []
    for (const [i, e] of experiences.entries()) {
      await client.query(
        `INSERT INTO profile_experiences
           (profile_id, company, role, employment_type, location, country, start_date, end_date,
            is_current, description, skills, confidence, sort_order)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13)`,
        [
          profileId,
          e.company,
          e.role || 'Unspecified role',
          e.employmentType,
          e.location,
          e.country,
          dateOrNull(e.startDate),
          // A role marked current with an end date is contradictory; trust the flag.
          e.isCurrent ? null : dateOrNull(e.endDate),
          Boolean(e.isCurrent),
          e.description,
          Array.isArray(e.skills) ? e.skills.slice(0, 30) : [],
          clamp01(e.confidence),
          i,
        ],
      )
    }

    for (const [i, e] of (extraction.education ?? []).entries()) {
      await client.query(
        `INSERT INTO profile_education
           (profile_id, institution, degree, field, country, start_year, end_year,
            likely_recognised_in_de, confidence, sort_order)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)`,
        [
          profileId,
          e.institution,
          e.degree,
          e.field,
          e.country,
          Number.isInteger(e.startYear) ? e.startYear : null,
          Number.isInteger(e.endYear) ? e.endYear : null,
          e.likelyRecognisedInGermany,
          clamp01(e.confidence),
          i,
        ],
      )
    }

    for (const [i, c] of (extraction.certifications ?? []).entries()) {
      if (!c.name) continue
      await client.query(
        `INSERT INTO profile_certifications
           (profile_id, name, issuer, issued_on, expires_on, credential_id, confidence, sort_order)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8)`,
        [profileId, c.name, c.issuer, dateOrNull(c.issuedOn), dateOrNull(c.expiresOn), c.credentialId, clamp01(c.confidence), i],
      )
    }

    // The unique index on (profile_id, name_normalised) is the real dedupe; the
    // Set here just avoids pointless round-trips for obvious repeats.
    const seen = new Set()
    for (const s of extraction.skills ?? []) {
      const normalised = normaliseSkill(s.name)
      if (!normalised || seen.has(normalised)) continue
      seen.add(normalised)
      await client.query(
        `INSERT INTO profile_skills (profile_id, name, name_normalised, category, years, evidence, is_evidenced, confidence)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8)
         ON CONFLICT (profile_id, name_normalised) DO NOTHING`,
        [
          profileId,
          s.name.trim().slice(0, 120),
          normalised,
          ['technical', 'tool', 'domain', 'soft', 'language', 'other'].includes(s.category) ? s.category : 'other',
          Number.isFinite(Number(s.years)) ? Number(s.years) : null,
          s.evidence,
          Boolean(s.isEvidenced),
          clamp01(s.confidence),
        ],
      )
    }

    const seenLang = new Set()
    for (const l of extraction.languages ?? []) {
      const key = String(l.language || '').trim().toLowerCase()
      if (!key || seenLang.has(key)) continue
      seenLang.add(key)
      await client.query(
        `INSERT INTO profile_languages (profile_id, language, level, is_self_reported, certificate, confidence)
         VALUES ($1,$2,$3,$4,$5,$6)
         ON CONFLICT (profile_id, language) DO NOTHING`,
        [
          profileId,
          l.language.trim().slice(0, 60),
          CEFR.has(l.level) ? l.level : null,
          l.isSelfReported !== false,
          l.certificate,
          clamp01(l.confidence),
        ],
      )
    }

    const months = Number.isFinite(Number(extraction.totalExperienceMonths))
      ? Math.max(0, Math.round(Number(extraction.totalExperienceMonths)))
      : null

    await client.query(
      `UPDATE candidate_profiles SET
         document_id = $2, headline = $3, summary = $4, current_title = $5, current_employer = $6,
         total_experience_months = $7, country = $8, city = $9, extraction_confidence = $10
       WHERE id = $1`,
      [
        profileId,
        documentId,
        extraction.headline,
        extraction.summary,
        extraction.currentRole,
        extraction.currentEmployer,
        months,
        extraction.country,
        extraction.city,
        clamp01(extraction.overallConfidence),
      ],
    )

    return profileId
  })

export const saveClassification = async ({ profileId, classification, model }) => {
  const known = await one('SELECT code FROM domains WHERE code = $1', [classification.domain])
  return transaction(async (client) => {
    await client.query(
      'UPDATE profile_classifications SET is_current = false WHERE profile_id = $1 AND is_current',
      [profileId],
    )
    const { rows } = await client.query(
      `INSERT INTO profile_classifications
         (profile_id, domain, specialisation, seniority, rationale, confidence, model, is_current)
       VALUES ($1,$2,$3,$4,$5,$6,$7,true)
       RETURNING *`,
      [
        profileId,
        // The model was given a closed list, but a hallucinated code would break
        // the foreign key and fail the whole job — fall back instead.
        known ? classification.domain : 'other',
        classification.specialisation,
        classification.seniority,
        classification.rationale,
        clamp01(classification.confidence),
        model,
      ],
    )
    return rows[0]
  })
}

export const saveReadiness = async ({ profileId, goal, readiness, model }) =>
  transaction(async (client) => {
    await client.query(
      'UPDATE readiness_assessments SET is_current = false WHERE profile_id = $1 AND goal = $2 AND is_current',
      [profileId, goal],
    )
    const score = Math.min(100, Math.max(0, Math.round(Number(readiness.score) || 0)))
    const band = ['not_ready', 'developing', 'nearly_ready', 'ready'].includes(readiness.band)
      ? readiness.band
      : score >= 80 ? 'ready' : score >= 60 ? 'nearly_ready' : score >= 40 ? 'developing' : 'not_ready'

    const { rows } = await client.query(
      `INSERT INTO readiness_assessments (profile_id, goal, score, band, summary, factors, model, is_current)
       VALUES ($1,$2,$3,$4,$5,$6,$7,true)
       RETURNING *`,
      [profileId, goal, score, band, readiness.summary, JSON.stringify(readiness.factors ?? []), model],
    )
    const assessment = rows[0]

    for (const [i, gap] of (readiness.gaps ?? []).entries()) {
      if (!gap.skill) continue
      await client.query(
        `INSERT INTO skill_gaps
           (assessment_id, skill, importance, current_level, target_level, why, how_to_close, est_weeks, resource_hint, sort_order)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)`,
        [
          assessment.id,
          gap.skill,
          ['critical', 'important', 'nice_to_have'].includes(gap.importance) ? gap.importance : 'important',
          gap.currentLevel,
          gap.targetLevel,
          gap.why,
          gap.howToClose,
          Number.isFinite(Number(gap.estimatedWeeks)) ? Math.round(Number(gap.estimatedWeeks)) : null,
          gap.resourceHint,
          i,
        ],
      )
    }
    return assessment
  })

export const saveQuestionnaire = async ({ profileId, questions, model }) =>
  transaction(async (client) => {
    // Answers already given are worth keeping, so an unanswered questionnaire is
    // replaced and a completed one is left alone.
    await client.query(
      `DELETE FROM questionnaires
        WHERE profile_id = $1 AND status <> 'completed'`,
      [profileId],
    )
    const { rows } = await client.query(
      'INSERT INTO questionnaires (profile_id, generated_by) VALUES ($1, $2) RETURNING *',
      [profileId, model],
    )
    const questionnaire = rows[0]

    for (const [i, q] of (questions ?? []).slice(0, 8).entries()) {
      if (!q.key || !q.question) continue
      await client.query(
        `INSERT INTO questionnaire_questions
           (questionnaire_id, key, question, help_text, input_type, options, is_required, reason, sort_order)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)
         ON CONFLICT (questionnaire_id, key) DO NOTHING`,
        [
          questionnaire.id,
          q.key.slice(0, 80),
          q.question,
          q.helpText,
          ['text', 'long_text', 'single_select', 'multi_select', 'boolean', 'number', 'date'].includes(q.inputType)
            ? q.inputType
            : 'text',
          JSON.stringify(q.options ?? []),
          q.isRequired !== false,
          q.reason,
          i,
        ],
      )
    }
    return questionnaire
  })

/**
 * Percentage of the profile that is actually filled in. Drives the "complete
 * your profile" nudge and gives the admin a sort order that is more useful than
 * upload date.
 */
export const recomputeCompleteness = async (profileId) => {
  const row = await one(
    `SELECT
       p.headline IS NOT NULL                       AS has_headline,
       p.summary IS NOT NULL                        AS has_summary,
       p.country IS NOT NULL                        AS has_country,
       p.total_experience_months IS NOT NULL        AS has_experience_total,
       (SELECT count(*) FROM profile_experiences  WHERE profile_id = p.id) AS experiences,
       (SELECT count(*) FROM profile_education    WHERE profile_id = p.id) AS education,
       (SELECT count(*) FROM profile_skills       WHERE profile_id = p.id) AS skills,
       (SELECT count(*) FROM profile_languages    WHERE profile_id = p.id) AS languages,
       (SELECT count(*) FROM profile_classifications WHERE profile_id = p.id AND is_current) AS classified,
       (SELECT count(*) FROM questionnaires q
          JOIN questionnaire_questions qq ON qq.questionnaire_id = q.id
          LEFT JOIN questionnaire_answers qa ON qa.question_id = qq.id
         WHERE q.profile_id = p.id AND qa.id IS NULL AND qq.is_required) AS unanswered
     FROM candidate_profiles p WHERE p.id = $1`,
    [profileId],
  )
  if (!row) return 0

  const checks = [
    row.has_headline,
    row.has_summary,
    row.has_country,
    row.has_experience_total,
    row.experiences > 0,
    row.education > 0,
    row.skills >= 3,
    row.languages > 0,
    row.classified > 0,
    row.unanswered === 0,
  ]
  const score = Math.round((checks.filter(Boolean).length / checks.length) * 100)
  await one('UPDATE candidate_profiles SET completeness = $2 WHERE id = $1 RETURNING id', [profileId, score])
  return score
}

/**
 * Raises the exceptions an admin should look at, and clears any it previously
 * raised that no longer apply. This is the mechanism that turns "open every
 * CV" into "open the flagged ones".
 */
export const refreshReviewFlags = async (profileId) => {
  const profile = await one(
    `SELECT p.*,
            (SELECT count(*) FROM profile_experiences WHERE profile_id = p.id) AS experiences,
            (SELECT count(*) FROM profile_experiences WHERE profile_id = p.id AND start_date IS NULL) AS undated,
            (SELECT count(*) FROM profile_skills WHERE profile_id = p.id) AS skills,
            (SELECT count(*) FROM profile_languages WHERE profile_id = p.id) AS languages,
            (SELECT min(confidence) FROM profile_experiences WHERE profile_id = p.id) AS min_exp_confidence
       FROM candidate_profiles p WHERE p.id = $1`,
    [profileId],
  )
  if (!profile) return []

  const flags = []
  const add = (code, severity, detail) => flags.push({ code, severity, detail })

  if ((profile.extraction_confidence ?? 1) < 0.6) {
    add('low_confidence', 'critical', `Extraction confidence ${Math.round((profile.extraction_confidence ?? 0) * 100)}%`)
  }
  if (Number(profile.experiences) === 0) add('no_experience', 'warning', 'No work history could be extracted')
  if (Number(profile.undated) > 0) {
    add('missing_dates', 'warning', `${profile.undated} role(s) without a start date`)
  }
  if (Number(profile.skills) < 3) add('few_skills', 'warning', 'Fewer than three skills extracted')
  if (Number(profile.languages) === 0) add('no_languages', 'info', 'No language proficiencies found')
  if (profile.min_exp_confidence !== null && profile.min_exp_confidence < 0.5) {
    add('uncertain_experience', 'warning', 'At least one role was read with low confidence')
  }

  return transaction(async (client) => {
    const codes = flags.map((f) => f.code)
    // Resolve anything that has since been fixed, so the queue does not fill up
    // with stale exceptions from an earlier upload.
    await client.query(
      `UPDATE review_flags SET resolved_at = now()
        WHERE profile_id = $1 AND resolved_at IS NULL AND NOT (code = ANY($2::text[]))`,
      [profileId, codes.length ? codes : ['']],
    )
    for (const flag of flags) {
      const { rows } = await client.query(
        'SELECT id FROM review_flags WHERE profile_id = $1 AND code = $2 AND resolved_at IS NULL',
        [profileId, flag.code],
      )
      if (rows.length) {
        await client.query('UPDATE review_flags SET detail = $2 WHERE id = $1', [rows[0].id, flag.detail])
      } else {
        await client.query(
          'INSERT INTO review_flags (profile_id, code, severity, detail) VALUES ($1,$2,$3,$4)',
          [profileId, flag.code, flag.severity, flag.detail],
        )
      }
    }

    const critical = flags.some((f) => f.severity === 'critical')
    await client.query(
      `UPDATE candidate_profiles
          SET review_status = CASE
            WHEN review_status IN ('approved','rejected') THEN review_status
            WHEN $2 THEN 'flagged'::review_status
            WHEN $3 THEN 'pending'::review_status
            ELSE 'auto_cleared'::review_status
          END
        WHERE id = $1`,
      [profileId, critical, flags.length > 0],
    )
    return flags
  })
}

export const getProfileByUser = (userId) =>
  one('SELECT * FROM candidate_profiles WHERE user_id = $1', [userId])

/** The whole profile in one round trip — what the dashboard and admin both need. */
export const getFullProfile = async (profileId) => {
  const profile = await one(
    `SELECT p.*, c.domain, c.domain_label, c.specialisation, c.seniority, c.rationale AS classification_rationale,
            c.confidence AS classification_confidence, d.label_en AS domain_label_en,
            d.label_de AS domain_label_de, d.label_fr AS domain_label_fr
       FROM candidate_profiles p
       LEFT JOIN profile_classifications c ON c.profile_id = p.id AND c.is_current
       LEFT JOIN domains d ON d.code = c.domain
      WHERE p.id = $1`,
    [profileId],
  )
  if (!profile) return null

  const [experiences, education, certifications, skills, languages, assessments, flags] = await Promise.all([
    many('SELECT * FROM profile_experiences WHERE profile_id = $1 ORDER BY sort_order', [profileId]),
    many('SELECT * FROM profile_education WHERE profile_id = $1 ORDER BY sort_order', [profileId]),
    many('SELECT * FROM profile_certifications WHERE profile_id = $1 ORDER BY sort_order', [profileId]),
    many('SELECT * FROM profile_skills WHERE profile_id = $1 ORDER BY is_evidenced DESC, name', [profileId]),
    many('SELECT * FROM profile_languages WHERE profile_id = $1 ORDER BY language', [profileId]),
    many('SELECT * FROM readiness_assessments WHERE profile_id = $1 AND is_current ORDER BY goal', [profileId]),
    many('SELECT * FROM review_flags WHERE profile_id = $1 AND resolved_at IS NULL ORDER BY severity, code', [
      profileId,
    ]),
  ])

  const gaps = assessments.length
    ? await many(
        `SELECT * FROM skill_gaps WHERE assessment_id = ANY($1::uuid[]) ORDER BY sort_order`,
        [assessments.map((a) => a.id)],
      )
    : []

  return {
    profile,
    experiences,
    education,
    certifications,
    skills,
    languages,
    assessments: assessments.map((a) => ({ ...a, gaps: gaps.filter((g) => g.assessment_id === a.id) })),
    flags,
  }
}
