import { apiFetch } from './client';

/** A `scene3d` document is validated against
 * ../../../schema/scene3d.schema.json (see validation/scene3d.ts); its
 * exact shape isn't relevant to the API layer, which only ever passes it
 * through untouched. Genuinely separate from the 2D `SceneDocument`
 * (`api/projects.ts`) per issue #208's decision. */
export type SceneDocument3D = Record<string, unknown>;

export type SceneVersion3D = {
  id: number;
  sequence: number;
  origin: string;
  scene_json: SceneDocument3D;
  created_by: string | null;
  created_at: string;
};

/** Mirrors `scenes/serializers.py`'s `Project3DSerializer` -- deliberately
 * smaller than the 2D `Project` type (issue #212 deferred
 * visibility/description/tags; there is no metadata-update endpoint yet).
 * `current_version` is the full nested version object (unlike 2D
 * `Project.current_version`, which is a bare id) -- matches the server
 * shape exactly. */
export type Project3D = {
  id: string;
  owner: string;
  title: string;
  current_version: SceneVersion3D | null;
  created_at: string;
  updated_at: string;
};

/** Issue #213: creation has no request body (no client_request_id/renderer
 * concept yet, unlike the 2D `createBlankProject`) -- see
 * `scenes/api.py`'s `Project3DListCreateView.post` docstring for why. */
export function createProject3D(): Promise<Project3D> {
  return apiFetch<Project3D>('/api/projects3d/', { method: 'POST' });
}

export function listProjects3D(): Promise<Project3D[]> {
  return apiFetch<Project3D[]>('/api/projects3d/');
}

export function getProject3D(id: string): Promise<Project3D> {
  return apiFetch<Project3D>(`/api/projects3d/${id}/`);
}

/** Issue #228: save a new current version. */
export function saveSceneVersion3D(
  projectId: string,
  sceneJson: SceneDocument3D,
): Promise<SceneVersion3D> {
  return apiFetch<SceneVersion3D>(`/api/projects3d/${projectId}/versions/`, {
    method: 'POST',
    body: JSON.stringify({ scene_json: sceneJson }),
  });
}
