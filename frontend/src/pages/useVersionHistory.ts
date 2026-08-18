import { useCallback, useEffect, useRef, useState } from 'react';

import { ApiError } from '../api/client';
import {
  deleteSceneVersion,
  listSceneVersions,
  restoreSceneVersion,
  saveSceneVersion,
  type SaveSceneVersionOrigin,
  type SceneDocument,
  type SceneValidationErrorBody,
  type SceneVersion,
  type SceneVersionSummary,
} from '../api/projects';
import type { SceneValidationError } from '../validation/scene';
import { validateScene } from '../validation/scene';

export type HistoryLoadState = 'loading' | 'ready' | 'error';

/** A single, user-facing shape every mutating action (save/restore/delete)
 * reports its failures through, so the panel only needs one rendering
 * branch per action rather than one per HTTP status code.
 *  - 'validation': the submitted scene failed schema validation (save
 *    only) — never creates a version; `details` is the exact per-field
 *    breakdown from the server (or from the client-side pre-check, same
 *    shape) so the message can be concrete rather than generic.
 *  - 'conflict': the one real conflict this API surfaces — trying to
 *    restore or soft-delete the version that is *already* current
 *    (`scenes/api.py`'s `CannotModifyCurrentVersion`, always a 400 with a
 *    `detail` string). There is no distinct "someone else saved first"
 *    signal for the save endpoint itself: concurrent saves are
 *    serialized server-side (`select_for_update`) so they never race on
 *    sequence — see that view's own docstring — they just both succeed,
 *    one after the other.
 *  - 'auth': the request was rejected as unauthorized/not-found-for-you
 *    (every version endpoint 404s rather than 403s on this — see
 *    `scenes/api.py`), which in practice means "your session no longer
 *    has access to this project" (expired session, ownership changed).
 *  - 'server': anything else (network failure, 5xx, unexpected shape).
 */
export type VersionActionError =
  | { kind: 'validation'; message: string; details: SceneValidationError[] }
  | { kind: 'conflict'; message: string }
  | { kind: 'auth'; message: string }
  | { kind: 'server'; message: string };

export type ActionState = {
  pending: boolean;
  error: VersionActionError | null;
};

const IDLE_ACTION_STATE: ActionState = { pending: false, error: null };

function classifyError(err: unknown, kind: 'save' | 'restore' | 'delete'): VersionActionError {
  if (err instanceof ApiError) {
    if (err.status === 400 && kind === 'save') {
      const body = err.body as Partial<SceneValidationErrorBody> | null;
      if (body && Array.isArray(body.errors)) {
        return {
          kind: 'validation',
          message:
            'This scene could not be saved because it failed validation. Your working changes have not been lost — fix the issue below and try saving again.',
          details: body.errors as SceneValidationError[],
        };
      }
      return {
        kind: 'server',
        message:
          'The save request was rejected. Your working changes have not been lost — please try again.',
      };
    }
    if (err.status === 400 && (kind === 'restore' || kind === 'delete')) {
      return {
        kind: 'conflict',
        message:
          kind === 'restore'
            ? 'This is already the current version, so it cannot be restored.'
            : 'This is the current version, so it cannot be deleted.',
      };
    }
    if (err.status === 401 || err.status === 403 || err.status === 404) {
      return {
        kind: 'auth',
        message:
          'You no longer have access to this project — your session may have expired, or you are no longer its owner. Your working changes have not been lost; sign in again to continue.',
      };
    }
  }
  return {
    kind: 'server',
    message:
      'Something went wrong and the request could not be completed. Your working changes have not been lost — please try again.',
  };
}

/**
 * Task 41: loads and mutates a project's explicit, immutable version
 * history — separate from `useSceneEditor`'s in-memory undo/redo stack
 * (that's per-session shape editing history; this is the server-side
 * saved-version record) and separate from crash-recovery drafts (Tasks
 * 42-44, out of scope here).
 *
 * Every action here (`save`, `restore`, `remove`) is careful to never
 * touch the caller's in-progress working state on failure: on any error
 * this hook only ever sets its own `*State.error`, never calls back into
 * the editor to change `workingCopy` — the caller decides what, if
 * anything, to update on success via the returned version/project data.
 */
