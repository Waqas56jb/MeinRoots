import { useEffect, useMemo, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import AppShell from '../components/app/AppShell.jsx'
import ErrorState from '../components/app/ErrorState.jsx'
import { Loading, QuestionSkeleton } from '../components/app/Skeletons.jsx'
import Icon from '../components/ui/Icon.jsx'
import { Note } from '../components/app/widgets.jsx'
import { useI18n } from '../context/I18nContext.jsx'
import { useWorkspace } from '../context/WorkspaceContext.jsx'
import { questionnaireApi } from '../lib/api.js'
import { useApiMessage } from '../lib/apiMessage.js'

const isAnswered = (value) => {
  if (value === undefined || value === null) return false
  if (typeof value === 'string') return value.trim().length > 0
  if (Array.isArray(value)) return value.length > 0
  return true
}

/** The API types answers per question, so send the type it expects. */
const normalise = (question, value) => {
  if (question.inputType === 'number') return Number(value)
  if (question.inputType === 'boolean') return Boolean(value)
  if (question.inputType === 'multi_select') return Array.isArray(value) ? value : [value]
  return String(value)
}

/**
 * The qualification questionnaire, one question at a time.
 *
 * Every question exists because the CV could not answer it, and each carries
 * the reason it is being asked — a question you understand the purpose of is a
 * question you answer honestly. Stepping through them rather than presenting a
 * wall of fields is what keeps the promise of "no long forms": the candidate
 * sees exactly one decision, and always knows how many are left.
 *
 * Answers live in component state and are written on the way forward, so
 * changing question, going back, or leaving the page never costs work already
 * done.
 */
export default function QuestionnairePage() {
  const { t } = useI18n()
  const navigate = useNavigate()
  const apiMessage = useApiMessage()
  const ws = useWorkspace()

  const [answers, setAnswers] = useState({})
  const [index, setIndex] = useState(0)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [savedAt, setSavedAt] = useState(null)
  const [savedIds, setSavedIds] = useState(() => new Set())
  const [finished, setFinished] = useState(false)
  const [reviewAll, setReviewAll] = useState(false)

  const questions = ws.questions ?? []

  useEffect(() => {
    if (!questions.length) return
    setAnswers((current) =>
      Object.keys(current).length
        ? current
        : Object.fromEntries(questions.filter((q) => q.answer !== null).map((q) => [q.id, q.answer])),
    )
    // Anything already stored on the server is, by definition, saved.
    setSavedIds(new Set(questions.filter((q) => q.answer !== null).map((q) => q.id)))
    // Open on the first unanswered question rather than always at the start.
    const firstOpen = questions.findIndex((q) => q.answer === null)
    if (firstOpen > 0) setIndex(firstOpen)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [questions.length])

  const answeredCount = useMemo(
    () => questions.filter((q) => isAnswered(answers[q.id])).length,
    [questions, answers],
  )
  const outstanding = useMemo(
    () => questions.filter((q) => q.isRequired && !isAnswered(answers[q.id])).length,
    [questions, answers],
  )
  const percent = questions.length ? Math.round((answeredCount / questions.length) * 100) : 0

  const save = async ({ complete = false, silent = false } = {}) => {
    const payload = questions
      .filter((q) => isAnswered(answers[q.id]))
      .map((q) => ({ questionId: q.id, value: normalise(q, answers[q.id]) }))
    if (!payload.length) {
      if (!silent) setError(t('app.questionnaire.nothingToSave'))
      return false
    }

    setSaving(true)
    setError('')
    try {
      await questionnaireApi.answer(payload)
      setSavedAt(Date.now())
      setSavedIds(new Set(payload.map((a) => a.questionId)))
      if (complete) {
        await questionnaireApi.complete()
        await ws.reload({ quiet: true })
        setFinished(true)
      }
      return true
    } catch (err) {
      setError(apiMessage(err.code))
      return false
    } finally {
      setSaving(false)
    }
  }

  const next = async () => {
    // Save on the way forward: a dropped connection later must not cost the
    // answers already given.
    await save({ silent: true })
    if (index < questions.length - 1) setIndex((i) => i + 1)
    else setReviewAll(true)
  }

  const shell = {
    eyebrow: t('app.nav.questionnaire'),
    title: t('app.questionnaire.title'),
    badges: { questionnaire: outstanding },
  }

  if (ws.loading) {
    return (
      <AppShell {...shell}>
        <Loading label={t('common.loading')}>
          <QuestionSkeleton />
        </Loading>
      </AppShell>
    )
  }

  if (ws.error) {
    return (
      <AppShell {...shell}>
        <ErrorState code={ws.error} what={t('app.error.questions')} onRetry={ws.reload} />
      </AppShell>
    )
  }

  if (!ws.questionnaire || !questions.length) {
    return (
      <AppShell {...shell}>
        <section className="rpanel rpanel--empty">
          <span className="rpanel__emptyIcon"><Icon name="clipboard" size={24} /></span>
          <h2>{t('app.questionnaire.emptyTitle')}</h2>
          <p>{t('app.questionnaire.emptyText')}</p>
          <Link to="/cv" className="btn btn--primary">
            {t('nav.cta')} <Icon name="arrowRight" size={16} />
          </Link>
        </section>
      </AppShell>
    )
  }

  if (finished) {
    return (
      <AppShell {...shell}>
        <section className="qdone">
          <span className="qdone__icon"><Icon name="checkCircle" size={28} /></span>
          <h2>{t('app.questionnaire.doneTitle')}</h2>
          <p>{t('app.questionnaire.doneText')}</p>
          <div className="qdone__actions">
            <button type="button" className="btn btn--primary" onClick={() => navigate('/readiness')}>
              {t('app.questionnaire.seeReadiness')} <Icon name="arrowRight" size={16} />
            </button>
            <button
              type="button"
              className="btn btn--ghost"
              onClick={() => { setFinished(false); setReviewAll(true) }}
            >
              {t('app.questionnaire.reviewAnswers')}
            </button>
          </div>
        </section>
      </AppShell>
    )
  }

  const question = questions[index]

  return (
    <AppShell {...shell}>
      {error && <Note tone="bad">{error}</Note>}
      {ws.questionnaire.status === 'completed' && !reviewAll && (
        <Note tone="good" icon="check">{t('app.questionnaire.completed')}</Note>
      )}

      <section className="quiz">
        {/* ------------------------------ progress -------------------------- */}
        <header className="quiz__bar">
          <div className="quiz__barTop">
            <strong>
              {reviewAll
                ? t('app.questionnaire.reviewing')
                : t('app.questionnaire.position', { current: index + 1, total: questions.length })}
            </strong>
            <span className="num">
              {t('app.questionnaire.answeredOf', { done: answeredCount, total: questions.length })}
            </span>
          </div>

          <div
            className="quiz__track"
            role="progressbar"
            aria-valuenow={percent}
            aria-valuemin={0}
            aria-valuemax={100}
            aria-label={t('app.questionnaire.title')}
          >
            <span className="quiz__fill" style={{ width: `${Math.max(3, percent)}%` }} />
          </div>

          <div className="quiz__dots" role="tablist" aria-label={t('app.questionnaire.title')}>
            {questions.map((q, i) => (
              <button
                key={q.id}
                type="button"
                role="tab"
                aria-selected={!reviewAll && i === index}
                aria-label={`${t('app.questionnaire.position', { current: i + 1, total: questions.length })} — ${
                  isAnswered(answers[q.id])
                    ? t('app.questionnaire.stateAnswered')
                    : t('app.questionnaire.stateOpen')
                }`}
                className={`quiz__dot ${isAnswered(answers[q.id]) ? 'is-done' : ''} ${
                  !reviewAll && i === index ? 'is-on' : ''
                }`}
                onClick={() => { setReviewAll(false); setIndex(i) }}
              />
            ))}
          </div>
        </header>

        {reviewAll ? (
          /* ------------------------------ review --------------------------- */
          <div className="quiz__review">
            <h2>{t('app.questionnaire.reviewTitle')}</h2>
            <ul>
              {questions.map((q, i) => {
                const answered = isAnswered(answers[q.id])
                return (
                  <li key={q.id} className={answered ? 'is-done' : 'is-open'}>
                    <span className="quiz__num num" aria-hidden="true">{i + 1}</span>
                    <div className="quiz__reviewBody">
                      <strong>{q.question}</strong>
                      <span>
                        {answered
                          ? Array.isArray(answers[q.id])
                            ? answers[q.id].join(', ')
                            : String(answers[q.id])
                          : t('app.questionnaire.noAnswer')}
                      </span>
                      {answered && savedIds.has(q.id) && (
                        <em className="quiz__savedTag">
                          <Icon name="check" size={11} />{t('app.questionnaire.saved')}
                        </em>
                      )}
                    </div>
                    <button
                      type="button"
                      className="btn btn--ghost btn--sm"
                      onClick={() => { setReviewAll(false); setIndex(i) }}
                    >
                      <Icon name="pencil" size={14} /> {t('app.edit.edit')}
                    </button>
                  </li>
                )
              })}
            </ul>
          </div>
        ) : (
          /* ----------------------------- one question ----------------------- */
          <div className="quiz__q">
            <div className="quiz__qHead">
              <span className="quiz__num quiz__num--lg num" aria-hidden="true">{index + 1}</span>
              {question.isRequired ? (
                <span className="quiz__req">{t('app.questionnaire.required')}</span>
              ) : (
                <span className="quiz__opt">{t('app.questionnaire.optional')}</span>
              )}
              {savedIds.has(question.id) && (
                <span className="quiz__savedTag">
                  <Icon name="check" size={11} />{t('app.questionnaire.saved')}
                </span>
              )}
            </div>

            <h2>{question.question}</h2>

            {question.reason && (
              <p className="quiz__why">
                <Icon name="info" size={14} />
                <span>
                  <em>{t('app.questionnaire.whyAsked')}</em>
                  {question.reason}
                </span>
              </p>
            )}
            {question.helpText && <p className="quiz__help">{question.helpText}</p>}

            <QuestionInput
              question={question}
              value={answers[question.id]}
              onChange={(value) => {
                setAnswers((a) => ({ ...a, [question.id]: value }))
                setError('')
              }}
            />
          </div>
        )}

        {/* ------------------------------ controls -------------------------- */}
        <footer className="quiz__actions">
          <div className="quiz__status">
            {outstanding > 0 ? (
              <span><Icon name="info" size={15} />{t('app.questionnaire.outstanding', { count: outstanding })}</span>
            ) : (
              <span className="is-good">
                <Icon name="checkCircle" size={15} />{t('app.questionnaire.allAnswered')}
              </span>
            )}
            {savedAt && (
              <em><Icon name="check" size={13} />{t('app.questionnaire.autosaved')}</em>
            )}
          </div>

          <div className="quiz__buttons">
            {!reviewAll && index > 0 && (
              <button type="button" className="btn btn--ghost" onClick={() => setIndex((i) => i - 1)} disabled={saving}>
                <Icon name="arrowRight" className="is-flipped" size={15} /> {t('app.questionnaire.previous')}
              </button>
            )}
            {reviewAll && (
              <button type="button" className="btn btn--ghost" onClick={() => setReviewAll(false)} disabled={saving}>
                {t('app.questionnaire.backToQuestions')}
              </button>
            )}

            {!reviewAll && index < questions.length - 1 ? (
              <button type="button" className="btn btn--primary" onClick={next} disabled={saving}>
                {t('app.questionnaire.next')} <Icon name="arrowRight" size={15} />
              </button>
            ) : (
              <button
                type="button"
                className="btn btn--primary btn--lg"
                onClick={() => save({ complete: true })}
                disabled={saving || outstanding > 0}
              >
                {saving ? t('auth.processing') : t('app.questionnaire.submit')}
                {!saving && <Icon name="arrowRight" size={15} />}
              </button>
            )}
          </div>
        </footer>

        {/* Explains the disabled submit rather than leaving it inert and
            unexplained — a greyed-out button with no reason reads as a bug. */}
        {outstanding > 0 && (index === questions.length - 1 || reviewAll) && (
          <p className="quiz__blocked">
            <Icon name="info" size={14} />
            {t('app.questionnaire.blocked', { count: outstanding })}
          </p>
        )}
      </section>
    </AppShell>
  )
}

function QuestionInput({ question, value, onChange }) {
  const { t } = useI18n()

  switch (question.inputType) {
    case 'boolean':
      return (
        <div className="quiz__opts">
          {[true, false].map((option) => (
            <button
              key={String(option)}
              type="button"
              className={`quiz__choice ${value === option ? 'is-on' : ''}`}
              onClick={() => onChange(option)}
              aria-pressed={value === option}
            >
              <Icon name={option ? 'check' : 'close'} size={16} />
              {option ? t('common.yes') : t('common.no')}
            </button>
          ))}
        </div>
      )

    case 'single_select':
      return (
        <div className="quiz__opts quiz__opts--stack">
          {question.options.map((option) => (
            <button
              key={option.value}
              type="button"
              className={`quiz__choice ${value === option.value ? 'is-on' : ''}`}
              onClick={() => onChange(option.value)}
              aria-pressed={value === option.value}
            >
              <span className="quiz__radio" aria-hidden="true" />
              {option.label}
            </button>
          ))}
        </div>
      )

    case 'multi_select': {
      const selected = Array.isArray(value) ? value : []
      return (
        <div className="quiz__opts quiz__opts--stack">
          {question.options.map((option) => {
            const on = selected.includes(option.value)
            return (
              <button
                key={option.value}
                type="button"
                className={`quiz__choice ${on ? 'is-on' : ''}`}
                aria-pressed={on}
                onClick={() =>
                  onChange(on ? selected.filter((v) => v !== option.value) : [...selected, option.value])
                }
              >
                <span className="quiz__check" aria-hidden="true">{on && <Icon name="check" size={12} />}</span>
                {option.label}
              </button>
            )
          })}
        </div>
      )
    }

    case 'number':
      return (
        <input
          className="quiz__input"
          type="number"
          inputMode="numeric"
          value={value ?? ''}
          onChange={(e) => onChange(e.target.value === '' ? '' : Number(e.target.value))}
        />
      )

    case 'date':
      return <input className="quiz__input" type="date" value={value ?? ''} onChange={(e) => onChange(e.target.value)} />

    case 'long_text':
      return (
        <textarea
          className="quiz__input quiz__input--area"
          rows={4}
          value={value ?? ''}
          onChange={(e) => onChange(e.target.value)}
          placeholder={t('app.questionnaire.placeholder')}
        />
      )

    default:
      return (
        <input
          className="quiz__input"
          type="text"
          value={value ?? ''}
          onChange={(e) => onChange(e.target.value)}
          placeholder={t('app.questionnaire.placeholder')}
        />
      )
  }
}
