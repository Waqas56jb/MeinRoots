import { useState } from 'react'
import { Link } from 'react-router-dom'
import Navbar from '../components/Navbar.jsx'
import Footer from '../components/Footer.jsx'
import ScrollTop from '../components/ScrollTop.jsx'
import Icon from '../components/ui/Icon.jsx'
import { contact, goalKeys } from '../data/content.js'
import { useI18n } from '../context/I18nContext.jsx'
import { contactApi } from '../lib/api.js'
import { useApiMessage } from '../lib/apiMessage.js'

/**
 * Write to MeinRoots.
 *
 * Asks the same three things the sign-up asks — which side you are on, what
 * you are trying to do, which plan you had in mind — so an enquiry arrives as
 * something answerable rather than a name and a paragraph. All of them except
 * the message are optional or a single tap, because a contact form that takes
 * two minutes to fill in is a contact form nobody fills in.
 *
 * The address and phone stay on the page beside it. Some people would simply
 * rather send an email, and hiding that behind a form to capture a lead is the
 * kind of thing that makes people not write at all.
 */

const ROLES = ['candidate', 'recruiter']

/**
 * The plan keys the platform actually sells, taken from the `plans` table
 * rather than the unused free/pro/premium placeholders in content.js. An
 * enquiry naming a plan that does not exist helps nobody.
 */
const PLANS = ['trial', 'professional', 'premium']

