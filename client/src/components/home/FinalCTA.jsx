import Icon from '../ui/Icon.jsx'
import Reveal from '../ui/Reveal.jsx'
import { useI18n } from '../../context/I18nContext.jsx'
import { useCvGate } from '../../hooks/useCvGate.js'

/**
 * The close.
 *
 * One idea, one action. The page has already made its argument, so this does
 * not repeat it — it states the premise the whole product rests on and gets out
 * of the way. Same gate as every other upload control on the page.
 */
export default function FinalCTA() {
  const { t } = useI18n()
  const openCv = useCvGate()

  return (
    <section className="section fcta">
      <div className="container">
        <Reveal className="fcta__inner">
          <h2>
            {t('home.final.titleA')}
            <span>{t('home.final.titleB')}</span>
          </h2>
          <p>{t('home.final.lead')}</p>

          <div className="fcta__actions">
            <button type="button" className="btn btn--primary btn--lg" onClick={openCv}>
              <Icon name="upload" size={18} />
              {t('home.hero.ctaPrimary')}
            </button>
            <a href="#how-it-works" className="btn btn--ghost btn--lg fcta__ghost">
              {t('home.final.secondary')}
            </a>
          </div>

          <p className="fcta__note">
            <Icon name="shield" size={14} />
            {t('home.final.note')}
          </p>
        </Reveal>
      </div>
    </section>
  )
}
