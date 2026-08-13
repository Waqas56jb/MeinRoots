import { relative } from 'node:path'
import config from '../../config.js'
import { many, one, query, transaction } from '../../db/pool.js'
import { badRequest, notFound } from '../../lib/errors.js'
import { logger } from '../../lib/logger.js'
import { enqueue, latestJobForDocument } from '../../worker/queue.js'
import { deleteFile, sha256File } from './storage.js'

/**
 * Registers an uploaded file and queues the analysis.
 *
 * The HTTP request returns as soon as the row exists — parsing, translation and
 * scoring take tens of seconds and must not be held open on a connection the
 * candidate's phone will drop when the screen locks.
 */
export const registerUpload = async ({ user, file }) => {
  const storagePath = relative(config.storage.dir, file.path).split('\\').join('/')
  const sha256 = await sha256File(file.path)

  const existing = await one(
    `SELECT id FROM cv_documents
      WHERE user_id = $1 AND sha256 = $2 AND deleted_at IS NULL AND status <> 'failed'`,
    [user.id, sha256],
  )
  if (existing) {
    // Byte-identical re-upload, usually a double tap on a slow connection.
    // Point at the work already in flight instead of paying for it twice.
    await deleteFile(file.path)
    const job = await latestJobForDocument(existing.id)
    return { document: await getDocument(existing.id, user.id), jobId: job?.id ?? null, duplicate: true }
  }

  const document = await transaction(async (client) => {
    await client.query('UPDATE cv_documents SET is_primary = false WHERE user_id = $1 AND is_primary', [user.id])
    const { rows } = await client.query(
      `INSERT INTO cv_documents
         (user_id, original_filename, storage_path, mime_type, size_bytes, sha256, is_primary)
       VALUES ($1,$2,$3,$4,$5,$6,true)
       RETURNING *`,
      [user.id, file.originalname.slice(0, 255), storagePath, file.mimetype, file.size, sha256],
    )
    return rows[0]
  })

  const job = await enqueue({ type: 'cv.analyse', payload: { documentId: document.id }, priority: 10 })
  logger.info('cv queued for analysis', { documentId: document.id, jobId: job.id })

  return { document: presentDocument(document), jobId: job.id, duplicate: false }
}

const presentDocument = (row) => ({
  id: row.id,
  filename: row.original_filename,
  sizeBytes: Number(row.size_bytes),
  mimeType: row.mime_type,
  status: row.status,
  sourceLanguage: row.source_language,
  languageConfidence: row.language_confidence,
  pageCount: row.page_count,
  error: row.error_message,
  isPrimary: row.is_primary,
  uploadedAt: row.uploaded_at,
  processedAt: row.processed_at,
})

export const getDocument = async (documentId, userId) => {
  const row = await one(
    `SELECT * FROM cv_documents WHERE id = $1 AND deleted_at IS NULL ${userId ? 'AND user_id = $2' : ''}`,
    userId ? [documentId, userId] : [documentId],
  )
  if (!row) throw notFound('document_not_found', 'CV not found')
  return presentDocument(row)
}

export const getDocumentRow = (documentId, userId) =>
  one(
    `SELECT * FROM cv_documents WHERE id = $1 AND deleted_at IS NULL ${userId ? 'AND user_id = $2' : ''}`,
    userId ? [documentId, userId] : [documentId],
  )

export const listDocuments = async (userId) => {
  const rows = await many(
    'SELECT * FROM cv_documents WHERE user_id = $1 AND deleted_at IS NULL ORDER BY uploaded_at DESC',
    [userId],
  )
  return rows.map(presentDocument)
}

export const primaryDocument = async (userId) => {
  const row = await one(
    'SELECT * FROM cv_documents WHERE user_id = $1 AND is_primary AND deleted_at IS NULL',
    [userId],
  )
  return row ? presentDocument(row) : null
}

/**
 * What the upload screen polls. Combines the document row with its job so the
 * UI can distinguish "queued behind other work", "running step 3 of 5",
 * "finished" and "failed" — states a bare status column cannot express.
 */
export const analysisStatus = async (documentId, userId) => {
  const document = await getDocument(documentId, userId)
  const job = await latestJobForDocument(documentId)

  const stage = job?.progress?.stage ?? null
  const terminal = document.status === 'analysed' || document.status === 'failed'
  const jobRunning = job?.status === 'queued' || job?.status === 'running'

  return {
    document,
    // The profile is finished before the translations are — the handler marks
    // the document analysed early on purpose so the candidate is not kept
    // waiting on the slowest step. The UI needs to know the difference, or the
    // language tabs look broken for the ~20 seconds it takes them to land.
    translationsPending: document.status === 'analysed' && jobRunning,
    job: job
      ? {
          id: job.id,
          status: job.status,
          stage,
          attempts: job.attempts,
          maxAttempts: job.max_attempts,
          // A queued job that has already failed once is retrying, not stuck.
          willRetry: job.status === 'queued' && job.attempts > 0,
          error: job.status === 'dead' ? job.last_error : null,
          startedAt: job.started_at,
          finishedAt: job.finished_at,
        }
      : null,
    done: terminal,
    ok: document.status === 'analysed',
  }
}

export const listVersions = async (documentId, userId) => {
  const document = await getDocumentRow(documentId, userId)
  if (!document) throw notFound('document_not_found', 'CV not found')
  const rows = await many(
    'SELECT id, language, is_source, model, reviewed_at, created_at, content FROM cv_versions WHERE document_id = $1 ORDER BY is_source DESC, language',
    [documentId],
  )
  return rows.map((r) => ({
    id: r.id,
    language: r.language,
    isSource: r.is_source,
    // Everything the model wrote stays labelled until a human signs it off —
    // the FAQ promises exactly this.
    isAiGenerated: !r.is_source,
    reviewed: Boolean(r.reviewed_at),
    content: r.content,
    createdAt: r.created_at,
  }))
}

/** Re-queues analysis, e.g. after a failure or when goals changed. */
export const requeue = async (documentId, userId) => {
  const document = await getDocumentRow(documentId, userId)
  if (!document) throw notFound('document_not_found', 'CV not found')

  const existing = await latestJobForDocument(documentId)
  if (existing && (existing.status === 'queued' || existing.status === 'running')) {
    throw badRequest('already_running', 'This CV is already being analysed')
  }

  await query("UPDATE cv_documents SET status = 'uploaded', error_message = NULL WHERE id = $1", [documentId])
  const job = await enqueue({ type: 'cv.analyse', payload: { documentId }, priority: 5 })
  return { jobId: job.id }
}

/**
 * Soft-deletes the row and removes the bytes.
 *
 * The row is kept so the audit trail still shows a CV existed; the file itself
 * is destroyed because keeping personal data after a deletion request is the
 * thing GDPR is most direct about.
 */
export const deleteDocument = async (documentId, userId) => {
  const document = await getDocumentRow(documentId, userId)
  if (!document) throw notFound('document_not_found', 'CV not found')

  await query(
    `UPDATE cv_documents
        SET deleted_at = now(), is_primary = false, extracted_text = NULL
      WHERE id = $1`,
    [documentId],
  )
  const { absolutePath } = await import('./storage.js')
  await deleteFile(absolutePath(document.storage_path))
  return { deleted: true }
}
