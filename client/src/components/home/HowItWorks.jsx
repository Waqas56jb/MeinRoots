import Icon from '../ui/Icon.jsx'
import Reveal from '../ui/Reveal.jsx'
import { useI18n } from '../../context/I18nContext.jsx'

/**
 * Four steps.
 *
 * Numbered because this genuinely is a sequence — the candidate does them in
 * this order and each depends on the one before. The connecting rail is drawn
 * once behind the row rather than as a divider per card, so it reads as one
 * process instead of four separate boxes.
 */
const STEPS = [
  { key: 'upload', icon: 'upload' },
  { key: 'understand', icon: 'brain' },
  { key: 'readiness', icon: 'target' },
  { key: 'act', icon: 'listChecks' },
]

export default function HowItWorks() {
  const { t } = useI18n()

  return (
    <section className="section how" id="how-it-works">
      <div className="container">
        <Reveal className="shead">
          <span className="shead__eyebrow">{t('home.how.eyebrow')}</span>
          <h2>{t('home.how.title')}</h2>
          <p>{t('home.how.lead')}</p>
        </Reveal>

        <ol className="how__steps">
          <span className="how__rail" aria-hidden="true" />
          {STEPS.map((step, i) => (
            <Reveal key={step.key} delay={i * 80} as="li" className="how__step">
              <span className="how__num">{String(i + 1).padStart(2, '0')}</span>
              <span className="how__icon"><Icon name={step.icon} size={19} /></span>
              <h3>{t(`home.how.steps.${step.key}.title`)}</h3>
              <p>{t(`home.how.steps.${step.key}.text`)}</p>
            </Reveal>
          ))}
        </ol>
      </div>
    </section>
  )
}
