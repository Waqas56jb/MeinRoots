import { useEffect, useState } from 'react'
import Layout from '../../components/Layout.jsx'
import Icon from '../../components/Icon.jsx'
import { Field } from '../../components/AuthShell.jsx'
import { Badge, ErrorState, Panel, PendingState, Skeleton } from '../../components/ui.jsx'
import { isNotImplemented } from '../../lib/api.js'
import { useResource } from '../../hooks/useResource.js'
import { companyApi } from '../../services/index.js'
import { useI18n } from '../../context/I18nContext.jsx'
import { useToast } from '../../context/ToastContext.jsx'

const FIELDS = ['legalName', 'tradingName', 'country', 'city', 'website', 'registrationNumber', 'vatId', 'industry']

const VERIFICATION_TONE = {
  verified: 'good',
  pending: 'info',
  info_required: 'warn',
  rejected: 'bad',
}

/**
 * The company this seat belongs to.
 *
 * Verification status sits at the top rather than in the form, because it is
 * the thing that decides what the account can do and is not something the
 * recruiter can edit their way out of. The form below it is the part they own.
 */
export default function CompanyPage() {
  const { t } = useI18n()
  const toast = useToast()
  const { data, loading, error, pending, reload } = useResource(() => companyApi.get(), [])

  const [values, setValues] = useState({})
  const [busy, setBusy] = useState(false)
  const [dirty, setDirty] = useState(false)

  const company = data?.company ?? data ?? null

  useEffect(() => {
    if (!company) return
    setValues(Object.fromEntries(FIELDS.map((f) => [f, company[f] ?? ''])))
    setDirty(false)
  }, [company])

  const set = (key, value) => {
    setValues((s) => ({ ...s, [key]: value }))
    setDirty(true)
  }

  const save = async (e) => {
    e.preventDefault()
    setBusy(true)
    try {
      await companyApi.update(values)
      toast.success(t('company.saved'))
      setDirty(false)
      await reload()
    } catch (err) {
      toast.error(isNotImplemented(err) ? t('company.pendingSave') : t('company.saveFailed'))
    } finally {
      setBusy(false)
    }
  }

  return (
    <Layout title={t('company.title')} subtitle={t('company.subtitle')}>
      {loading ? (
        <Skeleton variant="detail" />
      ) : pending ? (
        <PendingState endpoint="GET /api/recruiter/company" />
      ) : error ? (
        <ErrorState message={t('company.loadError')} onRetry={reload} />
      ) : (
        <>
          <Panel className="panel--verify">
            <div className="verify">
              <span className={`verify__icon verify__icon--${company?.verificationStatus ?? 'pending'}`}>
                <Icon name={company?.verificationStatus === 'verified' ? 'shield' : 'clock'} size={20} />
              </span>
              <div className="verify__body">
                <span className="verify__label">{t('company.verification')}</span>
                <strong>
                  <Badge tone={VERIFICATION_TONE[company?.verificationStatus] ?? 'neutral'}>
                    {t(`company.verificationStatus.${company?.verificationStatus ?? 'pending'}`)}
                  </Badge>
                </strong>
                <p>{t(`company.verificationText.${company?.verificationStatus ?? 'pending'}`)}</p>
              </div>
            </div>
          </Panel>

          <Panel icon="company" title={t('company.details')} hint={t('company.detailsHint')}>
            <form onSubmit={save} noValidate>
              <div className="grid2">
                {FIELDS.map((f) => (
                  <Field
                    key={f}
                    label={t(`company.fields.${f}`)}
                    name={f}
                    value={values[f] ?? ''}
                    onChange={(v) => set(f, v)}
                    required={f === 'legalName' || f === 'country'}
                  />
                ))}
              </div>
              <div className="formfoot">
                <button type="submit" className="btn btn--primary" disabled={busy || !dirty}>
                  {busy ? t('common.loading') : t('common.saveChanges')}
                </button>
              </div>
            </form>
          </Panel>
        </>
      )}
    </Layout>
  )
}
