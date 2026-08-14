import Icon from '../ui/Icon.jsx'
import Reveal from '../ui/Reveal.jsx'
import { goalKeys } from '../../data/content.js'
import { useI18n } from '../../context/I18nContext.jsx'
import { useCvGate } from '../../hooks/useCvGate.js'

/**
 * The four objectives, presented as a choice of direction rather than a feature
 * grid. Each one is a real value the product stores on the account and assesses
 * against, so picking one here leads to the same place the signup form does.
 *
 * `goalKeys` is the same source the signup form, upload card and settings page
 * read, so the four can never fall out of step.
 */
export default function CareerPaths() {
  const { t } = useI18n()
  const openCv = useCvGate()

  return (
    <section className="section paths" id="career-paths">
      <div className="container">
        <Reveal className="shead">
          <span className="shead__eyebrow">{t('home.paths.eyebrow')}</span>
          <h2>{t('home.paths.title')}</h2>
          <p>{t('home.paths.lead')}</p>
        </Reveal>

        <div className="paths__grid">
          {goalKeys.map((goal, i) => (
            <Reveal key={goal.key} delay={i * 70}>
              <button type="button" className="path" onClick={openCv}>
                <span className="path__icon"><Icon name={goal.icon} size={20} /></span>
                <h3>{t(`goals.items.${goal.key}.title`)}</h3>
                <p>{t(`goals.items.${goal.key}.text`)}</p>
                <span className="path__detail">
                  <Icon name="target" size={13} />
                  {t(`home.paths.detail.${goal.key}`)}
                </span>
                <span className="path__go">
                  {t('home.paths.choose')}
                  <Icon name="arrowRight" size={15} />
                </span>
              </button>
            </Reveal>
          ))}
        </div>

        <p className="paths__note">
          <Icon name="info" size={14} />
          {t('home.paths.note')}
        </p>
      </div>
    </section>
  )
}
