import { useI18n } from '../../context/I18nContext.jsx'

/** Rough client-side strength hint — the real policy is enforced by the API. */
export function scorePassword(value) {
  if (!value || value.length < 8) return 0
  let score = 1
  if (value.length >= 12) score += 1
  if (/[A-Z]/.test(value) && /[a-z]/.test(value)) score += 1
  if (/\d/.test(value) && /[^\w\s]/.test(value)) score += 1
  return Math.min(score, 4)
}

export default function PasswordMeter({ value }) {
  const { t } = useI18n()
  const score = scorePassword(value)
  if (!value) return null

  return (
    <div className={`pmeter pmeter--${score}`}>
      <span className="pmeter__bars" aria-hidden="true">
        {[0, 1, 2, 3].map((i) => (
          <i key={i} className={i < score ? 'is-on' : ''} />
        ))}
      </span>
      <span className="pmeter__label">{t('auth.strength')[score]}</span>
    </div>
  )
}
