import Icon from './ui/Icon.jsx'
import SmartImage from './ui/SmartImage.jsx'
import Reveal from './ui/Reveal.jsx'
import { goalKeys } from '../data/content.js'
import { useI18n } from '../context/I18nContext.jsx'
import { useCvGate } from '../hooks/useCvGate.js'

export default function Goals() {
  const { t } = useI18n()
  const openCv = useCvGate()

  return (
    <section className="section" id="goals">
      <div className="container">
        <Reveal className="section-head">
          <span className="eyebrow"><Icon name="compass" />{t('goals.eyebrow')}</span>
          <h2>{t('goals.title')}</h2>
          <p className="lead">{t('goals.lead')}</p>
        </Reveal>

        <div className="grid grid--4 goals">
          {goalKeys.map((g, i) => (
            <Reveal key={g.key} delay={i * 90}>
              <article className={`goal card card--hover ${g.featured ? 'goal--featured' : ''}`}>
                <div className="goal__media">
                  <SmartImage src={g.image} alt="" ratio="16 / 10" />
                  <span className="goal__mediaVeil" aria-hidden="true" />
                  <span className={`icon-badge ${g.featured ? 'icon-badge--solid' : ''} goal__icon`}>
                    <Icon name={g.icon} />
                  </span>
                  {g.featured && <span className="goal__flag">{t('goals.mostChosen')}</span>}
                </div>

                <div className="goal__body">
                  <h3>{t(`goals.items.${g.key}.title`)}</h3>
                  <p>{t(`goals.items.${g.key}.text`)}</p>
                  <ul className="goal__points">
                    {t(`goals.items.${g.key}.points`).map((p) => (
                      <li key={p}><Icon name="check" size={16} />{p}</li>
                    ))}
                  </ul>
                  <button type="button" className="link-arrow" onClick={openCv}>
                    {t('goals.choose')} <Icon name="arrowRight" />
                  </button>
                </div>
              </article>
            </Reveal>
          ))}
        </div>
      </div>
    </section>
  )
}
