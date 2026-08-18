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

/** Task 41: the history-list shape (`SceneVersionListSerializer`) — every
 * `SceneVersion` field except `scene_json`, which the list endpoint omits
 * on purpose (see `scenes/api.py`'s `SceneVersionListCreateView.get`). */
export type SceneVersionSummary = Omit<SceneVersion, 'scene_json'>;

/** Task 41: origins a manual save from the editor may submit. `restore`
 * and `fork` are valid `SceneVersion.Origin` values but are only ever
 * produced server-side by their own dedicated endpoints — sending them
 * here is rejected with a 400 (`scenes/serializers.py`'s
 * `ALLOWED_MANUAL_SAVE_ORIGINS`). */
export type SaveSceneVersionOrigin = 'manual' | 'ai_create' | 'ai_edit';

export type SaveSceneVersionInput = {
  scene_json: SceneDocument;
  origin: SaveSceneVersionOrigin;
  change_label?: string;
};

/** Body shape for a 400 scene-validation failure on save
 * (`scenes/api.py`'s `SceneVersionListCreateView.post`). */
export type SceneValidationErrorBody = {
  errors: Array<{ path: string; rule: string; message: string }>;
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

/** Task 41: history list for a project, newest last (server orders by
 * `sequence` ascending) and excluding soft-deleted versions. */
export function listSceneVersions(projectId: string): Promise<SceneVersionSummary[]> {
  return apiFetch<SceneVersionSummary[]>(`/api/projects/${projectId}/versions/`);
}

/** Task 41: explicit save — submits the working scene and, only if it
 * passes server-side validation, creates exactly one new immutable
 * version and advances the project's current version to it. */
export function saveSceneVersion(
  projectId: string,
  input: SaveSceneVersionInput,
): Promise<SceneVersion> {
  return apiFetch<SceneVersion>(`/api/projects/${projectId}/versions/`, {
    method: 'POST',
    body: JSON.stringify(input),
  });
}

/** Task 41: restore a historical version — creates a brand-new latest
 * version copied from it; the historical version itself is never mutated. */
export function restoreSceneVersion(projectId: string, versionId: number): Promise<SceneVersion> {
  return apiFetch<SceneVersion>(`/api/projects/${projectId}/versions/${versionId}/restore/`, {
    method: 'POST',
  });
}

/** Task 41: soft-delete an eligible (non-current) version. Resolves with
 * no value on success (204 No Content). */
export function deleteSceneVersion(projectId: string, versionId: number): Promise<void> {
  return apiFetch<void>(`/api/projects/${projectId}/versions/${versionId}/`, {
    method: 'DELETE',
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
