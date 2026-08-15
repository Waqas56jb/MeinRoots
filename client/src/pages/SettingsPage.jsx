import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import AppShell from '../components/app/AppShell.jsx'
import Icon from '../components/ui/Icon.jsx'
import { Badge, Card, Note } from '../components/app/widgets.jsx'
import { goalKeys } from '../data/content.js'
import { useI18n } from '../context/I18nContext.jsx'
import { useAuth } from '../context/AuthContext.jsx'
import { useWorkspace } from '../context/WorkspaceContext.jsx'
import { authApi } from '../lib/api.js'
import { useApiMessage } from '../lib/apiMessage.js'

/**
 * Account settings.
 *
 * Only settings that are actually backed by an endpoint appear here: language,
 * objectives, email notifications, password, and erasure. Nothing decorative.
 */
export default function SettingsPage() {
  const { t, locale, setLocale, locales } = useI18n()
  const { user, updateGoals, setEmailNotifications, resendVerification, syncLocale, logout } = useAuth()
  const apiMessage = useApiMessage()
  const ws = useWorkspace()
  const navigate = useNavigate()

  const [goals, setGoals] = useState(user?.goals ?? [])
  const [saved, setSaved] = useState('')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  const flash = (key) => {
    setSaved(key)
    setError('')
    setTimeout(() => setSaved(''), 2500)
  }

  const saveGoals = async () => {
    if (!goals.length) return setError(t('errors.goal_required'))
    setBusy(true)
    const result = await updateGoals(goals)
    setBusy(false)
    if (!result.ok) return setError(apiMessage(result.error))
    flash('goals')
    return ws.reload({ quiet: true })
  }

  const toggleNotifications = async (enabled) => {
    const result = await setEmailNotifications(enabled)
    if (!result.ok) setError(apiMessage(result.error))
    else flash('notifications')
  }

  return (
    <AppShell
      eyebrow={t('app.nav.settings')}
      title={t('app.settings.title')}
      subtitle={t('app.settings.subtitle')}
      badges={{ questionnaire: ws.outstandingQuestions }}
    >
      {error && <Note tone="bad">{error}</Note>}
      {saved && <Note tone="good" icon="check">{t(`app.settings.saved.${saved}`)}</Note>}

      {/* Two deliberate columns rather than auto-fit: on a wide screen auto-fit
          produced three, which left the fourth card stranded on its own row. */}
      <div className="settings__grid">
        <Card icon="userCircle" title={t('app.settings.account')}>
          <div className="settings__identity">
            <span className="settings__avatar" aria-hidden="true">
              {(user?.name ?? '')
                .split(' ')
                .filter(Boolean)
                .slice(0, 2)
                .map((p) => p[0].toUpperCase())
                .join('') || 'M'}
            </span>
            <div>
              <strong>{user?.name}</strong>
              {/* The address is one long unbroken token; without this it breaks
                  mid-word and reads as two lines of nonsense. */}
              <span className="settings__addr">{user?.email}</span>
            </div>
          </div>

          <div className="settings__verify">
            {user?.emailVerified ? (
              <Badge tone="good" icon="check">{t('app.settings.verified')}</Badge>
            ) : (
              <>
                <Badge tone="warn" icon="alert">{t('app.settings.unverified')}</Badge>
                <button
                  type="button"
                  className="btn btn--ghost btn--sm"
                  onClick={async () => {
                    const result = await resendVerification()
                    if (result.ok) flash('verification')
                    else setError(apiMessage(result.error))
                  }}
                >
                  <Icon name="mail" size={15} /> {t('app.verify.resend')}
                </button>
              </>
            )}
          </div>

          {user?.createdAt && (
            <p className="settings__since">
              <Icon name="clock" size={13} />
              {t('app.settings.memberSince', {
                date: new Intl.DateTimeFormat(locale, { dateStyle: 'long' }).format(new Date(user.createdAt)),
              })}
            </p>
          )}
        </Card>

        <Card icon="globe" title={t('app.settings.language')} hint={t('app.settings.languageHint')}>
          <div className="settings__langs">
            {locales.map((l) => (
              <button
                key={l.code}
                type="button"
                className={`settings__lang ${l.code === locale ? 'is-on' : ''}`}
                onClick={() => {
                  setLocale(l.code)
                  syncLocale(l.code)
                  flash('language')
                }}
                aria-pressed={l.code === locale}
              >
                <span className="settings__langCode" aria-hidden="true">{l.code.toUpperCase()}</span>
                <span className="settings__langName">{l.native}</span>
                {l.code === locale && <Icon name="check" size={16} />}
              </button>
            ))}
          </div>
        </Card>

        <Card icon="target" title={t('app.settings.goals')} hint={t('app.settings.goalsHint')}>
          <div className="upgoals__row">
            {goalKeys.map((g) => (
              <button
                key={g.key}
                type="button"
                className={`upgoals__chip ${goals.includes(g.key) ? 'is-on' : ''}`}
                aria-pressed={goals.includes(g.key)}
                onClick={() =>
                  setGoals((s) => (s.includes(g.key) ? s.filter((x) => x !== g.key) : [...s, g.key]))
                }
              >
                <Icon name={g.icon} size={16} />
                {t(`goals.items.${g.key}.title`)}
              </button>
            ))}
          </div>
          <div className="settings__foot">
            <p>{t('app.settings.goalsNote')}</p>
            <button
              type="button"
              className="btn btn--primary btn--sm"
              onClick={saveGoals}
              disabled={busy || JSON.stringify(goals) === JSON.stringify(user?.goals ?? [])}
            >
              {busy ? t('auth.processing') : t('app.edit.save')}
            </button>
          </div>
        </Card>

        <Card icon="bell" title={t('app.settings.notifications')}>
          <label className="settings__toggle">
            <input
              type="checkbox"
              checked={user?.notifyByEmail !== false}
              onChange={(e) => toggleNotifications(e.target.checked)}
            />
            <span>
              <strong>{t('app.settings.notifyTitle')}</strong>
              <small>{t('app.settings.notifyText')}</small>
            </span>
          </label>
        </Card>
      </div>

      <ConsentCard onSaved={() => flash('consents')} onError={setError} />

      <PasswordCard onSaved={() => flash('password')} onError={setError} />

      <DangerCard
        onDeleted={async () => {
          await logout()
          navigate('/', { replace: true })
        }}
      />
    </AppShell>
  )
}

