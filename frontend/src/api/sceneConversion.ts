/**
 * Issue #528: typed fetch wrappers for the AI-assisted 2D-to-3D scene
 * conversion run endpoints (`scenes/scene_conversion_api.py`) — the
 * conversion-only counterpart of `aiRuns.ts`'s bounded run wrappers.
 * `startSceneConversion` creates a server-owned run against an existing 2D
 * project; `advanceSceneConversion` performs at most one provider call per
 * invocation (the caller drives the loop, mirroring `useAIRun.ts`);
 * `getSceneConversion` never triggers a provider call; `cancelSceneConversion`/
 * `acceptSceneConversion` mirror the run's own `cancel_conversion`/
 * `accept_conversion` semantics — Accept creates a brand-new 3D project
 * rather than mutating an existing one, so its response carries
 * `accepted_project3d_id` instead of `AIRun`'s in-place `accepted_version_id`.
 */
import { apiFetch } from './client';
import type { SceneDocument } from './projects';

export type SceneConversionStatus =
  'running' | 'awaiting_review' | 'accepted' | 'cancelled' | 'failed' | 'expired';

export type SceneConversionUsage = {
  prompt_tokens: number;
  completion_tokens: number;
  estimated_cost_usd: number;
};

export type SceneConversionRun = {
  id: number;
  status: SceneConversionStatus;
  source_project_id: string;
  source_version_id: number;
  attempts: number;
  repairs: number;
  candidate_scene: Record<string, unknown> | null;
  unsupported_shape_types: string[];
  plan_summary: string;
  validation_summary: string;
  error_reason: string;
  usage: SceneConversionUsage;
  accepted_project3d_id: string | null;
  accepted_version_id: number | null;
  created_at: string;
  updated_at: string;
  deadline_at: string;
  cancelled_at: string | null;
};

/** Every distinct `error` code any `/api/scene-conversions/...` endpoint can
 * return -- see `scenes/scene_conversion_api.py`'s `_ERROR_STATUS` table. */
export type SceneConversionErrorCode =
  | 'not_found'
  | 'quota_exceeded'
  | 'rate_limited'
  | 'missing_credential'
  | 'invalid_target'
  | 'agentic_not_supported'
  | 'not_running'
  | 'advance_in_progress'
  | 'not_awaiting_review'
  | 'stale_base'
  | 'request_invalid'
  | 'scene_conversion_error';

export type SceneConversionErrorBody = { error: SceneConversionErrorCode; detail: unknown };

export type StartSceneConversionInput = {
  project_id: string;
  prompt?: string;
  vendor?: 'mistral' | 'gemini' | 'deepseek';
  model?: string;
  /** A UUID generated once per user gesture -- a repeated start with the
   * same id resolves to the same existing run, mirroring `useAIRun.ts`'s
   * `start_request_id` convention. */
  start_request_id?: string;
};

export function startSceneConversion(
  input: StartSceneConversionInput,
  signal?: AbortSignal,
): Promise<SceneConversionRun> {
  return apiFetch<SceneConversionRun>('/api/scene-conversions/', {
    method: 'POST',
    body: JSON.stringify(input),
    signal,
  });
}

export function getSceneConversion(id: number, signal?: AbortSignal): Promise<SceneConversionRun> {
  return apiFetch<SceneConversionRun>(`/api/scene-conversions/${id}/`, { signal });
}

export function advanceSceneConversion(
  id: number,
  signal?: AbortSignal,
): Promise<SceneConversionRun> {
  return apiFetch<SceneConversionRun>(`/api/scene-conversions/${id}/advance/`, {
    method: 'POST',
    signal,
  });
}

export function cancelSceneConversion(
  id: number,
  signal?: AbortSignal,
): Promise<SceneConversionRun> {
  return apiFetch<SceneConversionRun>(`/api/scene-conversions/${id}/cancel/`, {
    method: 'POST',
    signal,
  });
}

export function acceptSceneConversion(
  id: number,
  signal?: AbortSignal,
): Promise<SceneConversionRun> {
  return apiFetch<SceneConversionRun>(`/api/scene-conversions/${id}/accept/`, {
    method: 'POST',
    signal,
  });
}

/** Narrows `SceneConversionRun.candidate_scene`/other loosely-typed reads to
 * the shape callers (e.g. `Scene3DPreview`) expect -- exactly as loose as
 * `SceneDocument` itself (`Record<string, unknown>`), just named for this
 * call site's own clarity. */
export type SceneConversionCandidate = SceneDocument;
