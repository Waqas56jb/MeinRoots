import { Router } from 'express'
import { many, one, transaction } from '../../db/pool.js'
import { asyncHandler, badRequest, notFound } from '../../lib/errors.js'
import { created, noContent, ok } from '../../lib/http.js'
import { audit } from '../../lib/audit.js'
// `parse` rather than schema.parse: it turns a failure into a 400 with
// per-field codes the form can attach to inputs, instead of a raw ZodError.
import { parse, validateBody, z } from '../../lib/validate.js'
import { requireAuth } from '../../middleware/auth.js'
import { getFullProfile, getProfileByUser, recomputeCompleteness, refreshReviewFlags } from './repository.js'
import { presentFullProfile } from './present.js'

/**
 * Candidate corrections to the extracted profile.
 *
 * The profile is AI-extracted and the admin review queue is driven by how
 * confident that extraction was. So an edit does three things rather than one:
 *
 *   1. writes the new value,
 *   2. marks the row `source = 'candidate'` and clears its confidence — a
 *      hand-typed row must never masquerade as a confidently parsed one,
 *   3. records the full before/after in profile_edits, so an admin can still
 *      see what the AI originally read.
 *
 * A candidate can only ever reach rows under their own profile: every query is
 * scoped by the profile id resolved from the session, never from the request.
 */

const router = Router()
router.use(requireAuth)

// Which tables are editable, and how each row is shaped on the way in and out.
const ENTITIES = {
  experiences: {
    table: 'profile_experiences',
    label: 'experience',
    ordered: true,
    schema: z.object({
      role: z.string().trim().min(1, 'role_required').max(160),
      company: z.string().trim().max(160).nullish(),
      employmentType: z.string().trim().max(40).nullish(),
      location: z.string().trim().max(120).nullish(),
      country: z.string().trim().max(80).nullish(),
      startDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'invalid_date').nullish(),
      endDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'invalid_date').nullish(),
      isCurrent: z.boolean().default(false),
      description: z.string().trim().max(4000).nullish(),
      skills: z.array(z.string().trim().min(1).max(80)).max(30).default([]),
    }),
    columns: ['role', 'company', 'employment_type', 'location', 'country', 'start_date', 'end_date', 'is_current', 'description', 'skills'],
    toRow: (v) => [
      v.role,
      v.company ?? null,
      v.employmentType ?? null,
      v.location ?? null,
      v.country ?? null,
      v.startDate ?? null,
      // A role marked current cannot also have ended.
      v.isCurrent ? null : v.endDate ?? null,
      Boolean(v.isCurrent),
      v.description ?? null,
      v.skills ?? [],
    ],
  },

  education: {
    table: 'profile_education',
    label: 'education',
    ordered: true,
    schema: z.object({
      institution: z.string().trim().max(160).nullish(),
      degree: z.string().trim().max(160).nullish(),
      field: z.string().trim().max(160).nullish(),
      country: z.string().trim().max(80).nullish(),
      startYear: z.number().int().min(1900).max(2100).nullish(),
      endYear: z.number().int().min(1900).max(2100).nullish(),
    }),
    columns: ['institution', 'degree', 'field', 'country', 'start_year', 'end_year'],
    toRow: (v) => [
      v.institution ?? null,
      v.degree ?? null,
      v.field ?? null,
      v.country ?? null,
      v.startYear ?? null,
      v.endYear ?? null,
    ],
  },

  certifications: {
    table: 'profile_certifications',
    label: 'certification',
    ordered: true,
    schema: z.object({
      name: z.string().trim().min(1, 'name_required').max(200),
      issuer: z.string().trim().max(160).nullish(),
      issuedOn: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'invalid_date').nullish(),
      expiresOn: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'invalid_date').nullish(),
      credentialId: z.string().trim().max(120).nullish(),
    }),
    columns: ['name', 'issuer', 'issued_on', 'expires_on', 'credential_id'],
    toRow: (v) => [v.name, v.issuer ?? null, v.issuedOn ?? null, v.expiresOn ?? null, v.credentialId ?? null],
  },

  skills: {
    table: 'profile_skills',
    label: 'skill',
    ordered: false,
    schema: z.object({
      name: z.string().trim().min(1, 'name_required').max(120),
      category: z.enum(['technical', 'tool', 'domain', 'soft', 'language', 'other']).default('technical'),
      years: z.number().min(0).max(70).nullish(),
      evidence: z.string().trim().max(500).nullish(),
    }),
    columns: ['name', 'name_normalised', 'category', 'years', 'evidence', 'is_evidenced'],
    toRow: (v) => [
      v.name,
      normaliseSkill(v.name),
      v.category,
      v.years ?? null,
      v.evidence ?? null,
      // A candidate saying they have a skill is a claim, not evidence. Only the
      // extractor marks something evidenced, from what a role actually shows.
      false,
    ],
  },

  languages: {
    table: 'profile_languages',
    label: 'language',
    ordered: false,
    schema: z.object({
      language: z.string().trim().min(1, 'language_required').max(60),
      level: z.enum(['A1', 'A2', 'B1', 'B2', 'C1', 'C2', 'native']).nullish(),
      certificate: z.string().trim().max(160).nullish(),
    }),
    columns: ['language', 'level', 'certificate', 'is_self_reported'],
    toRow: (v) => [v.language, v.level ?? null, v.certificate ?? null, true],
  },
}

