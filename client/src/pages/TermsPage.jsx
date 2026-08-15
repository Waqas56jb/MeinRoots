import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import Navbar from '../components/Navbar.jsx'
import Footer from '../components/Footer.jsx'
import ScrollTop from '../components/ScrollTop.jsx'
import Icon from '../components/ui/Icon.jsx'
import { NOT_YET_ACTIVE, TERMS_VERSION, terms } from '../data/terms.js'
import { useI18n } from '../context/I18nContext.jsx'

/**
 * The Terms & Conditions.
 *
 * The document is English and stays English whatever language the interface is
 * in. That is a deliberate choice rather than an oversight: an unreviewed
 * translation of a binding text produces a second document that says something
 * slightly different, and then no one can say which one governs. Readers in
 * German and French get a notice saying exactly that, in their own language.
 *
 * Sections 6 to 8 describe subscription plans, fees and cancellation. MeinRoots
 * does not currently offer any of those, so they are marked — nobody should be
 * left thinking they have agreed to a charge that cannot be made.
 */
export default function TermsPage() {
  const { t, locale } = useI18n()
  const [active, setActive] = useState(null)

  // Highlights the clause you have scrolled to in the contents list.
  useEffect(() => {
    const headings = terms.map((s) => document.getElementById(`clause-${s.n}`)).filter(Boolean)
    if (!headings.length) return undefined
    const observer = new IntersectionObserver(
      (entries) => {
        const visible = entries.filter((e) => e.isIntersecting)
        if (visible.length) setActive(visible[0].target.id.replace('clause-', ''))
      },
      { rootMargin: '-90px 0px -70% 0px' },
    )
    headings.forEach((h) => observer.observe(h))
    return () => observer.disconnect()
  }, [])

  return (
    <div className="legal">
      <a className="skip-link" href="#main">{t('common.skip')}</a>
      <Navbar />

      <main id="main" className="legal__main">
        <div className="container">
          <header className="legal__head">
            <span className="legal__eyebrow">{t('legal.eyebrow')}</span>
            <h1>{t('legal.terms.title')}</h1>
            <p className="legal__meta">
              <span><Icon name="file" size={14} />{t('legal.version', { version: TERMS_VERSION })}</span>
              <span><Icon name="globe" size={14} />meinroots.de</span>
            </p>
          </header>

          {/* Shown to everyone, but it is only load-bearing for the readers who
              cannot read the document below. */}
          {locale !== 'en' && (
            <p className="legal__notice legal__notice--lang">
              <Icon name="info" size={17} />
              <span>{t('legal.englishOnly')}</span>
            </p>
          )}

          <div className="legal__layout">
            <nav className="legal__toc" aria-label={t('legal.contents')}>
              <p className="legal__tocTitle">{t('legal.contents')}</p>
              <ol>
                {terms.map((s) => (
                  <li key={s.n}>
                    <a
                      href={`#clause-${s.n}`}
                      className={active === s.n ? 'is-active' : ''}
                      aria-current={active === s.n ? 'true' : undefined}
                    >
                      <em>{s.n}</em>
                      {s.title}
                    </a>
                  </li>
                ))}
              </ol>
            </nav>

            <article className="legal__doc">
              {terms.map((section) => (
                <section key={section.n} className="clause">
                  <h2 id={`clause-${section.n}`}>
                    <span className="clause__n">{section.n}</span>
                    {section.title}
                  </h2>

                  {NOT_YET_ACTIVE.includes(section.n) && (
                    <p className="clause__pending">
                      <Icon name="info" size={14} />
                      {t('legal.notYetOffered')}
                    </p>
                  )}

                  {section.body?.map((p, i) => <p key={i}>{p}</p>)}

                  {section.list && (
                    <ul className="clause__list">
                      {section.list.map((item, i) => <li key={i}>{item}</li>)}
                    </ul>
                  )}

                  {section.after?.map((p, i) => <p key={`a${i}`}>{p}</p>)}

                  {section.note && (
                    <p className="clause__note">
                      <strong>{t('legal.important')}</strong>
                      {section.note}
                    </p>
                  )}
                </section>
              ))}

              <p className="legal__foot">
                {t('legal.questions')}{' '}
                <Link to="/signup">{t('legal.backToSignup')}</Link>
              </p>
            </article>
          </div>
        </div>
      </main>

      <Footer />
      <ScrollTop />
    </div>
  )
}
