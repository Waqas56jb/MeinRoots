import pg from 'pg'
import config from '../config.js'
import { logger } from '../lib/logger.js'

const { Pool, types } = pg

// node-postgres hands back DATE as a JS Date in the server's timezone, which
// turns 1990-01-01 into 1989-12-31 for anyone west of UTC. Dates on a CV are
// calendar dates, not instants — keep them as strings.
types.setTypeParser(types.builtins.DATE, (value) => value)
// bigint as string would break JSON counts; these columns are small enough
types.setTypeParser(types.builtins.INT8, (value) => Number.parseInt(value, 10))
// numeric(4,3) confidences should arrive as numbers, not strings
types.setTypeParser(types.builtins.NUMERIC, (value) => (value === null ? null : Number(value)))

export const pool = new Pool({
  connectionString: config.databaseUrl,
  max: config.dbPoolMax,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 10000,
  application_name: 'meinroots-api',
})

pool.on('error', (err) => {
  // An idle client dying is not fatal — the pool replaces it. Log and continue.
  logger.error('idle database client error', { message: err.message })
})

/**
 * Arrays of a user-defined enum have no built-in parser.
 *
 * node-postgres ships parsers keyed by type OID, and the OIDs of built-in types
 * are constants. `work_goal[]` is created by our own migration, so its OID
 * differs per database and there is no parser for it — `users.goals` would
 * arrive as the literal string "{germany,ausbildung}". That is quietly
 * dangerous rather than obviously broken: a string has .length and .includes,
 * so array-ish code appears to work and then iterates characters.
 *
 * The lookup has to happen at runtime, once, against the actual database.
 */
const parseEnumArray = (value) => {
  if (value == null) return null
  const inner = value.slice(1, -1)
  if (!inner) return []
  // Enum labels here are lowercase identifiers, so no quoting or embedded
  // commas are possible; the quote strip is belt and braces.
  return inner.split(',').map((part) => part.replace(/^"(.*)"$/, '$1'))
}

let typesReady = null

const ensureTypes = () => {
  if (!typesReady) {
    typesReady = pool
      .query("SELECT 'work_goal[]'::regtype::oid AS oid")
      .then(({ rows }) => {
        types.setTypeParser(Number(rows[0].oid), parseEnumArray)
      })
      .catch((err) => {
        // Before the first migration the type does not exist yet — that is the
        // expected case for `npm run migrate`, not an error.
        logger.debug('enum array parser not registered', { message: err.message })
      })
  }
  return typesReady
}

export const query = async (text, params) => {
  await ensureTypes()
  return pool.query(text, params)
}

/** First row or null — the shape almost every lookup in this codebase wants. */
export const one = async (text, params) => {
  const { rows } = await query(text, params)
  return rows[0] ?? null
}

export const many = async (text, params) => {
  const { rows } = await query(text, params)
  return rows
}

/**
 * Runs fn inside a transaction, rolling back on any throw.
 * The callback receives a dedicated client — use it for every query inside,
 * otherwise the statement runs on a different connection and outside the
 * transaction.
 */
export const transaction = async (fn) => {
  await ensureTypes()
  const client = await pool.connect()
  try {
    await client.query('BEGIN')
    const result = await fn(client)
    await client.query('COMMIT')
    return result
  } catch (err) {
    try {
      await client.query('ROLLBACK')
    } catch (rollbackErr) {
      logger.error('rollback failed', { message: rollbackErr.message })
    }
    throw err
  } finally {
    client.release()
  }
}

export const closePool = () => pool.end()
