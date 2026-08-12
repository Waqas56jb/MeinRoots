import Icon from './ui/Icon.jsx'
import SmartImage from './ui/SmartImage.jsx'
import Reveal from './ui/Reveal.jsx'
import { cvVersions, images } from '../data/content.js'
import { useI18n } from '../context/I18nContext.jsx'
import { useCvGate } from '../hooks/useCvGate.js'

export default function Languages() {
  const { t } = useI18n()
  const openCv = useCvGate()

  return (
    <section className="section section--tint" id="languages">
      <div className="container split split--reverse">
        <Reveal className="split__media">
          <div className="split__photo">
            <SmartImage src={images.languages} alt="" ratio="5 / 4" />
          </div>
          <div className="lang-stack">
            {cvVersions.map((l, i) => (
              <div key={l.code} className="lang-card" style={{ transitionDelay: `${i * 90}ms` }}>
                <span className="lang-card__code">{l.code}</span>
                <div>
                  <strong>{l.native}</strong>
                  <span>{l.source ? t('languages.original') : t('languages.generated')}</span>
                </div>
                <span className={`pill ${l.source ? 'pill--green' : 'pill--blue'}`}>
                  {l.source ? t('languages.source') : t('languages.ai')}
                </span>
              </div>
            ))}
          </div>
        </Reveal>

        <div className="split__copy">
          <Reveal className="eyebrow" as="span"><Icon name="translate" />{t('languages.eyebrow')}</Reveal>
          <Reveal as="h2" delay={60}>{t('languages.title')}</Reveal>
          <Reveal as="p" className="lead" delay={110}>{t('languages.lead')}</Reveal>

          <Reveal className="checklist" delay={160} as="ul">
            {t('languages.checklist').map((item) => (
              <li key={item}><span><Icon name="check" size={15} /></span>{item}</li>
            ))}
          </Reveal>

          <Reveal delay={220}>
            <button type="button" className="btn btn--primary" onClick={openCv}>
              <Icon name="upload" /> {t('languages.cta')}
            </button>
          </Reveal>
        </div>
      </div>
    </section>
  )
}
