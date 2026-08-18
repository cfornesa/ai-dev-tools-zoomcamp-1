import { useContext, useEffect, useRef } from 'react';

import type { SceneDocument, SceneVersion } from '../api/projects';
import { AuthContext } from '../auth/context';
import { DraftAutosaveController } from '../storage/draftAutosave';

const ANONYMOUS_USER_KEY = 'anonymous';
const SESSION_STORAGE_PREFIX = 'motion-editor-draft-session:';

/** A stable id for this browser tab's editing session of one project,
 * persisted in `sessionStorage` (per-tab, cleared when the tab closes) so
 * a reload of the same tab reuses the same session id but a second tab
 * editing the same project gets its own. Falls back to a fresh id on any
 * storage failure (e.g. private browsing) rather than throwing — the
 * autosave scheduler tolerates a less-stable session id fine, it's only
 * used for draft identity, never for security. */
function sessionIdFor(projectId: string): string {
  const key = `${SESSION_STORAGE_PREFIX}${projectId}`;
  try {
    const existing = window.sessionStorage.getItem(key);
    if (existing) return existing;
    const created = `sess-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
    window.sessionStorage.setItem(key, created);
    return created;
  } catch {
    return `sess-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
  }
}

/**
 * Task 42: hooks the debounced local draft-autosave engine
 * (`../storage/draftAutosave.ts`) into `EditorWorkspace.tsx`'s existing
 * working-state change stream — the same `workingCopy` `useSceneEditor`
 * mutates and `useVersionHistory.save` reads from — rather than standing
 * up a parallel change-tracking system.
 *
 * - Every `workingCopy` change reschedules the controller's debounced
 *   write (see `DraftAutosaveController.schedule` for the newer-write-
 *   wins guarantee); nothing is written on every keystroke, only ~1.5s
 *   after the last one in a burst.
 * - The change summary compares against `persistedVersion.scene_json` —
 *   "what's changed since the last save" — matching `_docs/plan.md`'s
 *   recovery-prompt example ("3 shapes changed · 1 gesture binding
 *   added").
 * - Switching `projectId` (or unmounting) cancels any pending write
 *   without deleting persisted data, so a slow write for project A can
 *   never land under project B.
 * - `clearDraft()` is exposed for the two defined clearing actions this
 *   task owns: after a successful explicit Save, and after a confirmed
 *   Exit-without-saving. Nothing else clears a draft.
 */
export type UseDraftAutosaveOptions = {
  /** Test-only override of the debounce window; production callers never
   * pass this, so they always get `DEFAULT_DEBOUNCE_MS` (see
   * `../storage/draftAutosave.ts`, matching `_docs/plan.md`'s "1-2 seconds
   * after the last edit"). */
  debounceMs?: number;
};

export function useDraftAutosave(
  projectId: string | undefined,
  workingCopy: SceneDocument | null,
  persistedVersion: SceneVersion | null,
  options: UseDraftAutosaveOptions = {},
) {
  const auth = useContext(AuthContext);
  const userKey = auth.status === 'signed-in' ? auth.user.username : ANONYMOUS_USER_KEY;

  const controllerRef = useRef<DraftAutosaveController | null>(null);
  if (!controllerRef.current) {
    controllerRef.current = new DraftAutosaveController(
      options.debounceMs !== undefined ? { debounceMs: options.debounceMs } : undefined,
    );
  }

  // A project switch must never let a write scheduled for the previous
  // project land after the switch — cancel it (but don't delete the
  // previous project's already-persisted draft; it's still a valid
  // recovery candidate for whenever that project is reopened, see Task 44).
  const previousProjectIdRef = useRef(projectId);
  useEffect(() => {
    if (previousProjectIdRef.current !== projectId) {
      controllerRef.current?.cancelPending();
      previousProjectIdRef.current = projectId;
    }
  }, [projectId]);

  useEffect(() => {
    if (!projectId || !workingCopy) return;
    const baseline = (persistedVersion?.scene_json as SceneDocument | undefined) ?? null;
    controllerRef.current?.schedule(
      { projectId, userKey, sessionId: sessionIdFor(projectId) },
      baseline,
      workingCopy,
    );
    // Intentionally NOT depending on `persistedVersion` beyond reading its
    // current value here: a save updates `persistedVersion` and separately
    // clears the draft via `clearDraft()` below, it shouldn't also
    // reschedule a write.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [projectId, workingCopy, userKey]);

  useEffect(() => {
    const controller = controllerRef.current;
    return () => {
      controller?.cancelPending();
    };
  }, []);

  return {
    clearDraft: () =>
      projectId
        ? (controllerRef.current?.clearDraft(projectId) ?? Promise.resolve())
        : Promise.resolve(),
    readDraft: () =>
      projectId
        ? (controllerRef.current?.readDraft(projectId) ?? Promise.resolve(null))
        : Promise.resolve(null),
    getLastFailure: () => controllerRef.current?.getLastFailure() ?? null,
  };
}
