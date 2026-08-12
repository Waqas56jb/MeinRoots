import { useState } from 'react'
import Icon from './ui/Icon.jsx'
import LanguageSwitcher from './LanguageSwitcher.jsx'
import { Brand } from './Navbar.jsx'
import { contact, footerColumnKeys, footerMetaIcons } from '../data/content.js'
import { useI18n } from '../context/I18nContext.jsx'

const socials = [
  { key: 'linkedin', label: 'LinkedIn', icon: 'linkedin' },
  { key: 'twitter', label: 'X', icon: 'twitter' },
  { key: 'instagram', label: 'Instagram', icon: 'instagram' },
]

export default function Footer() {
  const { t } = useI18n()
  const [email, setEmail] = useState('')
  const [subscribed, setSubscribed] = useState(false)
  const year = new Date().getFullYear()

  const onSubscribe = (e) => {
    e.preventDefault()
    if (!email) return
    setSubscribed(true)
  }

  return (
    <footer className="footer">
      <span className="footer__hairline" aria-hidden="true" />
      <span className="footer__glow" aria-hidden="true" />
      <span className="footer__glow footer__glow--b" aria-hidden="true" />

      <div className="container">
        {/* brand + sitemap */}
        <div className="footer__grid">
          <div className="footer__brand">
            <Brand />
            <p className="footer__tagline">{t('footer.tagline')}</p>
            <p className="footer__about">{t('footer.about')}</p>

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
                <span className="footer__contactIcon"><Icon name="pin" size={15} /></span>
                <span>{contact.city}</span>
              </li>
            </ul>
          </div>

          {footerColumnKeys.map((col) => (
            <nav key={col} className="footer__col" aria-label={t(`footer.columns.${col}.title`)}>
              <h4>{t(`footer.columns.${col}.title`)}</h4>
              <ul>
                {t(`footer.columns.${col}.links`).map((l) => (
                  <li key={l}>
                    <a href="#top">
                      <span>{l}</span>
                    </a>
                  </li>
                ))}
              </ul>
            </nav>
          ))}
        </div>

        {/* newsletter + social */}
        <div className="footer__band">
          <div className="footer__news">
            <h4>{t('footer.newsletter.title')}</h4>
            <p>{t('footer.newsletter.text')}</p>
          </div>

          <div className="footer__newsAction">
            {subscribed ? (
              <p className="footer__newsDone">
                <Icon name="checkCircle" size={18} />
                {t('footer.newsletter.done')}
              </p>
            ) : (
              <form className="footer__form" onSubmit={onSubscribe}>
                <label className="sr-only" htmlFor="footer-email">
                  {t('footer.newsletter.placeholder')}
                </label>
                <div className="footer__field">
                  <Icon name="mail" size={17} />
                  <input
                    id="footer-email"
                    type="email"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder={t('footer.newsletter.placeholder')}
                    autoComplete="email"
                  />
                  <button type="submit">
                    <span>{t('footer.newsletter.cta')}</span>
                    <Icon name="send" size={16} />
                  </button>
                </div>
              </form>
            )}

            <div className="footer__socialRow">
              <span className="footer__socialLabel">{t('footer.follow')}</span>
              <ul className="footer__social">
                {socials.map((s) => (
                  <li key={s.key}>
                    <a href="#top" aria-label={s.label}>
                      <Icon name={s.icon} size={17} />
                    </a>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </div>

        {/* trust + language */}
        <div className="footer__utility">
          <ul className="footer__meta">
            {t('footer.meta').map((m, i) => (
              <li key={m}>
                <Icon name={footerMetaIcons[i]} size={15} /> {m}
              </li>
            ))}
          </ul>
          <div className="footer__langWrap">
            <span className="footer__langLabel">{t('nav.language')}</span>
            <LanguageSwitcher align="left" />
          </div>
        </div>

        <div className="footer__bottom">
          <p>© {year} MeinRoots GmbH. {t('footer.rights')}</p>
          <ul className="footer__legal">
            {t('footer.columns.legal.links').slice(0, 3).map((l) => (
              <li key={l}><a href="#top">{l}</a></li>
            ))}
          </ul>
        </div>
      </div>
    </footer>
  )
}