/**
 * The optional permissions, and the ability to take them back.
 *
 * Article 7(3): withdrawal must be as easy as consent was. Consent was one tick
 * on a form, so withdrawal is one toggle here — no email to support, no hunting
 * through account deletion, and it takes effect on the next request rather than
 * on a promise to action it.
 *
 * The three required consents are deliberately absent. They are the basis for
 * holding an account at all; the way to withdraw them is to delete the account,
 * which is the card at the bottom of this page.
 */
function ConsentCard({ onSaved, onError }) {
  const { t, locale } = useI18n()
  const { user, updateConsents } = useAuth()
  const apiMessage = useApiMessage()
  const [busy, setBusy] = useState('')

  const consents = user?.consents ?? {}

  const toggle = async (key, value) => {
    setBusy(key)
    const result = await updateConsents({ [key]: value })
    setBusy('')
    if (!result.ok) onError(apiMessage(result.error))
    else onSaved()
  }

  return (
    <Card icon="shield" title={t('app.settings.consents')} hint={t('app.settings.consentsHint')}>
      <div className="consentlist">
        {['employer_sharing', 'job_alerts', 'marketing'].map((key) => (
          <label key={key} className="settings__toggle">
            <input
              type="checkbox"
              checked={Boolean(consents[key])}
              disabled={busy === key}
              onChange={(e) => toggle(key, e.target.checked)}
            />
            <span>
              <strong>{t(`app.settings.consentLabels.${key}.title`)}</strong>
              <small>{t(`app.settings.consentLabels.${key}.text`)}</small>
            </span>
          </label>
        ))}
      </div>

      <p className="settings__since">
        <Icon name="file" size={13} />
        {consents.acceptedAt
          ? t('app.settings.acceptedOn', {
              version: consents.acceptedVersion ?? '—',
              date: new Intl.DateTimeFormat(locale, { dateStyle: 'long' }).format(
                new Date(consents.acceptedAt),
              ),
            })
          : t('app.settings.acceptedUnknown')}
        {' · '}
        <a href="/terms" target="_blank" rel="noreferrer">{t('app.settings.readTerms')}</a>
      </p>
    </Card>
  )
}

