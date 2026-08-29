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
  export_attribution: boolean;
  thumbnail_url: string | null;
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

/** Task 49: `visibility` is deliberately excluded — it's no longer a plain
 * metadata field; use `publishProject`/`unpublishProject` instead (see
 * `scenes/serializers.py`'s `ProjectMetadataSerializer` docstring for why
 * the PATCH endpoint itself ignores a `visibility` key rather than
 * applying it). */
export type ProjectMetadataInput = Partial<
  Pick<Project, 'title' | 'description' | 'tags' | 'allow_public_remix' | 'export_attribution'>
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

/** Body shape for a 400 "meaningful content" validation failure on publish
 * (`scenes/api.py`'s `ProjectPublishView`) — field-level, per Task 49's
 * acceptance criteria, never a generic failure. `current_version` is not a
 * form field; it means "save at least one version before publishing." */
export type PublishValidationErrorBody = {
  errors: Record<string, string[]>;
};

/** Task 49: switch a project from private to public. Owner-only (404 for
 * anyone else, matching every other project-scoped endpoint); rejected
 * with field-level `errors` (400) if title/description don't meet the
 * meaningful-content rules, or if the project has no saved version yet.
 * Never reads a request body — there is nothing for a client to submit
 * that could substitute for `project.current_version`. */
export function publishProject(id: string): Promise<Project> {
  return apiFetch<Project>(`/api/projects/${id}/publish/`, { method: 'POST' });
}

/** Task 49: switch a project back to private, immediately. Owner-only;
 * never fails on content — only publishing enforces the meaningful-content
 * rules. Version history is untouched. */
