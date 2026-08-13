import { z } from 'zod'
import { badRequest } from './errors.js'

/**
 * Parses `source` against a zod schema and turns a failure into a 400 whose
 * `details` are keyed by field, so the front end can attach each message to the
 * input it belongs to instead of showing one blanket error.
 */
export const parse = (schema, source) => {
  const result = schema.safeParse(source)
  if (result.success) return result.data

  const details = {}
  for (const issue of result.error.issues) {
    const key = issue.path.join('.') || '_'
    if (!details[key]) details[key] = issue.message
  }
  throw badRequest('validation_failed', 'Request failed validation', details)
}

export const validateBody = (schema) => (req, _res, next) => {
  try {
    req.body = parse(schema, req.body)
    next()
  } catch (err) {
    next(err)
  }
}

export const validateQuery = (schema) => (req, _res, next) => {
  try {
    // Express 5 makes req.query a getter; assigning to a separate property
    // keeps this working on both major versions.
    req.validatedQuery = parse(schema, req.query)
    next()
  } catch (err) {
    next(err)
  }
}

// ---------------------------- shared field types ----------------------------

export const emailField = z
  .string()
  .trim()
  .min(3, 'email_required')
  .max(254, 'email_invalid')
  .email('email_invalid')
  .transform((v) => v.toLowerCase())

export const passwordField = z.string().min(8, 'password_short').max(200, 'password_long')

export const localeField = z.enum(['en', 'de', 'fr'])

export const goalsField = z
  .array(z.enum(['germany', 'remote', 'freelance', 'ausbildung']))
  .min(1, 'goal_required')
  .max(4)
  // duplicates would make the postgres array misrepresent the choice
  .transform((values) => [...new Set(values)])

export const uuidField = z.string().uuid('invalid_id')

export { z }
