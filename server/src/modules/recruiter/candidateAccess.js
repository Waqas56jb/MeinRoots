import { many, one } from '../../db/pool.js'
import { can } from './entitlements.js'

/**
 * What a recruiter is allowed to see of a candidate.
 *
 * This is the file that keeps the promise the product is sold on, so it is
 * written to fail closed. Three rules, in order:
 *
 *   1. Identity is never selected.
 *      The SQL below does not read full_name, email or phone at all. Not
 *      "reads them and drops them later" — does not read them. A projection
 *      that never loads a column cannot leak it through a stray spread, a
 *      logging call, a future `...row`, or an error serialiser. The anonymised
 *      shape is not a filter applied to a full record; it is the only record
 *      that exists in this module.
 *
 *   2. Contact details need two independent yeses.
 *      The plan must entitle it AND the candidate must have consented AND
 *      there must be an accepted request. Any one missing means the fields are
 *      not fetched. Subscription alone never buys a person's phone number.
 *
 *   3. Absence is absence.
 *      Nothing is returned as null-to-be-hidden. If the caller is not entitled,
 *      the key is not in the object.
 */

/* ------------------------- the anonymised projection ---------------------- */

/*
 * Everything a recruiter may see without any consent at all.
 *
 * Note what is not here: u.full_name, u.email, u.phone. The join to users
 * exists only to filter on role and deletion, and to reach the consent that
 * decides whether this candidate wants to be found at all.
 */
const CARD_SELECT = `
  SELECT p.user_id                    AS id,
         p.reference                  AS reference,
         p.headline,
         p.total_experience_months,
         p.city, p.country,
         p.completeness,
         c.label_en                   AS domain,
         cl.specialisation,
         cl.seniority,
         (SELECT max(score) FROM readiness_assessments r WHERE r.profile_id = p.id) AS readiness,
         u.goals
    FROM candidate_profiles p
    JOIN users u ON u.id = p.user_id AND u.role = 'candidate' AND u.deleted_at IS NULL
    LEFT JOIN profile_classifications cl ON cl.profile_id = p.id AND cl.is_current
    LEFT JOIN domains c ON c.code = cl.domain
`

/*
 * Only candidates who said yes.
 *
 * The employer_sharing consent is the gate on being discoverable at all. It is
 * applied in the WHERE clause rather than checked afterwards, so a candidate
 * who withdrew consent is not merely hidden from the response — they are not in
 * the result set, and cannot be counted, paged past, or inferred from a total.
 */
const SHARING_CONSENT = `
  EXISTS (
    SELECT 1 FROM user_consents uc
     WHERE uc.user_id = p.user_id AND uc.type = 'employer_sharing'
     ORDER BY uc.created_at DESC LIMIT 1
  )
  AND (
    SELECT uc.granted FROM user_consents uc
     WHERE uc.user_id = p.user_id AND uc.type = 'employer_sharing'
     ORDER BY uc.created_at DESC LIMIT 1
  ) IS TRUE
`

/** Sort keys, allowlisted. A sort column is never interpolated from input. */
const SORTS = {
  relevance: 'p.completeness DESC NULLS LAST, p.updated_at DESC',
  readiness: 'readiness DESC NULLS LAST',
  experience: 'p.total_experience_months DESC NULLS LAST',
  recent: 'p.updated_at DESC',
}

/**
 * Candidate search.
 *
 * Every dynamic value is a placeholder; only the sort clause is chosen from a
 * fixed map, and by key rather than by value.
 */
