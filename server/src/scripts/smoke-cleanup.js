#!/usr/bin/env node
/**
 * Deletion tests: the admin endpoint, and the automatic cleanup.
 *
 *   node src/scripts/smoke-cleanup.js
 *
 * Every account this creates is created through the real endpoints and erased
 * again before the script exits, including on failure. Ages are produced by
 * backdating users.created_at, which is the only way to test a 24-hour rule
 * without waiting 24 hours; nothing else about the rows is falsified.
 *
 * The cleanup cases work on real production tables, so each one is checked by
 * asking whether that specific id survived — never by counting rows, which
 * would be wrong the moment a real candidate signed up mid-run.
 */
import assert from 'node:assert'
import { closePool, one, query } from '../db/pool.js'
import { cleanupNoCv, countEligible, ensureCleanupScheduled, runCleanupJob, CLEANUP_JOB } from '../worker/handlers/cleanupNoCv.js'
import { hashPassword } from '../lib/password.js'

const API = process.env.API_URL ?? 'http://127.0.0.1:4000'
const TAG = `cleanuptest+${Math.random().toString(36).slice(2, 9)}`
const PASS = 'TestPass!2026'

let passed = 0
let failed = 0
const created = []

const check = async (name, fn) => {
  try {
    await fn()
    passed += 1
    console.log(`  PASS  ${name}`)
  } catch (err) {
    failed += 1
    console.log(`  FAIL  ${name}\n        ${err.message}`)
  }
}

const api = async (path, { method = 'GET', body, cookies = '' } = {}) => {
  const res = await fetch(API + path, {
    method,
    headers: { 'content-type': 'application/json', ...(cookies ? { cookie: cookies } : {}) },
    body: body ? JSON.stringify(body) : undefined,
  })
  const setCookie = res.headers.getSetCookie?.() ?? []
  return {
    status: res.status,
    body: await res.json().catch(() => ({})),
    cookies: setCookie.map((c) => c.split(';')[0]).join('; '),
  }
}

/** A real candidate, through the real registration endpoint. */
const makeCandidate = async (label) => {
  const email = `${TAG}.${label}@meinroots.test`
  const res = await api('/api/auth/register', {
    method: 'POST',
    body: {
      name: `Cleanup ${label}`, email, password: PASS, goals: ['germany'], locale: 'en',
      consents: { terms: true, privacy: true, data_processing: true },
    },
  })
  assert.equal(res.status, 201, `register ${label} -> ${res.status} ${JSON.stringify(res.body)}`)
  const row = await one('SELECT id FROM users WHERE email = $1', [email])
  created.push(row.id)
  return { id: row.id, email, cookies: res.cookies }
}

const makeUser = async (label, role) => {
  const email = `${TAG}.${label}@meinroots.test`
  const row = await one(
    `INSERT INTO users (full_name, email, password_hash, role, locale, email_verified_at, gdpr_consent_at)
     VALUES ($1, $2, $3, $4::user_role, 'en', now(), now()) RETURNING id`,
    [`Cleanup ${label}`, email, await hashPassword(PASS), role],
  )
  created.push(row.id)
  return { id: row.id, email }
}

const ageHours = (userId, hours) =>
  query('UPDATE users SET created_at = now() - make_interval(hours => $2) WHERE id = $1', [userId, hours])

/** A cv_documents row in a given state, as the upload path would write it. */
const giveCv = (userId, status = 'uploaded') =>
  query(
    `INSERT INTO cv_documents (user_id, original_filename, storage_path, mime_type, size_bytes, sha256, status, is_primary)
     VALUES ($1, 'cv.pdf', $2, 'application/pdf', 1024, $3, $4::document_status, true)`,
    [userId, `${userId}/cv.pdf`, Math.random().toString(36).slice(2).padEnd(64, '0'), status],
  )

const alive = async (userId) =>
  Boolean(await one('SELECT id FROM users WHERE id = $1', [userId]))

const login = async (email) => {
  const res = await api('/api/auth/login', { method: 'POST', body: { email, password: PASS } })
  return res.cookies
}

