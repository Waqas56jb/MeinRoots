import Icon from './ui/Icon.jsx'
import SmartImage from './ui/SmartImage.jsx'
import Reveal from './ui/Reveal.jsx'
import { stepKeys, images } from '../data/content.js'
import { useI18n } from '../context/I18nContext.jsx'

export default function HowItWorks() {
  const { t } = useI18n()

  return (
    <section className="section section--soft" id="how-it-works">
      <div className="container">
        <Reveal className="section-head">
          <span className="eyebrow"><Icon name="bolt" />{t('how.eyebrow')}</span>
          <h2>{t('how.title')}</h2>
          <p className="lead">{t('how.lead')}</p>
        </Reveal>

        <div className="steps">
          <span className="steps__rail" aria-hidden="true" />
          {stepKeys.map((s, i) => (
            <Reveal key={s.key} delay={i * 100} className="step">
              <span className="step__num">{String(i + 1).padStart(2, '0')}</span>
              <span className="icon-badge"><Icon name={s.icon} /></span>
              <h3>{t(`how.steps.${s.key}.title`)}</h3>
              <p>{t(`how.steps.${s.key}.text`)}</p>
            </Reveal>
          ))}
        </div>

        <Reveal className="journey-banner" delay={120}>
          <div className="journey-banner__media">
            <SmartImage src={images.journey} alt="" ratio="16 / 10" />
          </div>
          <div className="journey-banner__copy">
            <span className="pill pill--blue"><Icon name="sparkle" size={14} />{t('how.banner.tag')}</span>
            <h3>{t('how.banner.title')}</h3>
            <p>{t('how.banner.text')}</p>
            <ul className="journey-banner__list">
              {t('how.banner.list').map((item) => (
                <li key={item}><Icon name="checkCircle" size={18} />{item}</li>
              ))}
            </ul>
          </div>
        </Reveal>
      </div>
    </section>
  )
}
