import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import AppHeader from '../components/app/AppHeader.jsx'
import Icon from '../components/ui/Icon.jsx'
import Spinner from '../components/ui/Spinner.jsx'
import EmptyState from '../components/ui/EmptyState.jsx'
import { useI18n } from '../context/I18nContext.jsx'
import { questionnaireApi } from '../lib/api.js'
import { useApiMessage } from '../lib/apiMessage.js'

/**
 * The qualification questionnaire.
 *
 * Every question was generated because the CV could not answer it, and each one
 * carries the reason it is being asked — so the form reads as follow-up rather
 * than as the long registration form the product promises to avoid.
 */
export default function QuestionnairePage() {
  const { t } = useI18n()
  const navigate = useNavigate()
  const apiMessage = useApiMessage()

  const [state, setState] = useState(undefined)
  const [answers, setAnswers] = useState({})
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [savedAt, setSavedAt] = useState(null)

  useEffect(() => {
    questionnaireApi
      .current()
      .then((data) => {
        setState(data)
        setAnswers(
          Object.fromEntries(
            data.questions.filter((q) => q.answer !== null).map((q) => [q.id, q.answer]),
          ),
        )
      })
      .catch((err) => {
        setError(apiMessage(err.code))
        setState({ questionnaire: null, questions: [] })
      })
  }, [apiMessage])

  const questions = state?.questions ?? []

  const outstanding = useMemo(
    () => questions.filter((q) => q.isRequired && !isAnswered(answers[q.id])).length,
    [questions, answers],
  )

  const setAnswer = (question, value) => {
    setAnswers((current) => ({ ...current, [question.id]: value }))
    setError('')
  }

  const save = async ({ complete }) => {
    const payload = questions
      .filter((q) => isAnswered(answers[q.id]))
      .map((q) => ({ questionId: q.id, value: normalise(q, answers[q.id]) }))

    if (!payload.length) {
      setError(t('app.questionnaire.nothingToSave'))
      return
    }

    setSaving(true)
    setError('')
    try {
      await questionnaireApi.answer(payload)
      setSavedAt(Date.now())
      if (complete) {
        await questionnaireApi.complete()
        navigate('/dashboard')
      }
    } catch (err) {
      setError(apiMessage(err.code))
    } finally {
      setSaving(false)
    }
  }

  if (state === undefined) {
    return (
      <div className="app">
        <AppHeader />
        <Spinner full />
      </div>
    )
  }

  if (!state.questionnaire || !questions.length) {
    return (
      <div className="app">
        <AppHeader />
        <main className="app__main">
          <div className="container">
            <EmptyState
              icon="clipboard"
              title={t('app.questionnaire.emptyTitle')}
              text={t('app.questionnaire.emptyText')}
              actionLabel={t('nav.cta')}
              actionTo="/upload"
            />
          </div>
        </main>
      </div>
    )
  }

  const completed = state.questionnaire.status === 'completed'

  return (
    <div className="app">
      <AppHeader />

      <main className="app__main">
        <div className="container container--narrow">
          <header className="dash__head">
            <div>
              <span className="eyebrow"><Icon name="clipboard" />{t('app.nav.questionnaire')}</span>
              <h1>{t('app.questionnaire.title')}</h1>
              <p className="lead">{t('app.questionnaire.subtitle', { count: questions.length })}</p>
            </div>
          </header>

          {completed && (
            <p className="banner banner--good">
              <Icon name="checkCircle" size={16} />{t('app.questionnaire.completed')}
            </p>
          )}

          {error && <p className="banner banner--bad"><Icon name="alert" size={16} />{error}</p>}

          <form
            className="quest"
            onSubmit={(e) => {
              e.preventDefault()
              save({ complete: outstanding === 0 })
            }}
          >
            {questions.map((question, index) => (
              <fieldset key={question.id} className="quest__q card">
                <legend>
                  <span className="quest__num">{index + 1}</span>
                  {question.question}
                  {question.isRequired && <em className="quest__req">{t('app.questionnaire.required')}</em>}
                </legend>

                {question.reason && (
                  <p className="quest__why">
                    <Icon name="info" size={14} />
                    {question.reason}
                  </p>
                )}
                {question.helpText && <p className="quest__help">{question.helpText}</p>}

                <QuestionInput
                  question={question}
                  value={answers[question.id]}
                  onChange={(value) => setAnswer(question, value)}
                />
              </fieldset>
            ))}

            <div className="quest__actions">
              <div className="quest__status">
                {outstanding > 0 ? (
                  <span><Icon name="info" size={15} />{t('app.questionnaire.outstanding', { count: outstanding })}</span>
                ) : (
                  <span className="is-good"><Icon name="checkCircle" size={15} />{t('app.questionnaire.allAnswered')}</span>
                )}
                {savedAt && <em>{t('app.questionnaire.saved')}</em>}
              </div>

              <div className="quest__buttons">
                <button
                  type="button"
                  className="btn btn--ghost"
                  onClick={() => save({ complete: false })}
                  disabled={saving}
                >
                  {t('app.questionnaire.saveDraft')}
                </button>
                <button type="submit" className="btn btn--primary btn--lg" disabled={saving || outstanding > 0}>
                  {saving ? t('auth.processing') : t('app.questionnaire.submit')}
                  {!saving && <Icon name="arrowRight" />}
                </button>
              </div>
            </div>
          </form>
        </div>
      </main>
    </div>
  )
}

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