const main = async () => {
  console.log(`\nMeinRoots — candidate deletion and cleanup\n  ${API}\n`)

  // ---------------------------------------------------------------- part 1
  console.log('manual deletion via the admin endpoint')

  const superAdmin = await makeUser('superadmin', 'super_admin')
  const plainAdmin = await makeUser('admin', 'admin')
  const recruiter = await makeUser('recruiter', 'company_admin')
  const superCookies = await login(superAdmin.email)
  const adminCookies = await login(plainAdmin.email)
  const recruiterCookies = await login(recruiter.email)

  await check('a super admin deletes a candidate with no email in the body', async () => {
    const c = await makeCandidate('m1')
    const res = await api(`/api/admin/candidates/${c.id}`, { method: 'DELETE', cookies: superCookies })
    assert.equal(res.status, 200, `expected 200, got ${res.status} ${JSON.stringify(res.body)}`)
    assert.equal(await alive(c.id), false, 'the candidate is still in the database')
  })

  await check('the deletion is recorded in the audit log', async () => {
    const c = await makeCandidate('m2')
    await api(`/api/admin/candidates/${c.id}`, { method: 'DELETE', cookies: superCookies })
    const row = await one(
      `SELECT action, actor_id, metadata FROM audit_log
        WHERE entity_id = $1 AND action = 'admin.gdpr_erasure' ORDER BY created_at DESC LIMIT 1`,
      [c.id],
    )
    assert.ok(row, 'no admin.gdpr_erasure entry was written')
    assert.equal(row.actor_id, superAdmin.id, 'the entry does not name the administrator')
    assert.ok(row.metadata.emailDigest, 'no email digest recorded')
    assert.ok(!JSON.stringify(row.metadata).includes(c.email), 'the raw email address was stored in the audit log')
  })

  await check('the candidate disappears from the admin list', async () => {
    const c = await makeCandidate('m3')
    const before = await api(`/api/admin/candidates?q=${encodeURIComponent(c.email)}`, { cookies: superCookies })
    assert.ok(before.body.data.some((r) => r.userId === c.id), 'the candidate was not in the list to begin with')
    await api(`/api/admin/candidates/${c.id}`, { method: 'DELETE', cookies: superCookies })
    const after = await api(`/api/admin/candidates?q=${encodeURIComponent(c.email)}`, { cookies: superCookies })
    assert.ok(!after.body.data.some((r) => r.userId === c.id), 'the candidate is still listed after deletion')
  })

  await check('a plain admin is refused', async () => {
    const c = await makeCandidate('m4')
    const res = await api(`/api/admin/candidates/${c.id}`, { method: 'DELETE', cookies: adminCookies })
    assert.equal(res.status, 403, `expected 403, got ${res.status}`)
    assert.equal(await alive(c.id), true, 'the candidate was deleted by a plain admin')
  })

  await check('a recruiter is refused', async () => {
    const c = await makeCandidate('m5')
    const res = await api(`/api/admin/candidates/${c.id}`, { method: 'DELETE', cookies: recruiterCookies })
    assert.ok(res.status === 403 || res.status === 401, `expected 401/403, got ${res.status}`)
    assert.equal(await alive(c.id), true, 'a recruiter deleted a candidate')
  })

  await check('a candidate cannot delete another candidate', async () => {
    const victim = await makeCandidate('m6')
    const attacker = await makeCandidate('m7')
    const cookies = await login(attacker.email)
    const res = await api(`/api/admin/candidates/${victim.id}`, { method: 'DELETE', cookies })
    assert.ok(res.status === 403 || res.status === 401, `expected 401/403, got ${res.status}`)
    assert.equal(await alive(victim.id), true, 'a candidate deleted another candidate')
  })

  await check('an anonymous request is refused', async () => {
    const c = await makeCandidate('m8')
    const res = await api(`/api/admin/candidates/${c.id}`, { method: 'DELETE' })
    assert.equal(res.status, 401, `expected 401, got ${res.status}`)
    assert.equal(await alive(c.id), true, 'an unauthenticated request deleted a candidate')
  })

  await check('a missing candidate returns 404', async () => {
    const res = await api('/api/admin/candidates/00000000-0000-0000-0000-000000000000', {
      method: 'DELETE', cookies: superCookies,
    })
    assert.equal(res.status, 404, `expected 404, got ${res.status}`)
  })

  await check('the endpoint refuses to delete a non-candidate', async () => {
    const other = await makeUser('victimadmin', 'admin')
    const res = await api(`/api/admin/candidates/${other.id}`, { method: 'DELETE', cookies: superCookies })
    assert.equal(res.status, 404, `expected 404, got ${res.status}`)
    assert.equal(await alive(other.id), true, 'an administrator was deleted through the candidate endpoint')
  })

  // ---------------------------------------------------------------- part 2
  console.log('\nautomatic cleanup of accounts with no CV')

  const cases = {
    young: await makeCandidate('c23h'),
    ripe: await makeCandidate('c25h'),
    uploaded: await makeCandidate('cvup'),
    processing: await makeCandidate('cvproc'),
    analysed: await makeCandidate('cvdone'),
    failed: await makeCandidate('cvfail'),
    recruiter: await makeUser('reccl', 'company_admin'),
    admin: await makeUser('admcl', 'admin'),
  }

  await ageHours(cases.young.id, 23)
  for (const k of ['ripe', 'uploaded', 'processing', 'analysed', 'failed']) await ageHours(cases[k].id, 25)
  await ageHours(cases.recruiter.id, 48)
  await ageHours(cases.admin.id, 48)

  await giveCv(cases.uploaded.id, 'uploaded')
  await giveCv(cases.processing.id, 'processing')
  await giveCv(cases.analysed.id, 'analysed')
  await giveCv(cases.failed.id, 'failed')

  const eligibleBefore = await countEligible()
  const first = await cleanupNoCv()

  await check('1. candidate 23 hours old with no CV survives', async () =>
    assert.equal(await alive(cases.young.id), true))
  await check('2. candidate 25 hours old with no CV is deleted', async () =>
    assert.equal(await alive(cases.ripe.id), false))
  await check('3. candidate 25 hours old with an uploaded CV survives', async () =>
    assert.equal(await alive(cases.uploaded.id), true))
  await check('4. candidate 25 hours old with a CV in processing survives', async () =>
    assert.equal(await alive(cases.processing.id), true))
  await check('5. candidate 25 hours old with an analysed CV survives', async () =>
    assert.equal(await alive(cases.analysed.id), true))
  await check('5b. candidate whose CV analysis failed survives', async () =>
    assert.equal(await alive(cases.failed.id), true, 'deleted for our own analysis failure'))
  await check('6. a 48-hour-old recruiter with no CV survives', async () =>
    assert.equal(await alive(cases.recruiter.id), true))
  await check('7. a 48-hour-old admin with no CV survives', async () =>
    assert.equal(await alive(cases.admin.id), true))

  await check('the count of eligible accounts matched what was erased', async () => {
    assert.ok(eligibleBefore >= 1, 'nothing was eligible, so the run proved nothing')
    assert.equal(await countEligible(), 0, 'accounts are still eligible after a full run')
    assert.ok(first.erased >= 1, `the run reported ${first.erased} erased`)
  })

  await check('8. an upload that lands during the run saves the candidate', async () => {
    // The scan picks the account up, then a CV arrives before the delete
    // commits. Simulated by writing the document between the two, which is the
    // exact window the re-check inside the locked transaction exists to close.
    const racer = await makeCandidate('race')
    await ageHours(racer.id, 30)
    const ids = await query(
      `SELECT u.id FROM users u
        WHERE u.role = 'candidate' AND u.deleted_at IS NULL
          AND u.created_at < now() - make_interval(hours => 24)
          AND NOT EXISTS (SELECT 1 FROM cv_documents d WHERE d.user_id = u.id)`,
    )
    assert.ok(ids.rows.some((r) => r.id === racer.id), 'the scan did not find the racer')
    await giveCv(racer.id, 'uploaded')
    const run = await cleanupNoCv()
    assert.equal(await alive(racer.id), true, 'a candidate was deleted after uploading a CV')
    assert.ok(run.erased === 0, `the run erased ${run.erased} accounts it should not have`)
  })

  await check('9. a second run is a no-op rather than an error', async () => {
    const again = await cleanupNoCv()
    assert.equal(again.erased, 0, `the second run erased ${again.erased}`)
    assert.equal(await countEligible(), 0)
  })

  await check('10. an account with M2 recruitment records is erased cleanly', async () => {
    const c = await makeCandidate('m2rec')
    const company = await one('SELECT id FROM companies LIMIT 1')
    if (!company) return // nothing to attach to on an empty install
    await query(
      `INSERT INTO recruitment_requests (company_id, candidate_id, type, message, status)
       VALUES ($1, $2, 'contact', 'cleanup test', 'pending')`,
      [company.id, c.id],
    )
    await query(
      'INSERT INTO saved_candidates (company_id, candidate_id) VALUES ($1, $2) ON CONFLICT DO NOTHING',
      [company.id, c.id],
    )
    await ageHours(c.id, 30)
    await cleanupNoCv()
    assert.equal(await alive(c.id), false, 'the candidate survived')
    const left = await query(
      `SELECT (SELECT count(*) FROM recruitment_requests WHERE candidate_id = $1)::int AS reqs,
              (SELECT count(*) FROM saved_candidates   WHERE candidate_id = $1)::int AS saved`,
      [c.id],
    )
    assert.equal(left.rows[0].reqs, 0, 'recruitment requests were left behind')
    assert.equal(left.rows[0].saved, 0, 'saved-candidate rows were left behind')
    // The company is a row in companies, not in users — erasing a candidate
    // must take their requests with them and leave the employer standing.
    const stillThere = await one('SELECT id FROM companies WHERE id = $1', [company.id])
    assert.ok(stillThere, 'erasing the candidate removed the company too')
  })

  await check('the automatic deletion is audited as a system action', async () => {
    const row = await one(
      `SELECT actor_id, actor_role, metadata FROM audit_log
        WHERE entity_id = $1 AND action = 'candidate.auto_erasure' ORDER BY created_at DESC LIMIT 1`,
      [cases.ripe.id],
    )
    assert.ok(row, 'no candidate.auto_erasure entry was written')
    assert.equal(row.actor_id, null, 'an automatic deletion named a human actor')
    assert.equal(row.actor_role, null, 'actor_role is the user_role enum; system is not one')
    assert.equal(row.metadata.actor, 'system')
    assert.equal(row.metadata.reason, 'no_cv_after_24_hours')
    assert.ok(!row.metadata.emailDigest, 'the automatic path kept a fingerprint of the person')
  })

  await check('the next sweep is scheduled, and only one of it', async () => {
    await ensureCleanupScheduled()
    await ensureCleanupScheduled()
    const { rows } = await query(
      `SELECT count(*)::int AS n FROM jobs WHERE type = $1 AND status = 'queued'`,
      [CLEANUP_JOB],
    )
    assert.equal(rows[0].n, 1, `expected exactly one queued cleanup, found ${rows[0].n}`)
  })

  await check('a running sweep can still queue its successor', async () => {
    // The bug this exists for: the sweep reschedules from a finally block, so
    // its own row is still 'running' at that moment. While the guard counted
    // running jobs, every sweep saw itself, concluded one was already
    // scheduled, and queued nothing — the chain died after one run and only a
    // restart revived it. The earlier test missed it by calling
    // ensureCleanupScheduled with no job in flight, which is not how it runs.
    await query(`DELETE FROM jobs WHERE type = $1 AND status = 'queued'`, [CLEANUP_JOB])
    const running = await one(
      `INSERT INTO jobs (type, status, locked_at, locked_by, started_at)
       VALUES ($1, 'running', now(), 'smoke-cleanup', now()) RETURNING id`,
      [CLEANUP_JOB],
    )
    try {
      await ensureCleanupScheduled({ delayHours: 6 })
      const { rows } = await query(
        `SELECT count(*)::int AS n FROM jobs WHERE type = $1 AND status = 'queued'`,
        [CLEANUP_JOB],
      )
      assert.equal(rows[0].n, 1, 'a running sweep failed to queue the next one — the chain would stop here')
    } finally {
      await query('DELETE FROM jobs WHERE id = $1', [running.id])
    }
  })

  await check('a full run leaves a successor queued', async () => {
    await query(`DELETE FROM jobs WHERE type = $1 AND status = 'queued'`, [CLEANUP_JOB])
    await runCleanupJob()
    const { rows } = await query(
      `SELECT count(*)::int AS n FROM jobs WHERE type = $1 AND status = 'queued'`,
      [CLEANUP_JOB],
    )
    assert.equal(rows[0].n, 1, 'after a sweep there is no next sweep queued')
  })

  console.log(`\n  ${passed} passed, ${failed} failed\n`)
}

main()
  .catch((err) => {
    failed += 1
    console.error('\nharness error:', err)
  })
  .finally(async () => {
    // Everything this script made, gone — including on failure. Matched on the
    // run's own random tag so a parallel run or a real account is never touched.
    const { rowCount } = await query('DELETE FROM users WHERE email LIKE $1', [`${TAG}%`])
    console.log(`  cleaned up ${rowCount} test account(s)`)
    await closePool()
    process.exit(failed ? 1 : 0)
  })
