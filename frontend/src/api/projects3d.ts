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

/** Issue #296: mirrors `scenes/models.py`'s `Project3D.Visibility`. */
export type Project3DVisibility = 'private' | 'public';

/** Mirrors `scenes/serializers.py`'s `Project3DSerializer` -- still
 * smaller than the 2D `Project` type (issue #212 deferred
 * description/tags/remix; there is no metadata-update endpoint yet).
 * `current_version` is the full nested version object (unlike 2D
 * `Project.current_version`, which is a bare id) -- matches the server
 * shape exactly. */
export type Project3D = {
  id: string;
  owner: string;
  title: string;
  /** Issue #296: private by default; see `publishProject3D`/`unpublishProject3D`. */
  visibility: Project3DVisibility;
  /** Issue #243: gallery-card thumbnail URL, mirroring 2D `Project.thumbnail_url`. */
  thumbnail_url: string | null;
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

/** Issue #242: owner-only soft-delete, mirroring the 2D
 * `Project.is_deleted`/`deleted_at` behavior (`scenes/api.py`'s
 * `ProjectDetailView.delete`) -- 204 on success. */
export function deleteProject3D(id: string): Promise<void> {
  return apiFetch<void>(`/api/projects3d/${id}/`, { method: 'DELETE' });
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

/** Issue #296: switch a project from private to public -- owner-only;
 * mirrors the 2D `publishProject`. Rejects with an `ApiError` (`status`
 * 400, `body.errors` field-level) if the title is still the untouched
 * "Untitled 3D scene" placeholder, or if there's no saved version yet. */
export function publishProject3D(id: string): Promise<Project3D> {
  return apiFetch<Project3D>(`/api/projects3d/${id}/publish/`, { method: 'POST' });
}

/** Issue #296: switch a project back to private, immediately -- owner-only;
 * mirrors the 2D `unpublishProject`. Never fails on content. */
export function unpublishProject3D(id: string): Promise<Project3D> {
  return apiFetch<Project3D>(`/api/projects3d/${id}/unpublish/`, { method: 'POST' });
}

/** Issue #296: mirrors the 2D `PublicProject` type -- deliberately smaller
 * (no `remix_provenance`: Project3D has no fork/remix capability). */
export type PublicProject3D = {
  id: string;
  owner: string;
  title: string;
  thumbnail_url: string | null;
  current_version: SceneVersion3D | null;
  created_at: string;
  updated_at: string;
};

/** Issue #296: anonymous-reachable read of a *published* Project3D --
 * mirrors the 2D `getPublicProject`. 404s (as an `ApiError`) for a
 * private/unpublished/deleted/nonexistent project, indistinguishably. */
export function getPublicProject3D(id: string): Promise<PublicProject3D> {
  return apiFetch<PublicProject3D>(`/api/public/projects3d/${id}/`);
}
