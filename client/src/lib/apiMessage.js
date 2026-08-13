import { useCallback } from 'react'
import { useI18n } from '../context/I18nContext.jsx'

/**
 * Turns an API error code into a translated sentence.
 *
 * The server sends stable codes ("email_taken") and an English message meant for
 * logs. The UI runs in three languages, so it must translate the code itself and
 * never render the server's message — falling back to a generic apology when a
 * code has no translation yet, rather than showing the raw code to a candidate.
 */
export const useApiMessage = () => {
  const { t } = useI18n()

  return useCallback(
    (code, fallbackKey = 'errors.generic') => {
      if (!code) return t(fallbackKey)
      const key = `errors.${code}`
      const message = t(key)
      return message === key ? t(fallbackKey) : message
    },
    [t],
  )
}

/** Field-level messages from a 400 validation_failed response. */
export const useFieldErrors = () => {
  const { t } = useI18n()

  return useCallback(
    (details) => {
      if (!details) return {}
      return Object.fromEntries(
        Object.entries(details).map(([field, code]) => {
          const key = `errors.${code}`
          const message = t(key)
          return [field, message === key ? t('errors.generic') : message]
        }),
      )
    },
    [t],
  )
}
