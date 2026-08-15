import { useEffect, useState } from 'react'
import Icon from './Icon.jsx'
import { Sheet } from './ui.jsx'
import { isNotImplemented } from '../lib/api.js'
import { requestApi } from '../services/index.js'
import { useI18n } from '../context/I18nContext.jsx'
import { useToast } from '../context/ToastContext.jsx'

/**
 * Asking to contact or interview a candidate.
 *
 * A confirmation step rather than a one-click send, because of what it actually
 * does: a message goes to a real person, who then decides whether to hand over
 * their contact details. The panel says that out loud before the button, so the
 * recruiter understands they are making a request and not retrieving a record.
 *
 * Every rule belongs to the server — whether the plan permits it, whether the
 * candidate consented, whether one is already open. This collects the message
 * and reports what came back.
 */
export default function RequestSheet({ candidate, type = 'contact', onClose, onSent }) {
  const { t } = useI18n()
  const toast = useToast()
  const [message, setMessage] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [pending, setPending] = useState(false)

  // A fresh panel for each candidate: a message typed for one person must never
  // be carried over to the next.
  useEffect(() => {
    setMessage('')
    setError('')
    setPending(false)
  }, [candidate?.id, type])

  if (!candidate) return null

  const send = async () => {
    setBusy(true)
    setError('')
    try {
      await requestApi.create({
        candidateId: candidate.id,
        type,
        message: message.trim() || undefined,
      })
      toast.success(t(`requests.sent.${type}`))
      onSent?.()
    } catch (err) {
      if (isNotImplemented(err)) setPending(true)
      else setError(t(`requests.errors.${err.code}`) || t('requests.errors.generic'))
    } finally {
      setBusy(false)
    }
  }

  return (
    <Sheet
      open={Boolean(candidate)}
      onClose={onClose}
      title={t(`requests.new.${type}Title`)}
      actions={
        <>
          <button type="button" className="btn btn--ghost" onClick={onClose} disabled={busy}>
            {t('common.cancel')}
          </button>
          <button type="button" className="btn btn--primary" onClick={send} disabled={busy || pending}>
            {busy ? t('common.loading') : t(`requests.new.${type}Send`)}
          </button>
        </>
      }
    >
      <div className="reqsheet">
        <div className="reqsheet__who">
          <span className="reqsheet__ref">{candidate.reference ?? `#${candidate.id}`}</span>
          <strong>{candidate.profession ?? t('candidates.professionUnknown')}</strong>
          {candidate.specialisation && <span className="muted">{candidate.specialisation}</span>}
        </div>

        {/*
          Said before the send button, not after. The recruiter is asking, and
          the candidate decides — presenting this as a retrieval would set the
          wrong expectation and make the eventual "declined" feel like a fault.
        */}
        <p className="reqsheet__privacy">
          <Icon name="shield" size={16} />
          <span>{t(`requests.new.${type}Privacy`)}</span>
        </p>

        <label className="field" htmlFor="req-message">
          <span className="field__label">
            {t('requests.new.message')}
            <em className="field__optional">{t('common.optional')}</em>
          </span>
          <textarea
            id="req-message"
            rows={4}
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            maxLength={1000}
            placeholder={t(`requests.new.${type}Placeholder`)}
          />
          <span className="field__hint num">{t('requests.new.remaining', { count: 1000 - message.length })}</span>
        </label>

        {error && <p className="field__err" role="alert"><Icon name="alert" size={14} />{error}</p>}

        {pending && (
          <div className="reqsheet__pending" role="status">
            <Icon name="clock" size={16} />
            <div>
              <strong>{t('requests.new.pendingTitle')}</strong>
              <p>{t('requests.new.pendingText')}</p>
              <code>POST /api/recruiter/requests</code>
            </div>
          </div>
        )}
      </div>
    </Sheet>
  )
}
