import { Link } from 'react-router-dom'
import Navbar from '../components/Navbar.jsx'
import Footer from '../components/Footer.jsx'
import ScrollTop from '../components/ScrollTop.jsx'
import Icon from '../components/ui/Icon.jsx'
import { contact } from '../data/content.js'
import { useI18n } from '../context/I18nContext.jsx'

/**
 * The privacy page — an interim notice, not the Privacy Policy.
 *
 * The registration form asks the candidate to acknowledge a Privacy Policy, and
 * that document does not exist yet. Pointing the checkbox at nothing would be
 * the worst of the available options: a required acknowledgement of a document
 * that cannot be read is not an acknowledgement.
 *
 * So this page says plainly that the policy is in preparation, and meanwhile
 * sets out what the platform actually does with personal data. Every statement
 * below is a description of implemented behaviour — consent gating on the CV
 * route, the untouched original file, the audit table, self-service erasure —
 * and not a commitment invented to fill the page. It is deliberately not
 * dressed up as a policy, because it is not one.
 */

/** Only facts that are true of the running system. */
const FACTS = ['consent', 'original', 'ai', 'audit', 'erase', 'transfer']

export default function PrivacyPage() {
  const { t } = useI18n()

  return (
    <div className="legal">
      <a className="skip-link" href="#main">{t('common.skip')}</a>
      <Navbar />

      <main id="main" className="legal__main">
        <div className="container legal__narrow">
          <header className="legal__head">
            <span className="legal__eyebrow">{t('legal.eyebrow')}</span>
            <h1>{t('legal.privacy.title')}</h1>
          </header>

          <p className="legal__notice legal__notice--pending">
            <Icon name="alert" size={17} />
            <span>
              <strong>{t('legal.privacy.pendingTitle')}</strong>
              {t('legal.privacy.pendingText')}
            </span>
          </p>

          <article className="legal__doc">
            <h2>{t('legal.privacy.todayTitle')}</h2>
            <p>{t('legal.privacy.todayLead')}</p>

            <ul className="factlist">
              {FACTS.map((key) => (
                <li key={key}>
                  <span className="factlist__icon"><Icon name="check" size={15} /></span>
                  <div>
                    <strong>{t(`legal.privacy.facts.${key}.title`)}</strong>
                    <p>{t(`legal.privacy.facts.${key}.text`)}</p>
                  </div>
                </li>
              ))}
            </ul>

            <h2>{t('legal.privacy.rightsTitle')}</h2>
            <p>{t('legal.privacy.rightsText')}</p>

            <p className="legal__foot">
              {t('legal.privacy.contact')}{' '}
              <a href={`mailto:${contact.email}`}>{contact.email}</a>
              {' · '}
              <Link to="/terms">{t('legal.terms.title')}</Link>
            </p>
          </article>
        </div>
      </main>

      <Footer />
      <ScrollTop />
    </div>
  )
}
