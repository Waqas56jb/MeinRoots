import Icon from './ui/Icon.jsx'
import Reveal from './ui/Reveal.jsx'
import { trustKeys } from '../data/content.js'
import { useI18n } from '../context/I18nContext.jsx'

export default function TrustBar() {
  const { t } = useI18n()

  return (
    <section className="trustbar">
      <div className="container">
        <Reveal className="trustbar__inner">
          <span className="trustbar__label">{t('trust.label')}</span>
          <ul className="trustbar__list">
            {trustKeys.map((item) => (
              <li key={item.key}>
                <Icon name={item.icon} size={18} />
                {t(`trust.items.${item.key}`)}
              </li>
            ))}
          </ul>
        </Reveal>
      </div>
    </section>
  )
}
