import Icon from '../ui/Icon.jsx'
import Reveal from '../ui/Reveal.jsx'
import { useI18n } from '../../context/I18nContext.jsx'

/**
 * How the AI is kept honest.
 *
 * The claim made here is deliberately narrow and true: the model reports its
 * own confidence, low confidence raises a flag, and flagged profiles reach a
 * person. It does not claim every profile is reviewed, because that is not what
 * the system does — and a candidate who later discovers the overstatement loses
 * trust in everything else on the page.
 */
const STAGES = [
  { key: 'analyse', icon: 'brain' },
  { key: 'confidence', icon: 'gauge' },
  { key: 'review', icon: 'users' },
  { key: 'profile', icon: 'checkCircle' },
]

export default function HumanReviewSection() {
  const { t } = useI18n()

  return (
    <section className="section human" id="trust">
      <div className="container">
        <Reveal className="shead shead--center">
          <span className="shead__eyebrow shead__eyebrow--light">{t('home.human.eyebrow')}</span>
          <h2>{t('home.human.title')}</h2>
          <p>{t('home.human.lead')}</p>
        </Reveal>

        <ol className="human__flow">
          {STAGES.map((stage, i) => (
            <Reveal key={stage.key} delay={i * 80} as="li" className="human__stage">
              <span className="human__icon"><Icon name={stage.icon} size={20} /></span>
              <h3>{t(`home.human.stages.${stage.key}.title`)}</h3>
              <p>{t(`home.human.stages.${stage.key}.text`)}</p>
              {i < STAGES.length - 1 && (
                <span className="human__arrow" aria-hidden="true">
                  <Icon name="arrowRight" size={16} />
                </span>
              )}
            </Reveal>
          ))}
        </ol>

        <Reveal className="human__honest">
          <Icon name="shield" size={17} />
          <p>{t('home.human.honest')}</p>
        </Reveal>
      </div>
    </section>
  )
}
