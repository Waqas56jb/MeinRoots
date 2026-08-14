import { useState } from 'react'
import Icon from '../ui/Icon.jsx'
import Reveal from '../ui/Reveal.jsx'
import { useI18n } from '../../context/I18nContext.jsx'

/**
 * The CV in three languages.
 *
 * The original is shown as a fixed, separate object rather than as a fourth
 * tab, because the product's promise is that it is never altered — and a
 * layout that files it alongside the generated versions quietly contradicts
 * that. The generated ones stay labelled as generated.
 */
const LANGS = [
  { code: 'en', label: 'English' },
  { code: 'de', label: 'Deutsch' },
  { code: 'fr', label: 'Français' },
]

export default function MultilingualCVSection() {
  const { t } = useI18n()
  const [active, setActive] = useState('de')

  return (
    <section className="section cvsec">
      <div className="container cvsec__inner">
        <Reveal className="cvsec__copy">
          <span className="shead__eyebrow">{t('home.cv.eyebrow')}</span>
          <h2>{t('home.cv.title')}</h2>
          <p className="cvsec__lead">{t('home.cv.lead')}</p>

          <ul className="cvsec__points">
            <li><Icon name="lock" size={16} />{t('home.cv.p1')}</li>
            <li><Icon name="translate" size={16} />{t('home.cv.p2')}</li>
            <li><Icon name="users" size={16} />{t('home.cv.p3')}</li>
          </ul>
        </Reveal>

        <Reveal className="cvsec__visual" delay={90}>
          <div className="cvdoc-demo">
            <div className="cvdoc-demo__original">
              <span className="cvdoc-demo__icon"><Icon name="fileText" size={18} /></span>
              <div>
                <strong>{t('home.cv.originalTitle')}</strong>
                <span>{t('home.cv.originalMeta')}</span>
              </div>
              <span className="cvdoc-demo__lockTag">
                <Icon name="lock" size={12} />
                {t('home.cv.untouched')}
              </span>
            </div>

            <span className="cvdoc-demo__link" aria-hidden="true">
              <Icon name="arrowRight" size={16} />
            </span>

            <div className="cvdoc-demo__generated">
              <div className="cvdoc-demo__tabs" role="tablist" aria-label={t('home.cv.title')}>
                {LANGS.map((lang) => (
                  <button
                    key={lang.code}
                    type="button"
                    role="tab"
                    aria-selected={active === lang.code}
                    className={active === lang.code ? 'is-on' : ''}
                    onClick={() => setActive(lang.code)}
                  >
                    {lang.label}
                  </button>
                ))}
              </div>

              <span className="cvdoc-demo__aiTag">
                <Icon name="brain" size={12} />
                {t('home.cv.generated')}
              </span>

              {/* Shape only — decorative lines standing in for a rendered CV,
                  never presented as anyone's real document. */}
              <div className="cvdoc-demo__page" aria-hidden="true">
                <span className="l l--title" />
                <span className="l l--sub" />
                <span className="l l--head" />
                <span className="l" /><span className="l l--short" />
                <span className="l l--head" />
                <span className="l" /><span className="l" /><span className="l l--short" />
              </div>
            </div>
          </div>
        </Reveal>
      </div>
    </section>
  )
}
