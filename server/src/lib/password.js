import bcrypt from 'bcryptjs'
import config from '../config.js'

export const hashPassword = (plain) => bcrypt.hash(plain, config.security.bcryptRounds)

export const verifyPassword = (plain, hash) => bcrypt.compare(plain, hash)

/**
 * Computed once at boot from a constant nobody can log in with.
 *
 * A login for an address that does not exist must cost the same as one that
 * does, otherwise response time alone tells an attacker which addresses hold
 * accounts — the same leak the identical error message is there to prevent.
 */
const DUMMY_HASH = bcrypt.hashSync('meinroots::timing-equaliser', config.security.bcryptRounds)

export const burnPasswordTime = (plain) => bcrypt.compare(String(plain ?? ''), DUMMY_HASH)

/**
 * Same rules the sign-up form enforces, repeated here because the form is a
 * convenience and the API is the actual boundary — a request can arrive without
 * ever touching our UI.
 */
export const passwordProblems = (plain) => {
  const problems = []
  if (!plain || plain.length < 8) problems.push('too_short')
  if (plain && plain.length > 200) problems.push('too_long')
  return problems
}
