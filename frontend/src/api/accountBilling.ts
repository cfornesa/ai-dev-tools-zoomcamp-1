import { apiFetch } from './client';

export type BillingStatus = {
  plan_key: string;
  plan: { price: string | null; currency: string; interval: string };
  subscription: { status: string | null; paid_through: string | null };
  available_plan: {
    plan_key: string;
    paypal_configured: boolean;
    price: string;
    currency: string;
    interval: string;
  } | null;
};

export type BillingCheckout = { checkout_id: number; approval_url: string };

export function fetchBillingStatus(): Promise<BillingStatus> {
  return apiFetch<BillingStatus>('/api/account/billing/');
}

export function createBillingCheckout(planKey: string, idempotencyKey: string) {
  return apiFetch<BillingCheckout>('/api/account/billing/', {
    method: 'POST',
    body: JSON.stringify({ plan_key: planKey, idempotency_key: idempotencyKey }),
  });
}
