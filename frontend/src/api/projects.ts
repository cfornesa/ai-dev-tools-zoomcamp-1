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

/** A scene document is validated against ../../../schema/scene.schema.json
 * (see validation/scene.ts); its exact shape isn't relevant to the API
 * layer, which only ever passes it through untouched. */
export type SceneDocument = Record<string, unknown>;

export type SceneVersion = {
  id: number;
  sequence: number;
  origin: string;
  change_label: string | null;
  created_by: string | null;
  parent: number | null;
  fork_source_version: number | null;
  created_at: string;
  scene_json: SceneDocument;
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

/** Task 21: fetch a single scene version, including its full scene_json,
 * so the editor workspace can load the project's current version into a
 * working copy. */
export function getSceneVersion(projectId: string, versionId: number): Promise<SceneVersion> {
  return apiFetch<SceneVersion>(`/api/projects/${projectId}/versions/${versionId}/`);
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
