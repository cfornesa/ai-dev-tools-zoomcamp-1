import { useEffect, useState } from 'react';
import { Navigate } from 'react-router-dom';

import {
  createBillingCheckout,
  fetchBillingStatus,
  type BillingStatus,
} from '../api/accountBilling';
import { useAuth } from '../auth/useAuth';

const BILLING_STATUS_POLL_MS = 5000;
const MAX_BILLING_STATUS_POLLS = 12;

function hasPayPalApprovalReturn() {
  const params = new URLSearchParams(window.location.search);
  return params.has('subscription_id') || params.has('ba_token');
}

function isActivePaidBilling(billing: BillingStatus) {
  return billing.plan_key !== 'free' && billing.subscription.status === 'active';
}

function AccountBilling() {
  const auth = useAuth();
  const [billing, setBilling] = useState<BillingStatus | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [awaitingPayPalWebhook, setAwaitingPayPalWebhook] = useState(hasPayPalApprovalReturn);
  const [billingPollTimedOut, setBillingPollTimedOut] = useState(false);

  useEffect(() => {
    if (auth.status !== 'signed-in') return;

    let cancelled = false;
    let pollCount = 0;
    let timer: number | undefined;

    async function loadBillingStatus() {
      try {
        const next = await fetchBillingStatus();
        if (cancelled) return;
        setBilling(next);
        setError(null);

        if (hasPayPalApprovalReturn() && !isActivePaidBilling(next)) {
          if (pollCount < MAX_BILLING_STATUS_POLLS) {
            pollCount += 1;
            timer = window.setTimeout(() => void loadBillingStatus(), BILLING_STATUS_POLL_MS);
          } else {
            setAwaitingPayPalWebhook(false);
            setBillingPollTimedOut(true);
          }
          return;
        }

        setAwaitingPayPalWebhook(false);
        setBillingPollTimedOut(false);
        if (hasPayPalApprovalReturn()) {
          window.history.replaceState({}, document.title, window.location.pathname);
        }
      } catch {
        if (cancelled) return;
        setError('Could not load billing status. Please try again.');
        if (hasPayPalApprovalReturn() && pollCount < MAX_BILLING_STATUS_POLLS) {
          pollCount += 1;
          timer = window.setTimeout(() => void loadBillingStatus(), BILLING_STATUS_POLL_MS);
        } else {
          setAwaitingPayPalWebhook(false);
          setBillingPollTimedOut(true);
        }
      }
    }

    void loadBillingStatus();
    return () => {
      cancelled = true;
      if (timer !== undefined) window.clearTimeout(timer);
    };
  }, [auth.status]);

  if (auth.status === 'loading') return null;
  if (auth.status !== 'signed-in') return <Navigate to="/" replace />;

  async function startCheckout() {
    if (!billing?.available_plan || !billing.available_plan.paypal_configured) return;
    setBusy(true);
    setError(null);
    try {
      const checkout = await createBillingCheckout(
        billing.available_plan.plan_key,
        crypto.randomUUID(),
      );
      window.location.assign(checkout.approval_url);
    } catch {
      setError('Could not start PayPal checkout. Please try again.');
      setBusy(false);
    }
  }

  return (
    <section className="content-panel account-billing">
      <h2>Billing</h2>
      {!billing && !error && <p role="status">Loading billing status…</p>}
      {awaitingPayPalWebhook && (
        <p role="status" aria-live="polite" data-testid="paypal-pending-status">
          PayPal approved your subscription. Confirmation can take a few minutes while the payment
          webhook updates your plan. This page will refresh automatically.
        </p>
      )}
      {billing && (
        <>
          <p>
            Your current plan: <strong>{billing.plan_key}</strong>
          </p>
          <p>
            Price: {billing.plan.price ?? 'configured plan price'} {billing.plan.currency} /{' '}
            {billing.plan.interval}
          </p>
          {billing.available_plan && (
            <p>
              Available {billing.available_plan.plan_key} plan: {billing.available_plan.price}{' '}
              {billing.available_plan.currency} / {billing.available_plan.interval}
            </p>
          )}
          <p>Subscription status: {billing.subscription.status ?? 'not started'}</p>
          {billing.available_plan?.paypal_configured && (
            <button
              type="button"
              className="shell-action"
              onClick={() => void startCheckout()}
              disabled={busy}
            >
              {busy ? 'Opening PayPal…' : 'Subscribe with PayPal'}
            </button>
          )}
        </>
      )}
      {billingPollTimedOut && (
        <p role="status" aria-live="polite">
          Your PayPal approval is still being confirmed. Refresh this page in a few minutes to check
          the latest subscription status.
        </p>
      )}
      {error && <p role="alert">{error}</p>}
    </section>
  );
}

export default AccountBilling;
