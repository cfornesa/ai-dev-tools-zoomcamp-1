import { apiFetch } from './client';

export type MistralCredentialStatus = { configured: boolean };

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