export function useVersionHistory(projectId: string | undefined, enabled: boolean) {
  const [historyLoadState, setHistoryLoadState] = useState<HistoryLoadState>('loading');
  const [historyError, setHistoryError] = useState<VersionActionError | null>(null);
  const [versions, setVersions] = useState<SceneVersionSummary[]>([]);
  const [saveState, setSaveState] = useState<ActionState>(IDLE_ACTION_STATE);
  const [restoreState, setRestoreState] = useState<ActionState & { versionId: number | null }>({
    ...IDLE_ACTION_STATE,
    versionId: null,
  });
  const [deleteState, setDeleteState] = useState<ActionState & { versionId: number | null }>({
    ...IDLE_ACTION_STATE,
    versionId: null,
  });

  // Guards against a slow in-flight history fetch resolving after a newer
  // one (or the component/projectId) has moved on — same pattern as
  // `useEditorWorkspaceState.load`.
  const requestIdRef = useRef(0);

  const loadHistory = useCallback(() => {
    if (!projectId || !enabled) return;
    const requestId = ++requestIdRef.current;
    setHistoryLoadState('loading');
    setHistoryError(null);
    listSceneVersions(projectId)
      .then((result) => {
        if (requestIdRef.current !== requestId) return;
        setVersions(result);
        setHistoryLoadState('ready');
      })
      .catch((err) => {
        if (requestIdRef.current !== requestId) return;
        setHistoryError(classifyError(err, 'save'));
        setHistoryLoadState('error');
      });
  }, [projectId, enabled]);

  useEffect(() => loadHistory(), [loadHistory]);

  const save = useCallback(
    async (
      sceneJson: SceneDocument,
      origin: SaveSceneVersionOrigin,
      changeLabel: string,
    ): Promise<SceneVersion | null> => {
      if (!projectId) return null;

      // Fast client-side feedback, mirroring the server's own authoritative
      // check (Task 6/14): never send an obviously-invalid scene, and
      // never create a version for one. The server re-validates
      // independently regardless (this pre-check is advisory only).
      const localResult = validateScene(sceneJson);
      if (!localResult.valid) {
        setSaveState({
          pending: false,
          error: {
            kind: 'validation',
            message:
              'This scene could not be saved because it failed validation. Your working changes have not been lost — fix the issue below and try saving again.',
            details: localResult.errors,
          },
        });
        return null;
      }

      setSaveState({ pending: true, error: null });
      try {
        const saved = await saveSceneVersion(projectId, {
          scene_json: sceneJson,
          origin,
          change_label: changeLabel,
        });
        setSaveState({ pending: false, error: null });
        setVersions((current) => [...current, toSummary(saved)]);
        return saved;
      } catch (err) {
        setSaveState({ pending: false, error: classifyError(err, 'save') });
        return null;
      }
    },
    [projectId],
  );

  const restore = useCallback(
    async (versionId: number): Promise<SceneVersion | null> => {
      if (!projectId) return null;
      setRestoreState({ pending: true, error: null, versionId });
      try {
        const restored = await restoreSceneVersion(projectId, versionId);
        setRestoreState({ pending: false, error: null, versionId: null });
        setVersions((current) => [...current, toSummary(restored)]);
        return restored;
      } catch (err) {
        setRestoreState({ pending: false, error: classifyError(err, 'restore'), versionId });
        return null;
      }
    },
    [projectId],
  );

  const remove = useCallback(
    async (versionId: number): Promise<boolean> => {
      if (!projectId) return false;
      setDeleteState({ pending: true, error: null, versionId });
      try {
        await deleteSceneVersion(projectId, versionId);
        setDeleteState({ pending: false, error: null, versionId: null });
        setVersions((current) => current.filter((version) => version.id !== versionId));
        return true;
      } catch (err) {
        setDeleteState({ pending: false, error: classifyError(err, 'delete'), versionId });
        return false;
      }
    },
    [projectId],
  );

  return {
    historyLoadState,
    historyError,
    versions,
    reloadHistory: loadHistory,
    save,
    saveState,
    restore,
    restoreState,
    remove,
    deleteState,
  };
}

function toSummary(version: SceneVersion): SceneVersionSummary {
  const { scene_json: _scene_json, ...summary } = version;
  return summary;
}
