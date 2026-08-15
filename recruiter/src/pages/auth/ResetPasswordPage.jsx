import { useState } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import AuthShell, { Field } from '../../components/AuthShell.jsx'
import Icon from '../../components/Icon.jsx'
import { authApi } from '../../services/index.js'
import { useI18n } from '../../context/I18nContext.jsx'

/** Uses the shared reset endpoint from Milestone 1 — already live. */
export default function ResetPasswordPage() {
  const { t, tError } = useI18n()
  const navigate = useNavigate()
  const [params] = useSearchParams()
  const token = params.get('token') ?? ''

  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [errors, setErrors] = useState({})
  const [busy, setBusy] = useState(false)

  const submit = async (e) => {
    e.preventDefault()
    const next = {}
    if (password.length < 8) next.password = t('auth.errors.passwordShort')
    if (confirm !== password) next.confirm = t('auth.errors.mismatch')
    setErrors(next)
    if (Object.keys(next).length) return

    setBusy(true)
    try {
      await authApi.resetPassword({ token, password })
      navigate('/login', { replace: true })
    } catch (err) {
      setErrors({ form: tError(err.code) })
    } finally {
      setBusy(false)
    }
  }

  // A link with no token cannot be completed, and saying so beats a form that
  // fails only after the password has been typed twice.
  if (!token) {
    return (
      <AuthShell>
        <h1>{t('auth.reset.invalidTitle')}</h1>
        <p className="auth__sub">{t('auth.reset.invalidText')}</p>
        <Link to="/forgot-password" className="btn btn--primary btn--block">{t('auth.reset.requestNew')}</Link>
      </AuthShell>
    )
  }

  return (
    <AuthShell>
      <h1>{t('auth.reset.title')}</h1>
      <p className="auth__sub">{t('auth.reset.subtitle')}</p>

      <form onSubmit={submit} noValidate>
        {errors.form && <p className="auth__alert" role="alert"><Icon name="alert" size={16} />{errors.form}</p>}
        <Field
          label={t('auth.newPassword')} name="password" type="password" value={password}
          onChange={(v) => { setPassword(v); setErrors((s) => ({ ...s, password: undefined })) }}
          error={errors.password} autoComplete="new-password" required
        />
        <Field
          label={t('auth.confirm')} name="confirm" type="password" value={confirm}
          onChange={(v) => { setConfirm(v); setErrors((s) => ({ ...s, confirm: undefined })) }}
          error={errors.confirm} autoComplete="new-password" required
        />
        <button type="submit" className="btn btn--primary btn--block btn--lg" disabled={busy}>
          {busy ? t('common.loading') : t('auth.reset.submit')}
        </button>
      </form>
    </AuthShell>
  )
}
