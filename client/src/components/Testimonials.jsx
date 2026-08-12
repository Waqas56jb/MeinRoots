import Icon from './ui/Icon.jsx'
import SmartImage from './ui/SmartImage.jsx'
import Reveal from './ui/Reveal.jsx'
import { testimonialKeys } from '../data/content.js'
import { useI18n } from '../context/I18nContext.jsx'

export default function Testimonials() {
  const { t } = useI18n()

  return (
    <section className="section section--soft" id="stories">
      <div className="container">
        <Reveal className="section-head">
          <span className="eyebrow"><Icon name="quote" />{t('testimonials.eyebrow')}</span>
          <h2>{t('testimonials.title')}</h2>
          <p className="lead">{t('testimonials.lead')}</p>
        </Reveal>

        <div className="grid grid--3 quotes">
          {testimonialKeys.map((item, i) => (
            <Reveal key={item.key} delay={i * 110}>
              <figure className="quote card card--hover">
                <span className="quote__mark"><Icon name="quote" size={26} /></span>
                <div className="quote__stars" aria-label="5/5">
                  {Array.from({ length: 5 }).map((_, k) => (
                    <Icon key={k} name="star" size={15} fill="currentColor" strokeWidth={1} />
                  ))}
                </div>
                <blockquote>{t(`testimonials.items.${item.key}.quote`)}</blockquote>
                <figcaption>
                  <SmartImage
                    src={item.avatar}
                    alt={t(`testimonials.items.${item.key}.name`)}
                    className="quote__avatar"
                    ratio="1 / 1"
                  />
                  <div>
                    <strong>{t(`testimonials.items.${item.key}.name`)}</strong>
                    <span>{t(`testimonials.items.${item.key}.role`)}</span>
                  </div>
                </figcaption>
              </figure>
            </Reveal>
          ))}
        </div>
      </div>
    </section>
  )
}
