/**
 * Unit tests for the pure logic — the parts where a wrong answer is silent.
 *
 *   npm test
 *
 * Deliberately no database and no network: those paths are covered by
 * `npm run smoke` (27 checks) and `npm run e2e` (26, with real AI calls). What
 * is worth testing here is the code that transforms data without ever throwing,
 * because that is where a bug ships unnoticed.
 */
import assert from 'node:assert/strict'
import { describe, it } from 'node:test'

// config reads these at import time, and several modules under test import it.
process.env.DATABASE_URL ??= 'postgres://test:test@127.0.0.1:5432/test'
process.env.JWT_SECRET ??= 'unit-test-secret-not-used-for-anything-real'

const { guessLanguage } = await import('../modules/cv/extract.js')
const { renderEmail, TEMPLATES } = await import('../lib/emailTemplates.js')
const { hashToken, newOpaqueToken, safeEqual, signAccessToken, verifyAccessToken } = await import('../lib/tokens.js')
const { passwordProblems, hashPassword, verifyPassword, burnPasswordTime } = await import('../lib/password.js')
const { emailField, goalsField, localeField, passwordField } = await import('../lib/validate.js')

// ---------------------------------------------------------------- language ---

describe('guessLanguage', () => {
  it('identifies German from stop words, not from characters', () => {
    const cv = `Lebenslauf
      Ich bin seit 2019 bei der Firma Muller und habe Erfahrung mit der Pflege von Patienten.
      Meine Kenntnisse umfassen die Betreuung und die Dokumentation.
      Ausbildung: Krankenpfleger, abgeschlossen mit sehr gutem Ergebnis.`
    const { language } = guessLanguage(cv)
    assert.equal(language, 'de')
  })

  it('identifies English', () => {
    const cv = `Curriculum Vitae
      I have worked with the intensive care team and the surgical ward for six years.
      My skills include wound care and the education of junior staff.
      Experience: Registered Nurse from 2018 to the present.`
    assert.equal(guessLanguage(cv).language, 'en')
  })

  it('identifies French', () => {
    const cv = `Curriculum Vitae
      Je travaille depuis 2019 avec les equipes de soins et les patients de la clinique.
      Mes competences comprennent la formation et le suivi des dossiers.
      Experience : infirmier chez la clinique El Manar.`
    assert.equal(guessLanguage(cv).language, 'fr')
  })

  it('refuses to guess from too little text rather than guessing wrong', () => {
    const { language, confidence } = guessLanguage('John Smith')
    assert.equal(language, null)
    assert.equal(confidence, 0)
  })

  it('returns a confidence between 0 and 1', () => {
    // Must clear the 20-word floor below which the guess is refused outright.
    const { confidence } = guessLanguage(
      'the and with for from experience skills education work present university team ' +
        'project delivered patients records training support quality service and the work',
    )
    assert.ok(confidence > 0 && confidence <= 1, `got ${confidence}`)
  })
})

// ------------------------------------------------------------------ emails ---

describe('renderEmail', () => {
  it('renders every template in every language with both parts', () => {
    for (const template of TEMPLATES) {
      for (const locale of ['en', 'de', 'fr']) {
        const mail = renderEmail({
          template,
          locale,
          vars: { name: 'Amina', domain: 'Healthcare', questions: 2 },
          url: 'https://example.test/x?token=abc',
        })
        assert.ok(mail.subject.length > 3, `${template}/${locale} subject`)
        // A message with no text part is far more likely to be scored as spam.
        assert.ok(mail.text.includes('https://example.test/x?token=abc'), `${template}/${locale} text link`)
        assert.ok(mail.html.includes('https://example.test/x?token=abc'), `${template}/${locale} html link`)
      }
    }
  })

  it('gives each language its own subject', () => {
    const subjects = ['en', 'de', 'fr'].map(
      (locale) => renderEmail({ template: 'password_reset', locale, url: 'https://x' }).subject,
    )
    assert.equal(new Set(subjects).size, 3, `subjects were not distinct: ${subjects}`)
  })

  it('falls back to English for a language we do not speak', () => {
    const mail = renderEmail({ template: 'verify_email', locale: 'zz', vars: { name: 'X' }, url: 'https://x' })
    assert.equal(mail.subject, renderEmail({ template: 'verify_email', locale: 'en', vars: { name: 'X' }, url: 'https://x' }).subject)
  })

  it('escapes HTML in interpolated values', () => {
    const mail = renderEmail({
      template: 'profile_ready',
      locale: 'en',
      vars: { name: 'A', domain: '<script>alert(1)</script>', questions: 0 },
      url: 'https://x',
    })
    assert.ok(!mail.html.includes('<script>'), 'raw script tag reached the HTML body')
    assert.ok(mail.html.includes('&lt;script&gt;'))
  })

  it('refuses an unknown template instead of sending an empty message', () => {
    assert.throws(() => renderEmail({ template: 'nope', locale: 'en' }), /unknown email template/)
  })
})

