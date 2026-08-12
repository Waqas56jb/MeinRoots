import Icon from './ui/Icon.jsx'
import { Brand } from './Navbar.jsx'
import { contact } from '../data/content.js'
import { useI18n } from '../context/I18nContext.jsx'

export default function Footer() {
  const { t } = useI18n()
  const year = new Date().getFullYear()

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

          <ul className="footer__contact">
            <li>
              <span className="footer__contactIcon"><Icon name="mail" size={15} /></span>
              <a href={`mailto:${contact.email}`}>{contact.email}</a>
            </li>
            <li>
              <span className="footer__contactIcon"><Icon name="phone" size={15} /></span>
              <a href={`tel:${contact.phone.replace(/\s/g, '')}`}>{contact.phone}</a>
            </li>
          </ul>
        </div>

        <div className="footer__bottom">
          <p>© {year} MeinRoots GmbH. {t('footer.rights')}</p>
          <ul className="footer__legal">
            {t('footer.legalLinks').map((l) => (
              <li key={l}><a href="#top">{l}</a></li>
            ))}
          </ul>
        </div>
      </div>
    </footer>
  )
}