export function unpublishProject(id: string): Promise<Project> {
  return apiFetch<Project>(`/api/projects/${id}/unpublish/`, { method: 'POST' });
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

/** Task 53 (issue #52): "Remixed from [creator]" data for a public gallery
 * card or public project detail page — `null` when the project has no
 * fork provenance at all (not a remix; render nothing for that case, not
 * an empty element). See `scenes/serializers.py`'s `remix_provenance_data`
 * for the full policy this shape follows:
 *
 * - `source_creator` is always present and durable (a live read of the
 *   source project's current owner username — the "snapshot-or-live"
 *   policy is LIVE, so this can change if the creator's username changes,
 *   but is never unavailable, even after the source goes private).
 * - `source_public_id` is the source's id *only when it is currently
 *   public, published, and not deleted* — build a link to `/p/<id>` when
 *   it is non-null, and render plain unlinked text when it is `null`
 *   (private/unpublished/deleted source: durable attribution, no link,
 *   no other private source data exposed).
 * - Nested remixes report the *immediate* fork source, not the root of a
 *   longer chain — see that function's docstring for why. */
export type RemixProvenance = {
  source_creator: string;
  source_public_id: string | null;
};

/** Task 50: one public-gallery card (`PublicProjectListItemSerializer`).
 * Deliberately narrower than `Project` — no `description`, `tags`,
 * `visibility`, `current_version`, or any owner-only field; identical for
 * anonymous and signed-in callers. */
export type PublicGalleryProject = {
  id: string;
  title: string;
  owner: string;
  thumbnail_url: string | null;
  remix_provenance: RemixProvenance | null;
  published_at: string;
};

/** Task 50: one page of the public gallery. `next_cursor` is `null` exactly
 * when `has_more` is `false` — there is no separate "end of results"
 * sentinel to check. */
export type PublicGalleryPage = {
  results: PublicGalleryProject[];
  next_cursor: string | null;
  has_more: boolean;
};

/** Task 50: fetch one page of the public gallery, newest-published-first.
 * Pass the previous page's `next_cursor` to continue a walk — see
 * `scenes/gallery.py`'s module docstring for why this keyset cursor,
 * rather than a page number, is what keeps pagination duplicate/gap-safe
 * if a new project publishes between requests. */
export function listPublicGallery(
  options: { cursor?: string; pageSize?: number } = {},
): Promise<PublicGalleryPage> {
  const params = new URLSearchParams();
  if (options.cursor) params.set('cursor', options.cursor);
  if (options.pageSize) params.set('page_size', String(options.pageSize));
  const query = params.toString();
  return apiFetch<PublicGalleryPage>(`/api/public/projects/${query ? `?${query}` : ''}`);
}

/** Task 51 (issue #53): the *current* saved version of a public project, as
 * returned nested inside `PublicProject` (`PublicSceneVersionSerializer`).
 * Deliberately narrower than `SceneVersion` — no `id`/`origin`/
 * `change_label`/`created_by`/`parent`/`fork_source_version`, none of
 * which is meaningful (or safe) to expose to an anonymous visitor; see
 * that serializer's own docstring in `scenes/serializers.py`. */
export type PublicSceneVersion = {
  sequence: number;
  scene_json: SceneDocument;
  created_at: string;
};

/** Task 51 (issue #53): the single-public-project detail shape
 * (`PublicProjectSerializer`) the public viewer page fetches. Deliberately
 * narrower than `Project` — no `id`-as-pk, `visibility`, or
 * `export_attribution`, and `current_version` is the nested scene
 * snapshot itself (not just an id), so this one response has everything
 * the public viewer needs to render without a second request. */
export type PublicProject = {
  id: string;
  owner: string;
  title: string;
  description: string;
  tags: string[];
  allow_public_remix: boolean;
  thumbnail_url: string | null;
  remix_provenance: RemixProvenance | null;
  current_version: PublicSceneVersion | null;
  created_at: string;
  updated_at: string;
};

/** Task 51 (issue #53): fetch a single public project by its `public_id`,
 * for the public viewer page. 404s (via `ApiError`) identically whether
 * the id never existed or belongs to a project that is not currently
 * `public` — `PublicProjectDetailView` (`scenes/api.py`) never
 * distinguishes the two, so this call site can't either (see that view's
 * own docstring for why that's deliberate: no confirming a private
 * project's existence to an anonymous caller). */
export function getPublicProject(id: string): Promise<PublicProject> {
  return apiFetch<PublicProject>(`/api/public/projects/${id}/`);
}

/** Task 51: atomically fork a public, remix-enabled project's current
 * version into a new private project owned by the caller
 * (`ProjectForkView`, `scenes/api.py`). Requires authentication (a `401`
 * `ApiError` if the caller is signed out); `404`s exactly like every other
 * public/private-boundary check in this app if the source project is
 * private or has remixing turned off, never distinguishing the two.
 *
 * Pass the same `clientRequestId` again to safely retry a failed/uncertain
 * submission (e.g. a double-click) without risking a second fork — same
 * idempotency-key pattern as `createBlankProject`. */
export function forkProject(id: string, clientRequestId?: string): Promise<Project> {
  return apiFetch<Project>(`/api/public/projects/${id}/fork/`, {
    method: 'POST',
    body: JSON.stringify(clientRequestId ? { client_request_id: clientRequestId } : {}),
  });
}

/** Task 18: atomically create a private project with one blank-canvas version.
 * Pass the same `clientRequestId` again to safely retry a failed/uncertain
 * submission without risking a duplicate project.
 *
 * Issue #206: `renderer` chooses the new project's initial scene renderer
 * (`schema/scene.schema.json`'s `renderer.preferred`) -- the only point in
 * this app where a scene's renderer is ever chosen; there is no later
 * "change this scene's renderer" flow. Defaults to `'p5'` when omitted,
 * matching the backend's own default and every pre-#206 caller. */
export function createBlankProject(
  clientRequestId?: string,
  renderer?: 'p5' | 'canvas2d' | 'svg',
): Promise<Project> {
  const body: Record<string, string> = {};
  if (clientRequestId) body.client_request_id = clientRequestId;
  if (renderer) body.renderer = renderer;
  return apiFetch<Project>('/api/projects/blank/', {
    method: 'POST',
    body: JSON.stringify(body),
  });
}
