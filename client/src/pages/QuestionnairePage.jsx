import { useEffect, useMemo, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import AppShell from '../components/app/AppShell.jsx'
import Icon from '../components/ui/Icon.jsx'
import { Badge, Card, Empty, Note, Skeleton } from '../components/app/widgets.jsx'
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
 * the reason it is being asked. Stepping through them rather than presenting a
 * wall of fields is what keeps the promise of "no long forms": the candidate
 * always sees exactly one decision, and always knows how many are left.
 *
 * Answers are saved as they go, so leaving the page never loses work.
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

  if (ws.loading) {
    return (
      <AppShell eyebrow={t('app.nav.questionnaire')} title={t('app.questionnaire.title')}>
        <Skeleton rows={3} />
      </AppShell>
    )
  }

  if (!ws.questionnaire || !questions.length) {
    return (
      <AppShell eyebrow={t('app.nav.questionnaire')} title={t('app.questionnaire.title')}>
        <Card>
          <Empty
            icon="clipboard"
            title={t('app.questionnaire.emptyTitle')}
            text={t('app.questionnaire.emptyText')}
            action={<Link to="/cv" className="btn btn--primary">{t('nav.cta')} <Icon name="arrowRight" /></Link>}
          />
        </Card>
      </AppShell>
    )
  }

  if (finished) {
    return (
      <AppShell eyebrow={t('app.nav.questionnaire')} title={t('app.questionnaire.title')}>
        <Card>
          <Empty
            icon="check"
            title={t('app.questionnaire.doneTitle')}
            text={t('app.questionnaire.doneText')}
            action={
              <div className="qz__doneActions">
                <button type="button" className="btn btn--primary" onClick={() => navigate('/readiness')}>
                  {t('app.questionnaire.seeReadiness')} <Icon name="arrowRight" />
                </button>
                <button type="button" className="btn btn--ghost" onClick={() => { setFinished(false); setReviewAll(true) }}>
                  {t('app.questionnaire.reviewAnswers')}
                </button>
              </div>
            }
          />
        </Card>
      </AppShell>
    )
  }

  const question = questions[index]

  return (
    <AppShell
      eyebrow={t('app.nav.questionnaire')}
      title={t('app.questionnaire.title')}
      subtitle={t('app.questionnaire.subtitle', { count: questions.length })}
      badges={{ questionnaire: outstanding }}
    >
      {error && <Note tone="bad">{error}</Note>}
      {ws.questionnaire.status === 'completed' && !reviewAll && (
        <Note tone="good" icon="check">{t('app.questionnaire.completed')}</Note>
      )}

      <Card className="qz">
        <div className="qz__bar">
          <div className="qz__barTop">
            <strong>
              {reviewAll
                ? t('app.questionnaire.reviewing')
                : t('app.questionnaire.position', { current: index + 1, total: questions.length })}
            </strong>
            <span>{t('app.questionnaire.percent', { percent })}</span>
          </div>
          <div className="qz__track">
            <span className="qz__fill" style={{ width: `${Math.max(3, percent)}%` }} />
          </div>
          <div className="qz__dots" role="tablist" aria-label={t('app.questionnaire.title')}>
            {questions.map((q, i) => (
              <button
                key={q.id}
                type="button"
                role="tab"
                aria-selected={!reviewAll && i === index}
                aria-label={t('app.questionnaire.position', { current: i + 1, total: questions.length })}
                className={`qz__dot ${isAnswered(answers[q.id]) ? 'is-done' : ''} ${!reviewAll && i === index ? 'is-on' : ''}`}
                onClick={() => { setReviewAll(false); setIndex(i) }}
              />
            ))}
          </div>
        </div>

        {reviewAll ? (
          <div className="qz__review">
            <h2>{t('app.questionnaire.reviewTitle')}</h2>
            <ul className="wlist">
              {questions.map((q, i) => (
                <li key={q.id} className="wlist__item">
                  <span className="qz__num">{i + 1}</span>
                  <div>
                    <strong>{q.question}</strong>
                    <span>
                      {isAnswered(answers[q.id])
                        ? Array.isArray(answers[q.id])
                          ? answers[q.id].join(', ')
                          : String(answers[q.id])
                        : t('app.questionnaire.noAnswer')}
                    </span>
                  </div>
                  <button
                    type="button"
                    className="btn btn--ghost btn--sm"
                    onClick={() => { setReviewAll(false); setIndex(i) }}
                  >
                    <Icon name="pencil" size={14} /> {t('app.edit.edit')}
                  </button>
                </li>
              ))}
            </ul>
          </div>
        ) : (
          <div className="qz__q">
            <span className="qz__num qz__num--lg">{index + 1}</span>
            <h2>
              {question.question}
              {question.isRequired && <em className="qz__req">{t('app.questionnaire.required')}</em>}
            </h2>

            {question.reason && (
              <p className="qz__why">
                <Icon name="info" size={14} />
                {question.reason}
              </p>
            )}
            {question.helpText && <p className="qz__help">{question.helpText}</p>}

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

        <div className="qz__actions">
          <div className="qz__status">
            {outstanding > 0 ? (
              <span><Icon name="info" size={15} />{t('app.questionnaire.outstanding', { count: outstanding })}</span>
            ) : (
              <span className="is-good"><Icon name="checkCircle" size={15} />{t('app.questionnaire.allAnswered')}</span>
            )}
            {savedAt && <em><Icon name="check" size={13} />{t('app.questionnaire.saved')}</em>}
          </div>

          <div className="qz__buttons">
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
                title={outstanding > 0 ? t('app.questionnaire.outstanding', { count: outstanding }) : undefined}
              >
                {saving ? t('auth.processing') : t('app.questionnaire.submit')}
                {!saving && <Icon name="arrowRight" size={15} />}
              </button>
            )}
          </div>
        </div>
      </Card>
    </AppShell>
  )
}

