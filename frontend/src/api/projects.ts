import { apiFetch } from './client';

export type Visibility = 'private' | 'public';

export type Project = {
  id: string;
  owner: string;
  title: string;
  description: string;
  tags: string[];
  visibility: Visibility;
  allow_public_remix: boolean;
  thumbnail_choice: string;
  export_attribution: boolean;
  current_version: number | null;
  created_at: string;
  updated_at: string;
};

export type ProjectMetadataInput = Partial<
  Pick<
    Project,
    | 'title'
    | 'description'
    | 'tags'
    | 'visibility'
    | 'allow_public_remix'
    | 'thumbnail_choice'
    | 'export_attribution'
  >
>;

export function listProjects(): Promise<Project[]> {
  return apiFetch<Project[]>('/api/projects/');
}

export function getProject(id: string): Promise<Project> {
  return apiFetch<Project>(`/api/projects/${id}/`);
}

export function updateProjectMetadata(id: string, data: ProjectMetadataInput): Promise<Project> {
  return apiFetch<Project>(`/api/projects/${id}/`, {
    method: 'PATCH',
    body: JSON.stringify(data),
  });
}

/** Task 18: atomically create a private project with one blank-canvas version.
 * Pass the same `clientRequestId` again to safely retry a failed/uncertain
 * submission without risking a duplicate project. */
export function createBlankProject(clientRequestId?: string): Promise<Project> {
  return apiFetch<Project>('/api/projects/blank/', {
    method: 'POST',
    body: JSON.stringify(clientRequestId ? { client_request_id: clientRequestId } : {}),
  });
}
