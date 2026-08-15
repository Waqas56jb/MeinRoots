/**
 * The legal documents a candidate is asked to accept, and their version.
 *
 * The version is stored with every consent row. Without it a consent record
 * proves only that someone ticked something: the terms can change, and
 * "agreed" with no version attached cannot say what they agreed to. Bump this
 * when the document changes materially, and the difference between the stored
 * version and this one is what tells the product a re-acceptance is due.
 *
 * Kept in code rather than in the database because it must be in the same
 * commit as the document text it describes — a version number that can drift
 * away from the text it names is worse than none.
 */
export const TERMS_VERSION = '1.0'

/**
 * The three decisions a candidate cannot hold an account without.
 *
 * `terms` and `privacy` are contractual: they are how the agreement is formed
 * and acknowledged. `data_processing` is separate on purpose — the terms
 * document says so itself, and bundling a processing consent into a contract
 * acceptance is exactly the pattern regulators treat as invalid.
 */
export const REQUIRED_CONSENTS = ['terms', 'privacy', 'data_processing']

/**
 * The three that are genuinely optional.
 *
 * Refusing any of these costs the candidate nothing: the analysis still runs,
 * the profile is still built, the readiness score is still produced. That is
 * what makes them consent rather than a condition of service, and it is why
 * they must never be pre-ticked.
 */
export const OPTIONAL_CONSENTS = ['employer_sharing', 'job_alerts', 'marketing']

export const ALL_CONSENTS = [...REQUIRED_CONSENTS, ...OPTIONAL_CONSENTS]
