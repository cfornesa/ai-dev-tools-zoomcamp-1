import { useCallback, useEffect, useRef, useState } from 'react';

import {
  acceptAIRun,
  advanceAIRun,
  cancelAIRun,
  getAIRun,
  startAIRun,
  type AIRun,
  type AIRunErrorBody,
  type AIRunErrorCode,
  type AIRunScope,
} from '../api/aiRuns';
import { ApiError } from '../api/client';
import { getSceneVersion, type SceneDocument, type SceneVersion } from '../api/projects';

export type AIRunTargetMode = 'create' | 'edit-selection' | 'edit-whole';

export type AIRunClientError = { code: AIRunErrorCode | 'network'; message: string };

const ADVANCE_POLL_DELAY_MS = 350;
// After a rate-limited advance attempt (the run's own per-attempt rate
// bucket, distinct from any provider-side quota), wait longer before
// retrying rather than terminating the run outright -- this condition is
// expected to clear within the same short window it applies to.
const ADVANCE_RATE_LIMIT_RETRY_MS = 1500;

function runStorageKey(projectId: string): string {
  return `gesture-studio:ai-run:${projectId}`;
}

function readStoredRunId(projectId: string): number | null {
  try {
    const raw = window.localStorage.getItem(runStorageKey(projectId));
    if (!raw) return null;
    const parsed = Number(raw);
    return Number.isInteger(parsed) ? parsed : null;
  } catch {
    return null;
  }
}

function persistRunId(projectId: string, runId: number | null): void {
  try {
    if (runId === null) {
      window.localStorage.removeItem(runStorageKey(projectId));
    } else {
      window.localStorage.setItem(runStorageKey(projectId), String(runId));
    }
  } catch {
    // Best-effort only -- a full/blocked localStorage just means a reload
    // can't reconnect to an in-progress run, not a broken agent flow.
  }
}

function detailMessage(body: Partial<AIRunErrorBody> | null | undefined): string | null {
  if (!body || body.detail == null) return null;
  if (typeof body.detail === 'string') return body.detail;
  try {
    return JSON.stringify(body.detail);
  } catch {
    return null;
  }
}

function classifyRunError(err: unknown): AIRunClientError {
  if (err instanceof ApiError) {
    const body = err.body as Partial<AIRunErrorBody> | null;
    const code = body?.error;
    if (code === 'quota_exceeded') {
      return { code, message: detailMessage(body) ?? 'The daily AI run quota was reached.' };
    }
    if (code === 'missing_credential') {
      return {
        code,
        message: detailMessage(body) ?? 'Configure your personal AI provider key first.',
      };
    }
    if (code === 'invalid_target') {
      return {
        code,
        message: detailMessage(body) ?? 'This project has no saved scene to edit yet.',
      };
    }
    if (code) {
      return { code, message: detailMessage(body) ?? 'The agent run could not continue.' };
    }
  }
  return {
    code: 'network',
    message: 'Something went wrong contacting the agent run service. Please try again.',
  };
}

function isAbortError(err: unknown): boolean {
  return err instanceof DOMException && err.name === 'AbortError';
}

/**
 * Issue #462: drives the persisted plan-validate-revise "Agent workflow"
 * lifecycle (issue #461's `AIRun`) — start, the client-owned advance loop,
 * awaiting-review preview, Accept/Stop, and reload reconnection — as a
 * peer to `useAIProposal.ts`'s one-shot flow, not a replacement for it.
 *
 * Reconnection: the active run id is persisted to `localStorage` per
 * project. On mount, a stored id is looked up with `getAIRun` (a GET,
 * never a provider call) before anything else — a terminal run clears the
 * stored id and this hook starts idle; a `running` run resumes the
 * advance loop from wherever the server left it; an `awaiting_review` run
 * resumes the preview/Accept state directly. A plain page reload can
 * therefore never itself spend an extra provider attempt.
 *
 * The advance loop (`runAdvanceLoop`) is guarded by `loopTokenRef`: start/
 * stop/dismiss/a new run all bump the token, so a stale loop from a
 * superseded run can never apply its result to the current one.
 */