function PasswordCard({ onSaved, onError }) {
  const { t } = useI18n()
  const apiMessage = useApiMessage()
  const [values, setValues] = useState({ currentPassword: '', newPassword: '', confirm: '' })
  const [busy, setBusy] = useState(false)
  const [errors, setErrors] = useState({})

  const set = (k, v) => {
    setValues((s) => ({ ...s, [k]: v }))
    setErrors((e) => ({ ...e, [k]: undefined }))
  }

  const submit = async (e) => {
    e.preventDefault()
    const next = {}
    if (!values.currentPassword) next.currentPassword = t('errors.password_required')
    if (values.newPassword.length < 8) next.newPassword = t('errors.password_short')
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
      onSaved()
    } catch (err) {
      if (err.code === 'wrong_password') setErrors({ currentPassword: apiMessage(err.code) })
      else onError(apiMessage(err.code))
    } finally {
      setBusy(false)
    }
  }

  return (
    <Card icon="lock" title={t('app.settings.password')} hint={t('app.settings.passwordHint')}>
      <form className="settings__form" onSubmit={submit}>
        <div className="editform__grid">
          <label className="editfield is-wide">
            <span className="editfield__label">{t('app.settings.currentPassword')}</span>
            <input
              type="password"
              autoComplete="current-password"
              value={values.currentPassword}
              onChange={(e) => set('currentPassword', e.target.value)}
            />
            {errors.currentPassword && <span className="ffield__err">{errors.currentPassword}</span>}
          </label>
          <label className="editfield">
            <span className="editfield__label">{t('app.settings.newPassword')}</span>
            <input
              type="password"
              autoComplete="new-password"
              value={values.newPassword}
              onChange={(e) => set('newPassword', e.target.value)}
            />
            {errors.newPassword && <span className="ffield__err">{errors.newPassword}</span>}
          </label>
          <label className="editfield">
            <span className="editfield__label">{t('auth.confirm')}</span>
            <input
              type="password"
              autoComplete="new-password"
              value={values.confirm}
              onChange={(e) => set('confirm', e.target.value)}
            />
            {errors.confirm && <span className="ffield__err">{errors.confirm}</span>}
          </label>
        </div>
        <div className="editform__actions">
          <button type="submit" className="btn btn--primary btn--sm" disabled={busy}>
            {busy ? t('auth.processing') : t('app.settings.changePassword')}
          </button>
        </div>
      </form>
    </Card>
  )
}

/**
 * Erasure asks for the password, not a yes/no. A confirm dialog is muscle
 * memory; typing a password is a deliberate act.
 */
function DangerCard({ onDeleted }) {
  const { t } = useI18n()
  const apiMessage = useApiMessage()
  const [open, setOpen] = useState(false)
  const [password, setPassword] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  const submit = async (e) => {
    e.preventDefault()
    setBusy(true)
    setError('')
    try {
      await authApi.deleteAccount(password)
      await onDeleted()
    } catch (err) {
      setError(apiMessage(err.code))
      setBusy(false)
    }
  }

  return (
    <Card icon="trash" title={t('app.settings.danger')} className="danger">
      <p className="wcard__hint">{t('app.settings.dangerText')}</p>

      {!open ? (
        <button type="button" className="btn btn--danger btn--sm" onClick={() => setOpen(true)}>
          <Icon name="trash" size={15} /> {t('app.settings.deleteAccount')}
        </button>
      ) : (
        <form onSubmit={submit} className="editform">
          {error && <p className="ffield__err"><Icon name="alert" size={14} />{error}</p>}
          <label className="editfield is-wide">
            <span className="editfield__label">{t('app.settings.confirmPassword')}</span>
            <input
              type="password"
              autoComplete="current-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
          </label>
          <div className="editform__actions">
            <button type="button" className="btn btn--ghost btn--sm" onClick={() => setOpen(false)} disabled={busy}>
              {t('app.edit.cancel')}
            </button>
            <button type="submit" className="btn btn--danger btn--sm" disabled={busy || !password}>
              {busy ? t('auth.processing') : t('app.settings.deleteForever')}
            </button>
          </div>
        </form>
      )}
    </Card>
  )
}
