import { useId, useState } from 'react'
import Icon from '../ui/Icon.jsx'
import { useI18n } from '../../context/I18nContext.jsx'

/** Labelled input with an icon, inline error and an optional password toggle. */
export default function Field({
  label,
  icon,
  type = 'text',
  value,
  onChange,
  error,
  placeholder,
  autoComplete,
  name,
  required = true,
}) {
  const id = useId()
  const { t } = useI18n()
  const [visible, setVisible] = useState(false)
  const isPassword = type === 'password'
  const inputType = isPassword && visible ? 'text' : type

  return (
    <div className={`ffield ${error ? 'has-error' : ''}`}>
      <label htmlFor={id}>{label}</label>
      <div className="ffield__box">
        {icon && <Icon name={icon} size={18} />}
        <input
          id={id}
          name={name}
          type={inputType}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          autoComplete={autoComplete}
          required={required}
          aria-invalid={Boolean(error)}
          aria-describedby={error ? `${id}-err` : undefined}
        />
        {isPassword && (
          <button
            type="button"
            className="ffield__toggle"
            onClick={() => setVisible((v) => !v)}
            aria-label={visible ? t('auth.hide') : t('auth.show')}
          >
            <Icon name={visible ? 'eyeOff' : 'eye'} size={18} />
          </button>
        )}
      </div>
      {error && (
        <p className="ffield__err" id={`${id}-err`}>
          <Icon name="alert" size={14} />
          {error}
        </p>
      )}
    </div>
  )
}
