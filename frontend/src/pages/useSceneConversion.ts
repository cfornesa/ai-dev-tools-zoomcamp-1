import { useCallback, useEffect, useRef, useState } from 'react';

import {
  acceptSceneConversion,
  advanceSceneConversion,
  cancelSceneConversion,
  getSceneConversion,
  startSceneConversion,
  type SceneConversionErrorBody,
  type SceneConversionErrorCode,
  type SceneConversionRun,
} from '../api/sceneConversion';
import { ApiError } from '../api/client';

const ADVANCE_POLL_DELAY_MS = 350;
const ADVANCE_RATE_LIMIT_RETRY_MS = 1500;

export type SceneConversionClientError = {
  code: SceneConversionErrorCode | 'network';
  message: string;
};

function runStorageKey(projectId: string): string {
  return `gesture-studio:scene-conversion:${projectId}`;
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
    // Best-effort only, mirroring useAIRun.ts's identical policy.
  }
}

function detailMessage(body: Partial<SceneConversionErrorBody> | null | undefined): string | null {
  if (!body || body.detail == null) return null;
  if (typeof body.detail === 'string') return body.detail;
  try {
    return JSON.stringify(body.detail);
  } catch {
    return null;
  }
}

function classifyError(err: unknown): SceneConversionClientError {
  if (err instanceof ApiError) {
    const body = err.body as Partial<SceneConversionErrorBody> | null;
    const code = body?.error;
    if (code === 'quota_exceeded') {
      return { code, message: detailMessage(body) ?? 'The daily conversion quota was reached.' };
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
        message: detailMessage(body) ?? 'This project has no saved scene to convert yet.',
      };
    }
    if (code) {
      return { code, message: detailMessage(body) ?? 'The conversion could not continue.' };
    }
  }
  return {
    code: 'network',
    message: 'Something went wrong contacting the conversion service. Please try again.',
  };
}

/**
 * Issue #528: drives the AI-assisted 2D-to-3D "Convert to 3D" bounded run
 * lifecycle -- start, the client-owned advance loop, awaiting-review
 * preview, Accept/Stop, and reload reconnection. Deliberately its own hook
 * rather than a third `useAIRun.ts` target type: a conversion has no
 * create/edit/scope choice (it is always exactly one operation against the
 * current project), and Accept creates a brand-new 3D project rather than
 * updating an existing target -- see `scenes.scene_conversion`'s own module
 * docstring for the same reasoning on the backend.
 */
export function useSceneConversion(projectId: string | undefined) {
  const [prompt, setPrompt] = useState('');
  const [vendor, setVendor] = useState<'mistral' | 'gemini' | 'deepseek'>('mistral');
  const [model, setModel] = useState('');

  const [run, setRun] = useState<SceneConversionRun | null>(null);
  const [starting, setStarting] = useState(false);
  const [startError, setStartError] = useState<SceneConversionClientError | null>(null);
  const [advanceError, setAdvanceError] = useState<SceneConversionClientError | null>(null);
  const [accepting, setAccepting] = useState(false);
  const [acceptError, setAcceptError] = useState<SceneConversionClientError | null>(null);
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
        let next: SceneConversionRun;
        try {
          next = await advanceSceneConversion(runId);
        } catch (err) {
          if (!mountedRef.current || token !== loopTokenRef.current) return;
          const classified = classifyError(err);
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
    getSceneConversion(storedId)
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
        persistRunId(projectId, null);
      })
      .finally(() => {
        if (mountedRef.current) setReconnecting(false);
      });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [projectId]);

  const start = useCallback(async (): Promise<void> => {
    if (!projectId) return;
    setStarting(true);
    setStartError(null);
    setAdvanceError(null);
    setAcceptError(null);
    try {
      const started = await startSceneConversion({
        project_id: projectId,
        prompt: prompt.trim() || undefined,
        vendor,
        model: model.trim() || undefined,
        start_request_id: crypto.randomUUID(),
      });
      if (!mountedRef.current) return;
      persistRunId(projectId, started.id);
      setRun(started);
      const token = ++loopTokenRef.current;
      if (started.status === 'running') void runAdvanceLoop(started.id, token);
    } catch (err) {
      if (!mountedRef.current) return;
      setStartError(classifyError(err));
    } finally {
      if (mountedRef.current) setStarting(false);
    }
  }, [projectId, prompt, vendor, model, runAdvanceLoop]);

  const stop = useCallback(async (): Promise<void> => {
    if (!run) return;
    loopTokenRef.current += 1;
    try {
      const cancelled = await cancelSceneConversion(run.id);
      if (!mountedRef.current) return;
      setRun(cancelled);
    } catch {
      // Best-effort -- the loop is already stopped client-side either way.
    } finally {
      if (projectId) persistRunId(projectId, null);
    }
  }, [run, projectId]);

  const accept = useCallback(async (): Promise<string | null> => {
    if (!run || !projectId) return null;
    setAccepting(true);
    setAcceptError(null);
    try {
      const accepted = await acceptSceneConversion(run.id);
      if (!mountedRef.current) return null;
      setRun(accepted);
      persistRunId(projectId, null);
      if (accepted.status === 'accepted' && accepted.accepted_project3d_id !== null) {
        return accepted.accepted_project3d_id;
      }
      return null;
    } catch (err) {
      if (!mountedRef.current) return null;
      setAcceptError(classifyError(err));
      return null;
    } finally {
      if (mountedRef.current) setAccepting(false);
    }
  }, [run, projectId]);

  const dismiss = useCallback(() => {
    loopTokenRef.current += 1;
    setRun(null);
    setStartError(null);
    setAdvanceError(null);
    setAcceptError(null);
    if (projectId) persistRunId(projectId, null);
  }, [projectId]);

  return {
    prompt,
    setPrompt,
    vendor,
    setVendor,
    model,
    setModel,
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

export type UseSceneConversionResult = ReturnType<typeof useSceneConversion>;
