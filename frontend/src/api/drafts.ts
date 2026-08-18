import { apiFetch } from './client';
import type { SceneDocument } from './projects';

/**
 * Task 43: typed wrapper for the server-side recovery-draft sync endpoints
 * (`scenes/api.py`'s `DraftDetailView`). Mirrors `projects.ts`'s existing
 * per-resource wrapper conventions — thin functions over `apiFetch`, no
 * extra state here (the sync scheduling itself lives in
 * `../storage/draftServerSync.ts`).
 *
 * A draft is scoped to one (project, caller, browser-tab session) triple —
 * see `session_id` below, which must be the *same* per-tab id
 * `../pages/useDraftAutosave.ts`'s `sessionIdFor` already generates for the
 * local IndexedDB draft, so the two stay describing the same editing
 * session.
 */

export type DraftSyncPayload = {
  draft_json: SceneDocument;
  /** Monotonic per-(project, caller, session) write counter — see
   * `../storage/draftServerSync.ts` for how it's assigned and why. */
  client_seq: number;
};

export type DraftSyncResponse = {
  draft_json: SceneDocument;
  client_seq: number;
  last_autosaved_at: string;
  expires_at: string;
};

export type DraftUpsertResponse = DraftSyncResponse & {
  /** False when the server determined this write was not newer than what
   * it already had stored (an out-of-order/stale sync, or a losing side of
   * a race with another sync for the same session) and therefore ignored
   * it — the rest of the response still reflects the currently-stored
   * (newer) draft. */
  applied: boolean;
};

function draftPath(projectId: string, sessionId: string): string {
  return `/api/projects/${projectId}/draft/${encodeURIComponent(sessionId)}/`;
}

/** Reads the caller's own active server draft for one project/session.
 * Rejects with `ApiError` (status 404) when none exists (never created,
 * already cleared, or past its ~24-hour expiry). */
export function readDraftSync(projectId: string, sessionId: string): Promise<DraftSyncResponse> {
  return apiFetch<DraftSyncResponse>(draftPath(projectId, sessionId));
}

export type UpsertDraftSyncOptions = {
  /** Passed straight through to `fetch` — set by the page-hide path so the
   * browser keeps the request alive past navigation (see
   * `../storage/draftServerSync.ts`'s `syncOnPageHide`). Never set by the
   * periodic/meaningful-action paths. */
  keepalive?: boolean;
  /** Passed straight through to `fetch` — used to bound how long a
   * periodic/meaningful-action sync attempt can hang before it's aborted
   * and treated as a timeout. */
  signal?: AbortSignal;
};

/** Upserts the caller's own draft for one project/session. Never creates,
 * mutates, or advances a `SceneVersion` — see `DraftDetailView.put`'s own
 * docstring in `scenes/api.py`. */
export function upsertDraftSync(
  projectId: string,
  sessionId: string,
  payload: DraftSyncPayload,
  options: UpsertDraftSyncOptions = {},
): Promise<DraftUpsertResponse> {
  return apiFetch<DraftUpsertResponse>(draftPath(projectId, sessionId), {
    method: 'PUT',
    body: JSON.stringify(payload),
    keepalive: options.keepalive,
    signal: options.signal,
  });
}

/** Deletes the caller's own draft for one project/session. Resolves with
 * no value on success (204), including when no draft existed. */
export function deleteDraftSync(projectId: string, sessionId: string): Promise<void> {
  return apiFetch<void>(draftPath(projectId, sessionId), { method: 'DELETE' });
}