export default function ContactPage() {
  const { t, locale } = useI18n()
  const apiMessage = useApiMessage()
  const [values, setValues] = useState({
    name: '', email: '', role: 'candidate', goals: [], plan: '', message: '', consent: false,
  })
  const [errors, setErrors] = useState({})
  const [busy, setBusy] = useState(false)
  const [sent, setSent] = useState(false)

  const set = (key, value) => {
    setValues((s) => ({ ...s, [key]: value }))
    setErrors((e) => ({ ...e, [key]: undefined, form: undefined }))
  }

  const toggleGoal = (key) =>
    set('goals', values.goals.includes(key)
      ? values.goals.filter((g) => g !== key)
      : [...values.goals, key])

  const submit = async (e) => {
    e.preventDefault()
    const next = {}
    if (!values.name.trim()) next.name = t('contact.errors.name')
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(values.email.trim())) next.email = t('contact.errors.email')
    if (values.message.trim().length < 10) next.message = t('contact.errors.message')
    if (!values.consent) next.consent = t('contact.errors.consent')
    setErrors(next)
    if (Object.keys(next).length) return

    setBusy(true)
    try {
      await contactApi.send({
        name: values.name.trim(),
        email: values.email.trim(),
        role: values.role,
        goals: values.goals,
        // An empty select is "no answer", not a plan called "".
        ...(values.plan ? { plan: values.plan } : {}),
        message: values.message.trim(),
        consent: true,
        locale,
      })
      setSent(true)
    } catch (err) {
      setErrors({ form: apiMessage(err.code) })
      setBusy(false)
    }
  }

  return (
    <div className="legal">
      <a className="skip-link" href="#main">{t('common.skip')}</a>
      <Navbar />

      <main id="main" className="legal__main">
        <div className="container">
          <header className="legal__head">
            <span className="legal__eyebrow">{t('contact.eyebrow')}</span>
            <h1>{t('contact.title')}</h1>
            <p className="legal__lead">{t('contact.lead')}</p>
          </header>

          <div className="contactgrid">
            <section className="contactcard">
              {sent ? (
                /* The form is replaced rather than disabled: leaving a filled
                   form on screen invites a second send of the same message. */
                <div className="contactdone">
                  <span className="contactdone__icon"><Icon name="check" size={26} /></span>
                  <h2>{t('contact.sent.title')}</h2>
                  <p>{t('contact.sent.text')}</p>
                  <Link to="/" className="btn btn--ghost">{t('contact.sent.back')}</Link>
                </div>
              ) : (
                <form onSubmit={submit} noValidate>
                  <div className="contactrow">
                    <label className="field">
                      <span className="field__label">{t('contact.fields.name')} *</span>
                      <span className="field__box">
                        <input
                          type="text" value={values.name} autoComplete="name"
                          onChange={(e) => set('name', e.target.value)}
                        />
                      </span>
                      {errors.name && <span className="field__err">{errors.name}</span>}
                    </label>

                    <label className="field">
                      <span className="field__label">{t('contact.fields.email')} *</span>
                      <span className="field__box">
                        <input
                          type="email" value={values.email} autoComplete="email"
                          autoCapitalize="none" autoCorrect="off" spellCheck="false"
                          onChange={(e) => set('email', e.target.value)}
                        />
                      </span>
                      {errors.email && <span className="field__err">{errors.email}</span>}
                    </label>
                  </div>

                  {/* Which side of the marketplace. It decides who answers, so
                      it is two buttons rather than a dropdown nobody opens. */}
                  <fieldset className="pickset">
                    <legend>{t('contact.fields.role')}</legend>
                    <div className="pickrow">
                      {ROLES.map((role) => (
                        <button
                          key={role}
                          type="button"
                          className={`pick ${values.role === role ? 'is-on' : ''}`}
                          aria-pressed={values.role === role}
                          onClick={() => set('role', role)}
                        >
                          <Icon name={role === 'recruiter' ? 'company' : 'user'} size={17} />
                          <span>{t(`contact.roles.${role}`)}</span>
                        </button>
                      ))}
                    </div>
                  </fieldset>

                  <fieldset className="pickset">
                    <legend>{t('contact.fields.goals')}</legend>
                    <div className="pickrow pickrow--wrap">
                      {goalKeys.map((g) => (
                        <button
                          key={g.key}
                          type="button"
                          className={`pick ${values.goals.includes(g.key) ? 'is-on' : ''}`}
                          aria-pressed={values.goals.includes(g.key)}
                          onClick={() => toggleGoal(g.key)}
                        >
                          <Icon name={g.icon} size={16} />
                          <span>{t(`goals.items.${g.key}.title`)}</span>
                        </button>
                      ))}
                    </div>
                  </fieldset>

                  <label className="field">
                    <span className="field__label">{t('contact.fields.plan')}</span>
                    <span className="field__box">
                      <select value={values.plan} onChange={(e) => set('plan', e.target.value)}>
                        <option value="">{t('contact.planNone')}</option>
                        {PLANS.map((key) => (
                          <option key={key} value={key}>{t(`contact.plans.${key}`)}</option>
                        ))}
                      </select>
                    </span>
                  </label>

                  <label className="field">
                    <span className="field__label">{t('contact.fields.message')} *</span>
                    <span className="field__box field__box--area">
                      <textarea
                        rows={6} value={values.message} maxLength={4000}
                        placeholder={t('contact.placeholder')}
                        onChange={(e) => set('message', e.target.value)}
                      />
                    </span>
                    {errors.message && <span className="field__err">{errors.message}</span>}
                  </label>

                  <label className="checkline">
                    <input
                      type="checkbox" checked={values.consent}
                      onChange={(e) => set('consent', e.target.checked)}
                    />
                    <span>
                      {t('contact.consent')}{' '}
                      <Link to="/privacy">{t('footer.legal.privacy')}</Link>
                    </span>
                  </label>
                  {errors.consent && <span className="field__err">{errors.consent}</span>}

                  {errors.form && (
                    <p className="formerr"><Icon name="warning" size={16} /> {errors.form}</p>
                  )}

                  <button type="submit" className="btn btn--primary btn--lg" disabled={busy}>
                    {busy ? t('common.loading') : t('contact.submit')}
                  </button>
                </form>
              )}
            </section>

            <aside className="contactaside">
              <h2>{t('contact.direct.title')}</h2>
              <p>{t('contact.direct.text')}</p>
              <ul className="contactaside__list">
                <li>
                  <span className="contactaside__icon"><Icon name="mail" size={16} /></span>
                  <a href={`mailto:${contact.email}`}>{contact.email}</a>
                </li>
                <li>
                  <span className="contactaside__icon"><Icon name="phone" size={16} /></span>
                  <a href={`tel:${contact.phone.replace(/\s/g, '')}`}>{contact.phone}</a>
                </li>
              </ul>
              <p className="contactaside__note">
                <Icon name="shield" size={15} />
                <span>{t('contact.direct.note')}</span>
              </p>
            </aside>
          </div>
        </div>
      </main>

      <Footer />
      <ScrollTop />
    </div>
  )
}
