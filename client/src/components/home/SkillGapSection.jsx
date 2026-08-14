import Icon from '../ui/Icon.jsx'
import Reveal from '../ui/Reveal.jsx'
import { useI18n } from '../../context/I18nContext.jsx'

/**
 * Gaps, and what to do about them.
 *
 * The differentiator is not that the platform finds weaknesses — anything can
 * do that — but that each one arrives as a current level, a target level, why
 * it matters for the objective the candidate actually chose, and a first action.
 * The card is laid out in exactly that order.
 */
const GAPS = ['german', 'recognition', 'certificate']

export default function SkillGapSection() {
  const { t } = useI18n()

  return (
    <section className="section gapsec">
      <div className="container">
        <Reveal className="shead shead--center">
          <span className="shead__eyebrow">{t('home.gaps.eyebrow')}</span>
          <h2>{t('home.gaps.title')}</h2>
          <p>{t('home.gaps.lead')}</p>
        </Reveal>

        <div className="gapsec__grid">
          {GAPS.map((key, i) => (
            <Reveal key={key} delay={i * 80}>
              <article className={`gcard gcard--${key === 'german' ? 'critical' : key === 'recognition' ? 'important' : 'nice'}`}>
                <header className="gcard__head">
                  <h3>{t(`home.gaps.items.${key}.skill`)}</h3>
                  <span className="gcard__tag">{t(`home.gaps.items.${key}.tag`)}</span>
                </header>

                <div className="gcard__levels">
                  <span className="gcard__from">
                    <em>{t('home.gaps.current')}</em>
                    {t(`home.gaps.items.${key}.from`)}
                  </span>
                  <Icon name="arrowRight" size={16} />
                  <span className="gcard__to">
                    <em>{t('home.gaps.target')}</em>
                    {t(`home.gaps.items.${key}.to`)}
                  </span>
                </div>

                <p className="gcard__why">
                  <strong>{t('home.gaps.why')}</strong>
                  {t(`home.gaps.items.${key}.why`)}
                </p>

                <p className="gcard__action">
                  <Icon name="bolt" size={14} />
                  {t(`home.gaps.items.${key}.action`)}
                </p>
              </article>
            </Reveal>
          ))}
        </div>
      </div>
    </section>
  )
}
