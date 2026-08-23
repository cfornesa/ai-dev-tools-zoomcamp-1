import { useEffect, useRef } from 'react';

import { deleteDraftSync } from '../api/drafts';
import type { SceneDocument } from '../api/projects';
import { DraftServerSyncController } from '../storage/draftServerSync';
import { sessionIdFor } from './useDraftAutosave';

/**
 * Task 43: hooks `../storage/draftServerSync.ts`'s periodic/meaningful-
 * action/page-hide scheduler into `EditorWorkspace.tsx`'s `workingCopy`
 * stream — the same one Task 42's `useDraftAutosave` already observes for
 * the local IndexedDB draft. This hook only ever *reports* the working
 * copy outward; it never reads a server draft back into the editor (that's
 * Task 44's recovery-prompt scope, explicitly out of bounds here).
 *
 * - Starts/stops the periodic sync timer whenever `projectId` changes
 *   (including to/from `undefined`), so no timer for a previous project
 *   can keep firing after navigating away.
 * - Registers `pagehide` and a `visibilitychange`-to-`'hidden'` listener,
 *   both routed to the same bounded, fire-and-forget `syncOnPageHide` —
 *   covers both an outright navigation/tab-close (`pagehide`) and a
 *   backgrounded-but-still-open tab (`visibilitychange`), per plan.md's
 *   "On page hide/navigation" wording.
 * - Exposes `syncAfterMeaningfulAction` for callers to invoke after a
 *   defined meaningful action (this codebase's current one: restoring a
 *   historical version — see `EditorWorkspace.tsx`'s `onRestored`).
 * - Exposes `deleteServerDraft`, mirroring `useDraftAutosave`'s
 *   `clearDraft`: called from the same two places plan.md specifies
 *   (after a successful explicit Save, after a confirmed Exit-without-
 *   saving) so the server-side copy doesn't outlive the local one it was
 *   mirroring. Best-effort — a failed delete here just means the ~24-hour
 *   expiry (or the cleanup command) reclaims the row later; it never
 *   blocks or fails the Save/Exit flow it's called from.
 */
export type UseDraftServerSyncOptions = {
  /** Test-only override of the periodic sync interval; production callers
   * never pass this; see `DEFAULT_SYNC_INTERVAL_MS`. */
  intervalMs?: number;
};

export function useDraftServerSync(
  projectId: string | undefined,
  workingCopy: SceneDocument | null,
  options: UseDraftServerSyncOptions = {},
) {
  const controllerRef = useRef<DraftServerSyncController | null>(null);
  if (!controllerRef.current) {
    controllerRef.current = new DraftServerSyncController(
      options.intervalMs !== undefined ? { intervalMs: options.intervalMs } : undefined,
    );
  }

  const workingCopyRef = useRef(workingCopy);
  workingCopyRef.current = workingCopy;

  useEffect(() => {
    const controller = controllerRef.current;
    if (!projectId || !controller) return;
    const identity = { projectId, sessionId: sessionIdFor(projectId) };
    // Issue #125: a clean baseline recorded for a previous project must
    // never gate syncing for this one — see `resetCleanBaseline()`'s own
    // doc comment.
    controller.resetCleanBaseline();
    controller.start(identity, () => workingCopyRef.current);
    return () => controller.stop();
  }, [projectId]);

  useEffect(() => {
    const controller = controllerRef.current;
    if (!projectId || !controller) return;

    function attemptPageHideSync() {
      if (!projectId || !controller) return;
      controller.syncOnPageHide(
        { projectId, sessionId: sessionIdFor(projectId) },
        workingCopyRef.current,
      );
    }
    function handleVisibilityChange() {
      if (document.visibilityState === 'hidden') attemptPageHideSync();
    }

    window.addEventListener('pagehide', attemptPageHideSync);
    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => {
      window.removeEventListener('pagehide', attemptPageHideSync);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [projectId]);

  return {
    // `snapshotOverride` lets a caller pass the just-updated scene
    // directly (e.g. `onRestored`'s `version.scene_json`) instead of
    // relying on `workingCopyRef`, which — being written from the
    // `workingCopy` prop, not from the state setter the caller just
    // invoked — can still hold the *previous* render's value when this is
    // called synchronously inside the same event handler that changed it
    // (React re-renders, and therefore updates the ref, asynchronously).
    syncAfterMeaningfulAction: (snapshotOverride?: SceneDocument | null) => {
      const controller = controllerRef.current;
      if (!projectId || !controller) return;
      const identity = { projectId, sessionId: sessionIdFor(projectId) };
      const snapshot = snapshotOverride !== undefined ? snapshotOverride : workingCopyRef.current;
      controller.syncAfterMeaningfulAction(identity, snapshot, () => workingCopyRef.current);
    },
    // Issue #125: mirrors `syncAfterMeaningfulAction`'s `snapshotOverride`
    // pattern above — defaults to `workingCopyRef.current` (correct for
    // explicit Save/confirmed Exit, which don't replace the working copy
    // first), but restore/AI-accept must pass the just-restored/accepted
    // scene explicitly since `workingCopyRef` hasn't re-rendered yet.
    // Marks the controller's clean baseline *before* attempting the
    // delete (not after), so the gate applies even if the delete itself
    // fails — see `reportDeleteFailure`'s own doc comment on why a failed
    // cleanup still must not let periodic sync keep refreshing the
    // orphaned row.
    deleteServerDraft: (snapshotOverride?: SceneDocument | null): Promise<void> => {
      const controller = controllerRef.current;
      if (!projectId) return Promise.resolve();
      controller?.markClean(
        snapshotOverride !== undefined ? snapshotOverride : workingCopyRef.current,
      );
      return deleteDraftSync(projectId, sessionIdFor(projectId)).catch((err: unknown) => {
        controller?.reportDeleteFailure(err);
      });
    },
    getLastFailure: () => controllerRef.current?.getLastFailure() ?? null,
    getLastSyncedAt: () => controllerRef.current?.getLastSyncedAt() ?? null,
  };
}
