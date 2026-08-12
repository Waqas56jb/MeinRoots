import { useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import Icon from '../components/ui/Icon.jsx'
import LanguageSwitcher from '../components/LanguageSwitcher.jsx'
import { Brand } from '../components/Navbar.jsx'
import { goalKeys } from '../data/content.js'
import { localeCodes } from '../i18n/index.js'
import { useI18n } from '../context/I18nContext.jsx'
import { useAuth } from '../context/AuthContext.jsx'

const MAX_MB = 10
const ACCEPTED = ['.pdf', '.doc', '.docx']

const prettySize = (bytes) => `${(bytes / 1024 / 1024).toFixed(2)} MB`

export default function UploadPage() {
  const { t } = useI18n()
  const { user, logout } = useAuth()
  const inputRef = useRef(null)

  const [file, setFile] = useState(null)
  const [dragging, setDragging] = useState(false)
  const [goals, setGoals] = useState(user?.goals?.length ? user.goals : ['germany'])
  const [error, setError] = useState('')
  const [stage, setStage] = useState('idle') // idle | running | done
  const [step, setStep] = useState(0)

  const steps = t('auth.upload.steps')

  // Walks the visible progress steps while the (future) API does the real work.
  useEffect(() => {
    if (stage !== 'running') return undefined
    if (step >= steps.length) {
      const id = setTimeout(() => setStage('done'), 500)
      return () => clearTimeout(id)
    }
    const id = setTimeout(() => setStep((s) => s + 1), 900)
    return () => clearTimeout(id)
  }, [stage, step, steps.length])

  const accept = (candidate) => {
    if (!candidate) return
    const ext = `.${candidate.name.split('.').pop()?.toLowerCase()}`
    if (!ACCEPTED.includes(ext)) {
      setError(t('auth.errors.fileType'))
      return
    }
    if (candidate.size > MAX_MB * 1024 * 1024) {
      setError(t('auth.errors.fileSize'))
      return
    }
    setError('')
    setFile(candidate)
  }

  const toggleGoal = (key) =>
    setGoals((g) => (g.includes(key) ? g.filter((x) => x !== key) : [...g, key]))

  const onSubmit = (e) => {
    e.preventDefault()
    if (!file) {
      inputRef.current?.click()
      return
    }
    setStep(0)
    setStage('running')
  }

  return (
    <div className="upload">
      <header className="upload__bar">
        <div className="container upload__barInner">
          <Brand />
          <div className="upload__barActions">
            <LanguageSwitcher />
            <span className="upload__who">
              <span className="nav__avatar" aria-hidden="true">
                {user?.name?.trim().charAt(0).toUpperCase() || 'M'}
              </span>
              <span>
                <small>{t('auth.upload.signedInAs')}</small>
                <strong>{user?.name}</strong>
              </span>
            </span>
            <button type="button" className="upload__logout" onClick={logout} aria-label={t('nav.logout')}>
              <Icon name="logout" size={18} />
            </button>
          </div>
        </div>
      </header>

      <main className="upload__main">
        <div className="container upload__inner">
          {stage === 'done' ? (
            <section className="upload__done card">
              <span className="upload__doneIcon"><Icon name="checkCircle" size={34} /></span>
              <h1>{t('auth.upload.successTitle')}</h1>
              <p>{t('auth.upload.successText')}</p>
              <ul className="upload__doneList">
                {steps.map((s) => (
                  <li key={s}><Icon name="check" size={16} />{s}</li>
                ))}
              </ul>
              <Link to="/" className="btn btn--primary btn--lg">
                {t('auth.upload.backHome')} <Icon name="arrowRight" />
              </Link>
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
                    accept(e.dataTransfer.files?.[0])
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
                      <button type="button" onClick={() => setFile(null)} disabled={stage === 'running'}>
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
                      <button type="button" className="btn btn--ghost btn--sm" onClick={() => inputRef.current?.click()}>
                        {t('auth.upload.browse')}
                      </button>
                    </>
                  )}
                </div>

                {error && <p className="ffield__err"><Icon name="alert" size={14} />{error}</p>}

                <fieldset className="goalpick">
                  <legend>{t('auth.upload.goalLabel')}</legend>
                  <div className="goalpick__row">
                    {goalKeys.map((g) => (
                      <button
                        key={g.key}
                        type="button"
                        className={`goalpick__chip ${goals.includes(g.key) ? 'is-on' : ''}`}
                        onClick={() => toggleGoal(g.key)}
                        aria-pressed={goals.includes(g.key)}
                      >
                        <Icon name={g.icon} size={17} />
                        {t(`goals.items.${g.key}.title`)}
                        <span className="goalpick__tick"><Icon name="check" size={12} /></span>
                      </button>
                    ))}
                  </div>
                </fieldset>

                {stage === 'running' ? (
                  <ul className="progress">
                    {steps.map((s, i) => (
                      <li key={s} className={i < step ? 'is-done' : i === step ? 'is-active' : ''}>
                        <span className="progress__dot">
                          {i < step ? <Icon name="check" size={13} /> : <i />}
                        </span>
                        {s}
                      </li>
                    ))}
                  </ul>
                ) : (
                  <button type="submit" className="btn btn--primary btn--block btn--lg">
                    <Icon name="brain" /> {t('auth.upload.submit')}
                  </button>
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