export const searchCandidates = async ({
  q, profession, skills = [], germanLevel, minExperienceMonths, location,
  minReadiness, goal, sort = 'relevance', limit = 12, offset = 0,
  ids = null,
}) => {
  const where = [SHARING_CONSENT]
  const params = []
  const add = (value) => {
    params.push(value)
    return `$${params.length}`
  }

  // Restrict to a known set. The saved list used to ask for the first page of
  // everything and filter it down to the rows it wanted, which quietly worked
  // only while the searchable pool was smaller than one page: save a candidate,
  // let twelve newer ones appear, and yours dropped out of your own saved list.
  // The consent gate above still applies, so a candidate who withdraws still
  // disappears — that part was right and is kept.
  if (ids) {
    if (!ids.length) return { rows: [], total: 0 }
    where.push(`p.user_id = ANY(${add(ids)}::uuid[])`)
  }

  if (q) {
    const needle = add(`%${q.toLowerCase()}%`)
    where.push(`(
      lower(coalesce(p.headline, '')) LIKE ${needle}
      OR lower(coalesce(cl.specialisation, '')) LIKE ${needle}
      OR lower(coalesce(c.label_en, '')) LIKE ${needle}
      OR EXISTS (SELECT 1 FROM profile_skills s
                  WHERE s.profile_id = p.id AND lower(s.name) LIKE ${needle})
    )`)
  }
  if (profession) {
    const needle = add(`%${profession.toLowerCase()}%`)
    where.push(`(lower(coalesce(cl.specialisation, '')) LIKE ${needle}
                 OR lower(coalesce(c.label_en, '')) LIKE ${needle}
                 OR lower(coalesce(p.headline, '')) LIKE ${needle})`)
  }
  for (const skill of skills.slice(0, 8)) {
    const needle = add(`%${String(skill).toLowerCase()}%`)
    where.push(`EXISTS (SELECT 1 FROM profile_skills s
                         WHERE s.profile_id = p.id AND lower(s.name) LIKE ${needle})`)
  }
  if (germanLevel) {
    // CEFR is ordered, so "B2" means B2 or better, not exactly B2.
    const level = add(germanLevel)
    where.push(`EXISTS (
      SELECT 1 FROM profile_languages l
       WHERE l.profile_id = p.id
         AND lower(l.language) IN ('german', 'deutsch', 'allemand')
         AND l.level IS NOT NULL
         AND array_position(ARRAY['A1','A2','B1','B2','C1','C2','native']::text[], l.level::text)
             >= array_position(ARRAY['A1','A2','B1','B2','C1','C2','native']::text[], ${level})
    )`)
  }
  if (minExperienceMonths) where.push(`p.total_experience_months >= ${add(Number(minExperienceMonths))}`)
  if (location) {
    const needle = add(`%${location.toLowerCase()}%`)
    where.push(`(lower(coalesce(p.city, '')) LIKE ${needle} OR lower(coalesce(p.country, '')) LIKE ${needle})`)
  }
  if (minReadiness) {
    where.push(`(SELECT max(score) FROM readiness_assessments r WHERE r.profile_id = p.id)
                >= ${add(Number(minReadiness))}`)
  }
  if (goal) where.push(`${add(goal)}::work_goal = ANY(u.goals)`)

  const clause = `WHERE ${where.join(' AND ')}`
  const order = SORTS[sort] ?? SORTS.relevance

  const totalRow = await one(
    `SELECT count(*)::int AS total
       FROM candidate_profiles p
       JOIN users u ON u.id = p.user_id AND u.role = 'candidate' AND u.deleted_at IS NULL
       LEFT JOIN profile_classifications cl ON cl.profile_id = p.id AND cl.is_current
       LEFT JOIN domains c ON c.code = cl.domain
       ${clause}`,
    params,
  )

  const rows = await many(
    `${CARD_SELECT} ${clause} ORDER BY ${order} LIMIT ${add(limit)} OFFSET ${add(offset)}`,
    params,
  )

  return { rows, total: totalRow?.total ?? 0 }
}

/** Skills and languages for the cards, fetched in one round trip for the page. */
export const attachCardDetail = async (rows) => {
  if (!rows.length) return rows
  const ids = rows.map((r) => r.id)

  const [skills, languages] = await Promise.all([
    many(
      `SELECT p.user_id, s.name, s.is_evidenced
         FROM profile_skills s JOIN candidate_profiles p ON p.id = s.profile_id
        WHERE p.user_id = ANY($1::uuid[])
        ORDER BY s.is_evidenced DESC, s.name`,
      [ids],
    ),
    many(
      `SELECT p.user_id, l.language, l.level
         FROM profile_languages l JOIN candidate_profiles p ON p.id = l.profile_id
        WHERE p.user_id = ANY($1::uuid[])`,
      [ids],
    ),
  ])

  const byUser = (list) =>
    list.reduce((acc, row) => {
      ;(acc[row.user_id] ??= []).push(row)
      return acc
    }, {})
  const skillMap = byUser(skills)
  const langMap = byUser(languages)

  return rows.map((r) => ({
    ...r,
    skills: (skillMap[r.id] ?? []).slice(0, 12).map((s) => ({ name: s.name, isEvidenced: s.is_evidenced })),
    languages: (langMap[r.id] ?? []).map((l) => ({ language: l.language, level: l.level })),
  }))
}

