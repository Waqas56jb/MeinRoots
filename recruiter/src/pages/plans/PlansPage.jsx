import { useState } from 'react'
import Layout from '../../components/Layout.jsx'
import Icon from '../../components/Icon.jsx'
import { ErrorState, PendingState, Sheet, Skeleton } from '../../components/ui.jsx'
import { isNotImplemented } from '../../lib/api.js'
import { useResource } from '../../hooks/useResource.js'
import { billingApi } from '../../services/index.js'
import { useI18n } from '../../context/I18nContext.jsx'
import { useAccount } from '../../context/AccountContext.jsx'
import { useToast } from '../../context/ToastContext.jsx'

/**
 * What the plans are and what each one includes.
 *
 * Every price, interval and feature list is read from the API. Nothing is
 * written into this file — a figure hard-coded into a component is a figure
 * that will be wrong the first time someone changes it in the admin console,
 * and wrong in a place a customer is looking at while deciding to pay.
 *
 * A plan whose price the backend has not set renders as "on request" rather
 * than as a number this page made up.
 */
export default function PlansPage() {
  const { t, locale } = useI18n()
  const toast = useToast()
  const { plan: currentPlan, subscription } = useAccount()
  const { data, loading, error, pending, reload } = useResource(() => billingApi.plans(), [])

  const [confirming, setConfirming] = useState(null)
  const [busy, setBusy] = useState(false)

  const plans = data?.plans ?? []

  const price = (p) => {
    if (p.price === null || p.price === undefined) return t('billing.priceOnRequest')
    return new Intl.NumberFormat(locale, {
      style: 'currency',
      currency: p.currency ?? 'EUR',
      maximumFractionDigits: 0,
    }).format(p.price)
  }

  const upgrade = async () => {
    setBusy(true)
    try {
      await billingApi.upgrade({ plan: confirming.key })
      toast.success(t('billing.upgradeRequested'))
      setConfirming(null)
    } catch (err) {
      toast.error(isNotImplemented(err) ? t('billing.pendingUpgrade') : t('billing.upgradeFailed'))
    } finally {
      setBusy(false)
    }
  }

  return (
    <Layout title={t('billing.plansTitle')} subtitle={t('billing.plansSubtitle')}>
      {loading ? (
        <Skeleton variant="cards" rows={3} />
      ) : pending ? (
        <PendingState
          endpoint="GET /api/recruiter/plans"
          title={t('billing.plansPendingTitle')}
          text={t('billing.plansPendingText')}
        />
      ) : error ? (
        <ErrorState message={t('billing.plansError')} onRetry={reload} />
      ) : (
        <div className="plangrid">
          {plans.map((p) => {
            const isCurrent = p.key === currentPlan
            return (
              <section key={p.key} className={`plancard ${p.highlighted ? 'is-featured' : ''} ${isCurrent ? 'is-current' : ''}`}>
                {isCurrent && <span className="plancard__flag">{t('billing.currentPlan')}</span>}

                <header className="plancard__head">
                  <h2>{p.name ?? t(`billing.plans.${p.key}.name`)}</h2>
                  <p className="plancard__price">
                    <strong className="num">{price(p)}</strong>
                    {p.price !== null && p.price !== undefined && p.interval && (
                      <span>/{t(`billing.interval.${p.interval}`)}</span>
                    )}
                  </p>
                  {p.trialDays > 0 && (
                    <p className="plancard__trial">{t('billing.includesTrial', { days: p.trialDays })}</p>
                  )}
                </header>

                {p.description && <p className="plancard__desc">{p.description}</p>}

                <ul className="plancard__features">
                  {(p.features ?? []).map((f) => (
                    <li key={typeof f === 'string' ? f : f.key}>
                      <Icon name="check" size={14} />
                      {typeof f === 'string' ? f : f.label}
                    </li>
                  ))}
                </ul>

                {isCurrent ? (
                  <button type="button" className="btn btn--ghost btn--block" disabled>
                    {t('billing.currentPlan')}
                  </button>
                ) : (
                  <button
                    type="button"
                    className={`btn btn--block ${p.highlighted ? 'btn--primary' : 'btn--ghost'}`}
                    onClick={() => setConfirming(p)}
                  >
                    {p.price === null || p.price === undefined
                      ? t('billing.contactUs')
                      : t('billing.choosePlan')}
                  </button>
                )}
              </section>
            )
          })}
        </div>
      )}

      {/*
        A confirmation, not a checkout. No card is collected and no payment is
        taken anywhere in this milestone; this records the intent and the
        billing backend completes it later.
      */}
      <Sheet
        open={Boolean(confirming)}
        onClose={() => setConfirming(null)}
        title={t('billing.confirmTitle')}
        actions={
          <>
            <button type="button" className="btn btn--ghost" onClick={() => setConfirming(null)} disabled={busy}>
              {t('common.cancel')}
            </button>
            <button type="button" className="btn btn--primary" onClick={upgrade} disabled={busy}>
              {busy ? t('common.loading') : t('billing.confirmUpgrade')}
            </button>
          </>
        }
      >
        {confirming && (
          <div className="confirmplan">
            <div className="confirmplan__row">
              <span>{t('billing.plan')}</span>
              <strong>{confirming.name ?? t(`billing.plans.${confirming.key}.name`)}</strong>
            </div>
            <div className="confirmplan__row">
              <span>{t('billing.price')}</span>
              <strong className="num">
                {price(confirming)}
                {confirming.interval && confirming.price != null && ` / ${t(`billing.interval.${confirming.interval}`)}`}
              </strong>
            </div>
            {subscription?.status === 'trialing' && (
              <p className="confirmplan__note">{t('billing.trialNote')}</p>
            )}
            <p className="confirmplan__terms">
              <Icon name="info" size={15} />
              {t('billing.confirmTerms')}
            </p>
          </div>
        )}
      </Sheet>
    </Layout>
  )
}
