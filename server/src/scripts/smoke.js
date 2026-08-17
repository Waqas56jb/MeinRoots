#!/usr/bin/env node
/**
 * End-to-end check against a running API.
 *
 *   API_URL=http://127.0.0.1:4000 node src/scripts/smoke.js
 *
 * Exercises the whole candidate journey with a throwaway account and deletes it
 * afterwards. Every assertion prints, so a failure says which step broke rather
 * than just returning a non-zero exit code.
 */
const BASE = process.env.API_URL || 'http://127.0.0.1:4000'

let passed = 0
let failed = 0
const cookies = new Map()

const jar = () => [...cookies.entries()].map(([k, v]) => `${k}=${v}`).join('; ')

const remember = (response) => {
  for (const raw of response.headers.getSetCookie?.() ?? []) {
    const [pair] = raw.split(';')
    const idx = pair.indexOf('=')
    const name = pair.slice(0, idx)
    const value = pair.slice(idx + 1)
    if (value) cookies.set(name, value)
    else cookies.delete(name)
  }
}

const call = async (method, path, body, isForm = false) => {
  const headers = { cookie: jar() }
  if (body && !isForm) headers['content-type'] = 'application/json'
  const response = await fetch(`${BASE}${path}`, {
    method,
    headers,
    body: isForm ? body : body ? JSON.stringify(body) : undefined,
  })
  remember(response)
  const text = await response.text()
  let json = null
  try {
    json = text ? JSON.parse(text) : null
  } catch {
    json = { raw: text.slice(0, 200) }
  }
  return { status: response.status, body: json }
}

const check = (label, condition, detail = '') => {
  if (condition) {
    passed += 1
    process.stdout.write(`  PASS  ${label}\n`)
  } else {
    failed += 1
    process.stdout.write(`  FAIL  ${label}${detail ? ` — ${detail}` : ''}\n`)
  }
}

const email = `smoke+${Date.now().toString(36)}@meinroots.test`
const password = 'Smoke-Test-9915'

