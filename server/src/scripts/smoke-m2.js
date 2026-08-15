#!/usr/bin/env node
/**
 * Milestone 2 smoke test — the recruiter marketplace.
 *
 * Drives the whole flow against a running API: a recruiter registers, gets a
 * trial, finds a candidate, asks to contact them, and the candidate answers.
 *
 * The tests that matter most are the privacy ones. They do not check that a
 * name is absent from what the UI renders — they check that the name is absent
 * from the JSON, by searching the entire serialised response for the string.
 * A field that is never in the payload cannot be revealed by a bug in a
 * component, a log line, or an error handler.
 */
const BASE = process.env.API_URL || 'http://127.0.0.1:4000'

let passed = 0
let failed = 0
const check = (name, ok, detail = '') => {
  if (ok) {
    passed++
    process.stdout.write(`  PASS  ${name}\n`)
  } else {
    failed++
    process.stdout.write(`  FAIL  ${name}${detail ? ` — ${detail}` : ''}\n`)
  }
}

/** Each actor keeps its own cookie jar, so nothing leaks between roles. */
const jar = () => {
  let cookies = {}
  return {
    header: () => Object.entries(cookies).map(([k, v]) => `${k}=${v}`).join('; '),
    remember: (res) => {
      for (const raw of res.headers.getSetCookie?.() ?? []) {
        const [pair] = raw.split(';')
        const idx = pair.indexOf('=')
        cookies[pair.slice(0, idx)] = pair.slice(idx + 1)
      }
    },
    clear: () => { cookies = {} },
  }
}

const call = async (j, method, path, body) => {
  const headers = { cookie: j.header() }
  if (body) headers['content-type'] = 'application/json'
  const res = await fetch(`${BASE}${path}`, {
    method, headers, body: body ? JSON.stringify(body) : undefined,
  })
  j.remember(res)
  const text = await res.text()
  let json = null
  try { json = text ? JSON.parse(text) : null } catch { json = { raw: text.slice(0, 200) } }
  return { status: res.status, body: json, text }
}

const stamp = Date.now().toString(36)
const CANDIDATE = { email: `m2.cand.${stamp}@meinroots.test`, password: 'M2-Test-Password-1', name: 'Yusuf Bergström' }
const RECRUITER = { email: `m2.rec.${stamp}@meinroots.test`, password: 'M2-Test-Password-1', name: 'Klara Mendes' }

