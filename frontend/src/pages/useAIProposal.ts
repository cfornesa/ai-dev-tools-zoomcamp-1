import { useCallback, useEffect, useRef, useState } from 'react';

import {
  acceptAIProposal,
  createAIScene,
  editAIScene,
  type AIErrorBody,
  type AIErrorCode,
} from '../api/ai';
import { ApiError } from '../api/client';
import type { SceneDocument, SceneVersion } from '../api/projects';

export type ProposalMode = 'create' | 'edit';

/** Task 48's six required, distinct UI states for the AI panel. `prompt` is
 * the resting/entry state (also returned to after Accept/Reject/cancel). */
export type GenerationPhase =
  'prompt' | 'pending' | 'success' | 'validation-error' | 'quota-error' | 'provider-error';

export type GenerationError = { code: AIErrorCode | 'network'; message: string };

/** An unsaved AI draft, held entirely in this hook's own state — a THIRD
 * state alongside the editor's persisted/working scene (see
 * `useEditorWorkspaceState`/`useSceneEditor`). Nothing here is ever written
 * into `workingCopy` or `persistedVersion` until `accept()` resolves. */
export type Proposal = {
  mode: ProposalMode;
  scene: SceneDocument;
  /** Concise human-readable summary shown in the success state. Create has
   * no server-provided summary (the whole scene is new), so a fixed
   * description is used; edit's is `AIEditSceneResponse.change_summary`. */
  summary: string;
  /** RFC 6902 JSON Patch for an edit proposal, or null for a create
   * proposal (nothing to patch against). Preview-only — never applied
   * client-side; `scene` is already the fully patched result. */
  patch: unknown | null;
  /** The `project.current_version_id` this proposal was generated against
   * — resent unchanged on Accept so the server can detect a stale base
   * (`scenes/ai_api.py`'s `AIAcceptProposalView`). */
  baseVersionId: number | null;
  /** Generated once, when the proposal is first received — reused for
   * every Accept attempt against this exact proposal (including a retry),
   * so a duplicated/replayed Accept request resolves to the same version
   * instead of creating a second one. */
  clientRequestId: string;
};

export type AcceptError = {
  kind: 'stale-base' | 'validation' | 'auth' | 'server';
  message: string;
};

export type AcceptState = { pending: boolean; error: AcceptError | null };

const IDLE_ACCEPT_STATE: AcceptState = { pending: false, error: null };

function detailMessage(body: Partial<AIErrorBody> | null | undefined): string | null {
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
  'current_scene_invalid',
  'request_invalid',
  // Issue #158: the proposed patch touched a shape/group/binding/layer/
  // graph node/connection the prompt text never named, and the prompt
  // wasn't itself bulk/global in scope (see `scenes/patch.py`'s
  // docstring). Classified as a validation error (a problem with the
  // prompt's specificity, not a provider/network failure) so it's
  // surfaced distinctly rather than folded into the generic
  // provider-error bucket below -- the server's `detail` message already
  // names which unreferenced element triggered it.
  'unreferenced_element',
]);

const UNREFERENCED_ELEMENT_FALLBACK_MESSAGE =
  'This edit would also change a shape, group, binding, layer, or graph node/connection ' +
  'the prompt never mentioned. Name it explicitly in the prompt, or make the prompt ' +
  'explicitly broad (e.g. "all"/"every"/"everything"/"entire"/"whole") if that was intended.';

