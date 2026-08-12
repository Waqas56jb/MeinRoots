import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import Icon from './ui/Icon.jsx'
import Reveal from './ui/Reveal.jsx'
import { images } from '../data/content.js'
import { localeCodes } from '../i18n/index.js'
import { useI18n } from '../context/I18nContext.jsx'
import { useAuth } from '../context/AuthContext.jsx'
import { useCvGate } from '../hooks/useCvGate.js'

export default function CallToAction() {
  const { t } = useI18n()
  const [email, setEmail] = useState('')
  const navigate = useNavigate()
  const { isAuthenticated } = useAuth()
  const openCv = useCvGate()

  // The email field is a shortcut into signup — the address is carried across
  // so the candidate does not have to type it twice.
  const onSubmit = (e) => {
    e.preventDefault()
    if (!email) return
    if (isAuthenticated) {
      navigate('/upload')
      return
    }
    navigate(`/signup?email=${encodeURIComponent(email)}&next=${encodeURIComponent('/upload')}`)
  }

  return (
    <section className="cta" id="cta">
      <div className="cta__bg" style={{ backgroundImage: `url(${images.ctaBackdrop})` }} aria-hidden="true" />
      <div className="cta__veil" aria-hidden="true" />
      <div className="cta__aurora" aria-hidden="true"><span /><span /></div>

      <div className="container cta__inner">
        <Reveal className="cta__copy">
          <span className="eyebrow eyebrow--light"><Icon name="sparkle" />{t('cta.eyebrow')}</span>
          <h2>{t('cta.title')}</h2>
          <p>{t('cta.text')}</p>

          <ul className="cta__perks">
            {t('cta.perks').map((p) => (
              <li key={p}><Icon name="checkCircle" size={18} />{p}</li>
            ))}
          </ul>
        </Reveal>

        <Reveal className="cta__card" delay={120}>
          <button type="button" className="drop" onClick={openCv}>
            <span className="drop__icon"><Icon name="upload" size={26} /></span>
            <strong>{t('cta.dropTitle')}</strong>
            <span>{t('cta.dropHint')}</span>
            <span className="drop__langs">
              {localeCodes.map((code) => (
                <em key={code}>{code}</em>
              ))}
            </span>
          </button>

          <form className="cta__form" onSubmit={onSubmit}>
            <label className="sr-only" htmlFor="cta-email">{t('cta.emailPlaceholder')}</label>
            <div className="field">
              <Icon name="mail" size={18} />
              <input
                id="cta-email"
                type="email"
                required
                placeholder={t('cta.emailPlaceholder')}
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                autoComplete="email"
              />
            </div>
            <button type="submit" className="btn btn--primary btn--block">
              {t('cta.submit')} <Icon name="arrowRight" />
            </button>
          </form>

          <p className="cta__legal">
            <Icon name="lock" size={14} />
            {t('cta.legal')}
          </p>
        </Reveal>
      </div>
    </section>
  )
}
