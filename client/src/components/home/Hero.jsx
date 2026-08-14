import Icon from '../ui/Icon.jsx'
import { useI18n } from '../../context/I18nContext.jsx'
import { useCvGate } from '../../hooks/useCvGate.js'

/**
 * The hero.
 *
 * The visual half is a small, honest rendering of the real product surface —
 * a readiness score with the factors behind it and one next step — because the
 * fastest way to explain what MeinRoots does is to show what it hands back.
 * It is labelled as an example so it can never be mistaken for the visitor's
 * own data.
 *
 * Both calls to action route through useCvGate, which is the single rule for
 * every upload control on the site: signed in goes straight to the CV page,
 * anonymous goes to login carrying ?next=/cv&gate=cv.
 */

const FACTORS = [
  { key: 'experience', value: 88, tone: 'good' },
  { key: 'education', value: 82, tone: 'good' },
  { key: 'skills', value: 74, tone: 'good' },
  { key: 'language', value: 45, tone: 'warn' },
]

export default function Hero() {
  const { t } = useI18n()
  const openCv = useCvGate()

  return (
    <section className="hero" id="top">
      <div className="hero__inner container">
        <div className="hero__copy">
          <span className="hero__eyebrow">
            <Icon name="compass" size={14} />
            {t('home.hero.eyebrow')}
          </span>

          <h1>
            {t('home.hero.titleA')}{' '}
            <span className="hero__accent">{t('home.hero.titleB')}</span>
          </h1>

          <p className="hero__lead">{t('home.hero.lead')}</p>

          <div className="hero__actions">
            <button type="button" className="btn btn--primary btn--lg" onClick={openCv}>
              <Icon name="upload" size={18} />
              {t('home.hero.ctaPrimary')}
            </button>
            <a href="#how-it-works" className="btn btn--ghost btn--lg">
              {t('home.hero.ctaSecondary')}
              <Icon name="arrowRight" size={16} />
            </a>
          </div>

          <ul className="hero__reassure">
            <li><Icon name="check" size={15} />{t('home.hero.point1')}</li>
            <li><Icon name="check" size={15} />{t('home.hero.point2')}</li>
            <li><Icon name="check" size={15} />{t('home.hero.point3')}</li>
          </ul>
        </div>

        <div className="hero__visual">
          {/* Marked as an example in the markup and to screen readers, so the
              illustrative numbers can never read as the visitor's own. */}
          <figure className="hpv" aria-label={t('home.hero.exampleLabel')}>
            <figcaption className="hpv__tag">
              <Icon name="info" size={13} />
              {t('home.hero.exampleLabel')}
            </figcaption>

            <div className="hpv__card hpv__card--score">
              <div className="hpv__scoreHead">
                <span className="hpv__goal">
                  <Icon name="target" size={13} />
                  {t('goals.items.germany.title')}
                </span>
                <span className="hpv__band">{t('home.hero.band')}</span>
              </div>

              <div className="hpv__scoreRow">
                <span className="hpv__number">78</span>
                <span className="hpv__outOf">{t('home.hero.outOf')}</span>
              </div>

              <ul className="hpv__factors">
                {FACTORS.map((f) => (
                  <li key={f.key}>
                    <span className="hpv__factorLabel">{t(`home.factors.${f.key}`)}</span>
                    <span className="hpv__bar">
                      <span
                        className={`hpv__barFill is-${f.tone}`}
                        style={{ width: `${f.value}%` }}
                      />
                    </span>
                  </li>
                ))}
              </ul>
            </div>

            <div className="hpv__card hpv__card--next">
              <span className="hpv__nextIcon"><Icon name="bolt" size={16} /></span>
              <div>
                <strong>{t('home.hero.nextTitle')}</strong>
                <span>{t('home.hero.nextText')}</span>
              </div>
            </div>

            <div className="hpv__card hpv__card--file">
              <span className="hpv__fileIcon"><Icon name="fileText" size={16} /></span>
              <div>
                <strong>{t('home.hero.fileName')}</strong>
                <span>{t('home.hero.fileMeta')}</span>
              </div>
              <span className="hpv__done"><Icon name="check" size={13} /></span>
            </div>
          </figure>
        </div>
      </div>
    </section>
  )
}
