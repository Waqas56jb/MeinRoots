import { useState } from 'react'
import Icon from './ui/Icon.jsx'
import Reveal from './ui/Reveal.jsx'
import { useI18n } from '../context/I18nContext.jsx'

export default function Faq() {
  const { t } = useI18n()
  const [open, setOpen] = useState(0)
  const items = t('faq.items')

  return (
    <section className="section section--tint" id="faq">
      <div className="container faq">
        <Reveal className="faq__intro">
          <span className="eyebrow"><Icon name="clipboard" />{t('faq.eyebrow')}</span>
          <h2>{t('faq.title')}</h2>
          <p className="lead">{t('faq.lead')}</p>
          <a href="#cta" className="link-arrow">{t('faq.link')} <Icon name="arrowRight" /></a>
        </Reveal>

        <div className="faq__list">
          {items.map((f, i) => {
            const isOpen = open === i
            return (
              <Reveal key={f.q} delay={i * 55}>
                <div className={`faq__item ${isOpen ? 'is-open' : ''}`}>
                  <button
                    type="button"
                    className="faq__q"
                    onClick={() => setOpen(isOpen ? -1 : i)}
                    aria-expanded={isOpen}
                    aria-controls={`faq-panel-${i}`}
                  >
                    <span>{f.q}</span>
                    <span className="faq__toggle"><Icon name={isOpen ? 'minus' : 'plus'} size={18} /></span>
                  </button>
                  <div className="faq__a" id={`faq-panel-${i}`} hidden={!isOpen}>
                    <p>{f.a}</p>
                  </div>
                </div>
              </Reveal>
            )
          })}
        </div>
      </div>
    </section>
  )
}
