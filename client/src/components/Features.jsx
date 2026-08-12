import Icon from './ui/Icon.jsx'
import SmartImage from './ui/SmartImage.jsx'
import Reveal from './ui/Reveal.jsx'
import { featureKeys, images } from '../data/content.js'
import { useI18n } from '../context/I18nContext.jsx'

export default function Features() {
  const { t } = useI18n()

  return (
    <section className="section" id="platform">
      <div className="container">
        <Reveal className="section-head">
          <span className="eyebrow"><Icon name="layers" />{t('features.eyebrow')}</span>
          <h2>{t('features.title')}</h2>
          <p className="lead">{t('features.lead')}</p>
        </Reveal>

        <div className="bento">
          <Reveal className="bento__hero">
            <article className="feature feature--hero">
              <span className="feature__glow" aria-hidden="true" />
              <span className="pill pill--light"><Icon name="sparkle" size={14} />{t('features.highlight.tag')}</span>
              <h3>{t('features.highlight.title')}</h3>
              <p>{t('features.highlight.text')}</p>
              <div className="feature__metric">
                <strong>82%</strong>
                <span>{t('features.highlight.metric')}</span>
              </div>
              <div className="feature__meter" aria-hidden="true">
                <span style={{ width: '82%' }} />
              </div>
            </article>
          </Reveal>

          {featureKeys.map((f, i) => (
            <Reveal key={f.key} delay={(i % 3) * 80}>
              <article className="feature card card--hover">
                <span className="icon-badge"><Icon name={f.icon} /></span>
                <h3>{t(`features.items.${f.key}.title`)}</h3>
                <p>{t(`features.items.${f.key}.text`)}</p>
              </article>
            </Reveal>
          ))}

          <Reveal className="bento__photo" delay={120}>
            <SmartImage src={images.platform} alt="" ratio="4 / 5" />
            <span className="bento__photoVeil" aria-hidden="true" />
            <span className="bento__photoTag">
              <Icon name="users" size={16} />
              {t('features.photoTag')}
            </span>
          </Reveal>
        </div>
      </div>
    </section>
  )
}
