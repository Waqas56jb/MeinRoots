#!/usr/bin/env node
/**
 * Migration runner.
 *
 * Applies every .sql file in ./migrations in filename order, once, inside a
 * transaction, recording it in schema_migrations. A file's checksum is stored
 * too: editing an already-applied migration is a silent way to make two
 * environments disagree, so it is reported as an error rather than ignored.
 *
 *   npm run migrate           apply anything pending
 *   npm run migrate:status    list applied / pending
 */
import { createHash } from 'node:crypto'
import { readdir, readFile } from 'node:fs/promises'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { pool } from './pool.js'
import { logger } from '../lib/logger.js'

const MIGRATIONS_DIR = join(dirname(fileURLToPath(import.meta.url)), 'migrations')

const ensureTable = () =>
  pool.query(`
    CREATE TABLE IF NOT EXISTS schema_migrations (
      filename    text PRIMARY KEY,
      checksum    text NOT NULL,
      applied_at  timestamptz NOT NULL DEFAULT now(),
      duration_ms integer
    )
  `)

const readMigrations = async () => {
  const files = (await readdir(MIGRATIONS_DIR)).filter((f) => f.endsWith('.sql')).sort()
  return Promise.all(
    files.map(async (filename) => {
      const sql = await readFile(join(MIGRATIONS_DIR, filename), 'utf8')
      return { filename, sql, checksum: createHash('sha256').update(sql).digest('hex').slice(0, 16) }
    }),
  )
}

const applied = async () => {
  const { rows } = await pool.query('SELECT filename, checksum, applied_at FROM schema_migrations')
  return new Map(rows.map((r) => [r.filename, r]))
}

async function up() {
  await ensureTable()
  const [migrations, done] = await Promise.all([readMigrations(), applied()])

  const drifted = migrations.filter((m) => done.has(m.filename) && done.get(m.filename).checksum !== m.checksum)
  if (drifted.length) {
    throw new Error(
      `These migrations changed after being applied: ${drifted.map((m) => m.filename).join(', ')}. ` +
        'Add a new migration instead of editing an applied one.',
    )
  }

  const pending = migrations.filter((m) => !done.has(m.filename))
  if (!pending.length) {
    logger.info('database is up to date', { applied: done.size })
    return
  }

  for (const migration of pending) {
    const client = await pool.connect()
    const started = Date.now()
    try {
      await client.query('BEGIN')
      await client.query(migration.sql)
      await client.query(
        'INSERT INTO schema_migrations (filename, checksum, duration_ms) VALUES ($1, $2, $3)',
        [migration.filename, migration.checksum, Date.now() - started],
      )
      await client.query('COMMIT')
      logger.info(`applied ${migration.filename}`, { ms: Date.now() - started })
    } catch (err) {
      await client.query('ROLLBACK')
      throw new Error(`${migration.filename} failed: ${err.message}`)
    } finally {
      client.release()
    }
  }
  logger.info('migrations complete', { applied: pending.length })
}

async function status() {
  await ensureTable()
  const [migrations, done] = await Promise.all([readMigrations(), applied()])
  for (const m of migrations) {
    const row = done.get(m.filename)
    const state = !row ? 'PENDING' : row.checksum !== m.checksum ? 'DRIFTED' : 'applied'
    process.stdout.write(`${state.padEnd(8)} ${m.filename}\n`)
  }
}

const command = process.argv[2] || 'up'

try {
  if (command === 'up') await up()
  else if (command === 'status') await status()
  else throw new Error(`unknown command: ${command}`)
  await pool.end()
} catch (err) {
  logger.error('migration failed', { message: err.message })
  await pool.end()
  process.exit(1)
}
