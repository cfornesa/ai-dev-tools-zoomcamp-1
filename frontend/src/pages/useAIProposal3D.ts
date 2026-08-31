import { useCallback, useEffect, useRef, useState } from 'react';

import {
  acceptAIProposal3D,
  createAIScene3D,
  editAIScene3D,
  type AIErrorBody3D,
} from '../api/ai3d';
import type { AIErrorCode } from '../api/ai';
import { ApiError } from '../api/client';
import type { SceneDocument3D, SceneVersion3D } from '../api/projects3d';

/**
 * Issue #232: the 3D counterpart of `useAIProposal.ts`. Same state
 * machine and guards (repeated Accept, unmount/navigation mid-request,
 * stale-base response, request cancellation) -- see that hook's own
 * doc comment for the full rationale, unchanged here. Kept as a
 * parallel hook rather than a generic one because the 2D hook is
 * shared, tested code this issue should not risk regressing (mirrors
 * this repo's established "parallel document families" convention).
 */

export type ProposalMode3D = 'create' | 'edit';

const AI_MODEL_STORAGE_KEY_3D = 'gesture-studio:ai-model-preference-3d';

function readStoredModel(): string {
  try {
    return window.localStorage.getItem(AI_MODEL_STORAGE_KEY_3D) ?? '';
  } catch {
    return '';
  }
}

function persistModel(value: string): void {
  try {
    window.localStorage.setItem(AI_MODEL_STORAGE_KEY_3D, value);
  } catch {
    // Best-effort only.
  }
}

export type GenerationPhase3D =
  'prompt' | 'pending' | 'success' | 'validation-error' | 'quota-error' | 'provider-error';

export type GenerationError3D = { code: AIErrorCode | 'network'; message: string };

export type Proposal3D = {
  mode: ProposalMode3D;
  scene: SceneDocument3D;
  summary: string;
  patch: unknown | null;
  baseVersionId: number | null;
  clientRequestId: string;
};

export type AcceptError3D = {
  kind: 'stale-base' | 'validation' | 'auth' | 'server';
  message: string;
};

export type AcceptState3D = { pending: boolean; error: AcceptError3D | null };

const IDLE_ACCEPT_STATE: AcceptState3D = { pending: false, error: null };

function detailMessage(body: Partial<AIErrorBody3D> | null | undefined): string | null {
  if (!body || body.detail == null) return null;
  if (typeof body.detail === 'string') return body.detail;
  try {
    return JSON.stringify(body.detail);
  } catch {
    return null;
  }
}

const QUOTA_CODES = new Set<AIErrorCode>([
  'rate_limited',
  'quota_exceeded',
  'provider_quota_exceeded',
]);
const VALIDATION_CODES = new Set<AIErrorCode>([
  'prompt_invalid',
  'model_invalid',
  'current_scene_invalid',
  'request_invalid',
  'unreferenced_element',
]);

const UNREFERENCED_ELEMENT_FALLBACK_MESSAGE =
  'This edit would also change an object, group, or light the prompt never mentioned. ' +
  'Name it explicitly in the prompt, or make the prompt explicitly broad ' +
  '(e.g. "all"/"every"/"everything"/"entire"/"whole") if that was intended.';

function classifyGenerationError(err: unknown): {
  phase: GenerationPhase3D;
  error: GenerationError3D;
} {
  if (err instanceof ApiError) {
    const body = err.body as Partial<AIErrorBody3D> | null;
    const code = body?.error;
    if (code && VALIDATION_CODES.has(code)) {
      return {
        phase: 'validation-error',
        error: {
          code,
          message:
            detailMessage(body) ??
            (code === 'unreferenced_element'
              ? UNREFERENCED_ELEMENT_FALLBACK_MESSAGE
              : 'The request was invalid. Check the prompt and try again.'),
        },
      };
    }
    if (code && QUOTA_CODES.has(code)) {
      return {
        phase: 'quota-error',
        error: {
          code,
          message: detailMessage(body) ?? 'The AI request limit was reached. Wait and try again.',
        },
      };
    }
    if (code) {
      return {
        phase: 'provider-error',
        error: {
          code,
          message: detailMessage(body) ?? 'The AI provider could not complete this request.',
        },
      };
    }
  }
  return {
    phase: 'provider-error',
    error: {
      code: 'network',
      message: 'Something went wrong contacting the AI service. Please try again.',
    },
  };
}

function classifyAcceptError(err: unknown): AcceptError3D {
  if (err instanceof ApiError) {
    const body = err.body as Partial<AIErrorBody3D> | null;
    if (err.status === 409 || body?.error === 'stale_base') {
      return {
        kind: 'stale-base',
        message:
          detailMessage(body) ??
          'This project changed since the proposal was generated. Reject this proposal, reload the latest state, and try again.',
      };
    }
    if (err.status === 400 || err.status === 422) {
      return {
        kind: 'validation',
        message:
          detailMessage(body) ??
          'This proposal could not be saved because it failed validation. Reject and try a new prompt.',
      };
    }
    if (err.status === 401 || err.status === 403 || err.status === 404) {
      return {
        kind: 'auth',
        message:
          'You no longer have access to this project — your session may have expired. Sign in again to continue.',
      };
    }
  }
  return {
    kind: 'server',
    message: 'Something went wrong and the proposal could not be saved. Please try again.',
  };
}

function isAbortError(err: unknown): boolean {
  return err instanceof DOMException && err.name === 'AbortError';
}

