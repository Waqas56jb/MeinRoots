import { useEffect, useState } from 'react'
import AppShell from '../components/app/AppShell.jsx'
import UploadCard from '../components/app/UploadCard.jsx'
import AnalysisProgress from '../components/app/AnalysisProgress.jsx'
import ErrorState from '../components/app/ErrorState.jsx'
import { CvSkeleton, Loading } from '../components/app/Skeletons.jsx'
import Icon from '../components/ui/Icon.jsx'
import { Badge, ConfidenceBadge, Note } from '../components/app/widgets.jsx'
import { useI18n } from '../context/I18nContext.jsx'
import { useWorkspace } from '../context/WorkspaceContext.jsx'
import { cvApi } from '../lib/api.js'
import { renderMarkdown } from '../lib/markdown.js'
import { useApiMessage } from '../lib/apiMessage.js'

const LANGUAGE_NAMES = { en: 'English', de: 'Deutsch', fr: 'Français' }

const formatBytes = (bytes) => {
  if (!bytes) return '—'
  const mb = bytes / 1024 / 1024
  return mb >= 1 ? `${mb.toFixed(1)} MB` : `${Math.round(bytes / 1024)} KB`
}

/**
 * The CV page.
 *
 * The uploaded file is the record; the language versions are derived from it.
 * That distinction is structural rather than stated — the original sits at the
 * top with its own metadata and download, and the generated versions live below
 * in tabs, each carrying a label saying whether a person has checked it yet.
 * Nothing here can be mistaken for having replaced the file the candidate sent,
 * which matters: it is often the only copy they have.
 */
