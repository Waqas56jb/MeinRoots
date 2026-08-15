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
  process.stdout.write(`  test account left behind: ${email}\n\n`)
  process.exit(failed ? 1 : 0)
}

run().catch((err) => {
  process.stderr.write(`smoke test crashed: ${err.message}\n`)
  process.exit(1)
})
