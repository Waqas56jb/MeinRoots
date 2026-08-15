#!/usr/bin/env node
/**
 * Full candidate journey against a running API, including the OpenAI pipeline.
 *
 *   API_URL=http://127.0.0.1:4000 node src/scripts/e2e.js
 *
 * Registers a candidate, uploads a generated CV, waits for the analysis to
 * finish and then asserts on what came out: profile, classification, readiness,
 * skill gaps, questionnaire and the three language versions.
 *
 * This one costs real OpenAI tokens — it is not part of `npm run smoke`.
 */
const BASE = process.env.API_URL || 'http://127.0.0.1:4000'
const TIMEOUT_MS = Number(process.env.E2E_TIMEOUT_MS || 300000)

const cookies = new Map()
let passed = 0
let failed = 0

const jar = () => [...cookies.entries()].map(([k, v]) => `${k}=${v}`).join('; ')
const remember = (res) => {
  for (const raw of res.headers.getSetCookie?.() ?? []) {
    const [pair] = raw.split(';')
    const i = pair.indexOf('=')
    if (pair.slice(i + 1)) cookies.set(pair.slice(0, i), pair.slice(i + 1))
    else cookies.delete(pair.slice(0, i))
  }
}

const call = async (method, path, body, isForm = false) => {
  const headers = { cookie: jar() }
  if (body && !isForm) headers['content-type'] = 'application/json'
  const res = await fetch(`${BASE}${path}`, {
    method,
    headers,
    body: isForm ? body : body ? JSON.stringify(body) : undefined,
  })
  remember(res)
  const text = await res.text()
  try {
    return { status: res.status, body: text ? JSON.parse(text) : null }
  } catch {
    return { status: res.status, body: { raw: text.slice(0, 300) } }
  }
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

const info = (line) => process.stdout.write(`        ${line}\n`)

/**
 * Builds a small but valid PDF with a real text layer.
 *
 * Written by hand rather than pulled from a PDF library: the test needs a file
 * whose contents it controls exactly, so the assertions below can be about
 * whether extraction found the right employer rather than about fixtures.
 *
 * Every offset is measured in latin1 — the encoding the file is finally written
 * in — and not with the default utf8. An em dash is one byte in latin1 and
 * three in utf8, so counting in utf8 shifts every xref entry after the first
 * accented character. The reader then falls back to scanning for objects, which
 * succeeds or throws "bad XRef entry" depending on what it happens to find.
 */
const ENCODING = 'latin1'
const bytes = (text) => Buffer.byteLength(text, ENCODING)

const buildPdf = (lines) => {
  const escape = (s) => s.replace(/\\/g, '\\\\').replace(/\(/g, '\\(').replace(/\)/g, '\\)')
  const content = `BT /F1 11 Tf 40 780 Td 14 TL\n${lines
    .map((l) => `(${escape(l)}) Tj T*`)
    .join('\n')}\nET`

  const objects = [
    '<< /Type /Catalog /Pages 2 0 R >>',
    '<< /Type /Pages /Kids [3 0 R] /Count 1 >>',
    '<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Contents 4 0 R /Resources << /Font << /F1 5 0 R >> >> >>',
    `<< /Length ${bytes(content)} >>\nstream\n${content}\nendstream`,
    '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>',
  ]

  let pdf = '%PDF-1.4\n'
  const offsets = []
  objects.forEach((body, i) => {
    offsets.push(bytes(pdf))
    pdf += `${i + 1} 0 obj\n${body}\nendobj\n`
  })

  const xrefStart = bytes(pdf)
  pdf += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n`
  for (const offset of offsets) pdf += `${String(offset).padStart(10, '0')} 00000 n \n`
  pdf += `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xrefStart}\n%%EOF\n`

  return Buffer.from(pdf, ENCODING)
}

const CV_LINES = [
  'Amina Haddad',
  'Registered Nurse — Intensive Care',
  'Tunis, Tunisia | amina.haddad@example.com | +216 55 000 000',
  '',
  'PROFILE',
  'Registered nurse with 6 years of intensive care experience in a 400-bed teaching',
  'hospital. Seeking a nursing position in Germany. B1 German, currently studying for B2.',
  '',
  'EXPERIENCE',
  'Charge Nurse, Intensive Care Unit — Hopital Charles Nicolle, Tunis',
  'March 2021 - present',
  'Lead a shift team of six nurses across a 12-bed ICU. Responsible for ventilated',
  'patients, medication administration, and family communication. Introduced a handover',
  'checklist that reduced missed medication events.',
  '',
  'Staff Nurse — Clinique El Manar, Tunis',
  'September 2018 - February 2021',
  'Post-operative surgical ward. Wound care, vital sign monitoring, patient education.',
  '',
  'EDUCATION',
  'Bachelor of Nursing Science — University of Tunis El Manar, 2014 - 2018',
  '',
  'CERTIFICATIONS',
  'Advanced Cardiac Life Support (ACLS), Tunisian Red Crescent, 2022',
  'Goethe-Zertifikat B1, Goethe-Institut Tunis, 2023',
  '',
  'SKILLS',
  'Intensive care, ventilator management, wound care, triage, medication administration,',
  'electronic patient records, team leadership, infection control',
  '',
  'LANGUAGES',
  'Arabic (native), French (C1), English (B2), German (B1)',
]

const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

const run = async () => {
  process.stdout.write(`\nMeinRoots end-to-end pipeline test → ${BASE}\n\n`)

  const health = await call('GET', '/api/health')
  if (health.body?.data?.ai !== 'configured') {
    process.stderr.write('  OPENAI_API_KEY is not configured on the API — cannot run the pipeline test\n')
    process.exit(2)
  }

  const email = `e2e+${Date.now().toString(36)}@meinroots.test`
  const register = await call('POST', '/api/auth/register', {
    name: 'Amina Haddad',
    email,
    password: 'E2E-Test-Password-1',
    goals: ['germany', 'ausbildung'],
    locale: 'en',
    consents: { terms: true, privacy: true, data_processing: true, employer_sharing: true },
  })
  check('candidate registered', register.status === 201, JSON.stringify(register.body).slice(0, 200))

  const form = new FormData()
  form.append('cv', new Blob([buildPdf(CV_LINES)], { type: 'application/pdf' }), 'amina-haddad-cv.pdf')
  const upload = await call('POST', '/api/cv/upload', form, true)
  check('CV uploaded', upload.status === 201, JSON.stringify(upload.body).slice(0, 300))

  const documentId = upload.body?.data?.document?.id
  if (!documentId) {
    process.stdout.write('\n  upload failed, cannot continue\n')
    process.exit(1)
  }

  process.stdout.write('\n  waiting for analysis...\n')
  const deadline = Date.now() + TIMEOUT_MS
  let status = null
  let lastStage = null
  while (Date.now() < deadline) {
    status = (await call('GET', `/api/cv/documents/${documentId}/status`)).body?.data
    const stage = status?.job?.stage
    if (stage && stage !== lastStage) {
      lastStage = stage
      info(`stage: ${stage}`)
    }
    if (status?.done) break
    await sleep(3000)
  }

  check('analysis finished', Boolean(status?.done), `document status ${status?.document?.status}`)
  check('analysis succeeded', status?.ok === true, status?.document?.error || status?.job?.error || '')
  if (!status?.ok) {
    process.stdout.write(`\n  ${passed} passed, ${failed} failed\n\n`)
    process.exit(1)
  }

  check('source language detected', Boolean(status?.document?.sourceLanguage))
  info(`source language: ${status?.document?.sourceLanguage}`)

  const profile = (await call('GET', '/api/profile/me')).body?.data?.profile
  check('profile was built', Boolean(profile))
  check('experience extracted', (profile?.experiences?.length ?? 0) >= 2, `${profile?.experiences?.length} roles`)
  check('education extracted', (profile?.education?.length ?? 0) >= 1)
  check('skills extracted', (profile?.skills?.length ?? 0) >= 5, `${profile?.skills?.length} skills`)
  check('languages extracted', (profile?.languages?.length ?? 0) >= 3)
  check(
    'German level was picked up',
    profile?.languages?.some((l) => /german|deutsch/i.test(l.language)),
    JSON.stringify(profile?.languages?.map((l) => `${l.language}:${l.level}`)),
  )
  check('classified into a domain', Boolean(profile?.classification?.domain))
  check(
    'healthcare domain chosen',
    profile?.classification?.domain === 'health',
    `got "${profile?.classification?.domain}"`,
  )
  info(`domain: ${profile?.classification?.domain} / ${profile?.classification?.specialisation}`)
  info(`completeness: ${profile?.completeness}%  review: ${profile?.reviewStatus}`)

  check('readiness assessed for both goals', (profile?.assessments?.length ?? 0) === 2, `${profile?.assessments?.length}`)
  for (const a of profile?.assessments ?? []) {
    info(`readiness ${a.goal}: ${a.score}/100 (${a.band}), ${a.factors.length} factors, ${a.gaps.length} gaps`)
  }
  check(
    'readiness is explainable, not a bare score',
    (profile?.assessments ?? []).every((a) => a.factors.length >= 3),
  )
  check('skill gaps produced', (profile?.assessments ?? []).some((a) => a.gaps.length > 0))

  const questionnaire = (await call('GET', '/api/questionnaire/current')).body?.data
  check('questionnaire generated', (questionnaire?.questions?.length ?? 0) > 0, `${questionnaire?.questions?.length}`)
  check('questionnaire is short', (questionnaire?.questions?.length ?? 0) <= 8)
  check('every question explains itself', (questionnaire?.questions ?? []).every((q) => Boolean(q.reason)))
  for (const q of questionnaire?.questions ?? []) info(`Q: ${q.question} [${q.inputType}]`)

  const answerable = (questionnaire?.questions ?? []).filter((q) => q.inputType !== 'date').slice(0, 3)
  if (answerable.length) {
    const answers = answerable.map((q) => ({
      questionId: q.id,
      value:
        q.inputType === 'boolean'
          ? true
          : q.inputType === 'number'
            ? 3
            : q.inputType === 'multi_select'
              ? [q.options?.[0]?.value ?? 'unknown']
              : q.inputType === 'single_select'
                ? q.options?.[0]?.value ?? 'unknown'
                : 'Yes, within three months.',
    }))
    const saved = await call('POST', '/api/questionnaire/answers', { answers })
    check('answers saved', saved.status === 200, JSON.stringify(saved.body).slice(0, 200))
  }

  // The document reports "analysed" before the translations run, so waiting on
  // `done` alone would race them.
  if (status?.translationsPending) info('waiting for translations...')
  const translationDeadline = Date.now() + 180000
  let versions = []
  while (Date.now() < translationDeadline) {
    versions = (await call('GET', `/api/cv/documents/${documentId}/versions`)).body?.data?.versions ?? []
    if (versions.length >= 3) break
    const poll = (await call('GET', `/api/cv/documents/${documentId}/status`)).body?.data
    if (!poll?.translationsPending) break
    await sleep(3000)
  }
  check('three language versions exist', versions.length === 3, `${versions.length}: ${versions.map((v) => v.language)}`)
  check('exactly one is the untouched source', versions.filter((v) => v.isSource).length === 1)
  check(
    'AI versions are labelled as unreviewed',
    versions.filter((v) => !v.isSource).every((v) => v.isAiGenerated && !v.reviewed),
  )
  const german = versions.find((v) => v.language === 'de')
  check('German version has real content', (german?.content?.length ?? 0) > 200, `${german?.content?.length} chars`)

  const original = await fetch(`${BASE}/api/cv/documents/${documentId}/file`, { headers: { cookie: jar() } })
  const bytes = Buffer.from(await original.arrayBuffer())
  check('original file downloads', original.status === 200)
  check(
    'original bytes are unchanged',
    bytes.equals(buildPdf(CV_LINES)),
    `${bytes.length} vs ${buildPdf(CV_LINES).length} bytes`,
  )

  process.stdout.write(`\n  ${passed} passed, ${failed} failed\n`)
  process.stdout.write(`  test account: ${email}\n\n`)
  process.exit(failed ? 1 : 0)
}

run().catch((err) => {
  process.stderr.write(`e2e crashed: ${err.stack}\n`)
  process.exit(1)
})
