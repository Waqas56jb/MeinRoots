import OpenAI from 'openai'
import config from '../config.js'
import { query } from '../db/pool.js'
import { serverError } from '../lib/errors.js'
import { logger } from '../lib/logger.js'

let client = null

const getClient = () => {
  if (!config.openai.enabled) {
    throw serverError('ai_not_configured', 'OPENAI_API_KEY is not set — CV analysis is unavailable')
  }
  if (!client) {
    client = new OpenAI({
      apiKey: config.openai.apiKey,
      timeout: config.openai.timeoutMs,
      maxRetries: config.openai.maxRetries,
    })
  }
  return client
}

/**
 * One call, one validated object.
 *
 * `json_schema` with `strict: true` makes the model's reply conform to the
 * schema at decode time, so there is no "parse the JSON out of the prose" step
 * and no retry loop for malformed output — the reason every analysis step here
 * returns structured data rather than paragraphs.
 */
export const complete = async ({
  purpose,
  system,
  user,
  schema,
  schemaName = 'result',
  model = config.openai.model,
  temperature = 0.2,
  maxTokens = 4000,
  jobId = null,
  userId = null,
}) => {
  const openai = getClient()
  const started = Date.now()

  try {
    const response = await openai.chat.completions.create({
      model,
      temperature,
      max_tokens: maxTokens,
      messages: [
        { role: 'system', content: system },
        { role: 'user', content: user },
      ],
      response_format: {
        type: 'json_schema',
        json_schema: { name: schemaName, strict: true, schema },
      },
    })

    const choice = response.choices?.[0]
    if (choice?.finish_reason === 'length') {
      // Truncated JSON is invalid JSON. Better to fail the step than to store a
      // half-parsed profile that looks complete.
      throw new Error(`model output hit the token ceiling for ${purpose}`)
    }

    const parsed = JSON.parse(choice?.message?.content ?? '{}')

    await recordCall({
      jobId,
      userId,
      purpose,
      model,
      usage: response.usage,
      durationMs: Date.now() - started,
      ok: true,
    })

    return parsed
  } catch (err) {
    await recordCall({
      jobId,
      userId,
      purpose,
      model,
      usage: null,
      durationMs: Date.now() - started,
      ok: false,
      error: err.message,
    })
    logger.error('openai call failed', { purpose, model, message: err.message })
    throw err
  }
}

const recordCall = async ({ jobId, userId, purpose, model, usage, durationMs, ok, error }) => {
  try {
    await query(
      `INSERT INTO ai_calls (job_id, user_id, purpose, model, prompt_tokens, completion_tokens, duration_ms, ok, error)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
      [
        jobId,
        userId,
        purpose,
        model,
        usage?.prompt_tokens ?? null,
        usage?.completion_tokens ?? null,
        durationMs,
        ok,
        error ? String(error).slice(0, 1000) : null,
      ],
    )
  } catch (err) {
    // Accounting must never break the pipeline it is measuring.
    logger.warn('ai_calls write failed', { message: err.message })
  }
}

/**
 * A CV can be far longer than the useful context. Trimming from the middle
 * keeps the two parts that identify a candidate — the header with name/title
 * and the earliest roles — instead of losing the tail entirely.
 */
export const trimForModel = (text, maxChars = 24000) => {
  if (text.length <= maxChars) return text
  const head = Math.floor(maxChars * 0.7)
  const tail = maxChars - head
  return `${text.slice(0, head)}\n\n[... middle of document omitted for length ...]\n\n${text.slice(-tail)}`
}
