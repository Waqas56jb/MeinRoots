import { useState } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import AuthShell from '../components/auth/AuthShell.jsx'
import Field from '../components/auth/Field.jsx'
import PasswordMeter from '../components/auth/PasswordMeter.jsx'
import Icon from '../components/ui/Icon.jsx'
import { goalKeys } from '../data/content.js'
import { consentBoxes } from '../data/terms.js'
import { useI18n } from '../context/I18nContext.jsx'
import { useAuth } from '../context/AuthContext.jsx'
import { useApiMessage, useFieldErrors } from '../lib/apiMessage.js'

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/

/**
 * Every consent starts false.
 *
 * Including the optional ones, and especially the optional ones: a pre-ticked
 * box is not consent. The candidate has to have done something, and defaulting
 * marketing to on would make the record we keep of it worthless.
 */
const NO_CONSENTS = Object.fromEntries(consentBoxes.map((b) => [b.key, false]))

export default function SignupPage() {
  const { t, locale } = useI18n()
  const { signup, busy } = useAuth()
  const navigate = useNavigate()
  const [params] = useSearchParams()
  const apiMessage = useApiMessage()
  const fieldErrors = useFieldErrors()

  const next = params.get('next') || '/cv'

  const [name, setName] = useState('')
  const [email, setEmail] = useState(params.get('email') || '')
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [goals, setGoals] = useState(['germany'])
  const [consents, setConsents] = useState(NO_CONSENTS)
  const [errors, setErrors] = useState({})

  const toggleGoal = (key) =>
    setGoals((current) =>
      current.includes(key) ? current.filter((g) => g !== key) : [...current, key],
    )

  const setConsent = (key, value) => {
    setConsents((c) => ({ ...c, [key]: value }))
    setErrors((s) => ({ ...s, consents: undefined }))
  }

  const missingRequired = consentBoxes.filter((b) => b.required && !consents[b.key])

  const validate = () => {
    const e = {}
    if (!name.trim()) e.name = t('auth.errors.nameRequired')
    if (!email.trim()) e.email = t('auth.errors.emailRequired')
    else if (!EMAIL_RE.test(email.trim())) e.email = t('auth.errors.emailInvalid')
    if (!password) e.password = t('auth.errors.passwordRequired')
    else if (password.length < 8) e.password = t('auth.errors.passwordShort')
    if (confirm !== password) e.confirm = t('auth.errors.mismatch')
    if (!goals.length) e.goals = t('auth.errors.goalRequired')
    if (missingRequired.length) e.consents = t('auth.errors.consentsRequired')
    setErrors(e)
    return Object.keys(e).length === 0
  }

  const onSubmit = async (event) => {
    event.preventDefault()
    if (!validate()) return
    const result = await signup({ name, email, password, goals, locale, consents })
    if (!result.ok) {
      // A 400 carries per-field codes; anything else is a single form-level message.
      setErrors({ ...fieldErrors(result.details), form: apiMessage(result.error) })
      return
    }
    navigate(next, { replace: true })
  }

  return (
    <AuthShell asidePath="auth.signup.aside">
      <h1>{t('auth.signup.title')}</h1>
      <p className="auth__sub">{t('auth.signup.subtitle')}</p>

      <form onSubmit={onSubmit} noValidate>
        {errors.form && (
          <p className="auth__alert"><Icon name="alert" size={16} />{errors.form}</p>
        )}

        <Field
          label={t('auth.fullName')}
          icon="user"
          name="name"
          value={name}
          onChange={(v) => { setName(v); setErrors((s) => ({ ...s, name: undefined })) }}
          placeholder={t('auth.namePlaceholder')}
          autoComplete="name"
          error={errors.name}
        />

        <Field
          label={t('auth.email')}
          icon="mail"
          type="email"
          name="email"
          value={email}
          onChange={(v) => { setEmail(v); setErrors((s) => ({ ...s, email: undefined, form: undefined })) }}
          placeholder={t('auth.emailPlaceholder')}
          autoComplete="email"
          error={errors.email}
        />

        <div className="auth__grid2">
          <div>
            <Field
              label={t('auth.password')}
              icon="lock"
              type="password"
              name="password"
              value={password}
              onChange={(v) => { setPassword(v); setErrors((s) => ({ ...s, password: undefined })) }}
              placeholder={t('auth.passwordPlaceholder')}
              autoComplete="new-password"
              error={errors.password}
            />
            <PasswordMeter value={password} />
          </div>

          <Field
            label={t('auth.confirm')}
            icon="lock"
            type="password"
            name="confirm"
            value={confirm}
            onChange={(v) => { setConfirm(v); setErrors((s) => ({ ...s, confirm: undefined })) }}
            placeholder={t('auth.passwordPlaceholder')}
            autoComplete="new-password"
            error={errors.confirm}
          />
        </div>

        <fieldset className="goalpick">
          <legend>
            {t('auth.signup.goalLabel')}
            <small>{t('auth.signup.goalHint')}</small>
          </legend>
          <div className="goalpick__row">
            {goalKeys.map((g) => (
              <button
                key={g.key}
                type="button"
                className={`goalpick__chip ${goals.includes(g.key) ? 'is-on' : ''}`}
                onClick={() => { toggleGoal(g.key); setErrors((s) => ({ ...s, goals: undefined })) }}
                aria-pressed={goals.includes(g.key)}
              >
                <Icon name={g.icon} size={17} />
                {t(`goals.items.${g.key}.title`)}
                <span className="goalpick__tick"><Icon name="check" size={12} /></span>
              </button>
            ))}
          </div>
          {errors.goals && <p className="ffield__err"><Icon name="alert" size={14} />{errors.goals}</p>}
        </fieldset>

        {/*
          Required and optional are separated visually, not just labelled.
          Bundling them into one block is what makes an optional consent look
          like a condition of signing up — and a consent that felt compulsory
          is not freely given, which is the whole test.
        */}
        <fieldset className={`consents ${errors.consents ? 'has-error' : ''}`}>
          <legend>{t('auth.signup.consentLegend')}</legend>

          {consentBoxes.filter((b) => b.required).map((box) => (
            <ConsentBox
              key={box.key}
              box={box}
              checked={consents[box.key]}
              onChange={(v) => setConsent(box.key, v)}
            />
          ))}

          {errors.consents && (
            <p className="ffield__err"><Icon name="alert" size={14} />{errors.consents}</p>
          )}

          <div className="consents__optional">
            <p className="consents__optionalHead">
              {t('auth.signup.optionalLegend')}
              <small>{t('auth.signup.optionalHint')}</small>
            </p>
            {consentBoxes.filter((b) => !b.required).map((box) => (
              <ConsentBox
                key={box.key}
                box={box}
                checked={consents[box.key]}
                onChange={(v) => setConsent(box.key, v)}
              />
            ))}
          </div>
        </fieldset>

        <button type="submit" className="btn btn--primary btn--block btn--lg" disabled={busy}>
          {busy ? t('auth.processing') : t('auth.signup.submit')}
          {!busy && <Icon name="arrowRight" />}
        </button>
      </form>

      <p className="auth__switch">
        {t('auth.signup.haveAccount')} <Link to="/login">{t('auth.signup.loginLink')}</Link>
      </p>
    </AuthShell>
  )
}

/**
 * One consent.
 *
 * The label is the whole row, so the tap target is the sentence rather than the
 * 20px box — which matters on a phone, and matters more when the thing being
 * tapped is a legal agreement. Where a consent refers to a document, the link
 * opens in a new tab: sending someone away mid-form to read the terms, and
 * losing everything they had typed, is how a form teaches people to tick
 * without reading.
 */
function ConsentBox({ box, checked, onChange }) {
  const { t } = useI18n()

  return (
    <label className={`consent ${box.required ? 'consent--required' : ''}`}>
      <input
        type="checkbox"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
        aria-describedby={box.link ? `consent-link-${box.key}` : undefined}
      />
      <span className="checkbox__box"><Icon name="check" size={13} /></span>
      <span className="consent__text">
        {t(`auth.consents.${box.key}`)}
        {box.link && (
          <>
            {' '}
            <a
              id={`consent-link-${box.key}`}
              href={box.link}
              target="_blank"
              rel="noreferrer"
              onClick={(e) => e.stopPropagation()}
            >
              {t('auth.consents.read')}
              <Icon name="arrowUpRight" size={12} />
            </a>
          </>
        )}
      </span>
    </label>
  )
}
