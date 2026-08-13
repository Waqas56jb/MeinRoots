import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react'
import { cvApi, profileApi, questionnaireApi } from '../lib/api.js'

/**
 * One place that knows the candidate's current state.
 *
 * Six pages need the same profile, the same CV document and the same
 * questionnaire. Fetching them per page meant three requests per navigation and
 * three independent polling loops racing each other. This loads once, polls
 * only while an analysis is actually running, and stops the moment it finishes.
 */

const WorkspaceContext = createContext(null)

const POLL_MS = 3000

export function WorkspaceProvider({ children }) {
  const [profile, setProfile] = useState(undefined) // undefined = loading
  const [document, setDocument] = useState(undefined)
  const [questionnaire, setQuestionnaire] = useState(undefined)
  const [questions, setQuestions] = useState([])
  const [status, setStatus] = useState(null)
  const [error, setError] = useState(null)

  const timer = useRef(null)

  const load = useCallback(async ({ quiet = false } = {}) => {
    if (!quiet) setError(null)
    try {
      const [p, d, q] = await Promise.all([
        profileApi.me(),
        cvApi.current(),
        // A candidate with no CV has no questionnaire; that is a normal state,
        // not an error worth surfacing.
        questionnaireApi.current().catch(() => ({ questionnaire: null, questions: [] })),
      ])
      setProfile(p.profile)
      setDocument(d.document)
      setQuestionnaire(q.questionnaire)
      setQuestions(q.questions ?? [])
      return d.document
    } catch (err) {
      setError(err.code ?? 'server_error')
      setProfile(null)
      setDocument(null)
      setQuestionnaire(null)
      return null
    }
  }, [])

  useEffect(() => {
    load()
  }, [load])

  // Poll only while there is something to watch, and stop as soon as there is
  // not — an idle dashboard should make no requests at all.
  useEffect(() => {
    const id = document?.id
    const running = document && document.status !== 'analysed' && document.status !== 'failed'
    const translating = status?.translationsPending

    if (!id || (!running && !translating)) {
      if (timer.current) clearInterval(timer.current)
      timer.current = null
      return undefined
    }

    let cancelled = false
    const tick = async () => {
      try {
        const next = await cvApi.status(id)
        if (cancelled) return
        setStatus(next)
        // Reload the profile once analysis lands, so the new data appears
        // without the candidate refreshing.
        if (next.done && running) await load({ quiet: true })
      } catch {
        /* transient — the next tick tries again */
      }
    }

    timer.current = setInterval(tick, POLL_MS)
    tick()
    return () => {
      cancelled = true
      if (timer.current) clearInterval(timer.current)
      timer.current = null
    }
  }, [document?.id, document?.status, status?.translationsPending, load])

  // One status read for a finished document, so the CV page knows whether the
  // translations are still being generated.
  useEffect(() => {
    if (document?.id && document.status === 'analysed' && !status) {
      cvApi.status(document.id).then(setStatus).catch(() => {})
    }
  }, [document?.id, document?.status, status])

  const value = useMemo(() => {
    const analysing = Boolean(document) && document.status !== 'analysed' && document.status !== 'failed'
    const outstanding = questions.filter((q) => q.isRequired && q.answer === null).length

    return {
      profile,
      document,
      questionnaire,
      questions,
      status,
      error,
      loading: profile === undefined,
      analysing,
      failed: document?.status === 'failed',
      hasProfileData: Boolean(profile && (profile.experiences?.length || profile.skills?.length)),
      outstandingQuestions: outstanding,
      reload: load,
      setProfile,
    }
  }, [profile, document, questionnaire, questions, status, error, load])

  return <WorkspaceContext.Provider value={value}>{children}</WorkspaceContext.Provider>
}

export function useWorkspace() {
  const ctx = useContext(WorkspaceContext)
  if (!ctx) throw new Error('useWorkspace must be used inside <WorkspaceProvider>')
  return ctx
}

/**
 * Everything the candidate could usefully do next, derived from real data.
 *
 * Nothing invented: each item exists because a field is genuinely empty, a
 * question is genuinely unanswered, or the assessment genuinely produced that
 * gap. Every one links to a page that can actually resolve it.
 */
export const buildRecommendations = ({ profile, document, outstandingQuestions, user }) => {
  const out = []

  if (!document) {
    out.push({ key: 'upload_cv', priority: 'critical', icon: 'upload', to: '/cv' })
    return out
  }
  if (document.status === 'failed') {
    out.push({ key: 'retry_cv', priority: 'critical', icon: 'refresh', to: '/cv' })
  }
  if (user && !user.emailVerified) {
    out.push({ key: 'verify_email', priority: 'important', icon: 'mail', to: '/settings' })
  }
  if (outstandingQuestions > 0) {
    out.push({
      key: 'answer_questions',
      priority: 'critical',
      icon: 'clipboard',
      to: '/questionnaire',
      count: outstandingQuestions,
    })
  }
  if (!profile) return out

  // The gaps the assessment itself produced, worst first.
  const gaps = (profile.assessments ?? []).flatMap((a) =>
    (a.gaps ?? []).map((g) => ({ ...g, goal: a.goal })),
  )
  const order = { critical: 0, important: 1, nice_to_have: 2 }
  for (const gap of gaps.sort((a, b) => order[a.importance] - order[b.importance]).slice(0, 4)) {
    out.push({
      key: 'close_gap',
      priority: gap.importance === 'critical' ? 'critical' : 'important',
      icon: 'trendingUp',
      to: '/readiness',
      gap,
    })
  }

  if (!profile.summary) out.push({ key: 'add_summary', priority: 'nice_to_have', icon: 'userCircle', to: '/profile' })
  if (!profile.languages?.length) out.push({ key: 'add_languages', priority: 'important', icon: 'translate', to: '/profile' })
  if (!profile.certifications?.length) out.push({ key: 'add_certification', priority: 'nice_to_have', icon: 'award', to: '/profile' })
  if (profile.willingToRelocate === null || profile.willingToRelocate === undefined) {
    out.push({ key: 'set_relocation', priority: 'nice_to_have', icon: 'pin', to: '/profile' })
  }
  if ((profile.experiences?.length ?? 0) === 0) {
    out.push({ key: 'add_experience', priority: 'important', icon: 'briefcase', to: '/profile' })
  }

  return out
}