export default function MyCvPage() {
  const { t, locale } = useI18n()
  const apiMessage = useApiMessage()
  const ws = useWorkspace()

  const [versions, setVersions] = useState(null)
  const [active, setActive] = useState(locale)
  const [replacing, setReplacing] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  const documentId = ws.document?.id
  const pending = Boolean(ws.status?.translationsPending)

  useEffect(() => {
    if (!documentId || ws.document?.status !== 'analysed') return undefined
    let cancelled = false

    const load = async () => {
      try {
        const data = await cvApi.versions(documentId)
        if (cancelled) return
        setVersions(data.versions)
        if (!data.versions.some((v) => v.language === active)) {
          setActive(data.versions[0]?.language ?? locale)
        }
      } catch {
        /* the card simply will not render */
      }
    }
    load()
    // Translations land after the profile does; keep looking while they do.
    const timer = pending ? setInterval(load, 5000) : null
    return () => {
      cancelled = true
      if (timer) clearInterval(timer)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- `active` must not restart polling
  }, [documentId, ws.document?.status, pending, locale])

  const reanalyse = async () => {
    setBusy(true)
    setError('')
    try {
      await cvApi.reanalyse(documentId)
      await ws.reload()
    } catch (err) {
      setError(apiMessage(err.code))
    } finally {
      setBusy(false)
    }
  }

  const current = versions?.find((v) => v.language === active)

  const shell = {
    eyebrow: t('app.nav.cv'),
    title: t('app.cv.pageTitle'),
    subtitle: t('app.cv.pageSubtitle'),
    badges: { questionnaire: ws.outstandingQuestions },
  }

  if (ws.loading) {
    return (
      <AppShell {...shell}>
        <Loading label={t('common.loading')}>
          <CvSkeleton />
        </Loading>
      </AppShell>
    )
  }

  if (ws.error) {
    return (
      <AppShell {...shell}>
        <ErrorState code={ws.error} what={t('app.error.cv')} onRetry={ws.reload} />
      </AppShell>
    )
  }

  if (!ws.document || replacing) {
    return (
      <AppShell {...shell}>
        {replacing && (
          <Note tone="info" icon="info" title={t('app.cv.replaceTitle')}>
            {t('app.cv.replaceHint')}
          </Note>
        )}
        <div className="cvupload">
          <UploadCard
            onDone={async () => {
              setReplacing(false)
              await ws.reload()
            }}
          />
          {replacing && (
            <button type="button" className="btn btn--ghost btn--block" onClick={() => setReplacing(false)}>
              {t('app.edit.cancel')}
            </button>
          )}
        </div>
      </AppShell>
    )
  }

  if (ws.analysing) {
    return (
      <AppShell {...shell}>
        <AnalysisProgress />
      </AppShell>
    )
  }

  const facts = [
    {
      key: 'uploaded',
      label: t('app.cv.uploaded'),
      value: new Intl.DateTimeFormat(locale, { dateStyle: 'medium', timeStyle: 'short' }).format(
        new Date(ws.document.uploadedAt),
      ),
    },
    { key: 'size', label: t('app.cv.size'), value: formatBytes(ws.document.sizeBytes) },
    {
      key: 'lang',
      label: t('app.cv.sourceLanguage'),
      value: ws.document.sourceLanguage
        ? LANGUAGE_NAMES[ws.document.sourceLanguage] ?? ws.document.sourceLanguage.toUpperCase()
        : null,
    },
    { key: 'pages', label: t('app.cv.pages'), value: ws.document.pageCount },
  ].filter((f) => f.value !== null && f.value !== undefined && f.value !== '')

  return (
    <AppShell {...shell}>
      {error && <Note tone="bad">{error}</Note>}

      {/* ------------------------- the original file ------------------------ */}
      <section className="doc">
        <div className="doc__head">
          <span className="doc__icon"><Icon name="fileText" size={26} /></span>
          <div className="doc__title">
            <span className="doc__eyebrow">{t('app.cv.original')}</span>
            <h2>{ws.document.filename}</h2>
            <div className="doc__status">
              {ws.document.status === 'analysed' ? (
                <Badge tone="good" icon="check">{t('app.cv.statusAnalysed')}</Badge>
              ) : ws.document.status === 'failed' ? (
                <Badge tone="bad" icon="alert">{t('app.cv.statusFailed')}</Badge>
              ) : (
                <Badge tone="brand" live>{t('app.cv.statusProcessing')}</Badge>
              )}
              {ws.profile?.extractionConfidence ? (
                <ConfidenceBadge value={ws.profile.extractionConfidence} />
              ) : null}
            </div>
          </div>

          {/* One obvious primary action; everything else is quieter. */}
          <a className="btn btn--primary doc__download" href={cvApi.downloadUrl(ws.document.id)}>
            <Icon name="download" size={16} /> {t('app.cv.download')}
          </a>
        </div>

        <dl className="doc__facts">
          {facts.map((f) => (
            <div key={f.key}>
              <dt>{f.label}</dt>
              <dd>{f.value}</dd>
            </div>
          ))}
        </dl>

        <div className="doc__foot">
          <p className="doc__note">
            <Icon name="lock" size={13} /> {t('app.cv.originalNote')}
          </p>
          <div className="doc__actions">
            <button type="button" className="btn btn--ghost btn--sm" onClick={() => setReplacing(true)}>
              <Icon name="upload" size={15} /> {t('app.cv.replace')}
            </button>
            <button type="button" className="btn btn--ghost btn--sm" onClick={reanalyse} disabled={busy}>
              <Icon name="refresh" size={15} /> {busy ? t('auth.processing') : t('app.cv.reanalyse')}
            </button>
          </div>
        </div>
      </section>

      {/* ------------------------ generated versions ------------------------ */}
      <section className="doc doc--versions">
        <div className="doc__versionsHead">
          <div>
            <h2>{t('app.cv.versionsTitle')}</h2>
            <p>{t('app.cv.versionsHint')}</p>
          </div>
        </div>

        {pending && versions && versions.length < 3 && (
          <Note tone="info" icon="refresh">{t('app.cv.stillTranslating')}</Note>
        )}

        {!versions ? (
          <Loading label={t('common.loading')}>
            <div className="sk" aria-hidden="true">
              <span className="sk__bar" style={{ width: '40%', height: 40, borderRadius: 999 }} />
              <span className="sk__bar" style={{ width: '100%', height: 12, marginTop: 20 }} />
              <span className="sk__bar" style={{ width: '92%', height: 12, marginTop: 9 }} />
              <span className="sk__bar" style={{ width: '86%', height: 12, marginTop: 9 }} />
            </div>
          </Loading>
        ) : (
          <>
            <div className="cvtabs" role="tablist" aria-label={t('app.cv.versionsTitle')}>
              {['en', 'de', 'fr'].map((code) => {
                const version = versions.find((v) => v.language === code)
                return (
                  <button
                    key={code}
                    type="button"
                    role="tab"
                    aria-selected={active === code}
                    className={`cvtabs__tab ${active === code ? 'is-on' : ''}`}
                    disabled={!version}
                    onClick={() => setActive(code)}
                  >
                    {LANGUAGE_NAMES[code]}
                    {version?.isSource && <span className="cvtabs__flag">{t('app.cv.originalShort')}</span>}
                    {!version && pending && <span className="cvtabs__flag">…</span>}
                  </button>
                )
              })}
            </div>

            {current ? (
              <>
                {current.isSource ? (
                  <Note tone="good" icon="check" title={t('app.cv.sourceLabel')}>
                    {t('app.cv.sourceLabelText')}
                  </Note>
                ) : (
                  <Note
                    tone={current.reviewed ? 'good' : 'warn'}
                    icon={current.reviewed ? 'check' : 'brain'}
                    title={current.reviewed ? t('app.cv.reviewed') : t('app.cv.aiGenerated')}
                  >
                    {current.reviewed ? t('app.cv.reviewedText') : t('app.cv.aiGeneratedText')}
                  </Note>
                )}
                <div
                  className="cvdoc"
                  /* Model output, escaped inside renderMarkdown before any tag
                     is added to it. */
                  dangerouslySetInnerHTML={{ __html: renderMarkdown(current.content) }}
                />
              </>
            ) : (
              <p className="doc__empty">
                <Icon name="translate" size={16} /> {t('app.cv.notAvailable')}
              </p>
            )}
          </>
        )}
      </section>
    </AppShell>
  )
}
