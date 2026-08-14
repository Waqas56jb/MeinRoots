import Icon from '../ui/Icon.jsx'
import Reveal from '../ui/Reveal.jsx'
import { useI18n } from '../../context/I18nContext.jsx'

/**
 * Readiness explained.
 *
 * The point of the section is that the number is never the answer on its own —
 * so the layout puts the score and its reasoning side by side and gives the
 * reasoning more room than the score. A bare 78 would say nothing; 78 with four
 * weighted factors and one weak one is a decision a person can act on.
 */
const FACTORS = [
  { key: 'experience', value: 88, status: 'strong' },
  { key: 'education', value: 82, status: 'strong' },
  { key: 'skills', value: 74, status: 'ok' },
  { key: 'language', value: 45, status: 'weak' },
]

export default function ReadinessSection() {
  const { t } = useI18n()

  return (
    <section className="section readsec" id="readiness">
      <div className="container readsec__inner">
        <Reveal className="readsec__copy">
          <span className="shead__eyebrow">{t('home.readiness.eyebrow')}</span>
          <h2>{t('home.readiness.title')}</h2>
          <p className="readsec__lead">{t('home.readiness.lead')}</p>

          <ul className="readsec__points">
            <li>
              <Icon name="checkCircle" size={18} />
              <div>
                <strong>{t('home.readiness.p1Title')}</strong>
                <span>{t('home.readiness.p1Text')}</span>
              </div>
            </li>
            <li>
              <Icon name="checkCircle" size={18} />
              <div>
                <strong>{t('home.readiness.p2Title')}</strong>
                <span>{t('home.readiness.p2Text')}</span>
              </div>
            </li>
            <li>
              <Icon name="checkCircle" size={18} />
              <div>
                <strong>{t('home.readiness.p3Title')}</strong>
                <span>{t('home.readiness.p3Text')}</span>
              </div>
            </li>
          </ul>

          <p className="readsec__caveat">
            <Icon name="info" size={15} />
            {t('home.readiness.caveat')}
          </p>
        </Reveal>

        <Reveal className="readsec__panel" delay={90}>
          <figure className="rcard" aria-label={t('home.hero.exampleLabel')}>
            <figcaption className="rcard__tag">
              <Icon name="info" size={13} />
              {t('home.hero.exampleLabel')}
            </figcaption>

            <span className="rcard__goal">
              <Icon name="target" size={13} />
              {t('goals.items.germany.title')}
            </span>

            <div className="rcard__score">
              <span className="rcard__num">78</span>
              <span className="rcard__band">{t('home.hero.band')}</span>
            </div>

            <ul className="rcard__factors">
              {FACTORS.map((f) => (
                <li key={f.key}>
                  <span className="rcard__fLabel">
                    {t(`home.factors.${f.key}`)}
                    <em className={`rcard__fState is-${f.status}`}>{t(`home.readiness.state.${f.status}`)}</em>
                  </span>
                  <span className="rcard__track">
                    <span className={`rcard__fill is-${f.status}`} style={{ width: `${f.value}%` }} />
                  </span>
                </li>
              ))}
            </ul>

            <p className="rcard__foot">
              <Icon name="trendingUp" size={14} />
              {t('home.readiness.improve')}
            </p>
          </figure>
        </Reveal>
      </div>
    </section>
  )
}
