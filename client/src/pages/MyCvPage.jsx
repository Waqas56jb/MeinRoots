import { useEffect, useState } from 'react'
import AppShell from '../components/app/AppShell.jsx'
import UploadCard from '../components/app/UploadCard.jsx'
import AnalysisProgress from '../components/app/AnalysisProgress.jsx'
import Icon from '../components/ui/Icon.jsx'
import { Badge, Card, ConfidenceBadge, Empty, Facts, Note, Skeleton } from '../components/app/widgets.jsx'
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
 * That distinction is made structurally — the original sits in its own card
 * with the download, the generated versions live below in tabs and stay
 * labelled as AI output until a person has reviewed them. Nothing here can be
 * mistaken for having replaced the file the candidate sent.
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

  return (
    <AppShell
      eyebrow={t('app.nav.cv')}
      title={t('app.cv.pageTitle')}
      subtitle={t('app.cv.pageSubtitle')}
      badges={{ questionnaire: ws.outstandingQuestions }}
    >
      {error && <Note tone="bad">{error}</Note>}

      {ws.loading ? (
        <Skeleton rows={3} />
      ) : !ws.document || replacing ? (
        <div className="wgrid wgrid--main">
          <UploadCard
            onDone={async () => {
              setReplacing(false)
              await ws.reload()
            }}
          />
          {replacing && (
            <Card icon="info" title={t('app.cv.replaceTitle')}>
              <p className="wcard__hint">{t('app.cv.replaceHint')}</p>
              <button type="button" className="btn btn--ghost btn--block" onClick={() => setReplacing(false)}>
                {t('app.edit.cancel')}
              </button>
            </Card>
          )}
        </div>
      ) : ws.analysing ? (
        <AnalysisProgress />
      ) : (
        <>
          <Card icon="file" title={t('app.cv.original')}>
            <div className="cvfile">
              <span className="cvfile__icon"><Icon name="fileText" size={26} /></span>
              <div className="cvfile__body">
                <strong>{ws.document.filename}</strong>
                <Facts
                  items={[
                    {
                      label: t('app.cv.uploaded'),
                      value: new Intl.DateTimeFormat(locale, { dateStyle: 'medium', timeStyle: 'short' }).format(
                        new Date(ws.document.uploadedAt),
                      ),
                    },
                    { label: t('app.cv.size'), value: formatBytes(ws.document.sizeBytes) },
                    {
                      label: t('app.cv.sourceLanguage'),
                      value: ws.document.sourceLanguage
                        ? LANGUAGE_NAMES[ws.document.sourceLanguage] ?? ws.document.sourceLanguage.toUpperCase()
                        : null,
                    },
                    { label: t('app.cv.pages'), value: ws.document.pageCount },
                    {
                      label: t('app.cv.status'),
                      value:
                        ws.document.status === 'analysed' ? (
                          <Badge tone="good" icon="check">{t('app.cv.statusAnalysed')}</Badge>
                        ) : ws.document.status === 'failed' ? (
                          <Badge tone="bad" icon="alert">{t('app.cv.statusFailed')}</Badge>
                        ) : (
                          <Badge tone="brand" live>{t('app.cv.statusProcessing')}</Badge>
                        ),
                    },
                    {
                      label: t('app.cv.confidence'),
                      value: ws.profile?.extractionConfidence ? (
                        <ConfidenceBadge value={ws.profile.extractionConfidence} />
                      ) : null,
                    },
                  ]}
                />
              </div>
            </div>

            <div className="cvfile__actions">
              <a className="btn btn--primary btn--sm" href={cvApi.downloadUrl(ws.document.id)}>
                <Icon name="download" size={15} /> {t('app.cv.download')}
              </a>
              <button type="button" className="btn btn--ghost btn--sm" onClick={() => setReplacing(true)}>
                <Icon name="upload" size={15} /> {t('app.cv.replace')}
              </button>
              <button type="button" className="btn btn--ghost btn--sm" onClick={reanalyse} disabled={busy}>
                <Icon name="refresh" size={15} /> {busy ? t('auth.processing') : t('app.cv.reanalyse')}
              </button>
            </div>

            <p className="wcard__hint" style={{ marginTop: 'var(--s-4)', marginBottom: 0 }}>
              <Icon name="lock" size={13} /> {t('app.cv.originalNote')}
            </p>
          </Card>

          <Card icon="translate" title={t('app.cv.versionsTitle')} hint={t('app.cv.versionsHint')}>
            {pending && versions && versions.length < 3 && (
              <Note tone="info" icon="refresh">{t('app.cv.stillTranslating')}</Note>
            )}

            {!versions ? (
              <Skeleton rows={2} />
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
                      /* Model output, escaped inside renderMarkdown before any
                         tag is added to it. */
                      dangerouslySetInnerHTML={{ __html: renderMarkdown(current.content) }}
                    />
                  </>
                ) : (
                  <Empty icon="translate" title={t('app.cv.notAvailable')} />
                )}
              </>
            )}
          </Card>
        </>
      )}
    </AppShell>
  )
}
