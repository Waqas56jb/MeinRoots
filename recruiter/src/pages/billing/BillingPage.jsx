import { useState } from 'react'
import { Link } from 'react-router-dom'
import Layout from '../../components/Layout.jsx'
import Icon from '../../components/Icon.jsx'
import { Badge, EmptyState, ErrorState, Panel, PendingState, Sheet, Skeleton } from '../../components/ui.jsx'
import { isNotImplemented } from '../../lib/api.js'
import { useResource } from '../../hooks/useResource.js'
import { billingApi } from '../../services/index.js'
import { useI18n } from '../../context/I18nContext.jsx'
import { useAccount } from '../../context/AccountContext.jsx'
import { useToast } from '../../context/ToastContext.jsx'

const STATUS_TONE = {
  trialing: 'info', active: 'good', past_due: 'warn', cancelled: 'neutral', expired: 'bad',
}

/** The current subscription, and the invoices behind it. */
export default function BillingPage() {
  const { t, locale } = useI18n()
  const toast = useToast()
  const { reload: reloadAccount } = useAccount()

  const sub = useResource(() => billingApi.subscription(), [])
  const invoices = useResource(() => billingApi.invoices(), [])

  const [cancelling, setCancelling] = useState(false)
  const [busy, setBusy] = useState(false)

  const s = sub.data?.subscription ?? sub.data ?? null
  const date = (v) => (v ? new Intl.DateTimeFormat(locale, { dateStyle: 'long' }).format(new Date(v)) : '—')

  const money = (amount, currency) =>
    amount === null || amount === undefined
      ? '—'
      : new Intl.NumberFormat(locale, { style: 'currency', currency: currency ?? 'EUR' }).format(amount)

  const cancel = async () => {
    setBusy(true)
    try {
      await billingApi.cancel()
      toast.success(t('billing.cancelRequested'))
      setCancelling(false)
      await Promise.all([sub.reload(), reloadAccount()])
    } catch (err) {
      toast.error(isNotImplemented(err) ? t('billing.pendingCancel') : t('billing.cancelFailed'))
    } finally {
      setBusy(false)
    }
  }

  return (
    <Layout
      title={t('billing.title')}
      subtitle={t('billing.subtitle')}
      actions={
        <Link to="/plans" className="btn btn--ghost btn--sm">
          {t('billing.viewPlans')} <Icon name="arrowRight" size={14} />
        </Link>
      }
    >
      <Panel icon="card" title={t('billing.current')}>
        {sub.loading ? (
          <Skeleton variant="rows" rows={3} />
        ) : sub.pending ? (
          <PendingState endpoint="GET /api/recruiter/subscription" />
        ) : sub.error ? (
          <ErrorState message={t('billing.loadError')} onRetry={sub.reload} />
        ) : !s ? (
          <EmptyState icon="card" title={t('billing.noSubscription')} text={t('billing.noSubscriptionText')} />
        ) : (
          <>
            <dl className="billfacts">
              <div>
                <dt>{t('billing.plan')}</dt>
                <dd><strong>{t(`billing.plans.${s.plan}.name`)}</strong></dd>
              </div>
              <div>
                <dt>{t('billing.statusLabel')}</dt>
                <dd><Badge tone={STATUS_TONE[s.status] ?? 'neutral'}>{t(`billing.status.${s.status}`)}</Badge></dd>
              </div>
              <div>
                <dt>{t('billing.price')}</dt>
                <dd className="num">
                  {money(s.price, s.currency)}
                  {s.interval && s.price != null && ` / ${t(`billing.interval.${s.interval}`)}`}
                </dd>
              </div>
              {s.status === 'trialing' && (
                <div>
                  <dt>{t('billing.trialEndsLabel')}</dt>
                  <dd>{date(s.trialEndsAt)}</dd>
                </div>
              )}
              {s.renewsAt && (
                <div>
                  <dt>{t('billing.renews')}</dt>
                  <dd>{date(s.renewsAt)}</dd>
                </div>
              )}
              {s.cancelledAt && (
                <div>
                  <dt>{t('billing.cancelled')}</dt>
                  <dd>{date(s.cancelledAt)}</dd>
                </div>
              )}
            </dl>

            {/* Cancellation is stated where it can be found, not hidden. */}
            {s.status !== 'cancelled' && (
              <div className="billfoot">
                <p className="muted small">{t('billing.cancelHint')}</p>
                <button type="button" className="btn btn--ghost btn--sm" onClick={() => setCancelling(true)}>
                  {t('billing.cancelPlan')}
                </button>
              </div>
            )}
          </>
        )}
      </Panel>

      <Panel icon="file" title={t('billing.invoices')}>
        {invoices.loading ? (
          <Skeleton variant="rows" rows={3} />
        ) : invoices.pending ? (
          <PendingState endpoint="GET /api/recruiter/invoices" />
        ) : invoices.error ? (
          <ErrorState message={t('billing.invoicesError')} onRetry={invoices.reload} />
        ) : !(invoices.data?.invoices ?? []).length ? (
          <EmptyState icon="file" title={t('billing.noInvoices')} text={t('billing.noInvoicesText')} />
        ) : (
          <ul className="invoicelist">
            {invoices.data.invoices.map((inv) => (
              <li key={inv.id}>
                <span className="invoicelist__date">{date(inv.issuedAt)}</span>
                <span className="invoicelist__amount num">{money(inv.amount, inv.currency)}</span>
                <Badge tone={inv.status === 'paid' ? 'good' : 'warn'}>{t(`billing.invoiceStatus.${inv.status}`)}</Badge>
                {inv.url && (
                  <a className="btn btn--ghost btn--sm" href={inv.url} target="_blank" rel="noreferrer">
                    <Icon name="download" size={15} /> {t('billing.download')}
                  </a>
                )}
              </li>
            ))}
          </ul>
        )}
      </Panel>

      <Sheet
        open={cancelling}
        onClose={() => setCancelling(false)}
        title={t('billing.cancelTitle')}
        actions={
          <>
            <button type="button" className="btn btn--ghost" onClick={() => setCancelling(false)} disabled={busy}>
              {t('billing.keepPlan')}
            </button>
            <button type="button" className="btn btn--danger" onClick={cancel} disabled={busy}>
              {busy ? t('common.loading') : t('billing.confirmCancel')}
            </button>
          </>
        }
      >
        <p>{t('billing.cancelText')}</p>
        {s?.renewsAt && <p className="muted small">{t('billing.cancelUntil', { date: date(s.renewsAt) })}</p>}
      </Sheet>
    </Layout>
  )
}
