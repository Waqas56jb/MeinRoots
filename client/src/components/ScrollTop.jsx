import Icon from './ui/Icon.jsx'
import { useScrolled } from '../hooks/useReveal.js'
import { useI18n } from '../context/I18nContext.jsx'

export default function ScrollTop() {
  const show = useScrolled(700)
  const { t } = useI18n()

  return (
    <button
      type="button"
      className={`to-top ${show ? 'is-visible' : ''}`}
      onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}
      aria-label={t('common.backToTop')}
      tabIndex={show ? 0 : -1}
    >
      <Icon name="arrowUp" size={20} />
    </button>
  )
}
