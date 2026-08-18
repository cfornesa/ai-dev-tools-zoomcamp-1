/**
 * Task 46-48: typed fetch wrappers for the AI create/edit/accept endpoints
 * (`scenes/ai_api.py`). `createAIScene`/`editAIScene` only ever return an
 * unsaved draft proposal — neither one ever creates a `SceneVersion` or
 * touches `Project.current_version` server-side (see that module's
 * docstring) — `acceptAIProposal` (Task 48) is the one call that does.
 *
 * Every function accepts an optional `AbortSignal` so a caller (Task 48's
 * `useAIProposal`) can cancel an in-flight request — e.g. the user closes
 * the AI panel, navigates away, or fires a new request before the last one
 * resolved — and have `fetch` itself reject with an `AbortError` rather
 * than letting a stale response silently land later.
 */
import { apiFetch } from './client';
import type { SceneDocument, SceneVersion } from './projects';

export type AIUsage = {
  prompt_tokens: number;
  completion_tokens: number;
  total_tokens: number;
  estimated_cost_usd: number;
};

export type AICreateSceneResponse = {
  draft: true;
  operation: string;
  scene: SceneDocument;
  usage: AIUsage;
};

export type AIEditSceneResponse = {
  draft: true;
  operation: string;
  /** RFC 6902 JSON Patch describing what changed — shown as part of the
   * proposal preview's change summary, never applied client-side (the
   * server already applied it to produce `scene`). */
  patch: unknown;
  scene: SceneDocument;
  /** A concise, deterministic, human-readable description of the change —
   * `AIProposalPanel`'s success-state summary text. */
  change_summary: string;
  usage: AIUsage;
};

/** Every distinct `error` code any of the three AI endpoints can return —
 * see `scenes/ai_api.py`'s failure-taxonomy tables. Kept as one union
 * (rather than per-endpoint unions) since `useAIProposal` classifies all
 * three response shapes through the same logic. */
export type AIErrorCode =
  | 'prompt_invalid'
  | 'rate_limited'
  | 'quota_exceeded'
  | 'provider_quota_exceeded'
  | 'timeout'
  | 'cancelled'
  | 'response_too_large'
  | 'provider_failure'
  | 'invalid_structured_output'
  | 'current_scene_invalid'
  | 'stale_base'
  | 'empty_patch'
  | 'protected_field'
  | 'invalid_patch_path'
  | 'malformed_patch'
  | 'oversized_patch'
  | 'patch_apply_failed'
  | 'request_invalid';

export type AIErrorBody = {
  error: AIErrorCode;
  detail: unknown;
};

export function createAIScene(
  projectId: string,
  prompt: string,
  signal?: AbortSignal,
): Promise<AICreateSceneResponse> {
  return apiFetch<AICreateSceneResponse>(`/api/projects/${projectId}/ai/create-scene/`, {
    method: 'POST',
    body: JSON.stringify({ prompt }),
    signal,
  });
}

export function editAIScene(
  projectId: string,
  prompt: string,
  currentScene: SceneDocument,
  baseVersionId: number | null,
  signal?: AbortSignal,
): Promise<AIEditSceneResponse> {
  return apiFetch<AIEditSceneResponse>(`/api/projects/${projectId}/ai/edit-scene/`, {
    method: 'POST',
    body: JSON.stringify({
      prompt,
      current_scene: currentScene,
      base_version_id: baseVersionId,
    }),
    signal,
  });
}

export type AcceptAIProposalInput = {
  operation: 'ai_create' | 'ai_edit';
  scene_json: SceneDocument;
  base_version_id: number | null;
  change_label?: string;
  /** A UUID generated once per proposal (not per Accept click) — see
   * `scenes/ai_api.py`'s `AIAcceptProposalView` docstring for why reusing
   * the same id across retries of the same proposal is what makes a
   * repeated/replayed Accept resolve to exactly one version. */
  client_request_id: string;
};

/** Task 48: the one call that actually persists an AI proposal — creates
 * exactly one new immutable `SceneVersion` (origin `ai_create`/`ai_edit`)
 * and advances the project's current version. Returns 201 on a fresh
 * accept, or 200 with the same already-created version on an idempotent
 * replay (same `client_request_id`) — both resolve this promise
 * successfully; only a genuine failure (validation, stale base, auth)
 * rejects it. */
export function acceptAIProposal(
  projectId: string,
  input: AcceptAIProposalInput,
  signal?: AbortSignal,
): Promise<SceneVersion> {
  return apiFetch<SceneVersion>(`/api/projects/${projectId}/ai/accept-proposal/`, {
    method: 'POST',
    body: JSON.stringify(input),
    signal,
  });
}
