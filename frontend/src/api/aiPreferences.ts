import { apiFetch } from './client';

export type SavedAIModelPreference = {
  id: number;
  vendor?: string;
  slug: string;
  label: string;
  created_at: string;
};

export type MistralModelPreference = SavedAIModelPreference;

export type AIPersona = {
  id: number;
  name: string;
  prompt_text: string;
  created_at: string;
};

export function fetchMistralModelPreferences(): Promise<MistralModelPreference[]> {
  return apiFetch<MistralModelPreference[]>('/api/account/mistral-model-preferences/');
}

export function fetchSavedAIModelPreferences(): Promise<SavedAIModelPreference[]> {
  return apiFetch<SavedAIModelPreference[]>('/api/account/ai-model-preferences/');
}

export function createSavedAIModelPreference(
  vendor: string,
  slug: string,
  label: string,
): Promise<SavedAIModelPreference> {
  return apiFetch<SavedAIModelPreference>('/api/account/ai-model-preferences/', {
    method: 'POST',
    body: JSON.stringify({ vendor, slug, label }),
  });
}

export function deleteSavedAIModelPreference(id: number): Promise<void> {
  return apiFetch<void>(`/api/account/ai-model-preferences/${id}/`, { method: 'DELETE' });
}

export function createMistralModelPreference(
  slug: string,
  label: string,
): Promise<MistralModelPreference> {
  return apiFetch<MistralModelPreference>('/api/account/mistral-model-preferences/', {
    method: 'POST',
    body: JSON.stringify({ slug, label }),
  });
}

export function deleteMistralModelPreference(id: number): Promise<void> {
  return apiFetch<void>(`/api/account/mistral-model-preferences/${id}/`, { method: 'DELETE' });
}

export function fetchAIPersonas(): Promise<AIPersona[]> {
  return apiFetch<AIPersona[]>('/api/account/ai-personas/');
}

export function createAIPersona(name: string, promptText: string): Promise<AIPersona> {
  return apiFetch<AIPersona>('/api/account/ai-personas/', {
    method: 'POST',
    body: JSON.stringify({ name, prompt_text: promptText }),
  });
}

export function deleteAIPersona(id: number): Promise<void> {
  return apiFetch<void>(`/api/account/ai-personas/${id}/`, { method: 'DELETE' });
}
