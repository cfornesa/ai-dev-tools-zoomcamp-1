import { apiFetch } from './client';

export type MistralCredentialStatus = { configured: boolean };

export type ProviderCredentialStatus = {
  vendor: 'mistral' | 'gemini' | 'deepseek';
  label: string;
  implemented: boolean;
  configured: boolean;
};

export type ProviderCredentialStatuses = { providers: ProviderCredentialStatus[] };

export function fetchProviderCredentials(): Promise<ProviderCredentialStatuses> {
  return apiFetch<ProviderCredentialStatuses>('/api/account/provider-credentials/');
}

export function saveProviderCredential(
  vendor: ProviderCredentialStatus['vendor'],
  key: string,
): Promise<Pick<ProviderCredentialStatus, 'vendor' | 'configured'>> {
  return apiFetch<Pick<ProviderCredentialStatus, 'vendor' | 'configured'>>(
    '/api/account/provider-credentials/',
    { method: 'PUT', body: JSON.stringify({ vendor, key }) },
  );
}

export function removeProviderCredential(
  vendor: ProviderCredentialStatus['vendor'],
): Promise<void> {
  return apiFetch<void>(`/api/account/provider-credentials/?vendor=${encodeURIComponent(vendor)}`, {
    method: 'DELETE',
  });
}

export function fetchMistralCredential(): Promise<MistralCredentialStatus> {
  return apiFetch<MistralCredentialStatus>('/api/account/mistral-credential/');
}

export function saveMistralCredential(key: string): Promise<MistralCredentialStatus> {
  return apiFetch<MistralCredentialStatus>('/api/account/mistral-credential/', {
    method: 'PUT',
    body: JSON.stringify({ key }),
  });
}

export function removeMistralCredential(): Promise<void> {
  return apiFetch<void>('/api/account/mistral-credential/', { method: 'DELETE' });
}
