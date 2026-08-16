import { Link } from 'react-router-dom'
import Icon from './ui/Icon.jsx'
import { Brand } from './Navbar.jsx'
import { contact, social } from '../data/content.js'
import { useI18n } from '../context/I18nContext.jsx'

/**
 * The legal links, wired to the pages that exist.
 *
 * All three used to point at `#top`. Two of them now lead somewhere real. The
 * imprint has no page yet — a §5 TMG Impressum is a legal requirement for a
 * German company and the details have to come from the company, not from here —
 * so it stays inert rather than pretending.
 */
const LEGAL = [
  { key: 'privacy', to: '/privacy' },
  { key: 'terms', to: '/terms' },
  { key: 'imprint', to: null },
]

export default function Footer() {
  const { t } = useI18n()
  const year = new Date().getFullYear()
  const links = social.filter((s) => s.url)

  return (
    <footer className="footer">
      <span className="footer__hairline" aria-hidden="true" />
      <span className="footer__glow" aria-hidden="true" />

      <div className="container">
        <div className="footer__main">
          <div className="footer__brand">
            <Brand />
            <p className="footer__tagline">{t('footer.tagline')}</p>
            <p className="footer__about">{t('footer.about')}</p>
          </div>

          <div className="footer__reach">
            <ul className="footer__contact">
              <li>
                <span className="footer__contactIcon"><Icon name="mail" size={15} /></span>
                <a href={`mailto:${contact.email}`}>{contact.email}</a>
              </li>
              <li>
                <span className="footer__contactIcon"><Icon name="phone" size={15} /></span>
                <a href={`tel:${contact.phone.replace(/\s/g, '')}`}>{contact.phone}</a>
              </li>
              <li>
                <span className="footer__contactIcon"><Icon name="message" size={15} /></span>
                <Link to="/contact">{t('footer.contact')}</Link>
              </li>
            </ul>

            {/* Only the accounts that exist. An icon linking nowhere under the
                company's own name is worse than no icon. */}
            {links.length > 0 && (
              <div className="footer__social">
                <span className="footer__socialLabel">{t('footer.follow')}</span>
                <ul>
                  {links.map((s) => (
                    <li key={s.key}>
                      <a
                        href={s.url}
                        target="_blank"
                        rel="noreferrer noopener"
                        aria-label={s.key}
                      >
                        <Icon name={s.icon} size={17} />
                      </a>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        </div>

        <div className="footer__bottom">
          <p>© {year} MeinRoots GmbH. {t('footer.rights')}</p>
          <ul className="footer__legal">
            {LEGAL.map((item) => (
              <li key={item.key}>
                {item.to ? (
                  <Link to={item.to}>{t(`footer.legal.${item.key}`)}</Link>
                ) : (
                  <span className="footer__legalPending">{t(`footer.legal.${item.key}`)}</span>
                )}
              </li>
            ))}
          </ul>
        </div>
      </div>
    </footer>
  )
}