const run = async () => {
  process.stdout.write(`\nMeinRoots Milestone 2 smoke → ${BASE}\n\n`)

  const cand = jar()
  const rec = jar()

  /* ------------------------- a candidate to find ------------------------- */

  const reg = await call(cand, 'POST', '/api/auth/register', {
    name: CANDIDATE.name,
    email: CANDIDATE.email,
    password: CANDIDATE.password,
    goals: ['germany'],
    locale: 'en',
    consents: {
      terms: true, privacy: true, data_processing: true,
      // Says yes to being found. Without this they are not discoverable at all.
      employer_sharing: true,
    },
  })
  check('candidate registered', reg.status === 201, `status ${reg.status}`)
  const candidateId = reg.body?.data?.user?.id

  /* ------------------------- recruiter registration ---------------------- */

  const missing = await call(rec, 'POST', '/api/recruiter/register', {
    recruiter: { name: RECRUITER.name, email: `x.${stamp}@meinroots.test`, password: RECRUITER.password },
    company: { legalName: 'Nordwind Pflege GmbH', country: 'Germany' },
    // One of the six left out.
    consents: { terms: true, privacy: true, legitimate_company: true, legitimate_use: true, access_understood: true },
  })
  check('registration without all six confirmations is refused', missing.status === 400, `status ${missing.status}`)

  const reg2 = await call(rec, 'POST', '/api/recruiter/register', {
    recruiter: { name: RECRUITER.name, email: RECRUITER.email, password: RECRUITER.password },
    company: { legalName: 'Nordwind Pflege GmbH', country: 'Germany', city: 'Hamburg' },
    consents: {
      terms: true, privacy: true, legitimate_company: true,
      legitimate_use: true, access_understood: true, no_guarantee: true,
    },
    locale: 'en',
  })
  check('recruiter registered', reg2.status === 201, JSON.stringify(reg2.body).slice(0, 200))
  check('company created', Boolean(reg2.body?.data?.company?.id))
  check('trial started', reg2.body?.data?.subscription?.status === 'trialing',
    JSON.stringify(reg2.body?.data?.subscription))
  check('trial has an end date', Boolean(reg2.body?.data?.subscription?.trialEndsAt))

  /* --------------------------- entitlements ------------------------------ */

  const me = await call(rec, 'GET', '/api/recruiter/me')
  check('recruiter /me works', me.status === 200)
  const features = me.body?.data?.features ?? {}
  check('trial grants candidate search', features.candidate_search === true)
  check('trial grants contact requests', features.contact_requests === true)
  // The three the trial must not include. If any of these is true the plan
  // configuration has drifted from what is sold.
  check('trial does NOT grant enhanced profiles', features.enhanced_profiles !== true)
  check('trial does NOT grant advanced filters', features.advanced_filters !== true)
  check('trial does NOT grant interview requests', features.interview_requests !== true)

  /* ------------------------------ search --------------------------------- */

  const search = await call(rec, 'GET', '/api/recruiter/candidates?limit=50')
  check('candidate search works', search.status === 200, `status ${search.status}`)
  const results = search.body?.data ?? []
  const found = results.find((c) => c.id === candidateId)
  check('the consenting candidate is discoverable', Boolean(found), `${results.length} results`)
  check('results carry a reference', Boolean(found?.reference), found?.reference)

  /* --------------------------- PRIVACY: the point ------------------------ */

  // The whole payload, as a string. If the name is anywhere in it, it leaked.
  check(
    'search response contains no candidate name',
    !search.text.includes(CANDIDATE.name),
    'candidate name found in search JSON',
  )
  check(
    'search response contains no candidate email',
    !search.text.includes(CANDIDATE.email),
    'candidate email found in search JSON',
  )

  const detail = await call(rec, 'GET', `/api/recruiter/candidates/${candidateId}`)
  check('candidate detail works', detail.status === 200, `status ${detail.status}`)
  check('detail is anonymous on a trial', detail.body?.data?.access?.level === 'anonymous',
    JSON.stringify(detail.body?.data?.access))
  check(
    'detail response contains no candidate name',
    !detail.text.includes(CANDIDATE.name),
    'candidate name found in detail JSON',
  )
  check(
    'detail response contains no candidate email',
    !detail.text.includes(CANDIDATE.email),
    'candidate email found in detail JSON',
  )
  check('no contact object before acceptance', detail.body?.data?.access?.contact === undefined)

  /* ------------------------------- saving -------------------------------- */

  const save = await call(rec, 'POST', `/api/recruiter/candidates/${candidateId}/save`)
  check('candidate can be saved', save.status === 201, `status ${save.status}`)
  const saved = await call(rec, 'GET', '/api/recruiter/saved')
  check('saved list returns them', (saved.body?.data ?? []).some((c) => c.id === candidateId))
  check('saved list is also anonymous', !saved.text.includes(CANDIDATE.name))

  /* ------------------------------ requests -------------------------------- */

  const interview = await call(rec, 'POST', '/api/recruiter/requests', {
    candidateId, type: 'interview', message: 'We would like to meet you.',
  })
  check('interview request is refused on a trial', interview.status === 403, `status ${interview.status}`)

  const contact = await call(rec, 'POST', '/api/recruiter/requests', {
    candidateId, type: 'contact', message: 'We would like to discuss your profile.',
  })
  check('contact request is allowed on a trial', contact.status === 201, JSON.stringify(contact.body).slice(0, 200))
  const requestId = contact.body?.data?.request?.id

  const duplicate = await call(rec, 'POST', '/api/recruiter/requests', {
    candidateId, type: 'contact', message: 'Again.',
  })
  check('a second open request of the same type is refused', duplicate.status === 409, `status ${duplicate.status}`)

  /* ------------------------- the candidate answers ------------------------ */

  const inbox = await call(cand, 'GET', '/api/recruitment/requests')
  check('candidate sees the request', inbox.status === 200 && (inbox.body?.data ?? []).length === 1)
  check('candidate sees the company name', inbox.body?.data?.[0]?.company?.name === 'Nordwind Pflege GmbH')

  const notMine = await call(rec, 'GET', '/api/recruitment/requests')
  check('a recruiter cannot use the candidate request API', notMine.status === 403, `status ${notMine.status}`)

  const accept = await call(cand, 'POST', `/api/recruitment/requests/${requestId}/accept`, {})
  check('candidate can accept', accept.status === 200, JSON.stringify(accept.body).slice(0, 160))

  const twice = await call(cand, 'POST', `/api/recruitment/requests/${requestId}/decline`, {})
  check('a request cannot be answered twice', twice.status === 409, `status ${twice.status}`)

  /* --------------------- access after acceptance -------------------------- */

  const after = await call(rec, 'GET', `/api/recruiter/candidates/${candidateId}`)
  check('access becomes granted after acceptance', after.body?.data?.access?.level === 'granted',
    JSON.stringify(after.body?.data?.access?.level))
  check('contact details are released', after.body?.data?.access?.contact?.email === CANDIDATE.email)
  check('and only then', after.text.includes(CANDIDATE.email))

  /* -------------------------- company isolation --------------------------- */

  const rec2 = jar()
  const other = await call(rec2, 'POST', '/api/recruiter/register', {
    recruiter: { name: 'Other Person', email: `m2.other.${stamp}@meinroots.test`, password: RECRUITER.password },
    company: { legalName: 'Other Company Ltd', country: 'Ireland' },
    consents: {
      terms: true, privacy: true, legitimate_company: true,
      legitimate_use: true, access_understood: true, no_guarantee: true,
    },
  })
  check('a second company registered', other.status === 201)

  const crossDetail = await call(rec2, 'GET', `/api/recruiter/candidates/${candidateId}`)
  check(
    'the other company does NOT inherit the acceptance',
    crossDetail.body?.data?.access?.level === 'anonymous',
    JSON.stringify(crossDetail.body?.data?.access?.level),
  )
  check(
    'the other company sees no contact details',
    !crossDetail.text.includes(CANDIDATE.email),
    'candidate email leaked to a company that was never accepted',
  )

  const crossRequests = await call(rec2, 'GET', '/api/recruiter/requests')
  check('the other company sees none of the first company requests',
    (crossRequests.body?.data ?? []).length === 0)

  const crossCancel = await call(rec2, 'DELETE', `/api/recruiter/requests/${requestId}`)
  check('the other company cannot touch the first company request', crossCancel.status === 404,
    `status ${crossCancel.status}`)

  /* ----------------------------- role matrix ------------------------------ */

  const candOnRecruiter = await call(cand, 'GET', '/api/recruiter/me')
  check('a candidate cannot reach recruiter APIs', candOnRecruiter.status === 403,
    `status ${candOnRecruiter.status}`)

  const recOnAdmin = await call(rec, 'GET', '/api/admin/companies')
  check('a recruiter cannot reach admin APIs', recOnAdmin.status === 403, `status ${recOnAdmin.status}`)

  const anon = jar()
  const anonSearch = await call(anon, 'GET', '/api/recruiter/candidates')
  check('search requires a session', anonSearch.status === 401, `status ${anonSearch.status}`)

  /* --------------------------- consent withdrawal ------------------------- */

  const withdraw = await call(cand, 'PATCH', '/api/auth/consents', { employer_sharing: false })
  check('candidate can withdraw employer sharing', withdraw.status === 200)

  const afterWithdraw = await call(rec, 'GET', '/api/recruiter/candidates?limit=50')
  check(
    'a withdrawn candidate disappears from search',
    !(afterWithdraw.body?.data ?? []).some((c) => c.id === candidateId),
    'candidate still discoverable after withdrawing consent',
  )
  const afterWithdrawDetail = await call(rec, 'GET', `/api/recruiter/candidates/${candidateId}`)
  check('and their detail becomes unavailable', afterWithdrawDetail.status === 404,
    `status ${afterWithdrawDetail.status}`)

  /* ------------------------------ injection ------------------------------- */

  const inject = await call(rec, 'GET',
    `/api/recruiter/candidates?q=${encodeURIComponent("'; DROP TABLE users; --")}`)
  check('a SQL payload in the search is just a search term', inject.status === 200,
    `status ${inject.status}`)
  const usersAlive = await call(rec, 'GET', '/api/recruiter/me')
  check('the database is intact afterwards', usersAlive.status === 200)

  const badSort = await call(rec, 'GET', '/api/recruiter/candidates?sort=users;DROP')
  check('an unknown sort key is rejected', badSort.status === 400, `status ${badSort.status}`)

  process.stdout.write(`\n  ${passed} passed, ${failed} failed\n\n`)
  process.exit(failed ? 1 : 0)
}

run().catch((err) => {
  process.stderr.write(`\nsmoke run failed: ${err.message}\n`)
  process.exit(1)
})
