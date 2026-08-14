import Icon from '../ui/Icon.jsx'
import Reveal from '../ui/Reveal.jsx'
import { domainKeys } from '../../data/content.js'
import { useI18n } from '../../context/I18nContext.jsx'

/**
 * Classification, shown as understanding rather than as a grid.
 *
 * One worked example carries the point — the system reads a nurse's CV and
 * returns "Healthcare & Care / Intensive care", not a keyword list. The full
 * set of domains is listed once underneath as quiet supporting evidence rather
 * than thirteen competing cards.
 */
export default function DomainSection() {
  const { t } = useI18n()

  return (
    <section className="section domsec" id="domains">
      <div className="container domsec__inner">
        <Reveal className="domsec__demo">
          <figure className="dcard" aria-label={t('home.hero.exampleLabel')}>
            <figcaption className="dcard__tag">
              <Icon name="info" size={13} />
              {t('home.hero.exampleLabel')}
            </figcaption>

            <div className="dcard__from">
              <Icon name="fileText" size={15} />
              <span>{t('home.domains.input')}</span>
            </div>

            <span className="dcard__arrow" aria-hidden="true"><Icon name="chevronDown" size={18} /></span>

            <dl className="dcard__out">
              <div>
                <dt>{t('home.domains.domainLabel')}</dt>
                <dd className="dcard__primary">
                  <Icon name="heartPulse" size={16} />
                  {t('home.domains.domainValue')}
                </dd>
              </div>
              <div>
                <dt>{t('home.domains.specLabel')}</dt>
                <dd>{t('home.domains.specValue')}</dd>
              </div>
              <div>
                <dt>{t('home.domains.seniorityLabel')}</dt>
                <dd>{t('home.domains.seniorityValue')}</dd>
              </div>
            </dl>
          </figure>
        </Reveal>

        <Reveal className="domsec__copy" delay={90}>
          <span className="shead__eyebrow">{t('home.domains.eyebrow')}</span>
          <h2>{t('home.domains.title')}</h2>
          <p className="domsec__lead">{t('home.domains.lead')}</p>

          <span className="domsec__listLabel">{t('home.domains.listLabel')}</span>
          <ul className="domsec__list">
            {domainKeys.map((d) => (
              <li key={d.key}>
                <Icon name={d.icon} size={13} />
                {t(`home.domains.items.${d.key}`)}
              </li>
            ))}
          </ul>
        </Reveal>
      </div>
    </section>
  )
}