// ------------------------------------------------------------------ tokens ---

describe('tokens', () => {
  it('never lets the raw token be derived from what is stored', () => {
    const { token, hash } = newOpaqueToken()
    assert.notEqual(token, hash)
    assert.equal(hash.length, 64) // sha256 hex
    assert.equal(hashToken(token), hash)
  })

  it('produces a different token every time', () => {
    const tokens = new Set(Array.from({ length: 50 }, () => newOpaqueToken().token))
    assert.equal(tokens.size, 50)
  })

  it('round-trips an access token and keeps the role', () => {
    const token = signAccessToken({ id: 'user-1', role: 'admin' })
    const payload = verifyAccessToken(token)
    assert.equal(payload.sub, 'user-1')
    assert.equal(payload.role, 'admin')
  })

  it('rejects a tampered access token', () => {
    const token = signAccessToken({ id: 'user-1', role: 'candidate' })
    // Flip the last character of the signature.
    const broken = token.slice(0, -1) + (token.at(-1) === 'a' ? 'b' : 'a')
    assert.throws(() => verifyAccessToken(broken))
  })

  it('compares in constant time without throwing on length mismatch', () => {
    assert.equal(safeEqual('abc', 'abc'), true)
    assert.equal(safeEqual('abc', 'abd'), false)
    assert.equal(safeEqual('abc', 'abcdef'), false)
  })
})

// --------------------------------------------------------------- passwords ---

describe('passwords', () => {
  it('rejects short passwords and accepts adequate ones', () => {
    assert.deepEqual(passwordProblems('short'), ['too_short'])
    assert.deepEqual(passwordProblems(''), ['too_short'])
    assert.deepEqual(passwordProblems('a-good-enough-one'), [])
    assert.deepEqual(passwordProblems('x'.repeat(201)), ['too_long'])
  })

  it('hashes and verifies, and never stores the password', async () => {
    const hash = await hashPassword('correct horse battery')
    assert.ok(!hash.includes('correct'))
    assert.equal(await verifyPassword('correct horse battery', hash), true)
    assert.equal(await verifyPassword('wrong horse battery', hash), false)
  })

  it('produces a different hash for the same password each time', async () => {
    const [a, b] = await Promise.all([hashPassword('same-password'), hashPassword('same-password')])
    assert.notEqual(a, b, 'salt is not being applied')
  })

  it('burnPasswordTime always resolves false, so a missing account costs the same', async () => {
    assert.equal(await burnPasswordTime('anything'), false)
    assert.equal(await burnPasswordTime(undefined), false)
  })
})

// -------------------------------------------------------------- validation ---

describe('validation fields', () => {
  it('lowercases and trims an email', () => {
    assert.equal(emailField.parse('  Anna@Example.COM '), 'anna@example.com')
  })

  it('rejects a malformed email', () => {
    assert.equal(emailField.safeParse('not-an-email').success, false)
    assert.equal(emailField.safeParse('a@b').success, false)
  })

  it('accepts the four objectives and rejects anything else', () => {
    assert.deepEqual(goalsField.parse(['germany', 'ausbildung']), ['germany', 'ausbildung'])
    assert.equal(goalsField.safeParse(['astronaut']).success, false)
    assert.equal(goalsField.safeParse([]).success, false)
  })

  it('deduplicates objectives so the array cannot misrepresent the choice', () => {
    assert.deepEqual(goalsField.parse(['remote', 'remote', 'germany']), ['remote', 'germany'])
  })

  it('accepts only the three supported locales', () => {
    assert.equal(localeField.parse('de'), 'de')
    assert.equal(localeField.safeParse('es').success, false)
  })

  it('enforces the password length rule at the API boundary too', () => {
    assert.equal(passwordField.safeParse('1234567').success, false)
    assert.equal(passwordField.safeParse('12345678').success, true)
  })
})
