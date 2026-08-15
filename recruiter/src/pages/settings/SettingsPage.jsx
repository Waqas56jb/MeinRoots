import { useState } from 'react'
import { Link } from 'react-router-dom'
import Layout from '../../components/Layout.jsx'
import Icon from '../../components/Icon.jsx'
import { Field } from '../../components/AuthShell.jsx'
import { Badge, Panel } from '../../components/ui.jsx'
import { authApi } from '../../services/index.js'
import { useI18n } from '../../context/I18nContext.jsx'
import { useAuth } from '../../context/AuthContext.jsx'
import { useAccount } from '../../context/AccountContext.jsx'
import { useToast } from '../../context/ToastContext.jsx'

/**
 * Account settings.
 *
 * Only what is genuinely backed by an endpoint. The password change and the
 * language switch are Milestone 1 routes and work today; anything that would
 * need the Milestone 2 backend lives on its own page with its own pending
 * state rather than being stubbed in here as a dead toggle.
 */
export default function SettingsPage() {
  const { t, locale, setLocale, locales } = useI18n()
  const { user, syncLocale, logout } = useAuth()
  const { company, plan, subscription } = useAccount()
  const toast = useToast()

  return (
    <Layout title={t('settings.title')} subtitle={t('settings.subtitle')} narrow>
      <div className="settingsgrid">
        <Panel icon="user" title={t('settings.account')}>
          <div className="settings__identity">
            <span className="avatar avatar--lg" aria-hidden="true">
              {(user?.name ?? '').split(' ').filter(Boolean).slice(0, 2).map((p) => p[0].toUpperCase()).join('') || 'R'}
            </span>
            <div>
              <strong>{user?.name}</strong>
              <span className="settings__addr">{user?.email}</span>
            </div>
          </div>
          {company?.legalName && (
            <p className="settings__meta">
              <Icon name="company" size={14} />
              {company.tradingName || company.legalName}
            </p>
          )}
          {plan && (
            <p className="settings__meta">
              <Icon name="card" size={14} />
              {t(`billing.plans.${plan}.name`)}
              {subscription?.status && (
                <Badge tone={subscription.status === 'active' ? 'good' : 'info'}>
                  {t(`billing.status.${subscription.status}`)}
                </Badge>
              )}
              <Link to="/billing">{t('settings.manageBilling')}</Link>
            </p>
          )}
        </Panel>

        <Panel icon="globe" title={t('settings.language')} hint={t('settings.languageHint')}>
          <div className="langpick">
            {locales.map((l) => (
              <button
                key={l.code}
                type="button"
                className={l.code === locale ? 'is-on' : ''}
                aria-pressed={l.code === locale}
                onClick={() => {
                  setLocale(l.code)
                  syncLocale(l.code)
                  toast.success(t('settings.languageSaved'))
                }}
              >
                <span className="langpick__code">{l.code.toUpperCase()}</span>
                <span className="langpick__name">{l.native}</span>
                {l.code === locale && <Icon name="check" size={16} />}
              </button>
            ))}
          </div>
        </Panel>
      </div>

      <PasswordPanel />

      <Panel icon="logout" title={t('settings.session')}>
        <div className="settings__foot">
          <p className="muted small">{t('settings.sessionText')}</p>
          <button type="button" className="btn btn--ghost btn--sm" onClick={logout}>
            <Icon name="logout" size={15} /> {t('common.logout')}
          </button>
        </div>
      </Panel>
    </Layout>
  )
}

/** Password change — a Milestone 1 endpoint, live today. */
function PasswordPanel() {
  const { t, tError } = useI18n()
  const toast = useToast()
  const [values, setValues] = useState({ currentPassword: '', newPassword: '', confirm: '' })
  const [errors, setErrors] = useState({})
  const [busy, setBusy] = useState(false)

  const set = (k, v) => {
    setValues((s) => ({ ...s, [k]: v }))
    setErrors((e) => ({ ...e, [k]: undefined }))
  }

  const submit = async (e) => {
    e.preventDefault()
    const next = {}
    if (!values.currentPassword) next.currentPassword = t('auth.errors.passwordRequired')
    if (values.newPassword.length < 8) next.newPassword = t('auth.errors.passwordShort')
    if (values.confirm !== values.newPassword) next.confirm = t('auth.errors.mismatch')
    setErrors(next)
    if (Object.keys(next).length) return

    setBusy(true)
    try {
      await authApi.changePassword({
        currentPassword: values.currentPassword,
        newPassword: values.newPassword,
      })
      setValues({ currentPassword: '', newPassword: '', confirm: '' })
      toast.success(t('settings.passwordChanged'))
    } catch (err) {
      if (err.code === 'wrong_password') setErrors({ currentPassword: tError(err.code) })
      else toast.error(tError(err.code))
    } finally {
      setBusy(false)
    }
  }

  return (
    <Panel icon="lock" title={t('settings.password')} hint={t('settings.passwordHint')}>
      <form onSubmit={submit} noValidate className="formcol">
        <Field
          label={t('settings.currentPassword')} name="currentPassword" type="password"
          value={values.currentPassword} onChange={(v) => set('currentPassword', v)}
          error={errors.currentPassword} autoComplete="current-password" required
        />
        <div className="grid2">
          <Field
            label={t('settings.newPassword')} name="newPassword" type="password"
            value={values.newPassword} onChange={(v) => set('newPassword', v)}
            error={errors.newPassword} autoComplete="new-password" required
          />
          <Field
            label={t('auth.confirm')} name="confirm" type="password"
            value={values.confirm} onChange={(v) => set('confirm', v)}
            error={errors.confirm} autoComplete="new-password" required
          />
        </div>
        <div className="formfoot">
          <button type="submit" className="btn btn--primary" disabled={busy}>
            {busy ? t('common.loading') : t('settings.changePassword')}
          </button>
        </div>
      </form>
    </Panel>
  )
}