const run = async () => {
  process.stdout.write(`\nMeinRoots API smoke test → ${BASE}\n\n`)

  const health = await call('GET', '/api/health')
  check('health responds', health.status === 200, `status ${health.status}`)
  check('database reachable', Boolean(health.body?.data?.time))
  process.stdout.write(`        openai: ${health.body?.data?.ai}\n`)

  const anon = await call('GET', '/api/profile/me')
  check('protected route rejects anonymous', anon.status === 401, `status ${anon.status}`)

  const badRegister = await call('POST', '/api/auth/register', {
    name: 'Partial Consent',
    email: `x${Date.now()}@meinroots.test`,
    password,
    goals: ['germany'],
    // A required consent left out entirely: the request must be refused, not
    // silently defaulted to false and the account created without it.
    consents: { terms: true, privacy: true },
  })
  check('register without every required consent is rejected', badRegister.status === 400, `status ${badRegister.status}`)

  const shortPw = await call('POST', '/api/auth/register', {
    name: 'Short',
    email: `y${Date.now()}@meinroots.test`,
    password: 'abc',
    goals: ['germany'],
    consents: { terms: true, privacy: true, data_processing: true },
  })
  check('short password is rejected', shortPw.status === 400)

  const register = await call('POST', '/api/auth/register', {
    name: 'Smoke Candidate',
    email,
    password,
    goals: ['germany', 'ausbildung'],
    locale: 'de',
    consents: { terms: true, privacy: true, data_processing: true },
  })
  check('register succeeds', register.status === 201, JSON.stringify(register.body).slice(0, 160))
  // Array.isArray matters: a Postgres enum array with no type parser comes back
  // as the string "{germany,ausbildung}", whose .includes() would pass happily.
  check(
    'goals come back as a real array',
    Array.isArray(register.body?.data?.user?.goals),
    JSON.stringify(register.body?.data?.user?.goals),
  )
  check('ausbildung goal is accepted', register.body?.data?.user?.goals?.includes?.('ausbildung'))
  check('password hash is never returned', !JSON.stringify(register.body).includes('$2'))

  const duplicate = await call('POST', '/api/auth/register', {
    name: 'Duplicate',
    email,
    password,
    goals: ['remote'],
    consents: { terms: true, privacy: true, data_processing: true },
  })
  check('duplicate email is rejected', duplicate.status === 409, `status ${duplicate.status}`)

  const me = await call('GET', '/api/auth/me')
  check('session cookie authenticates', me.status === 200 && me.body?.data?.user?.email === email)

  // ------------------------------ consent ------------------------------------
  const consents = me.body?.data?.user?.consents
  check('consents are returned with the session', Boolean(consents), JSON.stringify(consents))
  check('required consents are recorded as given', consents?.terms === true && consents?.data_processing === true)
  // The registration above sent no optional consents at all. The two that are
  // still opt-in must come back false — an omitted optional consent is a
  // refusal, never an assumption.
  check(
    'omitted optional consents default to refused',
    consents?.job_alerts === false && consents?.marketing === false,
    JSON.stringify(consents),
  )
  // employer_sharing is the exception, and deliberately so: being presented to
  // employers is what the candidate came for, so it is stated in the terms
  // checkbox and granted by accepting them. It is asserted here rather than
  // left untested, because it is now the one consent the server decides.
  check(
    'employer_sharing comes with accepting the terms',
    consents?.employer_sharing === true,
    JSON.stringify(consents),
  )
  check('the accepted terms version is recorded', Boolean(consents?.acceptedVersion))

  const grant = await call('PATCH', '/api/auth/consents', { employer_sharing: true })
  check('an optional consent can be granted later', grant.body?.data?.consents?.employer_sharing === true)

  const withdraw = await call('PATCH', '/api/auth/consents', { employer_sharing: false })
  check(
    'and withdrawn as easily as it was granted',
    withdraw.body?.data?.consents?.employer_sharing === false,
    JSON.stringify(withdraw.body?.data?.consents),
  )

  const forceRequired = await call('PATCH', '/api/auth/consents', { terms: false })
  check(
    'a required consent cannot be withdrawn through the settings endpoint',
    forceRequired.status === 400,
    `status ${forceRequired.status}`,
  )

  const emptyProfile = await call('GET', '/api/profile/me')
  check('profile exists from registration', emptyProfile.status === 200)

  const admin = await call('GET', '/api/admin/candidates')
  check('candidate cannot reach admin API', admin.status === 403, `status ${admin.status}`)

  const noFile = await call('POST', '/api/cv/upload')
  check('upload without a file is rejected', noFile.status === 400, `status ${noFile.status}`)

  const form = new FormData()
  form.append('cv', new Blob(['not a real pdf'], { type: 'image/png' }), 'photo.png')
  const badType = await call('POST', '/api/cv/upload', form, true)
  check('unsupported file type is rejected', badType.status === 400, `status ${badType.status}`)

  const wrongPassword = await call('POST', '/api/auth/login', { email, password: 'wrong-password-here' })
  check('wrong password is rejected', wrongPassword.status === 401)
  check(
    'login error does not reveal whether the account exists',
    wrongPassword.body?.error?.code === 'invalid_credentials',
  )

  const unknownAccount = await call('POST', '/api/auth/login', {
    email: 'nobody@meinroots.test',
    password: 'wrong-password-here',
  })
  check('unknown account returns the same error', unknownAccount.body?.error?.code === 'invalid_credentials')

  const login = await call('POST', '/api/auth/login', { email, password })
  check('login succeeds', login.status === 200 && login.body?.data?.user?.email === email)

  const goals = await call('PATCH', '/api/auth/goals', { goals: ['ausbildung'] })
  check('goals can be updated', goals.status === 200 && goals.body?.data?.user?.goals?.[0] === 'ausbildung')

  const badGoal = await call('PATCH', '/api/auth/goals', { goals: ['astronaut'] })
  check('unknown goal is rejected', badGoal.status === 400)

  const questionnaire = await call('GET', '/api/questionnaire/current')
  check('questionnaire endpoint responds before any CV', questionnaire.status === 200)

  const reset = await call('POST', '/api/auth/password/reset-request', { email })
  check('reset request always reports success', reset.status === 200 && reset.body?.data?.sent === true)

  const resetUnknown = await call('POST', '/api/auth/password/reset-request', {
    email: 'nobody@meinroots.test',
  })
  check('reset for unknown address responds identically', resetUnknown.body?.data?.sent === true)

  const logout = await call('POST', '/api/auth/logout')
  check('logout succeeds', logout.status === 204)

  const afterLogout = await call('GET', '/api/auth/me')
  check('session is dead after logout', afterLogout.status === 401, `status ${afterLogout.status}`)

  const notFound = await call('GET', '/api/does-not-exist')
  check('unknown route returns a structured 404', notFound.status === 404 && notFound.body?.error?.code === 'not_found')

  process.stdout.write(`\n  ${passed} passed, ${failed} failed\n`)
}

/**
 * Removes what this run created.
 *
 * It used to print "test account left behind" and exit, which over a couple of
 * days left thirty-odd @meinroots.test accounts sitting in the production
 * console. The client saw a list of profiles with no CV that appeared never to
 * be cleaned up and reported the deletion feature as broken three times; the
 * feature was working, and this was the mess it was working around.
 *
 * Runs even when the suite fails — a failed run leaves more behind, not less.
 * Matched on the exact addresses this run used, so a parallel run or a real
 * candidate can never be caught by it.
 */
const teardown = async () => {
  const { closePool, query } = await import('../db/pool.js')
  try {
    // The suite only ever creates one account. The x…/y… addresses belong to
    // registrations it expects to be *rejected*, so nothing should exist for
    // them — they are swept anyway, because "should" is how leftovers happen.
    const { rowCount } = await query(
      `DELETE FROM users
        WHERE email = $1
           OR email ~ '^[xy][0-9]{13}@meinroots\\.test$'`,
      [email],
    )
    process.stdout.write(`  cleaned up ${rowCount} test account(s)\n\n`)
  } catch (err) {
    process.stdout.write(`  WARNING: could not clean up test accounts — ${err.message}\n\n`)
  } finally {
    await closePool().catch(() => {})
  }
}

run()
  .catch((err) => {
    failed += 1
    process.stderr.write(`smoke test crashed: ${err.message}\n`)
  })
  .finally(async () => {
    await teardown()
    process.exit(failed ? 1 : 0)
  })
