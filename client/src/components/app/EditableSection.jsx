import { useEffect, useState } from 'react'
import Icon from '../ui/Icon.jsx'
import { useI18n } from '../../context/I18nContext.jsx'
import { profileApi } from '../../lib/api.js'
import { useApiMessage, useFieldErrors } from '../../lib/apiMessage.js'

/**
 * Add / edit / delete for one profile section.
 *
 * Every save returns the whole profile from the API and hands it back through
 * `onSaved`, so the screen re-renders from the server's answer rather than from
 * a locally patched copy that slowly drifts out of step with it.
 *
 * The form is described by a field list rather than written five times, because
 * the five sections differ only in their fields — and a shared form means the
 * mobile layout, the validation display and the focus handling are fixed once.
 */
export default function EditableSection({ section, fields, initial, onSaved, onCancel }) {
  const { t } = useI18n()
  const apiMessage = useApiMessage()
  const fieldErrors = useFieldErrors()

  const blank = Object.fromEntries(
    fields.map((f) => [f.name, f.type === 'checkbox' ? false : f.type === 'tags' ? [] : '']),
  )
  const [values, setValues] = useState(() => ({ ...blank, ...(initial ?? {}) }))
  const [errors, setErrors] = useState({})
  const [busy, setBusy] = useState(false)

  // Escape closes the form — expected of anything that behaves like a dialog.
  useEffect(() => {
    const onKey = (e) => {
      if (e.key === 'Escape') onCancel()
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [onCancel])

  const set = (name, value) => {
    setValues((v) => ({ ...v, [name]: value }))
    setErrors((e) => ({ ...e, [name]: undefined, form: undefined }))
  }

  /** Strings out, correct types in — the API rejects "" where it wants a number. */
  const toPayload = () => {
    const payload = {}
    for (const f of fields) {
      const raw = values[f.name]
      if (f.type === 'number') payload[f.name] = raw === '' || raw === null ? null : Number(raw)
      else if (f.type === 'checkbox') payload[f.name] = Boolean(raw)
      else if (f.type === 'tags') payload[f.name] = Array.isArray(raw) ? raw : []
      else payload[f.name] = raw === '' ? null : raw
    }
    return payload
  }

  const submit = async (event) => {
    event.preventDefault()
    const missing = fields.filter((f) => f.required && !String(values[f.name] ?? '').trim())
    if (missing.length) {
      setErrors(Object.fromEntries(missing.map((f) => [f.name, t('errors.field_required')])))
      return
    }

    setBusy(true)
    try {
      const data = initial?.id
        ? await profileApi.updateEntry(section, initial.id, toPayload())
        : await profileApi.createEntry(section, toPayload())
      onSaved(data.profile)
    } catch (err) {
      setErrors({ ...fieldErrors(err.details), form: apiMessage(err.code) })
    } finally {
      setBusy(false)
    }
  }

  return (
    <form className="editform" onSubmit={submit}>
      {errors.form && (
        <p className="ffield__err"><Icon name="alert" size={14} />{errors.form}</p>
      )}

      <div className="editform__grid">
        {fields.map((f) => (
          <label key={f.name} className={`editfield ${f.wide ? 'is-wide' : ''}`}>
            <span className="editfield__label">
              {t(f.label)}
              {f.required && <em>*</em>}
            </span>

            {f.type === 'textarea' ? (
              <textarea
                rows={3}
                value={values[f.name] ?? ''}
                onChange={(e) => set(f.name, e.target.value)}
                maxLength={f.maxLength}
              />
            ) : f.type === 'select' ? (
              <select value={values[f.name] ?? ''} onChange={(e) => set(f.name, e.target.value)}>
                <option value="">{t('app.edit.notSet')}</option>
                {f.options.map((o) => (
                  <option key={o.value} value={o.value}>{o.labelKey ? t(o.labelKey) : o.label}</option>
                ))}
              </select>
            ) : f.type === 'checkbox' ? (
              <span className="editfield__check">
                <input
                  type="checkbox"
                  checked={Boolean(values[f.name])}
                  onChange={(e) => set(f.name, e.target.checked)}
                />
                <span>{t(f.hint ?? f.label)}</span>
              </span>
            ) : f.type === 'tags' ? (
              <TagInput value={values[f.name] ?? []} onChange={(v) => set(f.name, v)} />
            ) : (
              <input
                type={f.type === 'number' ? 'number' : f.type === 'date' ? 'date' : 'text'}
                value={values[f.name] ?? ''}
                onChange={(e) => set(f.name, e.target.value)}
                placeholder={f.placeholder ? t(f.placeholder) : undefined}
                maxLength={f.maxLength}
                inputMode={f.type === 'number' ? 'numeric' : undefined}
              />
            )}

            {errors[f.name] && <span className="ffield__err">{errors[f.name]}</span>}
          </label>
        ))}
      </div>

      <div className="editform__actions">
        <button type="button" className="btn btn--ghost btn--sm" onClick={onCancel} disabled={busy}>
          {t('app.edit.cancel')}
        </button>
        <button type="submit" className="btn btn--primary btn--sm" disabled={busy}>
          {busy ? t('auth.processing') : t('app.edit.save')}
        </button>
      </div>
    </form>
  )
}

/** Free-form list of short strings — used for the skills attached to a role. */
function TagInput({ value, onChange }) {
  const { t } = useI18n()
  const [draft, setDraft] = useState('')

  const add = () => {
    const next = draft.trim()
    if (!next || value.includes(next)) return setDraft('')
    onChange([...value, next])
    return setDraft('')
  }

  return (
    <span className="taginput">
      <span className="taginput__list">
        {value.map((tag) => (
          <span key={tag} className="taginput__tag">
            {tag}
            <button type="button" onClick={() => onChange(value.filter((v) => v !== tag))} aria-label={t('app.edit.remove')}>
              <Icon name="close" size={12} />
            </button>
          </span>
        ))}
      </span>
      <input
        type="text"
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        onKeyDown={(e) => {
          // Enter must not submit the surrounding form — here it commits a tag.
          if (e.key === 'Enter' || e.key === ',') {
            e.preventDefault()
            add()
          }
        }}
        onBlur={add}
        placeholder={t('app.edit.addTag')}
      />
    </span>
  )
}
