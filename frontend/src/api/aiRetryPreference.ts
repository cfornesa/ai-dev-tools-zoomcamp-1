import { apiFetch } from './client';

export type AIRetryPreference = {
  auto_retry_enabled: boolean;
  max_retries: number;
};

export function fetchAIRetryPreference(): Promise<AIRetryPreference> {
  return apiFetch<AIRetryPreference>('/api/account/ai-retry-preference/');
}

export function updateAIRetryPreference(preference: AIRetryPreference): Promise<AIRetryPreference> {
  return apiFetch<AIRetryPreference>('/api/account/ai-retry-preference/', {
    method: 'PUT',
    body: JSON.stringify(preference),
  });
}