function QuestionInput({ question, value, onChange }) {
  const { t } = useI18n()

  switch (question.inputType) {
    case 'boolean':
      return (
        <div className="qz__opts">
          {[true, false].map((option) => (
            <button
              key={String(option)}
              type="button"
              className={`qz__opt ${value === option ? 'is-on' : ''}`}
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
        <div className="qz__opts qz__opts--stack">
          {question.options.map((option) => (
            <button
              key={option.value}
              type="button"
              className={`qz__opt ${value === option.value ? 'is-on' : ''}`}
              onClick={() => onChange(option.value)}
              aria-pressed={value === option.value}
            >
              <span className="qz__radio" aria-hidden="true" />
              {option.label}
            </button>
          ))}
        </div>
      )

    case 'multi_select': {
      const selected = Array.isArray(value) ? value : []
      return (
        <div className="qz__opts qz__opts--stack">
          {question.options.map((option) => {
            const on = selected.includes(option.value)
            return (
              <button
                key={option.value}
                type="button"
                className={`qz__opt ${on ? 'is-on' : ''}`}
                aria-pressed={on}
                onClick={() =>
                  onChange(on ? selected.filter((v) => v !== option.value) : [...selected, option.value])
                }
              >
                <span className="qz__check" aria-hidden="true">{on && <Icon name="check" size={12} />}</span>
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
          className="qz__input"
          type="number"
          inputMode="numeric"
          value={value ?? ''}
          onChange={(e) => onChange(e.target.value === '' ? '' : Number(e.target.value))}
        />
      )

    case 'date':
      return <input className="qz__input" type="date" value={value ?? ''} onChange={(e) => onChange(e.target.value)} />

    case 'long_text':
      return (
        <textarea
          className="qz__input qz__input--area"
          rows={4}
          value={value ?? ''}
          onChange={(e) => onChange(e.target.value)}
          placeholder={t('app.questionnaire.placeholder')}
        />
      )

    default:
      return (
        <input
          className="qz__input"
          type="text"
          value={value ?? ''}
          onChange={(e) => onChange(e.target.value)}
          placeholder={t('app.questionnaire.placeholder')}
        />
      )
  }
}
