import { useState } from 'react'
import Layout from '../../components/Layout.jsx'
import Icon from '../../components/Icon.jsx'
import { Field } from '../../components/AuthShell.jsx'
import { Badge, EmptyState, ErrorState, PendingState, Sheet, Skeleton } from '../../components/ui.jsx'
import { isNotImplemented } from '../../lib/api.js'
import { useResource } from '../../hooks/useResource.js'
import { teamApi } from '../../services/index.js'
import { useI18n } from '../../context/I18nContext.jsx'
import { useToast } from '../../context/ToastContext.jsx'

const ROLE_TONE = { owner: 'brand', admin: 'info', member: 'neutral' }
const STATUS_TONE = { active: 'good', invited: 'info', disabled: 'neutral' }

/**
 * The people from this company who can sign in.
 *
 * The invitation control sends a real request and reports what came back. It
 * does not optimistically add a row and call it success — an invitation the
 * interface believes went out and the server never accepted is the kind of
 * thing nobody discovers until the colleague says they got nothing.
 */
export default function TeamPage() {
  const { t, locale } = useI18n()
  const toast = useToast()
  const { data, loading, error, pending, reload } = useResource(() => teamApi.list(), [])

  const [inviting, setInviting] = useState(false)
  const [email, setEmail] = useState('')
  const [role, setRole] = useState('member')
  const [busy, setBusy] = useState(false)
  const [formError, setFormError] = useState('')

  const members = data?.members ?? []

  const invite = async () => {
    setBusy(true)
    setFormError('')
    try {
      await teamApi.invite({ email: email.trim(), role })
      toast.success(t('team.invited', { email: email.trim() }))
      setInviting(false)
      setEmail('')
      await reload()
    } catch (err) {
      setFormError(isNotImplemented(err) ? t('team.pendingInvite') : t('team.inviteFailed'))
    } finally {
      setBusy(false)
    }
  }

  const remove = async (member) => {
    try {
      await teamApi.remove(member.id)
      toast.success(t('team.removed'))
      await reload()
    } catch (err) {
      toast.error(isNotImplemented(err) ? t('team.pendingInvite') : t('team.removeFailed'))
    }
  }

  return (
    <Layout
      title={t('team.title')}
      subtitle={t('team.subtitle')}
      actions={
        <button type="button" className="btn btn--primary btn--sm" onClick={() => setInviting(true)}>
          <Icon name="userPlus" size={16} /> <span className="hide-sm">{t('team.invite')}</span>
        </button>
      }
    >
      {loading ? (
        <Skeleton variant="rows" rows={4} />
      ) : pending ? (
        <PendingState endpoint="GET /api/recruiter/team" />
      ) : error ? (
        <ErrorState message={t('team.loadError')} onRetry={reload} />
      ) : !members.length ? (
        <EmptyState icon="users" title={t('team.emptyTitle')} text={t('team.emptyText')} />
      ) : (
        <ul className="teamlist">
          {members.map((m) => (
            <li key={m.id}>
              <span className="avatar" aria-hidden="true">
                {(m.name ?? m.email ?? '?').slice(0, 2).toUpperCase()}
              </span>
              <div className="teamlist__body">
                <strong>{m.name ?? m.email}</strong>
                <span className="muted small">{m.email}</span>
              </div>
              <Badge tone={ROLE_TONE[m.role] ?? 'neutral'}>{t(`team.roles.${m.role}`)}</Badge>
              <Badge tone={STATUS_TONE[m.status] ?? 'neutral'}>{t(`team.statuses.${m.status}`)}</Badge>
              {m.lastLoginAt && (
                <span className="muted small hide-sm">
                  {new Intl.DateTimeFormat(locale, { dateStyle: 'medium' }).format(new Date(m.lastLoginAt))}
                </span>
              )}
              {/* The owner seat cannot be removed — there has to be someone left
                  who can administer the account. */}
              {m.role !== 'owner' && (
                <button
                  type="button"
                  className="btn btn--ghost btn--sm"
                  onClick={() => remove(m)}
                  aria-label={t('team.remove', { name: m.name ?? m.email })}
                >
                  <Icon name="close" size={15} />
                </button>
              )}
            </li>
          ))}
        </ul>
      )}

      <Sheet
        open={inviting}
        onClose={() => setInviting(false)}
        title={t('team.inviteTitle')}
        actions={
          <>
            <button type="button" className="btn btn--ghost" onClick={() => setInviting(false)}>
              {t('common.cancel')}
            </button>
            <button type="button" className="btn btn--primary" onClick={invite} disabled={busy || !email.trim()}>
              {busy ? t('common.loading') : t('team.sendInvite')}
            </button>
          </>
        }
      >
        <p className="muted small">{t('team.inviteHint')}</p>
        <Field
          label={t('auth.workEmail')}
          name="invite-email"
          type="email"
          value={email}
          onChange={setEmail}
          error={formError}
          required
        />
        <label className="field" htmlFor="invite-role">
          <span className="field__label">{t('team.role')}</span>
          <select id="invite-role" value={role} onChange={(e) => setRole(e.target.value)}>
            <option value="member">{t('team.roles.member')}</option>
            <option value="admin">{t('team.roles.admin')}</option>
          </select>
        </label>
      </Sheet>
    </Layout>
  )
}
