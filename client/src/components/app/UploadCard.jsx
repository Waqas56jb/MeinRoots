import { useRef, useState } from 'react'
import Icon from '../ui/Icon.jsx'
import { localeCodes } from '../../i18n/index.js'
import { goalKeys } from '../../data/content.js'
import { useI18n } from '../../context/I18nContext.jsx'
import { useAuth } from '../../context/AuthContext.jsx'
import { cvApi } from '../../lib/api.js'
import { useApiMessage } from '../../lib/apiMessage.js'

const MAX_MB = 10
const ACCEPTED = ['.pdf', '.docx']

const prettySize = (bytes) => `${(bytes / 1024 / 1024).toFixed(2)} MB`

/**
 * The CV upload card.
 *
 * Compact by design: a full-width empty dropzone reads as an unfinished page,
 * and the candidate is more reassured by seeing what happens next than by a
 * large target. Objective selection sits here because the analysis reads it —
 * choosing it after the upload would race the worker.
 */
export default function UploadCard({ onDone, compact = false }) {
  const { t } = useI18n()
  const { user, updateGoals } = useAuth()
  const apiMessage = useApiMessage()
  const inputRef = useRef(null)

  const [file, setFile] = useState(null)
  const [dragging, setDragging] = useState(false)
  const [goals, setGoals] = useState(user?.goals?.length ? user.goals : ['germany'])
  const [error, setError] = useState('')
  const [phase, setPhase] = useState('idle') // idle | uploading | done
  const [progress, setProgress] = useState(0)

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

  const submit = async (event) => {
    event.preventDefault()
    if (!file) return inputRef.current?.click()
    if (!goals.length) return setError(t('errors.goal_required'))

    setError('')
    setPhase('uploading')
    setProgress(0)

    // Objectives first: the analysis reads them to decide which readiness
    // assessments to run.
    if (JSON.stringify(goals) !== JSON.stringify(user?.goals ?? [])) {
      await updateGoals(goals)
    }

    try {
      await cvApi.upload(file, setProgress)
      setPhase('done')
      await onDone?.()
    } catch (err) {
      setPhase('idle')
      setError(apiMessage(err.code))
    }
    return undefined
  }

  const busy = phase === 'uploading'

  return (
    <section className="wcard upcard">
      <div className="wcard__head">
        <h2><Icon name="upload" size={17} />{t('app.upload.cardTitle')}</h2>
      </div>
      <p className="wcard__hint">{t('app.upload.cardHint')}</p>

      <form onSubmit={submit}>
        <div
          className={`updrop ${dragging ? 'is-dragging' : ''} ${file ? 'has-file' : ''} ${compact ? 'is-compact' : ''}`}
          onDragOver={(e) => { e.preventDefault(); if (!busy) setDragging(true) }}
          onDragLeave={() => setDragging(false)}
          onDrop={(e) => {
            e.preventDefault()
            setDragging(false)
            if (!busy) accept(e.dataTransfer.files?.[0])
          }}
        >
          <input
            ref={inputRef}
            type="file"
            accept={ACCEPTED.join(',')}
            onChange={(e) => accept(e.target.files?.[0])}
            hidden
            disabled={busy}
          />

          {file ? (
            <div className="updrop__file">
              <span className="updrop__fileIcon"><Icon name="file" size={22} /></span>
              <div>
                <strong>{file.name}</strong>
                <span>{prettySize(file.size)}</span>
              </div>
              <button type="button" onClick={() => setFile(null)} disabled={busy}>
                {t('auth.upload.remove')}
              </button>
            </div>
          ) : (
            <>
              <span className="updrop__icon"><Icon name="upload" size={24} /></span>
              <strong>{t('auth.upload.dropTitle')}</strong>
              <span className="updrop__hint">{t('app.upload.formats', { max: MAX_MB })}</span>
              <span className="updrop__langs">
                {localeCodes.map((code) => <em key={code}>{code}</em>)}
              </span>
              <button
                type="button"
                className="btn btn--ghost btn--sm"
                onClick={() => inputRef.current?.click()}
                disabled={busy}
              >
                {t('auth.upload.browse')}
              </button>
            </>
          )}
        </div>

        {error && <p className="upcard__err"><Icon name="alert" size={14} />{error}</p>}

        <fieldset className="upgoals" disabled={busy}>
          <legend>{t('auth.upload.goalLabel')}</legend>
          <div className="upgoals__row">
            {goalKeys.map((g) => (
              <button
                key={g.key}
                type="button"
                className={`upgoals__chip ${goals.includes(g.key) ? 'is-on' : ''}`}
                onClick={() => toggleGoal(g.key)}
                aria-pressed={goals.includes(g.key)}
              >
                <Icon name={g.icon} size={16} />
                {t(`goals.items.${g.key}.title`)}
              </button>
            ))}
          </div>
        </fieldset>

        {busy ? (
          <div className="upbar">
            <div className="upbar__track">
              <span className="upbar__fill" style={{ width: `${progress}%` }} />
            </div>
            <span className="upbar__label">{t('app.upload.sending', { percent: progress })}</span>
          </div>
        ) : (
          <button type="submit" className="btn btn--primary btn--block btn--lg">
            <Icon name="brain" /> {t('auth.upload.submit')}
          </button>
        )}
      </form>
    </section>
  )
}
