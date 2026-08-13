import { useI18n } from '../../context/I18nContext.jsx'

/**
 * Loading indicator. `full` centres it in the viewport for route-level waits.
 * The label is real text for screen readers — a bare spinning div announces
 * nothing at all.
 */
export default function Spinner({ full = false, label }) {
  const { t } = useI18n()
  const text = label ?? t('common.loading')

  return (
    <div className={`spinner ${full ? 'spinner--full' : ''}`} role="status" aria-live="polite">
      <span className="spinner__ring" aria-hidden="true" />
      <span className="sr-only">{text}</span>
    </div>
  )
}
