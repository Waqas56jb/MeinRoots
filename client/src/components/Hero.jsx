import Icon from './ui/Icon.jsx'
import SmartImage from './ui/SmartImage.jsx'
import Reveal from './ui/Reveal.jsx'
import { useCountUp } from '../hooks/useCountUp.js'
import { useI18n, RichText } from '../context/I18nContext.jsx'
import { useCvGate } from '../hooks/useCvGate.js'
import { heroStatKeys, testimonialKeys, domainKeys, images } from '../data/content.js'

function Stat({ statKey }) {
  const { t } = useI18n()
  const [ref, text] = useCountUp(t(`hero.stats.${statKey}.value`))
  const hint = t(`hero.stats.${statKey}.hint`)

  return (
    <div className="hero__stat">
      <strong ref={ref}>{text}</strong>
      <span>{t(`hero.stats.${statKey}.label`)}</span>
      {hint !== `hero.stats.${statKey}.hint` && <em>{hint}</em>}
    </div>
  )
}

export default function Hero() {
  const { t } = useI18n()
  const openCv = useCvGate()
  const marquee = [...domainKeys, ...domainKeys]

  return (
    <section className="hero" id="top">
      {/* layer 1 — photographic backdrop */}
      <div className="hero__bg" aria-hidden="true">
        <img src={images.heroBackdrop} alt="" loading="eager" decoding="async" referrerPolicy="no-referrer" />
      </div>
      {/* layer 2 — brand veil, aurora, grid and grain */}
      <div className="hero__veil" aria-hidden="true" />
      <div className="hero__aurora" aria-hidden="true">
        <span className="blob blob--1" />
        <span className="blob blob--2" />
        <span className="blob blob--3" />
      </div>
      <div className="hero__mesh" aria-hidden="true" />
      <div className="hero__grain" aria-hidden="true" />

      <div className="container hero__inner">
        <Reveal className="hero__proof">
          <span className="avatars">
            {testimonialKeys.map((tk) => (
              <SmartImage key={tk.key} src={tk.avatar} alt="" className="avatars__img" ratio="1 / 1" />
            ))}
            <i className="avatars__more">+</i>
          </span>
          <span className="hero__proofText">
            <span className="hero__stars">
              {Array.from({ length: 5 }).map((_, i) => (
                <Icon key={i} name="star" size={12} fill="currentColor" strokeWidth={1} />
              ))}
            </span>
            <RichText path="hero.proof" />
          </span>
        </Reveal>

        <Reveal as="h1" delay={70} className="hero__title">
          <span className="hero__titleA">{t('hero.titleA')}</span>
          <span className="hero__titleB">
            {t('hero.titleB')} <span className="hero__accent">{t('hero.titleC')}</span>
          </span>
        </Reveal>

        <Reveal as="p" className="hero__lead" delay={140}>
          {t('hero.lead')}
        </Reveal>

        <Reveal className="hero__cta" delay={210}>
          <button type="button" className="btn btn--primary btn--lg btn--shine" onClick={openCv}>
            <Icon name="upload" /> {t('hero.ctaPrimary')}
          </button>
          <a href="#how-it-works" className="btn btn--frost btn--lg">
            <span className="btn__play"><Icon name="play" size={13} /></span>
            {t('hero.ctaSecondary')}
          </a>
        </Reveal>

        <Reveal className="hero__note" delay={260}>
          <Icon name="shield" size={17} />
          <span>{t('hero.note')}</span>
        </Reveal>

        <Reveal className="hero__stats" delay={320}>
          {heroStatKeys.map((k) => (
            <Stat key={k} statKey={k} />
          ))}
        </Reveal>
      </div>

      <div className="hero__scroll" aria-hidden="true">
        <Icon name="mouse" size={19} />
        <span>{t('hero.scroll')}</span>
      </div>

      <div className="hero__marquee" aria-hidden="true">
        <div className="hero__track">
          {marquee.map((d, i) => (
            <span key={`${d.key}-${i}`} className="hero__tag">
              <Icon name={d.icon} size={16} />
              {t(`domains.items.${d.key}.name`)}
            </span>
          ))}
        </div>
      </div>
    </section>
  )
}
