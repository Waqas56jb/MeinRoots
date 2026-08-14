import { useState } from 'react'
import { Link } from 'react-router-dom'
import AppShell from '../components/app/AppShell.jsx'
import ErrorState from '../components/app/ErrorState.jsx'
import ProfileCompletion from '../components/app/ProfileCompletion.jsx'
import { Loading, ProfileSkeleton } from '../components/app/Skeletons.jsx'
import Icon from '../components/ui/Icon.jsx'
import {
  EducationList, ExperienceList, LanguagesBlock, SkillsBlock,
} from '../components/app/ProfileBlocks.jsx'
import { Badge, ConfidenceBadge, Note } from '../components/app/widgets.jsx'
import { formatMonths } from '../components/app/insight.js'
import { useI18n } from '../context/I18nContext.jsx'
import { useWorkspace } from '../context/WorkspaceContext.jsx'
import { profileApi } from '../lib/api.js'
import { useApiMessage } from '../lib/apiMessage.js'

/**
 * The candidate's structured professional identity.
 *
 * Everything on this page was read out of a CV by a model, and the page is
 * honest about that without making a performance of it. Rows the extractor was
 * unsure about carry a marker; rows the candidate has corrected say so and drop
 * the marker, because at that point the model's uncertainty is no longer about
 * anything. What it never does is show a confidence percentage on data that is
 * simply correct — that would turn a useful signal into noise.
 */
export default function ProfilePage() {
  const { t } = useI18n()
  const ws = useWorkspace()

  const [editingHeader, setEditingHeader] = useState(false)

  const shell = {
    eyebrow: t('app.nav.profile'),
    title: t('app.profile.title'),
    subtitle: t('app.profile.editHint'),
    badges: { questionnaire: ws.outstandingQuestions },
  }

  if (ws.loading) {
    return (
      <AppShell {...shell}>
        <Loading label={t('common.loading')}>
          <ProfileSkeleton />
        </Loading>
      </AppShell>
    )
  }

  if (ws.error) {
    return (
      <AppShell {...shell}>
        <ErrorState code={ws.error} what={t('app.error.profile')} onRetry={ws.reload} />
      </AppShell>
    )
  }

  if (!ws.profile || !ws.hasProfileData) {
    return (
      <AppShell {...shell}>
        <section className="rpanel rpanel--empty">
          <span className="rpanel__emptyIcon"><Icon name="upload" size={24} /></span>
          <h2>{t('app.dash.noCvTitle')}</h2>
          <p>{t('app.dash.noCvText')}</p>
          <Link to="/cv" className="btn btn--primary">
            {t('nav.cta')} <Icon name="arrowRight" size={16} />
          </Link>
        </section>
      </AppShell>
    )
  }

  const p = ws.profile

  return (
    <AppShell {...shell}>
      {/* ------------------------- who this person is ----------------------- */}
      <section className="ident ident--hero">
        {editingHeader ? (
          <HeaderForm
            profile={p}
            onCancel={() => setEditingHeader(false)}
            onSaved={(next) => {
              ws.setProfile(next)
              setEditingHeader(false)
            }}
          />
        ) : (
          <>
            <div className="ident__heroTop">
              <div className="ident__heroText">
                <h2>{p.headline || t('app.profile.noHeadline')}</h2>
                {p.classification && (
                  <p className="ident__heroDomain">
                    <Icon name="compass" size={15} />
                    <span>
                      <strong>{p.classification.label}</strong>
                      {p.classification.specialisation && ` · ${p.classification.specialisation}`}
                    </span>
                  </p>
                )}
              </div>
              <button type="button" className="btn btn--ghost btn--sm" onClick={() => setEditingHeader(true)}>
                <Icon name="pencil" size={15} /> {t('app.edit.edit')}
              </button>
            </div>

            {p.summary && <p className="ident__summary">{p.summary}</p>}

            <div className="ident__tags">
              {formatMonths(p.totalExperienceMonths, t) && (
                <Badge icon="briefcase">
                  {t('app.profile.experienceOf', { value: formatMonths(p.totalExperienceMonths, t) })}
                </Badge>
              )}
              {(p.city || p.country) && (
                <Badge icon="pin">{[p.city, p.country].filter(Boolean).join(', ')}</Badge>
              )}
              {p.willingToRelocate === true && (
                <Badge tone="good" icon="check">{t('app.profile.willRelocate')}</Badge>
              )}
              {p.noticePeriodWeeks !== null && p.noticePeriodWeeks !== undefined && (
                <Badge icon="clock">{t('app.profile.notice', { weeks: p.noticePeriodWeeks })}</Badge>
              )}
              {p.extractionConfidence !== null && p.extractionConfidence !== undefined && (
                <ConfidenceBadge value={p.extractionConfidence} />
              )}
            </div>
          </>
        )}
      </section>

      {p.flags?.length > 0 && (
        <Note tone="warn" icon="info" title={t('app.dash.flagsTitle')}>
          {p.flags.map((f) => t(`app.flags.${f.code}`)).join(' · ')}
        </Note>
      )}

      {/* How to read the markers, said once rather than on every row. */}
      <p className="ident__legend">
        <Icon name="info" size={14} />
        <span>
          <span className="prov prov--low"><Icon name="alert" size={11} />%</span>
          {t('app.profile.legendLow')}
          <span className="prov prov--mine"><Icon name="check" size={11} />{t('app.edit.edited')}</span>
          {t('app.profile.legendMine')}
        </span>
      </p>

      <div className="pgrid">
        <div className="pgrid__main">
          <ExperienceList items={p.experiences} editable onSaved={ws.setProfile} />
          <EducationList
            items={p.education}
            certifications={p.certifications}
            editable
            onSaved={ws.setProfile}
          />
        </div>
        <div className="pgrid__side">
          <ProfileCompletion profile={p} outstandingQuestions={ws.outstandingQuestions} />
          <SkillsBlock skills={p.skills} editable onSaved={ws.setProfile} />
          <LanguagesBlock languages={p.languages} editable onSaved={ws.setProfile} />
        </div>
      </div>
    </AppShell>
  )
}

