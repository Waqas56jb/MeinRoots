/**
 * Everything the workspace infers from the candidate's own data.
 *
 * Kept out of the pages so a derived state means one thing on every screen, and
 * so the rules can be read in one place instead of being reconstructed from six
 * JSX files. Nothing here invents data: every value traces back to a field the
 * API actually returned.
 */

/**
 * The ten checks behind the completeness percentage.
 *
 * These mirror recomputeCompleteness() on the server exactly — same ten
 * conditions, in the same order. The parity is the point: a candidate who reads
 * "80%" and then counts two missing items should find that the arithmetic
 * works. Showing a different set of checks would make the number look wrong
 * even though it is right. If the server formula changes, this list changes
 * with it.
 */
export const completenessChecks = ({ profile, outstandingQuestions }) => {
  if (!profile) return []
  const count = (list) => list?.length ?? 0
  return [
    { key: 'headline', done: Boolean(profile.headline), to: '/profile' },
    { key: 'summary', done: Boolean(profile.summary), to: '/profile' },
    { key: 'country', done: Boolean(profile.country), to: '/profile' },
    {
      key: 'experienceTotal',
      done: profile.totalExperienceMonths !== null && profile.totalExperienceMonths !== undefined,
      to: '/profile',
    },
    { key: 'experiences', done: count(profile.experiences) > 0, to: '/profile' },
    { key: 'education', done: count(profile.education) > 0, to: '/profile' },
    { key: 'skills', done: count(profile.skills) >= 3, to: '/profile' },
    { key: 'languages', done: count(profile.languages) > 0, to: '/profile' },
    // The domain is decided by the analysis, not by the candidate — so the only
    // thing that can change it is re-running the analysis on the CV page.
    { key: 'classification', done: Boolean(profile.classification), to: '/cv' },
    { key: 'questions', done: outstandingQuestions === 0, to: '/questionnaire' },
  ]
}

/**
 * How a review outcome reads to the candidate.
 *
 * `auto_cleared` means the analysis raised nothing worth a person's time, which
 * is a finished state and not a lesser one. `rejected` is a decision a reviewer
 * made; the note they wrote is stored but is not part of the candidate-facing
 * profile payload, so the step says only that the CV needs another look.
 */
const REVIEW_STATE = {
  approved: 'done',
  auto_cleared: 'done',
  flagged: 'active',
  pending: 'pending',
  rejected: 'attention',
}

/**
 * The candidate journey as seven steps, each in a state the data can prove.
 *
 * A step is only ever `done` because something exists — a document row, an
 * assessment, an answered question. Nothing is marked complete on the strength
 * of the step before it.
 */
export const journeySteps = ({
  user,
  profile,
  document,
  questions = [],
  outstandingQuestions = 0,
  hasProfileData = false,
}) => {
  const analysed = document?.status === 'analysed'
  const failed = document?.status === 'failed'
  const running = Boolean(document) && !analysed && !failed

  const cv = !document ? 'pending' : failed ? 'attention' : analysed ? 'done' : 'active'

  return [
    {
      key: 'objective',
      state: (user?.goals?.length ?? 0) > 0 ? 'done' : 'pending',
      to: '/settings',
    },
    { key: 'cv', state: cv, to: '/cv' },
    {
      key: 'profile',
      state: hasProfileData ? 'done' : running ? 'active' : 'pending',
      to: '/profile',
    },
    {
      key: 'domain',
      state: profile?.classification ? 'done' : running ? 'active' : 'pending',
      to: '/profile',
      note: profile?.classification?.label ?? null,
    },
    {
      key: 'readiness',
      state: (profile?.assessments?.length ?? 0) > 0 ? 'done' : running ? 'active' : 'pending',
      to: '/readiness',
    },
    {
      key: 'questions',
      state: !questions.length ? 'pending' : outstandingQuestions === 0 ? 'done' : 'active',
      to: '/questionnaire',
      count: outstandingQuestions,
    },
    {
      key: 'review',
      state: profile ? REVIEW_STATE[profile.reviewStatus] ?? 'pending' : 'pending',
      // Nothing for the candidate to do while a person is looking at it; the CV
      // page is only the right destination when it needs changing.
      to: profile?.reviewStatus === 'rejected' ? '/cv' : null,
      status: profile?.reviewStatus ?? null,
    },
  ]
}

/**
 * Readiness factors, split the way the page talks about them.
 *
 * "Unknown" sits with the opportunities rather than the strengths: a factor the
 * assessment could not judge is a thing to resolve, not a thing to celebrate.
 */
export const splitFactors = (factors = []) => {
  const byScore = (a, b) => (b.score ?? 0) - (a.score ?? 0)
  return {
    strengths: factors.filter((f) => f.status === 'strong' || f.status === 'adequate').sort(byScore),
    opportunities: factors
      .filter((f) => f.status === 'weak' || f.status === 'unknown')
      .sort((a, b) => (a.score ?? 0) - (b.score ?? 0)),
  }
}

/** The assessment the candidate is doing best on — the one the dashboard leads with. */
export const bestAssessment = (assessments = []) =>
  assessments.reduce((best, a) => (best === null || a.score > best.score ? a : best), null)

/** 27 → "2y 3m". The unit letters come from the dictionary so German reads right. */
export const formatMonths = (months, t) => {
  if (months === null || months === undefined) return null
  const years = Math.floor(months / 12)
  const rest = months % 12
  const y = t('app.units.years')
  const m = t('app.units.months')
  if (!years) return `${rest}${m}`
  return rest ? `${years}${y} ${rest}${m}` : `${years}${y}`
}

/** Which part of the day it is, for the greeting. */
export const greetingKey = (date = new Date()) => {
  const hour = date.getHours()
  if (hour < 12) return 'morning'
  if (hour < 18) return 'afternoon'
  return 'evening'
}
