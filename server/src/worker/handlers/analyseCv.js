import config from '../../config.js'
import { many, one, query } from '../../db/pool.js'
import { logger } from '../../lib/logger.js'
import { absolutePath } from '../../modules/cv/storage.js'
import { extractText, guessLanguage } from '../../modules/cv/extract.js'
import {
  recomputeCompleteness,
  refreshReviewFlags,
  saveClassification,
  saveExtraction,
  saveQuestionnaire,
  saveReadiness,
} from '../../modules/profile/repository.js'
import {
  assessReadiness,
  classifyProfile,
  extractProfile,
  generateQuestionnaire,
  translateCv,
} from '../../ai/steps.js'
import { queueEmail } from '../../lib/mailer.js'
import { setProgress } from '../queue.js'

const LANGUAGES = ['en', 'de', 'fr']

/**
 * The whole qualification pass for one uploaded CV.
 *
 * Ordering is deliberate: everything the candidate is waiting to see (profile,
 * classification, readiness, questions) happens before the translations, which
 * are the slowest and most expensive step and which nothing else depends on.
 * A translation failing therefore cannot cost the candidate their profile.
 */
export const analyseCv = async (job) => {
  const { documentId } = job.payload
  const document = await one('SELECT * FROM cv_documents WHERE id = $1 AND deleted_at IS NULL', [documentId])
  if (!document) throw new Error(`document ${documentId} no longer exists`)

  const user = await one('SELECT id, goals, locale FROM users WHERE id = $1 AND deleted_at IS NULL', [
    document.user_id,
  ])
  if (!user) throw new Error(`user for document ${documentId} no longer exists`)

  const goals = user.goals?.length ? user.goals : ['germany']
  const stage = (name, extra = {}) => setProgress(job.id, { stage: name, ...extra })

  await query("UPDATE cv_documents SET status = 'processing', error_message = NULL WHERE id = $1", [documentId])

  // ---------------------------------------------------------------- 1. text
  await stage('extracting_text')
  let text = document.extracted_text
  let pageCount = document.page_count
  if (!text) {
    const result = await extractText(absolutePath(document.storage_path), document.mime_type, document.original_filename)
    text = result.text
    pageCount = result.pageCount
    await query('UPDATE cv_documents SET extracted_text = $2, page_count = $3 WHERE id = $1', [
      documentId,
      text,
      pageCount,
    ])
  }

  const hint = guessLanguage(text)

  // ----------------------------------------------------------- 2. extraction
  await stage('analysing')
  const extraction = await extractProfile({
    text,
    languageHint: hint.language,
    jobId: job.id,
    userId: user.id,
  })

  const sourceLanguage = LANGUAGES.includes(extraction.detectedLanguage)
    ? extraction.detectedLanguage
    : hint.language && LANGUAGES.includes(hint.language)
      ? hint.language
      : 'en'

  await query(
    'UPDATE cv_documents SET source_language = $2, language_confidence = $3 WHERE id = $1',
    [documentId, sourceLanguage, extraction.languageConfidence ?? hint.confidence ?? null],
  )

  const profileId = await saveExtraction({ userId: user.id, documentId, extraction })

  // ------------------------------------------------------- 3. classification
  await stage('classifying')
  let classification = null
  try {
    const result = await classifyProfile({ extraction, jobId: job.id, userId: user.id })
    classification = await saveClassification({ profileId, classification: result, model: config.openai.model })
  } catch (err) {
    // A profile without a domain is still useful; the admin sees the flag.
    logger.warn('classification failed', { documentId, message: err.message })
  }

  // -------------------------------------------------------- 4. questionnaire
  await stage('questionnaire')
  try {
    const { questions } = await generateQuestionnaire({
      extraction,
      classification,
      goals,
      jobId: job.id,
      userId: user.id,
    })
    await saveQuestionnaire({ profileId, questions, model: config.openai.model })
  } catch (err) {
    logger.warn('questionnaire generation failed', { documentId, message: err.message })
  }

  // ------------------------------------------------------------ 5. readiness
  await stage('readiness')
  for (const goal of goals) {
    try {
      const readiness = await assessReadiness({
        extraction,
        classification,
        goal,
        jobId: job.id,
        userId: user.id,
      })
      await saveReadiness({ profileId, goal, readiness, model: config.openai.model })
    } catch (err) {
      logger.warn('readiness failed', { documentId, goal, message: err.message })
    }
  }

  // --------------------------------------------------------- 6. bookkeeping
  await refreshReviewFlags(profileId)
  await recomputeCompleteness(profileId)

  // The candidate can see everything above now; mark the document done before
  // the translations rather than after.
  await query("UPDATE cv_documents SET status = 'analysed', processed_at = now() WHERE id = $1", [documentId])

  // -------------------------------------------------------- 7. translations
  await stage('translating')
  await query(
    `INSERT INTO cv_versions (document_id, language, content, is_source, model)
     VALUES ($1, $2, $3, true, NULL)
     ON CONFLICT (document_id, language) DO NOTHING`,
    [documentId, sourceLanguage, text],
  )

  for (const target of LANGUAGES.filter((l) => l !== sourceLanguage)) {
    try {
      const { content } = await translateCv({
        text,
        targetLanguage: target,
        sourceLanguage,
        jobId: job.id,
        userId: user.id,
      })
      await query(
        `INSERT INTO cv_versions (document_id, language, content, is_source, model)
         VALUES ($1,$2,$3,false,$4)
         ON CONFLICT (document_id, language) DO UPDATE SET content = EXCLUDED.content, model = EXCLUDED.model`,
        [documentId, target, content, config.openai.translationModel],
      )
    } catch (err) {
      logger.warn('translation failed', { documentId, target, message: err.message })
    }
  }

  // ------------------------------------------------------- 8. tell them
  // Sent last, once everything the email promises actually exists. The upload
  // screen tells the candidate they will be notified; this is that promise.
  await notifyProfileReady({ userId: user.id, profileId, classification })

  await stage('done')
  const versions = await many('SELECT language FROM cv_versions WHERE document_id = $1', [documentId])

  return {
    profileId,
    sourceLanguage,
    domain: classification?.domain ?? null,
    goals,
    versions: versions.map((v) => v.language),
  }
}

