import { createHash, randomUUID } from 'node:crypto'
import { createReadStream } from 'node:fs'
import { mkdir, rm, stat } from 'node:fs/promises'
import { extname, join, normalize, resolve, sep } from 'node:path'
import multer from 'multer'
import config from '../../config.js'
import { badRequest } from '../../lib/errors.js'

/**
 * CVs are written to the server's own disk (200 GB SSD on the Contabo box).
 *
 * Layout: storage/cvs/<user-id>/<uuid><ext>. Sharding by user keeps any single
 * directory small and makes GDPR erasure a single recursive delete.
 */
export const userDir = (userId) => join(config.storage.dir, 'cvs', userId)

export const absolutePath = (storagePath) => {
  // storagePath comes from the database, but treating it as trusted is how a
  // path-traversal bug survives a refactor. Resolve and prove containment.
  const full = resolve(config.storage.dir, normalize(storagePath))
  const root = resolve(config.storage.dir)
  if (full !== root && !full.startsWith(root + sep)) {
    throw badRequest('invalid_path', 'Refusing to read outside the storage directory')
  }
  return full
}

export const ensureStorage = () => mkdir(join(config.storage.dir, 'cvs'), { recursive: true })

const storage = multer.diskStorage({
  destination: async (req, _file, cb) => {
    try {
      const dir = userDir(req.user.id)
      await mkdir(dir, { recursive: true })
      cb(null, dir)
    } catch (err) {
      cb(err)
    }
  },
  filename: (_req, file, cb) => {
    // The uploaded name is stored in the database for display, but never used
    // on disk: it is attacker-controlled and would otherwise decide a path.
    const ext = extname(file.originalname).toLowerCase()
    cb(null, `${randomUUID()}${ext}`)
  },
})

export const upload = multer({
  storage,
  limits: { fileSize: config.storage.maxUploadBytes, files: 1 },
  fileFilter: (_req, file, cb) => {
    const ext = extname(file.originalname).toLowerCase()
    const extOk = config.storage.acceptedExt.includes(ext)
    const mimeOk = config.storage.acceptedMime.includes(file.mimetype)
    // Either signal being right is enough: browsers routinely send
    // application/octet-stream for a .docx, and a wrong extension with a right
    // mime is equally common. The real gate is the parser, which fails loudly
    // on anything it cannot read.
    if (extOk || mimeOk) return cb(null, true)
    return cb(badRequest('unsupported_file_type', 'Upload a PDF or .docx CV'))
  },
})

export const sha256File = (path) =>
  new Promise((resolvePromise, reject) => {
    const hash = createHash('sha256')
    createReadStream(path)
      .on('error', reject)
      .on('data', (chunk) => hash.update(chunk))
      .on('end', () => resolvePromise(hash.digest('hex')))
  })

export const fileSize = async (path) => (await stat(path)).size

export const deleteFile = (path) => rm(path, { force: true })

export const deleteUserFiles = (userId) => rm(userDir(userId), { recursive: true, force: true })