function classifyGenerationError(err: unknown): { phase: GenerationPhase; error: GenerationError } {
  if (err instanceof ApiError) {
    const body = err.body as Partial<AIErrorBody> | null;
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

function classifyAcceptError(err: unknown): AcceptError {
  if (err instanceof ApiError) {
    const body = err.body as Partial<AIErrorBody> | null;
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

/**
 * Task 48: drives the AI create/edit proposal lifecycle — prompt entry,
 * request-in-flight, success (preview + summary), and the three
 * documented error states — plus the separate Accept/Reject actions that
 * turn a successful proposal into a real version or discard it.
 *
 * Guards, all explicit per the acceptance criteria:
 * - **Repeated Accept**: `acceptInFlightRef` is a synchronous ref (not
 *   React state) checked and set before any await, so two Accept calls
 *   fired in the same tick (e.g. a fast double-click before React
 *   re-renders the disabled button) can't both start a request.
 * - **Navigation during a request / component unmount**: `mountedRef`
 *   goes false on unmount; every `.then`/`catch` continuation checks it
 *   before touching state, so a response arriving after unmount is
 *   silently dropped.
 * - **Stale-base response**: `accept()` classifies a 409 as a distinct
 *   `'stale-base'` `AcceptError`, never applied as a normal failure —
 *   the caller is told to reject and retry rather than the state being
 *   silently corrupted.
 * - **Request cancellation**: every request carries an `AbortController`;
 *   `cancel()` (closing the panel mid-request) and `generate()` itself
 *   (starting a newer request) both abort the previous controller, and
 *   `abortControllerRef.current !== controller` after an await detects
 *   "a newer request has since started" so a slow, superseded response
 *   is never applied even if it resolves instead of aborting cleanly.
 */
export function useAIProposal(projectId: string | undefined) {
  const [mode, setModeState] = useState<ProposalMode>('create');
  const [prompt, setPrompt] = useState('');
  const [phase, setPhase] = useState<GenerationPhase>('prompt');
  const [genError, setGenError] = useState<GenerationError | null>(null);
  const [proposal, setProposal] = useState<Proposal | null>(null);
  const [acceptState, setAcceptState] = useState<AcceptState>(IDLE_ACCEPT_STATE);

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

  const setMode = useCallback((next: ProposalMode) => {
    setModeState(next);
    setPhase('prompt');
    setGenError(null);
    setProposal(null);
    setAcceptState(IDLE_ACCEPT_STATE);
  }, []);

  /** Aborts any in-flight generation request and returns to the prompt
   * state without recording an error — used when the user closes the AI
   * panel or otherwise explicitly cancels mid-request. */
  const cancelGeneration = useCallback(() => {
    abortControllerRef.current?.abort();
    setPhase('prompt');
    setGenError(null);
  }, []);

  const generate = useCallback(
    async (currentScene: SceneDocument | null, baseVersionId: number | null): Promise<void> => {
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

      try {
        if (mode === 'create') {
          const result = await createAIScene(projectId, trimmed, controller.signal);
          if (!mountedRef.current || abortControllerRef.current !== controller) return;
          setProposal({
            mode: 'create',
            scene: result.scene,
            summary: 'A new scene was generated from your prompt.',
            patch: null,
            baseVersionId,
            clientRequestId: crypto.randomUUID(),
          });
          setPhase('success');
        } else {
          const result = await editAIScene(
            projectId,
            trimmed,
            currentScene as SceneDocument,
            baseVersionId,
            controller.signal,
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
    [projectId, prompt, mode],
  );

  /** Discards the current proposal client-side only — never calls the
   * server, and never touches the editor's saved or unsaved working
   * state (neither is passed to this hook at all), so both are left
   * completely untouched. */
  const reject = useCallback(() => {
    setProposal(null);
    setPhase('prompt');
    setAcceptState(IDLE_ACCEPT_STATE);
  }, []);

  const accept = useCallback(async (): Promise<SceneVersion | null> => {
    if (!projectId || !proposal) return null;
    if (acceptInFlightRef.current) return null;
    acceptInFlightRef.current = true;

    acceptAbortRef.current?.abort();
    const controller = new AbortController();
    acceptAbortRef.current = controller;

    setAcceptState({ pending: true, error: null });
    try {
      const version = await acceptAIProposal(
        projectId,
        {
          operation: proposal.mode === 'create' ? 'ai_create' : 'ai_edit',
          scene_json: proposal.scene,
          base_version_id: proposal.baseVersionId,
          change_label: proposal.summary.slice(0, 200),
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

  /** Aborts an in-flight Accept request (e.g. the panel is closed mid-accept)
   * without applying whatever response eventually arrives. The proposal
   * itself is left intact so the user can retry. */
  const cancelAccept = useCallback(() => {
    acceptAbortRef.current?.abort();
    setAcceptState(IDLE_ACCEPT_STATE);
  }, []);

  return {
    mode,
    setMode,
    prompt,
    setPrompt,
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
