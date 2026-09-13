import { useEffect, useState } from 'react';
import { Navigate } from 'react-router-dom';

import {
  createBillingCheckout,
  fetchBillingStatus,
  type BillingStatus,
} from '../api/accountBilling';
import { useAuth } from '../auth/useAuth';

function AccountBilling() {
  const auth = useAuth();
  const [billing, setBilling] = useState<BillingStatus | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (auth.status === 'signed-in') {
      fetchBillingStatus()
        .then(setBilling)
        .catch(() => setError('Could not load billing status.'));
    }
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
      {billing && (
        <>
          <p>
            Your current plan: <strong>{billing.plan_key}</strong>
          </p>
          <p>
            Price: {billing.plan.price ?? 'configured plan price'} {billing.plan.currency} /{' '}
            {billing.plan.interval}
          </p>
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
      {error && <p role="alert">{error}</p>}
    </section>
  );
}

export default AccountBilling;
