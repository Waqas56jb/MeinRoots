import { createRequire } from 'node:module'
import { readFile } from 'node:fs/promises'
import mammoth from 'mammoth'
import { badRequest } from '../../lib/errors.js'
import { logger } from '../../lib/logger.js'

const require = createRequire(import.meta.url)

/**
 * pdf-parse's index.js runs a self-test against a bundled sample PDF whenever
 * `module.parent` is falsy — which it always is when required from ESM, so
 * importing the package normally crashes with ENOENT on ./test/data. Requiring
 * the implementation file directly skips that wrapper entirely.
 */
const pdfParse = require('pdf-parse/lib/pdf-parse.js')

/** Collapses the whitespace soup a PDF text layer produces, without losing paragraphs. */
const tidy = (text) =>
  text
    .replace(/\r\n?/g, '\n')
    .replace(/[ \t ]+/g, ' ')
    .replace(/ ?\n ?/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim()

/**
 * Pulls plain text out of an uploaded CV.
 *
 * The file on disk is never touched — extraction reads a copy into memory and
 * the original stays byte-identical, which is the promise made on the landing
 * page and in the FAQ.
 */
export const extractText = async (absolutePath, mimeType, originalFilename = '') => {
  const ext = originalFilename.toLowerCase().slice(originalFilename.lastIndexOf('.'))
  const buffer = await readFile(absolutePath)

  if (mimeType === 'application/pdf' || ext === '.pdf') {
    const parsed = await pdfParse(buffer)
    const text = tidy(parsed.text || '')
    if (text.length < 40) {
      // Almost always a scan: pages exist but carry no text layer. Saying so is
      // far more useful than handing the AI an empty string and reporting a
      // mysteriously empty profile.
      throw badRequest(
        'cv_not_readable',
        'No text could be read from this PDF — it looks like a scan or an image-only export',
      )
    }
    return { text, pageCount: parsed.numpages ?? null }
  }

  if (ext === '.docx' || mimeType.includes('officedocument.wordprocessingml')) {
    const { value, messages } = await mammoth.extractRawText({ buffer })
    if (messages?.length) logger.debug('docx extraction notes', { count: messages.length })
    const text = tidy(value || '')
    if (text.length < 40) throw badRequest('cv_not_readable', 'No text could be read from this document')
    return { text, pageCount: null }
  }

  if (ext === '.doc' || mimeType === 'application/msword') {
    // Legacy binary .doc is a different format from .docx and mammoth cannot
    // read it. Rejecting with a clear instruction beats a confusing failure.
    throw badRequest(
      'legacy_doc_format',
      'Old .doc files cannot be read — please save as PDF or .docx and upload again',
    )
  }

  throw badRequest('unsupported_file_type', 'Only PDF and .docx CVs are supported')
}

/**
 * Cheap language guess from the extracted text, used as a hint for the AI pass
 * and as a fallback if the model does not report one. Scores stop-words rather
 * than characters: "Berlin" appears in all three languages, "der" does not.
 */
export const guessLanguage = (text) => {
  const sample = text.toLowerCase().slice(0, 6000)
  const words = sample.match(/[a-zà-ÿäöüß]+/g) || []
  if (words.length < 20) return { language: null, confidence: 0 }

  const markers = {
    de: ['und', 'der', 'die', 'das', 'mit', 'für', 'von', 'bei', 'ich', 'seit', 'kenntnisse', 'erfahrung', 'ausbildung', 'beruf'],
    en: ['and', 'the', 'with', 'for', 'from', 'experience', 'skills', 'education', 'work', 'present', 'university'],
    fr: ['et', 'le', 'la', 'les', 'des', 'pour', 'avec', 'chez', 'depuis', 'expérience', 'compétences', 'formation'],
  }

  const counts = Object.fromEntries(Object.keys(markers).map((k) => [k, 0]))
  for (const word of words) {
    for (const [lang, list] of Object.entries(markers)) {
      if (list.includes(word)) counts[lang] += 1
    }
  }

  const ranked = Object.entries(counts).sort((a, b) => b[1] - a[1])
  const [best, bestCount] = ranked[0]
  const total = ranked.reduce((sum, [, n]) => sum + n, 0)
  if (!total) return { language: null, confidence: 0 }

  return { language: best, confidence: Number((bestCount / total).toFixed(3)) }
}