/** The handful of profile-level fields a candidate can correct about themselves. */
function HeaderForm({ profile, onCancel, onSaved }) {
  const { t } = useI18n()
  const apiMessage = useApiMessage()

  const [values, setValues] = useState({
    headline: profile.headline ?? '',
    summary: profile.summary ?? '',
    city: profile.city ?? '',
    country: profile.country ?? '',
    willingToRelocate: profile.willingToRelocate ?? false,
    noticePeriodWeeks: profile.noticePeriodWeeks ?? '',
  })
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  const set = (k, v) => setValues((s) => ({ ...s, [k]: v }))

  const submit = async (e) => {
    e.preventDefault()
    setBusy(true)
    setError('')
    try {
      const data = await profileApi.update({
        headline: values.headline || null,
        summary: values.summary || null,
        city: values.city || null,
        country: values.country || null,
        willingToRelocate: values.willingToRelocate,
        noticePeriodWeeks: values.noticePeriodWeeks === '' ? null : Number(values.noticePeriodWeeks),
      })
      onSaved(data.profile)
    } catch (err) {
      setError(apiMessage(err.code))
    } finally {
      setBusy(false)
    }
  }

  return (
    <form className="editform" onSubmit={submit}>
      {error && <p className="ffield__err"><Icon name="alert" size={14} />{error}</p>}
      <div className="editform__grid">
        <label className="editfield is-wide">
          <span className="editfield__label">{t('app.profile.headlineLabel')}</span>
          <input value={values.headline} onChange={(e) => set('headline', e.target.value)} maxLength={160} />
        </label>
        <label className="editfield is-wide">
          <span className="editfield__label">{t('app.profile.summaryLabel')}</span>
          <textarea rows={3} value={values.summary} onChange={(e) => set('summary', e.target.value)} maxLength={2000} />
        </label>
        <label className="editfield">
          <span className="editfield__label">{t('app.edit.f.location')}</span>
          <input value={values.city} onChange={(e) => set('city', e.target.value)} maxLength={80} />
        </label>
        <label className="editfield">
          <span className="editfield__label">{t('app.edit.f.country')}</span>
          <input value={values.country} onChange={(e) => set('country', e.target.value)} maxLength={80} />
        </label>
        <label className="editfield">
          <span className="editfield__label">{t('app.profile.noticeLabel')}</span>
          <input
            type="number"
            inputMode="numeric"
            value={values.noticePeriodWeeks}
            onChange={(e) => set('noticePeriodWeeks', e.target.value)}
            min={0}
            max={104}
          />
        </label>
        <label className="editfield">
          <span className="editfield__label">{t('app.profile.relocateLabel')}</span>
          <span className="editfield__check">
            <input
              type="checkbox"
              checked={Boolean(values.willingToRelocate)}
              onChange={(e) => set('willingToRelocate', e.target.checked)}
            />
            <span>{t('app.profile.willRelocate')}</span>
          </span>
        </label>
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
