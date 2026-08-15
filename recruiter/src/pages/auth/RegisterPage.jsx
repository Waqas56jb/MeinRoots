import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import AuthShell, { Field } from '../../components/AuthShell.jsx'
import Icon from '../../components/Icon.jsx'
import { isNotImplemented } from '../../lib/api.js'
import { recruiterApi } from '../../services/index.js'
import { useI18n } from '../../context/I18nContext.jsx'

/**
 * Recruiter registration.
 *
 * Three steps rather than one long column: this asks for a person, a company
 * and six separate agreements, and presenting all of that at once on a phone is
 * how a form gets abandoned. Each step is a complete thought, and nothing is
 * validated until it has been left.
 *
 * The six consents are six checkboxes, never one. Four of them are distinct
 * legal statements — an agreement, an acknowledgement, a representation about
 * who you are, and an undertaking about what you will do with what you see —
 * and a single tick covering all of them would record consent to none of them
 * in any way worth having.
 */

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/

/** All six are required. None is a preference. */
const CONSENTS = [
  { key: 'terms', link: '/legal/recruiter-terms' },
  { key: 'privacy', link: '/legal/privacy' },
  { key: 'legitimate_company' },
  { key: 'legitimate_use' },
  { key: 'access_understood' },
  { key: 'no_guarantee' },
]

const STEPS = ['account', 'company', 'terms']