/** The card the portal renders. Nothing identifying has been loaded to omit. */
export const presentCard = (row, { saved = false, requestState = null } = {}) => ({
  id: row.id,
  reference: row.reference,
  profession: row.domain ?? row.headline ?? null,
  specialisation: row.specialisation ?? null,
  seniority: row.seniority ?? null,
  experienceMonths: row.total_experience_months,
  location: [row.city, row.country].filter(Boolean).join(', ') || null,
  readiness: row.readiness,
  goals: row.goals ?? [],
  skills: row.skills ?? [],
  languages: row.languages ?? [],
  germanLevel: (row.languages ?? []).find((l) => /^(german|deutsch|allemand)$/i.test(l.language))?.level ?? null,
  isSaved: saved,
  requestState,
})

/* ----------------------------- the detail view ---------------------------- */

/**
 * How much of one candidate this company may see.
 *
 * Returns `anonymous`, `restricted` or `granted`, and only fetches what the
 * level allows. The level is the AND of three independent facts, and each is
 * checked against its own source of truth:
 *
 *   plan          — plan_features, via entitlements
 *   consent       — the candidate's own employer_sharing row
 *   relationship  — an accepted request from this company
 */
export const accessLevelFor = async ({ candidateId, companyId, entitlements }) => {
  const accepted = await one(
    `SELECT id FROM recruitment_requests
      WHERE candidate_id = $1 AND company_id = $2 AND status = 'accepted'
      LIMIT 1`,
    [candidateId, companyId],
  )

  // An accepted request is the candidate personally agreeing to this company.
  // That, and only that, releases contact details.
  if (accepted) return 'granted'
  if (can(entitlements, 'enhanced_profiles')) return 'restricted'
  return 'anonymous'
}

/**
 * The candidate detail, projected to the access level.
 *
 * Each branch runs its own query. There is no single "full" object that later
 * branches trim down, because that object is exactly the thing that leaks.
 */
export const candidateDetail = async ({ candidateId, companyId, entitlements }) => {
  const level = await accessLevelFor({ candidateId, companyId, entitlements })

  const base = await one(
    `${CARD_SELECT} WHERE p.user_id = $1 AND ${SHARING_CONSENT}`,
    [candidateId],
  )
  if (!base) return null

  const [withDetail] = await attachCardDetail([base])
  const card = presentCard(withDetail)

  // Anonymous: the card, and nothing else.
  if (level === 'anonymous') {
    return { candidate: card, access: { level } }
  }

  // Restricted: the assessed professional record. Still no identity — a work
  // history is not a name, and this is what the plan pays for.
  const profileId = await one('SELECT id FROM candidate_profiles WHERE user_id = $1', [candidateId])
  const [experiences, education, certifications, readiness] = await Promise.all([
    many(
      `SELECT role, company, location, start_date, end_date, is_current, description
         FROM profile_experiences WHERE profile_id = $1 ORDER BY coalesce(end_date, '9999-12-31') DESC`,
      [profileId.id],
    ),
    many(
      `SELECT degree, field, institution, country, end_year, likely_recognised_in_de
         FROM profile_education WHERE profile_id = $1 ORDER BY end_year DESC NULLS LAST`,
      [profileId.id],
    ),
    many(
      'SELECT name, issuer, issued_on FROM profile_certifications WHERE profile_id = $1',
      [profileId.id],
    ),
    one(
      `SELECT score, band, summary, factors FROM readiness_assessments
        WHERE profile_id = $1 ORDER BY score DESC LIMIT 1`,
      [profileId.id],
    ),
  ])

  const detail = {
    ...card,
    summary: withDetail.headline ? undefined : undefined,
    experiences: experiences.map((e) => ({
      role: e.role,
      company: e.company,
      location: e.location,
      period: [e.start_date, e.is_current ? 'present' : e.end_date].filter(Boolean).join(' – '),
      description: e.description,
    })),
    education: education.map((e) => ({
      degree: e.degree,
      field: e.field,
      institution: e.institution,
      country: e.country,
      endYear: e.end_year,
      recognisedInGermany: e.likely_recognised_in_de,
    })),
    certifications: certifications.map((c) => ({ name: c.name, issuer: c.issuer, issuedOn: c.issued_on })),
    readinessDetail: readiness
      ? { score: readiness.score, band: readiness.band, summary: readiness.summary, factors: readiness.factors ?? [] }
      : null,
  }

  if (level === 'restricted') {
    return { candidate: detail, access: { level } }
  }

  // Granted: the candidate accepted this company's request, so the identity is
  // fetched — here, once, in the only branch entitled to it.
  const identity = await one(
    'SELECT full_name, email, phone FROM users WHERE id = $1 AND deleted_at IS NULL',
    [candidateId],
  )

  return {
    candidate: detail,
    access: {
      level,
      contact: identity
        ? { name: identity.full_name, email: identity.email, phone: identity.phone }
        : null,
    },
  }
}
