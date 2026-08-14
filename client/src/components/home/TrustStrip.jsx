import Icon from '../ui/Icon.jsx'
import { useI18n } from '../../context/I18nContext.jsx'

/**
 * Capabilities, not social proof.
 *
 * Every item here is something the platform actually does — no candidate
 * counts, no partner logos, no ratings. Trust on a page that asks for a CV has
 * to be earned by saying what happens to it, not by claiming popularity.
 */
const ITEMS = [
  { key: 'languages', icon: 'translate' },
  { key: 'original', icon: 'lock' },
  { key: 'human', icon: 'users' },
  { key: 'gdpr', icon: 'shield' },
  { key: 'free', icon: 'sparkle' },
]

export default function TrustStrip() {
  const { t } = useI18n()

  return (
    <section className="tstrip" aria-label={t('home.trust.label')}>
      <div className="container">
        <ul className="tstrip__row">
          {ITEMS.map((item) => (
            <li key={item.key}>
              <Icon name={item.icon} size={17} />
              <span>{t(`home.trust.${item.key}`)}</span>
            </li>
          ))}
        </ul>
      </div>
    </section>
  )
}