const normaliseSkill = (name) =>
  String(name)
    .toLowerCase()
    .replace(/[\s._-]+/g, ' ')
    .replace(/[^a-z0-9+# ]/g, '')
    .trim()

const entityOr404 = (key) => {
  const entity = ENTITIES[key]
  if (!entity) throw notFound('unknown_section', `There is no editable section called "${key}"`)
  return entity
}

const myProfile = async (userId) => {
  const profile = await getProfileByUser(userId)
  if (!profile) throw notFound('profile_not_found', 'Upload a CV before editing your profile')
  return profile
}

/** Snapshot used for the before/after record. */
const loadRow = (client, table, id, profileId) =>
  client
    .query(`SELECT * FROM ${table} WHERE id = $1 AND profile_id = $2`, [id, profileId])
    .then(({ rows }) => rows[0] ?? null)

const recordEdit = (client, { profileId, entityType, entityId, action, before, after, actorId }) =>
  client.query(
    `INSERT INTO profile_edits (profile_id, entity_type, entity_id, action, before, after, actor_id)
     VALUES ($1,$2,$3,$4,$5,$6,$7)`,
    [
      profileId,
      entityType,
      entityId,
      action,
      before ? JSON.stringify(before) : null,
      after ? JSON.stringify(after) : null,
      actorId,
    ],
  )

const afterChange = async (profileId) => {
  await refreshReviewFlags(profileId)
  await recomputeCompleteness(profileId)
}

const respondWithProfile = async (res, profile, locale, status = 200) => {
  const full = await getFullProfile(profile.id)
  return status === 201
    ? created(res, { profile: presentFullProfile(full, locale) })
    : ok(res, { profile: presentFullProfile(full, locale) })
}

// --------------------------------- create ------------------------------------

router.post(
  '/me/:section',
  asyncHandler(async (req, res) => {
    const entity = entityOr404(req.params.section)
    const value = parse(entity.schema, req.body)
    const profile = await myProfile(req.user.id)

    const row = await transaction(async (client) => {
      const columns = ['profile_id', 'source', 'edited_at', 'edited_by', ...entity.columns]
      const values = [profile.id, 'candidate', new Date(), req.user.id, ...entity.toRow(value)]

      // Skills and languages are unordered sets; the rest keep CV order, and a
      // new row goes last so adding one never reshuffles what is already there.
      if (entity.ordered) {
        const { rows: max } = await client.query(
          `SELECT COALESCE(max(sort_order), -1) + 1 AS next FROM ${entity.table} WHERE profile_id = $1`,
          [profile.id],
        )
        columns.push('sort_order')
        values.push(max[0].next)
      }

      const { rows } = await client.query(
        `INSERT INTO ${entity.table} (${columns.join(', ')})
         VALUES (${columns.map((_, i) => `$${i + 1}`).join(', ')})
         RETURNING *`,
        values,
      )
      const inserted = rows[0]
      await recordEdit(client, {
        profileId: profile.id,
        entityType: entity.label,
        entityId: inserted.id,
        action: 'create',
        before: null,
        after: inserted,
        actorId: req.user.id,
      })
      return inserted
    })

    await afterChange(profile.id)
    await audit(req, {
      action: 'profile.section_created',
      entityType: entity.label,
      entityId: row.id,
      metadata: { section: req.params.section },
    })
    return respondWithProfile(res, profile, req.user.locale, 201)
  }),
)

// --------------------------------- update ------------------------------------

router.put(
  '/me/:section/:id',
  asyncHandler(async (req, res) => {
    const entity = entityOr404(req.params.section)
    const value = parse(entity.schema, req.body)
    const profile = await myProfile(req.user.id)

    const assignments = entity.columns.map((c, i) => `${c} = $${i + 3}`).join(', ')

    const row = await transaction(async (client) => {
      const before = await loadRow(client, entity.table, req.params.id, profile.id)
      if (!before) throw notFound('row_not_found', 'That entry does not exist on your profile')

      const { rows } = await client.query(
        `UPDATE ${entity.table}
            SET ${assignments},
                source = 'candidate',
                edited_at = now(),
                edited_by = $2,
                -- The extractor's confidence described the extractor's reading.
                -- Once a person has corrected the row it no longer applies, and
                -- leaving it would keep feeding a stale number to the review queue.
                confidence = NULL
          WHERE id = $1 AND profile_id = $${entity.columns.length + 3}
          RETURNING *`,
        [req.params.id, req.user.id, ...entity.toRow(value), profile.id],
      )
      const updated = rows[0]
      await recordEdit(client, {
        profileId: profile.id,
        entityType: entity.label,
        entityId: updated.id,
        action: 'update',
        before,
        after: updated,
        actorId: req.user.id,
      })
      return updated
    })

    await afterChange(profile.id)
    await audit(req, {
      action: 'profile.section_updated',
      entityType: entity.label,
      entityId: row.id,
      metadata: { section: req.params.section },
    })
    return respondWithProfile(res, profile, req.user.locale)
  }),
)

// --------------------------------- delete ------------------------------------

router.delete(
  '/me/:section/:id',
  asyncHandler(async (req, res) => {
    const entity = entityOr404(req.params.section)
    const profile = await myProfile(req.user.id)

    await transaction(async (client) => {
      const before = await loadRow(client, entity.table, req.params.id, profile.id)
      if (!before) throw notFound('row_not_found', 'That entry does not exist on your profile')

      await client.query(`DELETE FROM ${entity.table} WHERE id = $1 AND profile_id = $2`, [
        req.params.id,
        profile.id,
      ])
      // entity_id is left null: the row it pointed at is gone, but the snapshot
      // in `before` is exactly what makes this record worth keeping.
      await recordEdit(client, {
        profileId: profile.id,
        entityType: entity.label,
        entityId: null,
        action: 'delete',
        before,
        after: null,
        actorId: req.user.id,
      })
    })

    await afterChange(profile.id)
    await audit(req, {
      action: 'profile.section_deleted',
      entityType: entity.label,
      entityId: req.params.id,
      metadata: { section: req.params.section },
    })
    return noContent(res)
  }),
)

// ------------------------------ reorder --------------------------------------

router.patch(
  '/me/:section/order',
  validateBody(z.object({ ids: z.array(z.string().uuid()).min(1).max(100) })),
  asyncHandler(async (req, res) => {
    const entity = entityOr404(req.params.section)
    if (!entity.ordered) throw badRequest('not_orderable', 'This section is not ordered')
    const profile = await myProfile(req.user.id)

    await transaction(async (client) => {
      for (const [index, id] of req.body.ids.entries()) {
        await client.query(
          `UPDATE ${entity.table} SET sort_order = $3 WHERE id = $1 AND profile_id = $2`,
          [id, profile.id, index],
        )
      }
    })

    return respondWithProfile(res, profile, req.user.locale)
  }),
)

// ------------------------------ edit history ---------------------------------

router.get(
  '/me/edits',
  asyncHandler(async (req, res) => {
    const profile = await myProfile(req.user.id)
    const rows = await many(
      `SELECT id, entity_type, action, before, after, created_at
         FROM profile_edits WHERE profile_id = $1
        ORDER BY created_at DESC LIMIT 100`,
      [profile.id],
    )
    ok(res, {
      edits: rows.map((r) => ({
        id: Number(r.id),
        entityType: r.entity_type,
        action: r.action,
        before: r.before,
        after: r.after,
        createdAt: r.created_at,
      })),
    })
  }),
)

export default router
