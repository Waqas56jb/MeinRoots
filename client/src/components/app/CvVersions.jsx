import { useEffect, useState } from 'react'
import Icon from '../ui/Icon.jsx'
import Spinner from '../ui/Spinner.jsx'
import { cvApi } from '../../lib/api.js'
import { renderMarkdown } from '../../lib/markdown.js'
import { useI18n } from '../../context/I18nContext.jsx'

const LANGUAGE_NAMES = { en: 'English', de: 'Deutsch', fr: 'Français' }

/**
 * The three language renderings of a CV.
 *
 * The uploaded file is offered as a download and never as a tab — it is the
 * untouched original, and the tabs are derived text. Everything the model wrote
 * stays visibly labelled until a human has reviewed it.
 */
export default function CvVersions({ documentId, pending }) {
  const { t, locale } = useI18n()
  const [versions, setVersions] = useState(null)
  const [active, setActive] = useState(locale)
  const [error, setError] = useState('')

  useEffect(() => {
    let cancelled = false
    if (!documentId) return undefined

    const load = async () => {
      try {
        const data = await cvApi.versions(documentId)
        if (cancelled) return
        setVersions(data.versions)
        // Prefer the reader's own language; fall back to whatever exists.
        if (!data.versions.some((v) => v.language === active)) {
          setActive(data.versions[0]?.language ?? locale)
        }
      } catch (err) {
        if (!cancelled) setError(err.code)
      }
    }

    load()
    // Translations land after the profile does, so keep checking while the API
    // says they are still being produced.
    const timer = pending ? setInterval(load, 5000) : null
    return () => {
      cancelled = true
      if (timer) clearInterval(timer)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- `active` must not restart polling
  }, [documentId, pending, locale])

  if (!documentId) return null
  if (error) return null
  if (!versions) return <Spinner />

  const current = versions.find((v) => v.language === active)

  return (
    <section className="pblock card cvv">
      <h2><Icon name="file" size={18} />{t('app.cv.title')}</h2>
      <p className="pblock__hint">{t('app.cv.hint')}</p>

      <div className="cvv__bar">
        <div className="cvv__tabs" role="tablist" aria-label={t('app.cv.title')}>
          {['en', 'de', 'fr'].map((code) => {
            const version = versions.find((v) => v.language === code)
            return (
              <button
                key={code}
                type="button"
                role="tab"
                aria-selected={active === code}
                className={`cvv__tab ${active === code ? 'is-on' : ''}`}
                disabled={!version}
                onClick={() => setActive(code)}
              >
                {LANGUAGE_NAMES[code]}
                {version?.isSource && <span className="cvv__badge">{t('app.cv.original')}</span>}
                {!version && pending && <span className="cvv__badge cvv__badge--wait">…</span>}
              </button>
            )
          })}
        </div>

        <a className="btn btn--ghost btn--sm" href={cvApi.downloadUrl(documentId)}>
          <Icon name="file" size={15} /> {t('app.cv.download')}
        </a>
      </div>

      {pending && versions.length < 3 && (
        <p className="cvv__pending">
          <Icon name="info" size={14} /> {t('app.cv.stillTranslating')}
        </p>
      )}

      {current ? (
        <>
          {!current.isSource && (
            <p className={`cvv__label ${current.reviewed ? 'is-reviewed' : ''}`}>
              <Icon name={current.reviewed ? 'checkCircle' : 'brain'} size={14} />
              {current.reviewed ? t('app.cv.reviewed') : t('app.cv.aiGenerated')}
            </p>
          )}
          <div
            className="cvv__doc"
            // Model output, escaped inside renderMarkdown before any tag is added.
            dangerouslySetInnerHTML={{ __html: renderMarkdown(current.content) }}
          />
        </>
      ) : (
        <p className="cvv__pending">{t('app.cv.notAvailable')}</p>
      )}
    </section>
  )
}
