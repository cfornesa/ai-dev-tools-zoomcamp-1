/**
 * Issue #462: typed fetch wrappers for the persisted plan-validate-revise
 * AI run endpoints (`scenes/ai_runs_api.py`, issue #461) — the counterpart
 * of `ai.ts`'s one-shot create/edit/accept wrappers. `startAIRun` creates a
 * server-owned run; `advanceAIRun` performs at most one provider call per
 * invocation (the caller is responsible for calling it repeatedly, e.g.
 * `useAIRun.ts`'s loop, until the run reaches a terminal-for-review or
 * terminal state); `getAIRun` never triggers a provider call (safe to poll
 * on reload); `cancelAIRun`/`acceptAIRun` mirror the run's own
 * `cancel_run`/`accept_run` semantics.
 */
import { apiFetch } from './client';
import type { SceneDocument } from './projects';

export type AIRunTargetType = 'project' | 'project3d';
export type AIRunOperation = 'create' | 'edit_patch';
export type AIRunScope = 'whole_scene' | 'selection';
export type AIRunStatus =
  'running' | 'awaiting_review' | 'accepted' | 'cancelled' | 'failed' | 'expired';

export type AIRunUsage = {
  prompt_tokens: number;
  completion_tokens: number;
  estimated_cost_usd: number;
};

export type AIRun = {
  id: number;
  status: AIRunStatus;
  target_type: AIRunTargetType;
  project_id: string | null;
  project3d_id: string | null;
  operation: AIRunOperation;
  scope: AIRunScope;
  selected_target_ids: string[];
  attempts: number;
  repairs: number;
  candidate_scene: SceneDocument | null;
  candidate_patch: unknown | null;
  change_summary: string;
  plan_summary: string;
  validation_summary: string;
  error_reason: string;
  usage: AIRunUsage;
  accepted_version_id: number | null;
  created_at: string;
  updated_at: string;
  deadline_at: string;
  cancelled_at: string | null;
};

/** Every distinct `error` code any `/api/ai/runs/...` endpoint can return —
 * see `scenes/ai_runs_api.py`'s `_ERROR_STATUS` table. */
export type AIRunErrorCode =
  | 'not_found'
  | 'quota_exceeded'
  | 'rate_limited'
  | 'missing_credential'
  | 'invalid_target'
  | 'not_running'
  | 'advance_in_progress'
  | 'not_awaiting_review'
  | 'stale_base'
  | 'request_invalid'
  | 'ai_run_error';

export type AIRunErrorBody = { error: AIRunErrorCode; detail: unknown };

export type StartAIRunInput = {
  target_type: AIRunTargetType;
  project_id?: string;
  project3d_id?: string;
  operation: AIRunOperation;
  scope?: AIRunScope;
  selected_target_ids?: string[];
  prompt: string;
  vendor?: 'mistral' | 'gemini' | 'deepseek';
  model?: string;
  persona_id?: number;
  /** Issue #461's `start_request_id`: a UUID generated once per user
   * gesture (not per retry) — a repeated start with the same id resolves
   * to the same existing run rather than creating a second one, matching
   * `useAIProposal.ts`'s `clientRequestId` convention for Accept. */
  start_request_id?: string;
};

export function startAIRun(input: StartAIRunInput, signal?: AbortSignal): Promise<AIRun> {
  return apiFetch<AIRun>('/api/ai/runs/', {
    method: 'POST',
    body: JSON.stringify(input),
    signal,
  });
}

export function getAIRun(id: number, signal?: AbortSignal): Promise<AIRun> {
  return apiFetch<AIRun>(`/api/ai/runs/${id}/`, { signal });
}

export function advanceAIRun(id: number, signal?: AbortSignal): Promise<AIRun> {
  return apiFetch<AIRun>(`/api/ai/runs/${id}/advance/`, { method: 'POST', signal });
}

export function cancelAIRun(id: number, signal?: AbortSignal): Promise<AIRun> {
  return apiFetch<AIRun>(`/api/ai/runs/${id}/cancel/`, { method: 'POST', signal });
}

export function acceptAIRun(id: number, signal?: AbortSignal): Promise<AIRun> {
  return apiFetch<AIRun>(`/api/ai/runs/${id}/accept/`, { method: 'POST', signal });
}