function QuestionInput({ question, value, onChange }) {
  const { t } = useI18n()

  switch (question.inputType) {
    case 'boolean':
      return (
        <div className="quest__bool">
          {[true, false].map((option) => (
            <button
              key={String(option)}
              type="button"
              className={`quest__opt ${value === option ? 'is-on' : ''}`}
              onClick={() => onChange(option)}
              aria-pressed={value === option}
            >
              <Icon name={option ? 'check' : 'close'} size={15} />
              {option ? t('common.yes') : t('common.no')}
            </button>
          ))}
        </div>
      )

    case 'single_select':
      return (
        <div className="quest__opts">
          {question.options.map((option) => (
            <button
              key={option.value}
              type="button"
              className={`quest__opt ${value === option.value ? 'is-on' : ''}`}
              onClick={() => onChange(option.value)}
              aria-pressed={value === option.value}
            >
              {option.label}
            </button>
          ))}
        </div>
      )

    case 'multi_select': {
      const selected = Array.isArray(value) ? value : []
      return (
        <div className="quest__opts">
          {question.options.map((option) => {
            const on = selected.includes(option.value)
            return (
              <button
                key={option.value}
                type="button"
                className={`quest__opt ${on ? 'is-on' : ''}`}
                aria-pressed={on}
                onClick={() =>
                  onChange(on ? selected.filter((v) => v !== option.value) : [...selected, option.value])
                }
              >
                {on && <Icon name="check" size={14} />}
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
          className="quest__input"
          type="number"
          inputMode="numeric"
          value={value ?? ''}
          onChange={(e) => onChange(e.target.value === '' ? '' : Number(e.target.value))}
        />
      )

    case 'date':
      return (
        <input
          className="quest__input"
          type="date"
          value={value ?? ''}
          onChange={(e) => onChange(e.target.value)}
        />
      )

    case 'long_text':
      return (
        <textarea
          className="quest__input quest__input--area"
          rows={4}
          value={value ?? ''}
          onChange={(e) => onChange(e.target.value)}
          placeholder={t('app.questionnaire.placeholder')}
        />
      )

    default:
      return (
        <input
          className="quest__input"
          type="text"
          value={value ?? ''}
          onChange={(e) => onChange(e.target.value)}
          placeholder={t('app.questionnaire.placeholder')}
        />
      )
  }
}
