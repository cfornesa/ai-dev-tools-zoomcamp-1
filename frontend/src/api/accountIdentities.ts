import { apiFetch } from './client';

export type AccountIdentity = {
  provider: string;
  enabled: boolean;
  connected_at: string;
};

export type AccountIdentityProvider = {
  provider: string;
  label: string;
  enabled: boolean;
};

export async function fetchAccountIdentities(): Promise<AccountIdentity[]> {
  return apiFetch<AccountIdentity[]>('/api/account/identities/');
}

export async function fetchAccountIdentityProviders(): Promise<AccountIdentityProvider[]> {
  return apiFetch<AccountIdentityProvider[]>('/api/account/identity-providers/');
}

export async function unlinkAccountIdentity(provider: string): Promise<AccountIdentity[]> {
  return apiFetch<AccountIdentity[]>(`/api/account/identities/${encodeURIComponent(provider)}/`, {
    method: 'DELETE',
  });
}

const PROVIDER_LABELS: Record<string, string> = {
  google: 'Google',
  github: 'GitHub',
  linkedin: 'LinkedIn',
};

export function providerLabel(provider: string): string {
  return PROVIDER_LABELS[provider] ?? provider;
}
