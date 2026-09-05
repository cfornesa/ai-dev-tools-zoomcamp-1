import { apiFetch } from './client';

export type FeatureUsage = {
  feature: string;
  cap: number;
  used: number;
  remaining: number;
};

export type AccountEntitlementSummary = {
  plan_key: string;
  features: FeatureUsage[];
  reset_at: string;
};

export async function fetchAccountEntitlements(): Promise<AccountEntitlementSummary> {
  return apiFetch<AccountEntitlementSummary>('/api/account/entitlements/');
}

const FEATURE_LABELS: Record<string, string> = {
  ai_scene_create: 'AI scene creation',
  ai_scene_edit: 'AI scene editing',
  ai_art_generate: 'AI art generation',
};

export function featureLabel(feature: string): string {
  return FEATURE_LABELS[feature] ?? feature;
}
