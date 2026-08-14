import { useState } from 'react'
import Icon from '../ui/Icon.jsx'
import { useI18n } from '../../context/I18nContext.jsx'
import { useApiMessage } from '../../lib/apiMessage.js'

/**
 * Something did not load.
 *
 * Two rules: say it in language the candidate can act on, and do not pretend it
 * did not happen. So the panel leads with what failed and what to try, and
 * keeps the error code available underneath rather than swallowing it — when
 * someone writes in about a problem, that code is the whole difference between
 * a diagnosis and a guessing game.
 *
 * The retry calls back into whatever loaded the data in the first place; it
 * never invents a recovery path of its own.
 */
export default function ErrorState({ code, what, onRetry, tone = 'risk' }) {
  const { t } = useI18n()
  const apiMessage = useApiMessage()
  const [busy, setBusy] = useState(false)
  const [shown, setShown] = useState(false)

  const retry = async () => {
    if (!onRetry) return
    setBusy(true)
    try {
      await onRetry()
    } finally {
      setBusy(false)
    }
  }

  return (
    <section className={`estate estate--${tone}`} role="alert">
      <span className="estate__icon">
        <Icon name="shieldAlert" size={22} />
      </span>

      <div className="estate__body">
        <h2>{what ?? t('app.error.title')}</h2>
        <p>{apiMessage(code)}</p>

        {code && (
          <>
            <button type="button" className="estate__toggle" onClick={() => setShown((v) => !v)}>
              {t(shown ? 'app.error.hideDetail' : 'app.error.showDetail')}
              <Icon name="chevronDown" size={13} className={shown ? 'is-flipped' : ''} />
            </button>
            {shown && <code className="estate__code">{code}</code>}
          </>
        )}
      </div>

      {onRetry && (
        <button type="button" className="btn btn--ghost btn--sm" onClick={retry} disabled={busy}>
          <Icon name="refresh" size={15} />
          {busy ? t('common.loading') : t('app.error.retry')}
        </button>
      )}
    </section>
  )
}
