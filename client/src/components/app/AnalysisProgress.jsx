import Icon from '../ui/Icon.jsx'
import { Card } from './widgets.jsx'
import { useI18n } from '../../context/I18nContext.jsx'
import { useWorkspace } from '../../context/WorkspaceContext.jsx'

/**
 * What the candidate watches while their CV is analysed.
 *
 * The stages are the worker's real ones, reported by the API — nothing here is
 * a timed animation pretending to be progress. Until the first stage arrives it
 * shows an indeterminate state rather than inventing one, and a job that is
 * retrying says so instead of looking stuck.
 */
const STAGES = ['extracting_text', 'analysing', 'classifying', 'questionnaire', 'readiness', 'translating']

export default function AnalysisProgress() {
  const { t } = useI18n()
  const { status, document } = useWorkspace()

  const stage = status?.job?.stage ?? null
  const index = stage ? STAGES.indexOf(stage) : -1
  const retrying = status?.job?.willRetry

  return (
    <Card className="analysing">
      <div className="analysing__head">
        <span className="analysing__spin" aria-hidden="true"><Icon name="brain" size={26} /></span>
        <div>
          <h2>{t('app.analysing.title')}</h2>
          <p>{t('app.analysing.subtitle')}</p>
        </div>
      </div>

      <ol className="wsteps analysing__steps">
        {STAGES.map((key, i) => {
          const done = index > i
          const active = index === i
          return (
            <li key={key} className={done ? 'is-done' : active ? 'is-active' : ''}>
              <span className="wsteps__mark">{done && <Icon name="check" size={13} />}</span>
              <span>{t(`app.upload.stages.${key}`)}</span>
            </li>
          )
        })}
      </ol>

      {retrying && (
        <p className="analysing__retry">
          <Icon name="refresh" size={14} />
          {t('app.analysing.retrying', {
            attempt: status.job.attempts,
            max: status.job.maxAttempts,
          })}
        </p>
      )}

      <p className="analysing__note">
        <Icon name="info" size={14} />
        {t('app.analysing.keepOpen')}
      </p>

      {document?.filename && (
        <p className="analysing__file">
          <Icon name="file" size={14} />{document.filename}
        </p>
      )}
    </Card>
  )
}
