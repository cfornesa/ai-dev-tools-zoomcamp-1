import { apiFetch } from './client';

export type SiteSettings = {
  site_title: string;
  revision: number;
  cloud_sync_enabled: boolean;
  theme_config?: Record<string, string>;
};

export type Plan = {
  plan_key: string;
  daily_ai_requests: number;
  feature_keys: string[];
  active: boolean;
  paypal_plan_id: string;
  price: string;
  currency: string;
  interval: string;
  revision: number;
  role_key: string | null;
};

export type EntitlementRole = {
  role_key: string;
  label: string;
  description: string;
  capabilities: Record<string, boolean | { enabled: boolean; daily_cap?: number }>;
  active: boolean;
  revision: number;
  plan_keys: string[];
};

export type GlobalCapability = { enabled: boolean; revision: number };

export type CloudRetentionPolicy = {
  deleted_grace_days: number;
  entitlement_grace_days: number;
  disabled_sync_grace_days: number;
  revision: number;
  updated_at: string;
};

export async function fetchSiteSettings(): Promise<SiteSettings> {
  return apiFetch<SiteSettings>('/api/admin/settings/');
}

export async function updateSiteSettings(
  siteTitle: string,
  revision: number,
  themeConfig?: Record<string, string>,
): Promise<SiteSettings> {
  return apiFetch<SiteSettings>('/api/admin/settings/', {
    method: 'PATCH',
    body: JSON.stringify({
      site_title: siteTitle,
      revision,
      ...(themeConfig ? { theme_config: themeConfig } : {}),
    }),
  });
}

export async function fetchPlans(): Promise<Plan[]> {
  return apiFetch<Plan[]>('/api/admin/plans/');
}

export async function fetchRoles(): Promise<EntitlementRole[]> {
  return apiFetch<EntitlementRole[]>('/api/admin/roles/');
}

export async function createRole(
  role: Omit<EntitlementRole, 'revision' | 'plan_keys'>,
): Promise<EntitlementRole> {
  return apiFetch<EntitlementRole>('/api/admin/roles/', {
    method: 'POST',
    body: JSON.stringify(role),
  });
}

export async function updateRole(role: EntitlementRole): Promise<EntitlementRole> {
  return apiFetch<EntitlementRole>(`/api/admin/roles/${encodeURIComponent(role.role_key)}/`, {
    method: 'PATCH',
    body: JSON.stringify(role),
  });
}

export async function fetchGlobalCapabilities(): Promise<Record<string, GlobalCapability>> {
  return apiFetch<Record<string, GlobalCapability>>('/api/admin/global-capabilities/');
}

export async function fetchCloudRetentionPolicy(): Promise<CloudRetentionPolicy> {
  return apiFetch<CloudRetentionPolicy>('/api/admin/cloud-retention/');
}

export async function updateCloudRetentionPolicy(
  policy: CloudRetentionPolicy,
): Promise<CloudRetentionPolicy> {
  return apiFetch<CloudRetentionPolicy>('/api/admin/cloud-retention/', {
    method: 'PATCH',
    body: JSON.stringify(policy),
  });
}

export async function purgeCloudRetention(
  limit = 100,
  confirmRetroactive = false,
): Promise<{
  scanned: number;
  purged_backups: number;
  purged_blobs: number;
  purged_manifests: number;
  retained: number;
  policy_revision: number;
}> {
  return apiFetch('/api/admin/cloud-retention/purge/', {
    method: 'POST',
    body: JSON.stringify({ limit, confirm_retroactive: confirmRetroactive }),
  });
}

export async function updateGlobalCapability(
  capability_key: string,
  enabled: boolean,
  revision: number,
) {
  return apiFetch<{ capability_key: string; enabled: boolean; revision: number }>(
    '/api/admin/global-capabilities/',
    {
      method: 'PATCH',
      body: JSON.stringify({ capability_key, enabled, revision }),
    },
  );
}

export async function updatePlan(
  planKey: string,
  fields: {
    daily_ai_requests: number;
    feature_keys: string[];
    active: boolean;
    paypal_plan_id: string;
    price: string;
    currency: string;
    interval: string;
    revision: number;
    role_key?: string | null;
  },
): Promise<Plan> {
  return apiFetch<Plan>(`/api/admin/plans/?plan_key=${encodeURIComponent(planKey)}`, {
    method: 'PATCH',
    body: JSON.stringify(fields),
  });
}
