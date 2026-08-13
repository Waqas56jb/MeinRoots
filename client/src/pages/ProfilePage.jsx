import { useState } from 'react'
import { Link } from 'react-router-dom'
import AppShell from '../components/app/AppShell.jsx'
import Icon from '../components/ui/Icon.jsx'
import {
  EducationList, ExperienceList, LanguagesBlock, SkillsBlock,
} from '../components/app/ProfileBlocks.jsx'
import { Badge, Card, ConfidenceBadge, Empty, Note, Ring, Skeleton } from '../components/app/widgets.jsx'
import { useI18n } from '../context/I18nContext.jsx'
import { useWorkspace } from '../context/WorkspaceContext.jsx'
import { profileApi } from '../lib/api.js'
import { useApiMessage } from '../lib/apiMessage.js'

/**
 * The candidate's structured profile — everything the AI extracted, and every
 * correction they have made to it, in one editable place.
 */
export default function ProfilePage() {
  const { t } = useI18n()
  const apiMessage = useApiMessage()
  const ws = useWorkspace()

  const [editingHeader, setEditingHeader] = useState(false)

  return (
    <AppShell
      eyebrow={t('app.nav.profile')}
      title={t('app.profile.title')}
      subtitle={t('app.profile.editHint')}
      badges={{ questionnaire: ws.outstandingQuestions }}
    >
      {ws.loading ? (
        <Skeleton rows={4} />
      ) : !ws.profile || !ws.hasProfileData ? (
        <Card>
          <Empty
            icon="upload"
            title={t('app.dash.noCvTitle')}
            text={t('app.dash.noCvText')}
            action={<Link to="/cv" className="btn btn--primary">{t('nav.cta')} <Icon name="arrowRight" /></Link>}
          />
        </Card>
      ) : (
        <>
          <Card>
            <div className="phead">
              <Ring value={ws.profile.completeness} size={92} sublabel={t('app.dash.complete')} />
              <div className="phead__body">
                {editingHeader ? (
                  <HeaderForm
                    profile={ws.profile}
                    onCancel={() => setEditingHeader(false)}
                    onSaved={(p) => {
                      ws.setProfile(p)
                      setEditingHeader(false)
                    }}
                  />
                ) : (
                  <>
                    <h2>{ws.profile.headline || t('app.profile.noHeadline')}</h2>
                    {ws.profile.summary && <p className="phead__summary">{ws.profile.summary}</p>}
                    <div className="phead__tags">
                      {ws.profile.classification && (
                        <Badge tone="brand" icon="compass">
                          {ws.profile.classification.label}
                          {ws.profile.classification.specialisation
                            ? ` · ${ws.profile.classification.specialisation}`
                            : ''}
                        </Badge>
                      )}
                      {(ws.profile.city || ws.profile.country) && (
                        <Badge icon="pin">{[ws.profile.city, ws.profile.country].filter(Boolean).join(', ')}</Badge>
                      )}
                      {ws.profile.willingToRelocate === true && (
                        <Badge tone="good" icon="check">{t('app.profile.willRelocate')}</Badge>
                      )}
                      {ws.profile.noticePeriodWeeks !== null && ws.profile.noticePeriodWeeks !== undefined && (
                        <Badge icon="clock">{t('app.profile.notice', { weeks: ws.profile.noticePeriodWeeks })}</Badge>
                      )}
                      {ws.profile.extractionConfidence !== null && (
                        <ConfidenceBadge value={ws.profile.extractionConfidence} />
                      )}
                    </div>
                  </>
                )}
              </div>
              {!editingHeader && (
                <button type="button" className="btn btn--ghost btn--sm" onClick={() => setEditingHeader(true)}>
                  <Icon name="pencil" size={15} /> {t('app.edit.edit')}
                </button>
              )}
            </div>
          </Card>

          {ws.profile.flags?.length > 0 && (
            <Note tone="warn" icon="info" title={t('app.dash.flagsTitle')}>
              {ws.profile.flags.map((f) => t(`app.flags.${f.code}`)).join(' · ')}
            </Note>
          )}

          <div className="wgrid wgrid--main">
            <div className="wsection">
              <ExperienceList items={ws.profile.experiences} editable onSaved={ws.setProfile} />
              <EducationList
                items={ws.profile.education}
                certifications={ws.profile.certifications}
                editable
                onSaved={ws.setProfile}
              />
            </div>
            <div className="wsection">
              <SkillsBlock skills={ws.profile.skills} editable onSaved={ws.setProfile} />
              <LanguagesBlock languages={ws.profile.languages} editable onSaved={ws.setProfile} />
            </div>
          </div>
        </>
      )}
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
