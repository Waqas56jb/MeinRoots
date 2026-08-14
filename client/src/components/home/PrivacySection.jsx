import Icon from '../ui/Icon.jsx'
import Reveal from '../ui/Reveal.jsx'
import { useI18n } from '../../context/I18nContext.jsx'

/**
 * What happens to the CV.
 *
 * Every line here describes something the system genuinely does: consent is
 * required before processing, the file is stored unmodified, actions are
 * logged, and erasure is available from the account. No certification is
 * claimed, because none has been obtained.
 */
const POINTS = [
  { key: 'consent', icon: 'checkCircle' },
  { key: 'untouched', icon: 'lock' },
  { key: 'audit', icon: 'clipboard' },
  { key: 'erase', icon: 'trash' },
]

export default function PrivacySection() {
  const { t } = useI18n()

  return (
    <section className="section privacy" id="privacy">
      <div className="container">
        <Reveal className="shead shead--center">
          <span className="shead__eyebrow">{t('home.privacy.eyebrow')}</span>
          <h2>{t('home.privacy.title')}</h2>
          <p>{t('home.privacy.lead')}</p>
        </Reveal>

        <div className="privacy__grid">
          {POINTS.map((point, i) => (
            <Reveal key={point.key} delay={i * 70}>
              <div className="pcard">
                <span className="pcard__icon"><Icon name={point.icon} size={18} /></span>
                <h3>{t(`home.privacy.items.${point.key}.title`)}</h3>
                <p>{t(`home.privacy.items.${point.key}.text`)}</p>
              </div>
            </Reveal>
          ))}
        </div>
      </div>
    </section>
  )
}
