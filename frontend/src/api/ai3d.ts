/**
 * Issue #232: typed fetch wrappers for the 3D AI create/edit/accept
 * endpoints (`scenes/ai_api3d.py`). Mirrors `api/ai.ts`'s shape exactly,
 * targeting the `scene3d` document family instead -- see that file's own
 * docstring for the shared draft-vs-persist contract (create/edit never
 * persist; accept is the one call that does).
 */
import { apiFetch } from './client';
import type { AIErrorCode, AIUsage } from './ai';
import type { SceneDocument3D, SceneVersion3D } from './projects3d';

export type AICreateScene3DResponse = {
  draft: true;
  operation: string;
  scene: SceneDocument3D;
  usage: AIUsage;
};

export type AIEditScene3DResponse = {
  draft: true;
  operation: string;
  patch: unknown;
  scene: SceneDocument3D;
  change_summary: string;
  usage: AIUsage;
};

export type AIErrorBody3D = {
  error: AIErrorCode;
  detail: unknown;
};

export function createAIScene3D(
  projectId: string,
  prompt: string,
  signal?: AbortSignal,
  model?: string,
  personaId?: number,
  vendor?: 'mistral' | 'gemini' | 'deepseek',
): Promise<AICreateScene3DResponse> {
  return apiFetch<AICreateScene3DResponse>(`/api/projects3d/${projectId}/ai/create-scene/`, {
    method: 'POST',
    body: JSON.stringify({
      prompt,
      ...(model ? { model } : {}),
      ...(personaId ? { persona_id: personaId } : {}),
      ...(vendor && vendor !== 'mistral' ? { vendor } : {}),
    }),
    signal,
  });
}

export function editAIScene3D(
  projectId: string,
  prompt: string,
  currentScene: SceneDocument3D,
  baseVersionId: number | null,
  signal?: AbortSignal,
  model?: string,
  personaId?: number,
  vendor?: 'mistral' | 'gemini' | 'deepseek',
): Promise<AIEditScene3DResponse> {
  return apiFetch<AIEditScene3DResponse>(`/api/projects3d/${projectId}/ai/edit-scene/`, {
    method: 'POST',
    body: JSON.stringify({
      prompt,
      current_scene: currentScene,
      base_version_id: baseVersionId,
      ...(model ? { model } : {}),
      ...(personaId ? { persona_id: personaId } : {}),
      ...(vendor && vendor !== 'mistral' ? { vendor } : {}),
    }),
    signal,
  });
}

export type AcceptAIProposal3DInput = {
  operation: 'ai_create' | 'ai_edit';
  scene_json: SceneDocument3D;
  base_version_id: number | null;
  client_request_id: string;
};

export function acceptAIProposal3D(
  projectId: string,
  input: AcceptAIProposal3DInput,
  signal?: AbortSignal,
): Promise<SceneVersion3D> {
  return apiFetch<SceneVersion3D>(`/api/projects3d/${projectId}/ai/accept-proposal/`, {
    method: 'POST',
    body: JSON.stringify(input),
    signal,
  });
}
