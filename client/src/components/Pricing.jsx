import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import Icon from './ui/Icon.jsx'
import Reveal from './ui/Reveal.jsx'
import { planKeys } from '../data/content.js'
import { useI18n } from '../context/I18nContext.jsx'
import { useAuth } from '../context/AuthContext.jsx'

export default function Pricing() {
  const { t } = useI18n()
  const [yearly, setYearly] = useState(false)
  const navigate = useNavigate()
  const { isAuthenticated } = useAuth()

  const start = () => navigate(isAuthenticated ? '/upload' : '/signup')

  return (
    <section className="section" id="plans">
      <div className="container">
        <Reveal className="section-head">
          <span className="eyebrow"><Icon name="wallet" />{t('pricing.eyebrow')}</span>
          <h2>{t('pricing.title')}</h2>
          <p className="lead">{t('pricing.lead')}</p>
        </Reveal>

        <Reveal className="billing" delay={60}>
          <div className="billing__switch" role="group" aria-label={t('pricing.eyebrow')}>
            <button
              type="button"
              className={!yearly ? 'is-active' : ''}
              onClick={() => setYearly(false)}
              aria-pressed={!yearly}
            >
              {t('pricing.monthly')}
            </button>
            <button
              type="button"
              className={yearly ? 'is-active' : ''}
              onClick={() => setYearly(true)}
              aria-pressed={yearly}
            >
              {t('pricing.yearly')}
            </button>
          </div>
          <span className="billing__save">{t('pricing.save')}</span>
        </Reveal>

        <div className="grid grid--3 plans">
          {planKeys.map((p, i) => (
            <Reveal key={p.key} delay={i * 100}>
              <article className={`plan card ${p.featured ? 'plan--featured' : 'card--hover'}`}>
                {p.featured && <span className="plan__badge">{t('pricing.popular')}</span>}
                <h3>{t(`pricing.plans.${p.key}.name`)}</h3>
                <p className="plan__tagline">{t(`pricing.plans.${p.key}.tagline`)}</p>
                <div className="plan__price">
                  <strong>
                    {yearly
                      ? t(`pricing.plans.${p.key}.priceYearly`)
                      : t(`pricing.plans.${p.key}.price`)}
                  </strong>
                  <span>
                    {yearly
                      ? t(`pricing.plans.${p.key}.periodYearly`)
                      : t(`pricing.plans.${p.key}.period`)}
                  </span>
                </div>

                {/* the yearly price is per month — spell out what is charged */}
                {yearly && t(`pricing.plans.${p.key}.billedNote`) && (
                  <p className="plan__billed">
                    <Icon name="info" size={14} />
                    {t(`pricing.plans.${p.key}.billedNote`)}
                  </p>
                )}
                <ul className="plan__features">
                  {t(`pricing.plans.${p.key}.features`).map((f) => (
                    <li key={f}><Icon name="check" size={16} />{f}</li>
                  ))}
                </ul>
                <button
                  type="button"
                  onClick={start}
                  className={`btn btn--block ${p.featured ? 'btn--white' : 'btn--ghost'}`}
                >
                  {t(`pricing.plans.${p.key}.cta`)}
                </button>
              </article>
            </Reveal>
          ))}
        </div>

        <Reveal className="plans__note" delay={120}>
          <Icon name="shield" size={17} />
          <p>{t('pricing.note')}</p>
        </Reveal>
      </div>
    </section>
  )
}
