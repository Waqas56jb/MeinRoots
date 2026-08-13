import { useCallback, useEffect, useRef, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import Icon from '../components/ui/Icon.jsx'
import AppHeader from '../components/app/AppHeader.jsx'
import { goalKeys } from '../data/content.js'
import { localeCodes } from '../i18n/index.js'
import { useI18n } from '../context/I18nContext.jsx'
import { useAuth } from '../context/AuthContext.jsx'
import { cvApi } from '../lib/api.js'
import { useApiMessage } from '../lib/apiMessage.js'

const MAX_MB = 10
const ACCEPTED = ['.pdf', '.docx']
const POLL_MS = 2500

/** The stages the worker reports, in the order it reports them. */
const STAGES = ['extracting_text', 'analysing', 'classifying', 'questionnaire', 'readiness', 'translating']

const prettySize = (bytes) => `${(bytes / 1024 / 1024).toFixed(2)} MB`

export default function UploadPage() {
  const { t } = useI18n()
  const { user, updateGoals } = useAuth()
  const navigate = useNavigate()
  const apiMessage = useApiMessage()
  const inputRef = useRef(null)
  const pollRef = useRef(null)

  const [file, setFile] = useState(null)
  const [dragging, setDragging] = useState(false)
  const [goals, setGoals] = useState(user?.goals?.length ? user.goals : ['germany'])
  const [error, setError] = useState('')
  const [phase, setPhase] = useState('idle') // idle | uploading | analysing | done | failed
  const [progress, setProgress] = useState(0)
  const [stage, setStage] = useState(null)
  const [documentId, setDocumentId] = useState(null)

  // Any in-flight poll must stop when the screen goes away, or it keeps hitting
  // the API from a component that no longer exists.
  useEffect(() => () => clearTimeout(pollRef.current), [])

  const poll = useCallback(
    async (id) => {
      try {
        const status = await cvApi.status(id)
        setStage(status.job?.stage ?? null)

        if (status.document.status === 'failed') {
          setPhase('failed')
          setError(apiMessage(status.document.error ? 'analysis_failed' : 'analysis_failed'))
          return
        }
        if (status.document.status === 'analysed') {
          setPhase('done')
          return
        }
        pollRef.current = setTimeout(() => poll(id), POLL_MS)
      } catch (err) {
        // A dropped connection mid-analysis is not a failed analysis — the work
        // continues on the server, so keep trying rather than showing an error.
        pollRef.current = setTimeout(() => poll(id), POLL_MS * 2)
      }
    },
    [apiMessage],
  )

  const accept = (candidate) => {
    if (!candidate) return
    const ext = `.${candidate.name.split('.').pop()?.toLowerCase()}`
    if (!ACCEPTED.includes(ext)) return setError(t('errors.unsupported_file_type'))
    if (candidate.size > MAX_MB * 1024 * 1024) return setError(t('errors.file_too_large'))
    setError('')
    return setFile(candidate)
  }

  const toggleGoal = (key) =>
    setGoals((g) => (g.includes(key) ? g.filter((x) => x !== key) : [...g, key]))

  const onSubmit = async (event) => {
    event.preventDefault()
    if (!file) {
      inputRef.current?.click()
      return
    }
    if (!goals.length) {
      setError(t('errors.goal_required'))
      return
    }

    setError('')
    setPhase('uploading')
    setProgress(0)

    // Save the objective first: the analysis reads it to decide which readiness
    // assessments to run, so doing it after the upload would race the worker.
    if (JSON.stringify(goals) !== JSON.stringify(user?.goals ?? [])) {
      await updateGoals(goals)
    }

    try {
      const result = await cvApi.upload(file, setProgress)
      setDocumentId(result.document.id)
      setPhase('analysing')
      poll(result.document.id)
    } catch (err) {
      setPhase('failed')
      setError(apiMessage(err.code))
    }
  }

  const retry = () => {
    setPhase('idle')
    setError('')
    setProgress(0)
    setStage(null)
  }

  const stageIndex = stage ? STAGES.indexOf(stage) : -1

  return (
    <div className="upload">
      <AppHeader />

      <main className="upload__main">
        <div className="container upload__inner">
          {phase === 'done' ? (
            <section className="upload__done card">
              <span className="upload__doneIcon"><Icon name="checkCircle" size={34} /></span>
              <h1>{t('auth.upload.successTitle')}</h1>
              <p>{t('auth.upload.successText')}</p>
              <ul className="upload__doneList">
                {t('auth.upload.steps').map((s) => (
                  <li key={s}><Icon name="check" size={16} />{s}</li>
                ))}
              </ul>
              <div className="upload__doneActions">
                <button
                  type="button"
                  className="btn btn--primary btn--lg"
                  onClick={() => navigate('/dashboard')}
                >
                  {t('app.upload.seeProfile')} <Icon name="arrowRight" />
                </button>
                <Link to="/questionnaire" className="btn btn--ghost btn--lg">
                  {t('app.upload.answerQuestions')}
                </Link>
              </div>
            </section>
          ) : phase === 'failed' ? (
            <section className="upload__done card">
              <span className="upload__doneIcon upload__doneIcon--bad"><Icon name="alert" size={34} /></span>
              <h1>{t('app.upload.failedTitle')}</h1>
              <p>{error || t('errors.analysis_failed')}</p>
              <div className="upload__doneActions">
                <button type="button" className="btn btn--primary btn--lg" onClick={retry}>
                  {t('app.upload.tryAgain')}
                </button>
                {documentId && (
                  <Link to="/dashboard" className="btn btn--ghost btn--lg">
                    {t('app.nav.dashboard')}
                  </Link>
                )}
              </div>
            </section>
          ) : (
            <>
              <header className="upload__head">
                <span className="eyebrow"><Icon name="upload" />{t('nav.cta')}</span>
                <h1>{t('auth.upload.title')}</h1>
                <p className="lead">{t('auth.upload.subtitle')}</p>
              </header>

              <form className="upload__card card" onSubmit={onSubmit}>
                <div
                  className={`dropzone ${dragging ? 'is-dragging' : ''} ${file ? 'has-file' : ''}`}
                  onDragOver={(e) => { e.preventDefault(); setDragging(true) }}
                  onDragLeave={() => setDragging(false)}
                  onDrop={(e) => {
                    e.preventDefault()
                    setDragging(false)
                    if (phase === 'idle') accept(e.dataTransfer.files?.[0])
                  }}
                >
                  <input
                    ref={inputRef}
                    type="file"
                    accept={ACCEPTED.join(',')}
                    onChange={(e) => accept(e.target.files?.[0])}
                    hidden
                  />

                  {file ? (
                    <div className="dropzone__file">
                      <span className="dropzone__fileIcon"><Icon name="file" size={22} /></span>
                      <div>
                        <strong>{file.name}</strong>
                        <span>{prettySize(file.size)}</span>
                      </div>
                      <button type="button" onClick={() => setFile(null)} disabled={phase !== 'idle'}>
                        {t('auth.upload.remove')}
                      </button>
                    </div>
                  ) : (
                    <>
                      <span className="drop__icon"><Icon name="upload" size={26} /></span>
                      <strong>{t('auth.upload.dropTitle')}</strong>
                      <span className="dropzone__hint">{t('auth.upload.dropHint')}</span>
                      <span className="drop__langs">
                        {localeCodes.map((code) => (
                          <em key={code}>{code}</em>
                        ))}
                      </span>
                      <button
                        type="button"
                        className="btn btn--ghost btn--sm"
                        onClick={() => inputRef.current?.click()}
                      >
                        {t('auth.upload.browse')}
                      </button>
                    </>
                  )}
                </div>

                {error && <p className="ffield__err"><Icon name="alert" size={14} />{error}</p>}

                <fieldset className="goalpick" disabled={phase !== 'idle'}>
                  <legend>{t('auth.upload.goalLabel')}</legend>
                  <div className="goalpick__row">
                    {goalKeys.map((g) => (
                      <button
                        key={g.key}
                        type="button"
                        className={`goalpick__chip ${goals.includes(g.key) ? 'is-on' : ''}`}
                        onClick={() => toggleGoal(g.key)}
                        aria-pressed={goals.includes(g.key)}
                        disabled={phase !== 'idle'}
                      >
                        <Icon name={g.icon} size={17} />
                        {t(`goals.items.${g.key}.title`)}
                        <span className="goalpick__tick"><Icon name="check" size={12} /></span>
                      </button>
                    ))}
                  </div>
                </fieldset>

                {phase === 'uploading' && (
                  <div className="uploadbar">
                    <div className="uploadbar__track">
                      <span className="uploadbar__fill" style={{ width: `${progress}%` }} />
                    </div>
                    <span className="uploadbar__label">
                      {t('app.upload.sending', { percent: progress })}
                    </span>
                  </div>
                )}

                {phase === 'analysing' && (
                  <ul className="progress">
                    {STAGES.map((key, i) => (
                      <li
                        key={key}
                        className={
                          stageIndex > i ? 'is-done' : stageIndex === i ? 'is-active' : ''
                        }
                      >
                        <span className="progress__dot">
                          {stageIndex > i ? <Icon name="check" size={13} /> : <i />}
                        </span>
                        {t(`app.upload.stages.${key}`)}
                      </li>
                    ))}
                  </ul>
                )}

                {phase === 'idle' && (
                  <button type="submit" className="btn btn--primary btn--block btn--lg">
                    <Icon name="brain" /> {t('auth.upload.submit')}
                  </button>
                )}

                {phase === 'analysing' && (
                  <p className="upload__note">
                    <Icon name="info" size={15} /> {t('app.upload.keepOpen')}
                  </p>
                )}

                <p className="cta__legal">
                  <Icon name="lock" size={14} />
                  {t('cta.legal')}
                </p>
              </form>
            </>
          )}
        </div>
      </main>
    </div>
  )
}
