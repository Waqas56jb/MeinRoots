import Icon from './ui/Icon.jsx'
import SmartImage from './ui/SmartImage.jsx'
import Reveal from './ui/Reveal.jsx'
import { gallery } from '../data/content.js'
import { useI18n } from '../context/I18nContext.jsx'

/** Photo mosaic — carries the mood of the platform with almost no copy. */
export default function Gallery() {
  const { t } = useI18n()

  return (
    <section className="section gallery-section" id="gallery">
      <div className="container">
        <Reveal className="section-head">
          <span className="eyebrow"><Icon name="pin" />{t('gallery.eyebrow')}</span>
          <h2>{t('gallery.title')}</h2>
        </Reveal>

        <div className="mosaic">
          {gallery.map((tile, i) => (
            <Reveal
              key={tile.key}
              delay={(i % 3) * 90}
              className={`mosaic__tile ${tile.span === 'tall' ? 'mosaic__tile--tall' : ''}`}
            >
              <SmartImage src={tile.src} alt="" ratio={tile.span === 'tall' ? '4 / 5' : '3 / 2'} />
              <span className="mosaic__veil" aria-hidden="true" />
              <span className="mosaic__caption">{t(`gallery.items.${tile.key}`)}</span>
            </Reveal>
          ))}
        </div>
      </div>
    </section>
  )
}