/**
 * "Your profile is ready" — the one email the analysis sends.
 *
 * Never throws: a mail problem must not fail a job whose real work is already
 * finished and already visible to the candidate.
 */
const notifyProfileReady = async ({ userId, profileId, classification }) => {
  try {
    const user = await one(
      'SELECT id, full_name, email, locale, notify_by_email FROM users WHERE id = $1 AND deleted_at IS NULL',
      [userId],
    )
    if (!user || user.notify_by_email === false) return

    const counts = await one(
      `SELECT count(*)::int AS outstanding
         FROM questionnaires q
         JOIN questionnaire_questions qq ON qq.questionnaire_id = q.id
         LEFT JOIN questionnaire_answers qa ON qa.question_id = qq.id
        WHERE q.profile_id = $1 AND qa.id IS NULL AND qq.is_required`,
      [profileId],
    )

    const domain = classification?.domain
      ? await one('SELECT label_en, label_de, label_fr FROM domains WHERE code = $1', [classification.domain])
      : null

    await queueEmail({
      userId: user.id,
      to: user.email,
      template: 'profile_ready',
      locale: user.locale ?? 'en',
      vars: {
        name: (user.full_name ?? '').split(' ')[0] || user.full_name,
        domain: domain?.[`label_${user.locale ?? 'en'}`] ?? domain?.label_en ?? null,
        questions: counts?.outstanding ?? 0,
      },
      url: `${config.appUrl}/dashboard`,
    })
  } catch (err) {
    logger.warn('profile-ready notification failed', { userId, message: err.message })
  }
}

/** Marks the document failed so the upload screen can show a real error state. */
export const onAnalyseFailed = async (job, error) => {
  const { documentId } = job.payload ?? {}
  if (!documentId) return
  await query(
    `UPDATE cv_documents
        SET status = 'failed', error_message = $2, processed_at = now()
      WHERE id = $1`,
    [documentId, String(error?.message || error).slice(0, 1000)],
  )
}
