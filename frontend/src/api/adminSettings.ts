import { apiFetch } from './client';

export type SiteSettings = {
  site_title: string;
  revision: number;
};

export type Plan = {
  plan_key: string;
  daily_ai_requests: number;
  feature_keys: string[];
  active: boolean;
  paypal_plan_id: string;
  revision: number;
};

export async function fetchSiteSettings(): Promise<SiteSettings> {
  return apiFetch<SiteSettings>('/api/admin/settings/');
}

export async function updateSiteSettings(
  siteTitle: string,
  revision: number,
): Promise<SiteSettings> {
  return apiFetch<SiteSettings>('/api/admin/settings/', {
    method: 'PATCH',
    body: JSON.stringify({ site_title: siteTitle, revision }),
  });
}

export async function fetchPlans(): Promise<Plan[]> {
  return apiFetch<Plan[]>('/api/admin/plans/');
}

export async function updatePlan(
  planKey: string,
  fields: {
    daily_ai_requests: number;
    feature_keys: string[];
    active: boolean;
    paypal_plan_id: string;
    revision: number;
  },
): Promise<Plan> {
  return apiFetch<Plan>(`/api/admin/plans/?plan_key=${encodeURIComponent(planKey)}`, {
    method: 'PATCH',
    body: JSON.stringify(fields),
  });
}
