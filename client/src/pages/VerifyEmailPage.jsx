import { useEffect, useRef, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import AuthShell from '../components/auth/AuthShell.jsx'
import Icon from '../components/ui/Icon.jsx'
import Spinner from '../components/ui/Spinner.jsx'
import { images } from '../data/content.js'
import { useI18n } from '../context/I18nContext.jsx'
import { useAuth } from '../context/AuthContext.jsx'
import { useApiMessage } from '../lib/apiMessage.js'

/**
 * The page the confirmation link opens.
 *
 * It verifies once and only once: React 18 mounts effects twice in development,
 * and the token is single-use, so a second call would report "invalid link" for
 * a link that had just worked.
 */
export default function VerifyEmailPage() {
  const { t } = useI18n()
  const [params] = useSearchParams()
  const { verifyEmail } = useAuth()
  const apiMessage = useApiMessage()

  const token = params.get('token')
  const [state, setState] = useState(token ? 'checking' : 'missing')
  const [error, setError] = useState('')
  const started = useRef(false)

  useEffect(() => {
    if (!token || started.current) return
    started.current = true

    verifyEmail(token).then((result) => {
      if (result.ok) setState('done')
      else {
        setError(apiMessage(result.error))
        setState('failed')
      }
    })
  }, [token, verifyEmail, apiMessage])

  return (
    <AuthShell image={images.authBackdrop} asidePath="auth.login.aside">
      {state === 'checking' && (
        <div className="sent">
          <Spinner />
          <h1>{t('auth.verify.checkingTitle')}</h1>
        </div>
      )}

      {state === 'done' && (
        <div className="sent">
          <span className="sent__icon"><Icon name="checkCircle" size={28} /></span>
          <h1>{t('auth.verify.doneTitle')}</h1>
          <p className="auth__sub">{t('auth.verify.doneText')}</p>
          <Link to="/dashboard" className="btn btn--primary btn--block btn--lg">
            {t('app.nav.dashboard')} <Icon name="arrowRight" />
          </Link>
        </div>
      )}

      {(state === 'failed' || state === 'missing') && (
        <div className="sent">
          <span className="sent__icon sent__icon--bad"><Icon name="alert" size={28} /></span>
          <h1>{t('auth.verify.failedTitle')}</h1>
          <p className="auth__sub">{state === 'missing' ? t('auth.verify.missingText') : error}</p>
          <Link to="/dashboard" className="btn btn--primary btn--block btn--lg">
            {t('auth.verify.goToAccount')}
          </Link>
          <Link to="/login" className="btn btn--ghost btn--block">
            {t('auth.reset.backToLogin')}
          </Link>
        </div>
      )}
    </AuthShell>
  )
}
