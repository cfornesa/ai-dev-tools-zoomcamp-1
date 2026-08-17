import { apiFetch } from './client';
import type { Project } from './projects';

export type Template = {
  id: string;
  source_type: 'built_in' | 'private';
  owner: string | null;
  name: string;
  category: string;
  description: string;
  created_at: string;
};

export function listTemplates(): Promise<Template[]> {
  return apiFetch<Template[]>('/api/templates/');
}

/** Task 20: atomically clone a template's scene into a new private project. */
export function cloneTemplate(id: string): Promise<Project> {
  return apiFetch<Project>(`/api/templates/${id}/clone/`, { method: 'POST' });
}