export function useAIRun(projectId: string | undefined) {
  const [targetMode, setTargetMode] = useState<AIRunTargetMode>('create');
  const [selectedShapeId, setSelectedShapeId] = useState<string | null>(null);
  const [prompt, setPrompt] = useState('');
  const [vendor, setVendor] = useState<'mistral' | 'gemini' | 'deepseek'>('mistral');
  const [model, setModel] = useState('');
  const [personaId, setPersonaId] = useState<number | null>(null);

  const [run, setRun] = useState<AIRun | null>(null);
  const [starting, setStarting] = useState(false);
  const [startError, setStartError] = useState<AIRunClientError | null>(null);
  const [advanceError, setAdvanceError] = useState<AIRunClientError | null>(null);
  const [accepting, setAccepting] = useState(false);
  const [acceptError, setAcceptError] = useState<AIRunClientError | null>(null);
  const [reconnecting, setReconnecting] = useState(true);

  const mountedRef = useRef(true);
  const loopTokenRef = useRef(0);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  const delay = useCallback(
    (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms)),
    [],
  );

  const runAdvanceLoop = useCallback(
    async (runId: number, token: number) => {
      for (;;) {
        if (!mountedRef.current || token !== loopTokenRef.current) return;
        let next: AIRun;
        try {
          next = await advanceAIRun(runId);
        } catch (err) {
          if (!mountedRef.current || token !== loopTokenRef.current) return;
          const classified = classifyRunError(err);
          if (classified.code === 'rate_limited') {
            await delay(ADVANCE_RATE_LIMIT_RETRY_MS);
            continue;
          }
          setAdvanceError(classified);
          return;
        }
        if (!mountedRef.current || token !== loopTokenRef.current) return;
        setRun(next);
        if (next.status !== 'running') {
          if (next.status !== 'awaiting_review') {
            persistRunId(projectId ?? '', null);
          }
          return;
        }
        await delay(ADVANCE_POLL_DELAY_MS);
      }
    },
    [delay, projectId],
  );

  // Reload reconnection: look up a stored run id once per project, before
  // rendering the entry form, so a real in-progress run is never
  // momentarily hidden behind a blank "start a new run" state.
  useEffect(() => {
    if (!projectId) {
      setReconnecting(false);
      return;
    }
    const storedId = readStoredRunId(projectId);
    if (storedId === null) {
      setReconnecting(false);
      return;
    }
    setReconnecting(true);
    const token = ++loopTokenRef.current;
    getAIRun(storedId)
      .then((fetched) => {
        if (!mountedRef.current || token !== loopTokenRef.current) return;
        if (fetched.status === 'running' || fetched.status === 'awaiting_review') {
          setRun(fetched);
          if (fetched.status === 'running') void runAdvanceLoop(storedId, token);
        } else {
          persistRunId(projectId, null);
        }
      })
      .catch(() => {
        // A stale/foreign/deleted run id -- treat exactly like "no stored
        // run" rather than surfacing an error for state the user never
        // directly caused.
        persistRunId(projectId, null);
      })
      .finally(() => {
        if (mountedRef.current) setReconnecting(false);
      });
    // Only re-run this reconnection check when the project itself changes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [projectId]);

  const start = useCallback(
    async (workingCopy: SceneDocument | null, currentVersionId: number | null): Promise<void> => {
      if (!projectId) return;
      const trimmed = prompt.trim();
      if (!trimmed) {
        setStartError({ code: 'request_invalid', message: 'Enter a prompt before starting.' });
        return;
      }
      if (targetMode !== 'create' && !workingCopy) {
        setStartError({
          code: 'invalid_target',
          message: 'There is no working scene to edit yet.',
        });
        return;
      }
      if (targetMode === 'edit-selection' && !selectedShapeId) {
        setStartError({
          code: 'request_invalid',
          message: 'Select an object to edit, or switch to "Edit whole scene".',
        });
        return;
      }

      setStarting(true);
      setStartError(null);
      setAdvanceError(null);
      setAcceptError(null);
      const scope: AIRunScope = targetMode === 'edit-selection' ? 'selection' : 'whole_scene';
      try {
        const started = await startAIRun({
          target_type: 'project',
          project_id: projectId,
          operation: targetMode === 'create' ? 'create' : 'edit_patch',
          scope,
          selected_target_ids: scope === 'selection' && selectedShapeId ? [selectedShapeId] : [],
          prompt: trimmed,
          vendor,
          model: model.trim() || undefined,
          persona_id: personaId ?? undefined,
          start_request_id: crypto.randomUUID(),
        });
        if (!mountedRef.current) return;
        void currentVersionId; // captured server-side via the project's own current version at start time
        persistRunId(projectId, started.id);
        setRun(started);
        const token = ++loopTokenRef.current;
        if (started.status === 'running') void runAdvanceLoop(started.id, token);
      } catch (err) {
        if (!mountedRef.current) return;
        setStartError(classifyRunError(err));
      } finally {
        if (mountedRef.current) setStarting(false);
      }
    },
    [projectId, prompt, targetMode, selectedShapeId, vendor, model, personaId, runAdvanceLoop],
  );

  /** Stops an in-progress run (Stop) or discards an awaiting-review
   * candidate (Reject) -- both are the same server call: `cancel_run`
   * writes no creative state, and a cancelled run can never resume even
   * if an in-flight `advance` response was still on the wire. */
  const stop = useCallback(async (): Promise<void> => {
    if (!run) return;
    loopTokenRef.current += 1; // stop any in-flight advance loop immediately
    try {
      const cancelled = await cancelAIRun(run.id);
      if (!mountedRef.current) return;
      setRun(cancelled);
    } catch {
      // Best-effort -- the loop is already stopped client-side either way.
    } finally {
      if (projectId) persistRunId(projectId, null);
    }
  }, [run, projectId]);

  const accept = useCallback(async (): Promise<SceneVersion | null> => {
    if (!run || !projectId) return null;
    setAccepting(true);
    setAcceptError(null);
    try {
      const accepted = await acceptAIRun(run.id);
      if (!mountedRef.current) return null;
      setRun(accepted);
      if (accepted.status === 'accepted' && accepted.accepted_version_id !== null) {
        persistRunId(projectId, null);
        return await getSceneVersion(projectId, accepted.accepted_version_id);
      }
      // A failed re-validation or stale base at Accept time -- the run's
      // own `error_reason` (surfaced via the `run.status === 'failed'`
      // render path) explains why; nothing to return.
      persistRunId(projectId, null);
      return null;
    } catch (err) {
      if (isAbortError(err)) return null;
      if (!mountedRef.current) return null;
      setAcceptError(classifyRunError(err));
      return null;
    } finally {
      if (mountedRef.current) setAccepting(false);
    }
  }, [run, projectId]);

  /** Clears a terminal run (accepted/cancelled/failed/expired) back to the
   * entry form -- e.g. after reading a failure, or starting a fresh run
   * ("Rebase and retry" after a stale-base failure at Accept). */
  const dismiss = useCallback(() => {
    loopTokenRef.current += 1;
    setRun(null);
    setStartError(null);
    setAdvanceError(null);
    setAcceptError(null);
    if (projectId) persistRunId(projectId, null);
  }, [projectId]);

  return {
    targetMode,
    setTargetMode,
    selectedShapeId,
    setSelectedShapeId,
    prompt,
    setPrompt,
    vendor,
    setVendor,
    model,
    setModel,
    personaId,
    setPersonaId,
    run,
    starting,
    startError,
    advanceError,
    accepting,
    acceptError,
    reconnecting,
    start,
    stop,
    accept,
    dismiss,
  };
}

export type UseAIRunResult = ReturnType<typeof useAIRun>;
