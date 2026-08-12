import Icon from './ui/Icon.jsx'
import SmartImage from './ui/SmartImage.jsx'
import Reveal from './ui/Reveal.jsx'
import { domainKeys } from '../data/content.js'
import { useI18n } from '../context/I18nContext.jsx'

export default function Domains() {
  const { t } = useI18n()

  return (
    <section className="section section--tint" id="domains">
      <div className="container">
        <Reveal className="section-head">
          <span className="eyebrow"><Icon name="compass" />{t('domains.eyebrow')}</span>
          <h2>{t('domains.title')}</h2>
          <p className="lead">{t('domains.lead')}</p>
        </Reveal>

        <div className="grid grid--4 domains">
          {domainKeys.map((d, i) => (
            <Reveal key={d.key} delay={(i % 4) * 80}>
              <article className="domain">
                <SmartImage src={d.image} alt="" ratio="4 / 3" className="domain__img" />
                <span className="domain__veil" aria-hidden="true" />
                <span className="domain__icon"><Icon name={d.icon} size={20} /></span>
                <div className="domain__body">
                  <h4>{t(`domains.items.${d.key}.name`)}</h4>
                  <p>{t(`domains.items.${d.key}.spec`)}</p>
                  <span className="domain__meta">
                    {d.count} {t('domains.specialisations')}
                  </span>
                </div>
              </article>
            </Reveal>
          ))}
        </div>

        <Reveal className="domains__foot" delay={140}>
          <Icon name="gear" size={18} />
          <p>{t('domains.foot')}</p>
        </Reveal>
      </div>
    </section>
  )
}
