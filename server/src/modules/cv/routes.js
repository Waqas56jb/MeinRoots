import { Router } from 'express'
import { asyncHandler, badRequest, forbidden } from '../../lib/errors.js'
import { created, noContent, ok } from '../../lib/http.js'
import { audit } from '../../lib/audit.js'
import { requireAuth } from '../../middleware/auth.js'
import { uploadLimiter } from '../../middleware/rateLimit.js'
import { absolutePath, upload } from './storage.js'
import * as service from './service.js'

const router = Router()

router.use(requireAuth)

router.post(
  '/upload',
  uploadLimiter,
  upload.single('cv'),
  asyncHandler(async (req, res) => {
    if (!req.file) throw badRequest('no_file', 'Attach a CV file under the field name "cv"')

    // Processing a CV without consent would be unlawful, and the signup form
    // makes it required — so a missing timestamp here means something is wrong
    // upstream, not that we should proceed.
    if (!req.user.gdpr_consent_at) {
      throw forbidden('consent_required', 'CV processing consent is missing on this account')
    }

    const result = await service.registerUpload({ user: req.user, file: req.file })
    await audit(req, {
      action: 'cv.upload',
      entityType: 'cv_document',
      entityId: result.document.id,
      metadata: {
        filename: result.document.filename,
        sizeBytes: result.document.sizeBytes,
        duplicate: result.duplicate,
      },
    })
    created(res, result)
  }),
)

router.get(
  '/documents',
  asyncHandler(async (req, res) => ok(res, { documents: await service.listDocuments(req.user.id) })),
)

router.get(
  '/documents/current',
  asyncHandler(async (req, res) => ok(res, { document: await service.primaryDocument(req.user.id) })),
)

router.get(
  '/documents/:id',
  asyncHandler(async (req, res) => ok(res, { document: await service.getDocument(req.params.id, req.user.id) })),
)

/** Polled by the upload screen while analysis runs. */
router.get(
  '/documents/:id/status',
  asyncHandler(async (req, res) => ok(res, await service.analysisStatus(req.params.id, req.user.id))),
)

router.get(
  '/documents/:id/versions',
  asyncHandler(async (req, res) => ok(res, { versions: await service.listVersions(req.params.id, req.user.id) })),
)

/** Streams back the original bytes, exactly as uploaded. */
router.get(
  '/documents/:id/file',
  asyncHandler(async (req, res) => {
    const document = await service.getDocumentRow(req.params.id, req.user.id)
    if (!document) throw badRequest('document_not_found', 'CV not found')

    await audit(req, { action: 'cv.download', entityType: 'cv_document', entityId: document.id })
    res.type(document.mime_type)
    // `attachment` rather than inline: an HTML-ish file served inline from our
    // own origin would run in it.
    res.setHeader(
      'Content-Disposition',
      `attachment; filename="${encodeURIComponent(document.original_filename)}"`,
    )
    res.sendFile(absolutePath(document.storage_path))
  }),
)

router.post(
  '/documents/:id/reanalyse',
  uploadLimiter,
  asyncHandler(async (req, res) => {
    const result = await service.requeue(req.params.id, req.user.id)
    await audit(req, { action: 'cv.reanalyse', entityType: 'cv_document', entityId: req.params.id })
    ok(res, result)
  }),
)

router.delete(
  '/documents/:id',
  asyncHandler(async (req, res) => {
    await service.deleteDocument(req.params.id, req.user.id)
    await audit(req, { action: 'cv.delete', entityType: 'cv_document', entityId: req.params.id })
    noContent(res)
  }),
)

export default router