export default function RegisterPage() {
  const { t, tError, locale } = useI18n()
  const navigate = useNavigate()

  const [step, setStep] = useState(0)
  const [busy, setBusy] = useState(false)
  const [formError, setFormError] = useState('')
  const [notBuilt, setNotBuilt] = useState(false)
  const [errors, setErrors] = useState({})

  const [account, setAccount] = useState({ name: '', email: '', password: '', confirm: '', phone: '' })
  const [company, setCompany] = useState({
    legalName: '', tradingName: '', country: '', city: '', website: '', registrationNumber: '',
  })
  // Never pre-ticked. A box the user did not touch is not agreement.
  const [consents, setConsents] = useState(Object.fromEntries(CONSENTS.map((c) => [c.key, false])))

  const setField = (setter) => (key, value) => {
    setter((s) => ({ ...s, [key]: value }))
    setErrors((e) => ({ ...e, [key]: undefined }))
  }
  const setAccountField = setField(setAccount)
  const setCompanyField = setField(setCompany)

  const validateStep = (index) => {
    const e = {}
    if (index === 0) {
      if (!account.name.trim()) e.name = t('auth.errors.nameRequired')
      if (!account.email.trim()) e.email = t('auth.errors.emailRequired')
      else if (!EMAIL_RE.test(account.email.trim())) e.email = t('auth.errors.emailInvalid')
      if (!account.password) e.password = t('auth.errors.passwordRequired')
      else if (account.password.length < 8) e.password = t('auth.errors.passwordShort')
      if (account.confirm !== account.password) e.confirm = t('auth.errors.mismatch')
    }
    if (index === 1) {
      if (!company.legalName.trim()) e.legalName = t('auth.errors.companyRequired')
      if (!company.country.trim()) e.country = t('auth.errors.countryRequired')
    }
    if (index === 2 && CONSENTS.some((c) => !consents[c.key])) {
      e.consents = t('auth.errors.consentsRequired')
    }
    setErrors(e)
    return Object.keys(e).length === 0
  }

  const next = () => {
    if (validateStep(step)) setStep((s) => Math.min(STEPS.length - 1, s + 1))
  }

  const submit = async (e) => {
    e.preventDefault()
    if (!validateStep(2)) return
    setBusy(true)
    setFormError('')
    try {
      await recruiterApi.register({
        recruiter: {
          name: account.name.trim(),
          email: account.email.trim(),
          password: account.password,
          phone: account.phone.trim() || undefined,
        },
        company: Object.fromEntries(
          Object.entries(company).map(([k, v]) => [k, v.trim() || undefined]),
        ),
        consents,
        locale,
      })
      navigate('/dashboard', { replace: true })
    } catch (err) {
      // The endpoint does not exist until the backend milestone lands. Say that,
      // rather than reporting a fault nobody can go and fix.
      if (isNotImplemented(err)) setNotBuilt(true)
      else setFormError(tError(err.code))
    } finally {
      setBusy(false)
    }
  }

  return (
    <AuthShell wide>
      <h1>{t('auth.register.title')}</h1>
      <p className="auth__sub">{t('auth.register.subtitle')}</p>

      <ol className="steps" aria-label={t('auth.register.progress')}>
        {STEPS.map((key, i) => (
          <li
            key={key}
            className={i === step ? 'is-on' : i < step ? 'is-done' : ''}
            aria-current={i === step ? 'step' : undefined}
          >
            <span className="steps__mark num">{i < step ? <Icon name="check" size={12} /> : i + 1}</span>
            <span className="steps__label">{t(`auth.register.steps.${key}`)}</span>
          </li>
        ))}
      </ol>

      <form onSubmit={submit} noValidate>
        {formError && <p className="auth__alert" role="alert"><Icon name="alert" size={16} />{formError}</p>}

        {notBuilt && (
          <div className="auth__pending" role="status">
            <Icon name="clock" size={17} />
            <div>
              <strong>{t('auth.register.pendingTitle')}</strong>
              <p>{t('auth.register.pendingText')}</p>
              <code>POST /api/recruiter/register</code>
            </div>
          </div>
        )}

        {/* ----------------------------- account ---------------------------- */}
        {step === 0 && (
          <>
            <Field
              label={t('auth.fullName')} name="name" value={account.name}
              onChange={(v) => setAccountField('name', v)} error={errors.name}
              autoComplete="name" required
            />
            <Field
              label={t('auth.workEmail')} name="email" type="email" value={account.email}
              onChange={(v) => setAccountField('email', v)} error={errors.email}
              autoComplete="username" hint={t('auth.register.emailHint')} required
            />
            <div className="grid2">
              <Field
                label={t('auth.password')} name="password" type="password" value={account.password}
                onChange={(v) => setAccountField('password', v)} error={errors.password}
                autoComplete="new-password" required
              />
              <Field
                label={t('auth.confirm')} name="confirm" type="password" value={account.confirm}
                onChange={(v) => setAccountField('confirm', v)} error={errors.confirm}
                autoComplete="new-password" required
              />
            </div>
            <Field
              label={t('auth.phone')} name="phone" type="tel" value={account.phone}
              onChange={(v) => setAccountField('phone', v)} autoComplete="tel"
              hint={t('common.optional')}
            />
          </>
        )}

        {/* ----------------------------- company ---------------------------- */}
        {step === 1 && (
          <>
            <Field
              label={t('auth.register.legalName')} name="legalName" value={company.legalName}
              onChange={(v) => setCompanyField('legalName', v)} error={errors.legalName}
              autoComplete="organization" required
            />
            <Field
              label={t('auth.register.tradingName')} name="tradingName" value={company.tradingName}
              onChange={(v) => setCompanyField('tradingName', v)} hint={t('common.optional')}
            />
            <div className="grid2">
              <Field
                label={t('auth.register.country')} name="country" value={company.country}
                onChange={(v) => setCompanyField('country', v)} error={errors.country}
                autoComplete="country-name" required
              />
              <Field
                label={t('auth.register.city')} name="city" value={company.city}
                onChange={(v) => setCompanyField('city', v)} hint={t('common.optional')}
              />
            </div>
            <Field
              label={t('auth.register.website')} name="website" type="url" value={company.website}
              onChange={(v) => setCompanyField('website', v)} placeholder="https://"
              hint={t('auth.register.websiteHint')}
            />
            <Field
              label={t('auth.register.registrationNumber')} name="registrationNumber"
              value={company.registrationNumber}
              onChange={(v) => setCompanyField('registrationNumber', v)}
              hint={t('auth.register.registrationHint')}
            />
          </>
        )}

        {/* ------------------------------ terms ----------------------------- */}
        {step === 2 && (
          <fieldset className={`consents ${errors.consents ? 'has-error' : ''}`}>
            <legend>{t('auth.register.consentLegend')}</legend>
            <p className="consents__intro">{t('auth.register.consentIntro')}</p>

            {CONSENTS.map((c) => (
              <label key={c.key} className="consent">
                <input
                  type="checkbox"
                  checked={consents[c.key]}
                  onChange={(e) => {
                    setConsents((s) => ({ ...s, [c.key]: e.target.checked }))
                    setErrors((s) => ({ ...s, consents: undefined }))
                  }}
                />
                <span className="consent__box"><Icon name="check" size={13} /></span>
                <span className="consent__text">
                  {t(`auth.consents.${c.key}`)}
                  {c.link && (
                    <>
                      {' '}
                      <a href={c.link} target="_blank" rel="noreferrer" onClick={(e) => e.stopPropagation()}>
                        {t('auth.consents.read')}<Icon name="arrowUpRight" size={12} />
                      </a>
                    </>
                  )}
                </span>
              </label>
            ))}

            {errors.consents && (
              <p className="field__err" role="alert"><Icon name="alert" size={13} />{errors.consents}</p>
            )}
          </fieldset>
        )}

        <div className="auth__nav">
          {step > 0 && (
            <button type="button" className="btn btn--ghost" onClick={() => setStep((s) => s - 1)} disabled={busy}>
              <Icon name="arrowLeft" size={16} /> {t('common.back')}
            </button>
          )}
          {step < STEPS.length - 1 ? (
            <button type="button" className="btn btn--primary" onClick={next}>
              {t('common.continue')} <Icon name="arrowRight" size={16} />
            </button>
          ) : (
            <button type="submit" className="btn btn--primary btn--lg" disabled={busy}>
              {busy ? t('common.loading') : t('auth.register.submit')}
              {!busy && <Icon name="arrowRight" size={17} />}
            </button>
          )}
        </div>
      </form>

      <p className="auth__switch">
        {t('auth.register.haveAccount')} <Link to="/login">{t('auth.register.loginLink')}</Link>
      </p>
    </AuthShell>
  )
}