export function useAIProposal3D(projectId: string | undefined) {
  const [mode, setModeState] = useState<ProposalMode3D>('create');
  const [prompt, setPrompt] = useState('');
  const [model, setModelState] = useState(readStoredModel);
  const setModel = useCallback((next: string) => {
    setModelState(next);
    persistModel(next);
  }, []);
  // Issue #262: mirrors useAIProposal.ts's own personaId state -- see its
  // comment for why this isn't persisted like `model`.
  const [personaId, setPersonaId] = useState<number | null>(null);
  const [phase, setPhase] = useState<GenerationPhase3D>('prompt');
  const [genError, setGenError] = useState<GenerationError3D | null>(null);
  const [proposal, setProposal] = useState<Proposal3D | null>(null);
  const [acceptState, setAcceptState] = useState<AcceptState3D>(IDLE_ACCEPT_STATE);

  const mountedRef = useRef(true);
  const abortControllerRef = useRef<AbortController | null>(null);
  const acceptAbortRef = useRef<AbortController | null>(null);
  const acceptInFlightRef = useRef(false);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      abortControllerRef.current?.abort();
      acceptAbortRef.current?.abort();
    };
  }, []);

  const setMode = useCallback((next: ProposalMode3D) => {
    setModeState(next);
    setPhase('prompt');
    setGenError(null);
    setProposal(null);
    setAcceptState(IDLE_ACCEPT_STATE);
  }, []);

  const cancelGeneration = useCallback(() => {
    abortControllerRef.current?.abort();
    setPhase('prompt');
    setGenError(null);
  }, []);

  const generate = useCallback(
    async (currentScene: SceneDocument3D | null, baseVersionId: number | null): Promise<void> => {
      if (!projectId) return;
      const trimmed = prompt.trim();
      if (!trimmed) {
        setPhase('validation-error');
        setGenError({ code: 'prompt_invalid', message: 'Enter a prompt before generating.' });
        return;
      }
      if (mode === 'edit' && !currentScene) {
        setPhase('validation-error');
        setGenError({
          code: 'current_scene_invalid',
          message: 'There is no working scene to edit yet.',
        });
        return;
      }

      abortControllerRef.current?.abort();
      const controller = new AbortController();
      abortControllerRef.current = controller;

      setPhase('pending');
      setGenError(null);
      setProposal(null);

      const trimmedModel = model.trim() || undefined;
      try {
        if (mode === 'create') {
          const result = await createAIScene3D(
            projectId,
            trimmed,
            controller.signal,
            trimmedModel,
            personaId ?? undefined,
          );
          if (!mountedRef.current || abortControllerRef.current !== controller) return;
          setProposal({
            mode: 'create',
            scene: result.scene,
            summary: 'A new 3D scene was generated from your prompt.',
            patch: null,
            baseVersionId,
            clientRequestId: crypto.randomUUID(),
          });
          setPhase('success');
        } else {
          const result = await editAIScene3D(
            projectId,
            trimmed,
            currentScene as SceneDocument3D,
            baseVersionId,
            controller.signal,
            trimmedModel,
            personaId ?? undefined,
          );
          if (!mountedRef.current || abortControllerRef.current !== controller) return;
          setProposal({
            mode: 'edit',
            scene: result.scene,
            summary: result.change_summary,
            patch: result.patch,
            baseVersionId,
            clientRequestId: crypto.randomUUID(),
          });
          setPhase('success');
        }
      } catch (err) {
        if (isAbortError(err)) return;
        if (!mountedRef.current || abortControllerRef.current !== controller) return;
        const classified = classifyGenerationError(err);
        setPhase(classified.phase);
        setGenError(classified.error);
      }
    },
    [projectId, prompt, mode, model, personaId],
  );

  const reject = useCallback(() => {
    setProposal(null);
    setPhase('prompt');
    setAcceptState(IDLE_ACCEPT_STATE);
  }, []);

  const accept = useCallback(async (): Promise<SceneVersion3D | null> => {
    if (!projectId || !proposal) return null;
    if (acceptInFlightRef.current) return null;
    acceptInFlightRef.current = true;

    acceptAbortRef.current?.abort();
    const controller = new AbortController();
    acceptAbortRef.current = controller;

    setAcceptState({ pending: true, error: null });
    try {
      const version = await acceptAIProposal3D(
        projectId,
        {
          operation: proposal.mode === 'create' ? 'ai_create' : 'ai_edit',
          scene_json: proposal.scene,
          base_version_id: proposal.baseVersionId,
          client_request_id: proposal.clientRequestId,
        },
        controller.signal,
      );
      if (!mountedRef.current || acceptAbortRef.current !== controller) return null;
      setAcceptState(IDLE_ACCEPT_STATE);
      setProposal(null);
      setPhase('prompt');
      setPrompt('');
      return version;
    } catch (err) {
      if (isAbortError(err)) return null;
      if (!mountedRef.current || acceptAbortRef.current !== controller) return null;
      setAcceptState({ pending: false, error: classifyAcceptError(err) });
      return null;
    } finally {
      acceptInFlightRef.current = false;
    }
  }, [projectId, proposal]);

  const cancelAccept = useCallback(() => {
    acceptAbortRef.current?.abort();
    setAcceptState(IDLE_ACCEPT_STATE);
  }, []);

  return {
    mode,
    setMode,
    prompt,
    setPrompt,
    model,
    setModel,
    personaId,
    setPersonaId,
    phase,
    genError,
    proposal,
    generate,
    cancelGeneration,
    reject,
    accept,
    acceptState,
    cancelAccept,
  };
}
