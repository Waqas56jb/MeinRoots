#!/usr/bin/env node
/**
 * Creates (or promotes) an admin account.
 *
 *   node src/scripts/create-admin.js "Name" admin@meinroots.com 'password' [--super]
 *
 * Admins are made from the CLI on purpose: a self-service "become admin" route
 * is one misconfiguration away from being the whole security model's weak point.
 */
import { closePool, one } from '../db/pool.js'
import { hashPassword, passwordProblems } from '../lib/password.js'
import { logger } from '../lib/logger.js'

const [name, email, password] = process.argv.slice(2)
const isSuper = process.argv.includes('--super')

if (!name || !email || !password) {
  process.stderr.write('usage: create-admin.js "Full Name" email@example.com password [--super]\n')
  process.exit(2)
}

const problems = passwordProblems(password)
if (problems.length) {
  process.stderr.write(`password rejected: ${problems.join(', ')}\n`)
  process.exit(2)
}

const role = isSuper ? 'super_admin' : 'admin'
const normalised = email.trim().toLowerCase()

try {
  const existing = await one('SELECT id, role FROM users WHERE email = $1 AND deleted_at IS NULL', [normalised])
  const passwordHash = await hashPassword(password)

  if (existing) {
    await one('UPDATE users SET role = $2, password_hash = $3, full_name = $4 WHERE id = $1 RETURNING id', [
      existing.id,
      role,
      passwordHash,
      name,
    ])
    logger.info('existing account promoted', { email: normalised, from: existing.role, to: role })
  } else {
    const user = await one(
      `INSERT INTO users (full_name, email, password_hash, role, gdpr_consent_at, email_verified_at)
       VALUES ($1,$2,$3,$4,now(),now()) RETURNING id`,
      [name, normalised, passwordHash, role],
    )
    logger.info('admin created', { email: normalised, role, id: user.id })
  }
  await closePool()
} catch (err) {
  logger.error('create-admin failed', { message: err.message })
  await closePool()
  process.exit(1)
}
