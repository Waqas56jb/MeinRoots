import { one, query } from '../db/pool.js'
import { deleteUserFiles } from '../modules/cv/storage.js'
import { audit } from './audit.js'
import { logger } from './logger.js'

/**
 * Erasing a candidate, in one place.
 *
 * There are two ways a candidate is removed — an administrator pressing the
 * button, and the cleanup job retiring an account that never uploaded a CV —
 * and they must erase exactly the same things. Two implementations of "erase a
 * person" is one implementation and one liability: the day they drift apart,
 * the automatic path is the one nobody is watching.
 *
 * Their *authorisation* stays separate, which is the part that matters. Nothing
 * here checks a permission; it assumes the caller has already decided. The
 * route checks the role, the job checks eligibility.
 *
 * What actually gets erased is the database's business, not this module's. The
 * foreign keys were designed for it: everything the candidate owns cascades
 * from users — profile and all its child rows, CV documents, sessions,
 * consents, verification and reset tokens, saved-candidate rows, recruitment
 * requests and pipeline entries — while every reference that merely *mentions*
 * them as an actor is ON DELETE SET NULL, so the audit trail, the
 * outbound-email record and any review they were the subject of survive with
 * the person removed from them. That is the GDPR shape: erase the data, keep
 * the proof you erased it.
 */

/** Enough to tell two erasure entries apart, and no more. */
const digest = (email) => Buffer.from(String(email)).toString('base64').slice(0, 12)

/**
 * The half that has to happen after the row is gone.
 *
 * Split out because the cleanup job deletes inside a locked transaction and
 * these two steps must not be inside it: an unlinked file cannot be brought
 * back by a rollback, and an audit entry written inside a transaction that
 * later aborts is an audit entry claiming something that did not happen.
 *
 * `email` is optional. The manual path has it and hashes it; the automatic path
 * deletes first and has nothing left to hash, which is the right amount of
 * personal data to keep about a deletion nobody requested.
 */
export const finaliseErasure = async ({
  userId, email = null, req = null, action, actorId = null, actorRole = null, metadata = {},
}) => {
  // Best-effort: the row is already gone, so a file that resists removal must
  // not turn a completed erasure into a failed job that retries the delete.
  try {
    await deleteUserFiles(userId)
  } catch (err) {
    logger.error('erasure: could not remove stored files', { userId, message: err.message })
  }

  const written = await audit(req, {
    action,
    entityType: 'user',
    entityId: userId,
    actorId,
    actorRole,
    metadata: email ? { ...metadata, emailDigest: digest(email) } : metadata,
  })

  // audit() swallows its own failures so a logging problem cannot break a
  // request, which is right nearly everywhere and wrong here: an erasure with
  // no record of it is the one thing this whole path exists to avoid. Raised to
  // an error the operator will see rather than a line nobody reads.
  if (written === false) {
    logger.error('ERASURE NOT AUDITED — a user was deleted and the audit write failed', {
      userId, action,
    })
  }
}

/**
 * Removes one user and everything that cascades from them.
 *
 * The row goes before the files. The other order loses a candidate's CV while
 * leaving their account standing if the delete then fails — data destroyed with
 * no erasure to show for it. This way the worst case is a file on disk with
 * nothing pointing at it, and the person is erased, which is what was asked.
 *
 * Returns null when the row is already gone, which is what makes callers
 * idempotent: erasing the same id twice is a no-op, not an error.
 */
export const eraseUser = async ({
  userId, req = null, action, actorId = null, actorRole = null, metadata = {},
}) => {
  const user = await one('SELECT id, email, role FROM users WHERE id = $1', [userId])
  if (!user) return null

  await query('DELETE FROM users WHERE id = $1', [user.id])
  await finaliseErasure({ userId: user.id, email: user.email, req, action, actorId, actorRole, metadata })

  logger.info('user erased', { userId: user.id, role: user.role, action })
  return { id: user.id, role: user.role }
}
