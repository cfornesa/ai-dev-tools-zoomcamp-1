import { useEffect, useRef, useState } from 'react';

import { deleteDraftSync, readDraftSync } from '../api/drafts';
import type { SceneDocument } from '../api/projects';
import {
  deleteDraftRecord,
  getDraftRecord,
  openDraftDatabase,
  summarizeSceneChange,
} from '../storage/draftAutosave';
import { validateScene } from '../validation/scene';
import { sessionIdFor } from './useDraftAutosave';

/**
 * Task 44: the recovery-prompt check from `_docs/plan.md`'s "Recovery
 * prompt" section — run once per project open, BEFORE the editor renders
 * its interactive panels, so a user reopening a project with a valid
 * active draft sees the prompt first rather than the loaded (persisted)
 * scene.
 *
 * Deliberately talks to the *raw* Task 42/43 storage primitives
 * (`../storage/draftAutosave.ts`'s `getDraftRecord`/`deleteDraftRecord`,
 * `../api/drafts.ts`'s `readDraftSync`/`deleteDraftSync`) rather than
 * going through `useDraftAutosave`/`useDraftServerSync`'s own returned
 * closures. Two reasons:
 *  - Those hooks' `readDraft`/`clearDraft`/`deleteServerDraft` are already
 *    scoped to whatever `workingCopy` `EditorWorkspace.tsx` currently
 *    passes them, and wiring this hook through them would create a
 *    circular dependency (this hook's result gates what `workingCopy`
 *    those hooks are even allowed to see — see the "no clobbering" note
 *    below).
 *  - The raw primitives are the same functions those hooks call
 *    internally, so this is reuse of the established read/write/delete
 *    API, not a parallel reimplementation.
 *
 * No clobbering: `EditorWorkspace.tsx` must not let Task 42's autosave
 * scheduler (which writes on every `workingCopy` change, including the
 * unchanged clone `useEditorWorkspaceState` loads on mount) fire while a
 * draft is still just a *candidate* the user hasn't acted on yet — an
 * unrelated "no changes" write landing mid-prompt would silently replace
 * the very draft being offered for recovery before the user chooses. The
 * fix lives in `EditorWorkspace.tsx`: it only ever feeds a real
 * `workingCopy` into `useDraftAutosave`/`useDraftServerSync` once this
 * hook's `status` has left `'checking'`/`'prompt'` (i.e. `'none'` or
 * `'resolved'`) — see its own comment at the call site.
 */

/** Task 44 policy: local drafts (Task 42) carry no server-style expiry of
 * their own, so this mirrors the server's ~24h rolling window (Task 43's
 * `DEFAULT_DRAFT_LIFETIME`) for consistency — a local draft older than
 * this is treated exactly like "no draft," and is opportunistically
 * cleared so it stops resurfacing. */
export const LOCAL_DRAFT_MAX_AGE_MS = 24 * 60 * 60 * 1000;

export type RecoveryCandidate = {
  source: 'local' | 'server';
  sceneJson: SceneDocument;
  /** ISO timestamp of the last autosave this candidate reflects. */
  savedAt: string;
  /** Concise, deterministic change summary — reused verbatim from the
   * Task 42 draft record when the local draft wins, or computed with the
   * same shared `summarizeSceneChange` utility (never new/regenerated
   * summary text) when the server draft wins, since server drafts don't
   * carry a stored summary of their own. */
  changeSummary: string;
};

export type DraftRecoveryStatus = 'checking' | 'prompt' | 'none' | 'resolved';

async function loadLocalCandidate(projectId: string): Promise<RecoveryCandidate | null> {
  try {
    const db = await openDraftDatabase();
    const record = await getDraftRecord(db, projectId);
    if (!record) return null;

    const savedAtMs = new Date(record.savedAt).getTime();
    if (!Number.isFinite(savedAtMs) || Date.now() - savedAtMs > LOCAL_DRAFT_MAX_AGE_MS) {
      // Policy: expired local draft -> behave as if none exists. Cleared
      // best-effort so it doesn't keep resurfacing on future opens.
      await deleteDraftRecord(db, projectId).catch(() => undefined);
      return null;
    }

    if (!validateScene(record.sceneJson).valid) {
      // Policy: corrupt draft data -> behave as if none exists, and clear
      // the record so it can't keep failing on every future open.
      await deleteDraftRecord(db, projectId).catch(() => undefined);
      return null;
    }

    return {
      source: 'local',
      sceneJson: record.sceneJson,
      savedAt: record.savedAt,
      changeSummary: record.changeSummary,
    };
  } catch {
    // Policy: local storage unavailable (private browsing, quota, etc.) ->
    // fail safe, behave as if no local draft exists.
    return null;
  }
}

async function loadServerCandidate(
  projectId: string,
  sessionId: string,
  persistedSceneJson: SceneDocument | null,
): Promise<RecoveryCandidate | null> {
  let response;
  try {
    response = await readDraftSync(projectId, sessionId);
  } catch (err) {
    // Policy, by failure kind:
    // - 404 (never written, already expired server-side, or already
    //   deleted): no server draft -> null, not an error.
    // - 401/403 (unauthorized/session issue): fail safe -> null, never
    //   surfaces the draft's existence or contents.
    // - anything else (offline, timeout, 5xx): treat the server draft as
    //   unavailable this time -> null; the local draft (if any) still
    //   applies, opening the project is never blocked on this.
    void err;
    return null;
  }

  if (new Date(response.expires_at).getTime() <= Date.now()) {
    // Defense in depth: the server's GET already excludes expired drafts
    // (`EditSessionDraft.objects.active()`), but if the clock ever
    // disagrees, apply the same "expired -> no draft" policy client-side.
    return null;
  }

  if (!validateScene(response.draft_json).valid) {
    // Policy: corrupt server draft -> behave as if none exists, and
    // best-effort delete it server-side so it doesn't keep resurfacing.
    void deleteDraftSync(projectId, sessionId).catch(() => undefined);
    return null;
  }

  return {
    source: 'server',
    sceneJson: response.draft_json,
    savedAt: response.last_autosaved_at,
    changeSummary: summarizeSceneChange(persistedSceneJson, response.draft_json),
  };
}

/** Task 44 policy for a local/server conflict (both exist, different
 * content/timestamps): pick the genuinely newer one by timestamp,
 * deterministically, and use only that one — never merge content, never
 * show two competing prompts. An exact tie prefers the local draft, since
 * it's the one this exact browser/tab actually produced. */
function pickNewer(
  local: RecoveryCandidate | null,
  server: RecoveryCandidate | null,
): RecoveryCandidate | null {
  if (local && !server) return local;
  if (server && !local) return server;
  if (!local || !server) return null;
  const localMs = new Date(local.savedAt).getTime();
  const serverMs = new Date(server.savedAt).getTime();
  return serverMs > localMs ? server : local;
}

export function useDraftRecovery(
  projectId: string | undefined,
  ready: boolean,
  persistedSceneJson: SceneDocument | null,
) {
  const [status, setStatus] = useState<DraftRecoveryStatus>('checking');
  const [candidate, setCandidate] = useState<RecoveryCandidate | null>(null);
  const startedForProjectRef = useRef<string | null>(null);

  // A project switch resets the check entirely — a decision (or an
  // in-progress check) for the previous project must never leak into the
  // next one.
  useEffect(() => {
    startedForProjectRef.current = null;
    setStatus('checking');
    setCandidate(null);
  }, [projectId]);

  useEffect(() => {
    if (!projectId || !ready) return;
    if (startedForProjectRef.current === projectId) return;
    startedForProjectRef.current = projectId;
    let cancelled = false;

    (async () => {
      const sessionId = sessionIdFor(projectId);
      const [local, server] = await Promise.all([
        loadLocalCandidate(projectId),
        loadServerCandidate(projectId, sessionId, persistedSceneJson),
      ]);
      if (cancelled) return;
      const winner = pickNewer(local, server);
      if (!winner) {
        setStatus('none');
        return;
      }
      setCandidate(winner);
      setStatus('prompt');
    })();

    return () => {
      cancelled = true;
    };
    // `persistedSceneJson` is intentionally read only as this effect's
    // initial snapshot (via closure), not a dependency: by the time
    // `ready` first becomes true, `persistedSceneJson` already holds its
    // correct loaded value in the same render (see `useEditorWorkspaceState`,
    // which sets both together before flipping `loadState` to `'ready'`),
    // and this check must run exactly once per project open, not re-run
    // every time a later save/restore changes `persistedSceneJson`.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [projectId, ready]);

  return {
    status,
    candidate,
    /** Returns the candidate's scene JSON to load as the new (dirty)
     * working copy, and marks recovery resolved. Never touches the
     * server's saved current version — the caller is responsible for
     * calling `setWorkingCopy` with the returned scene; this hook has no
     * access to that setter, which is exactly what keeps "the saved
     * version remains unchanged" true by construction (nothing here ever
     * calls a version-save/restore endpoint). */
    recover(): SceneDocument | null {
      if (!candidate) return null;
      setStatus('resolved');
      return candidate.sceneJson;
    },
    /** Deletes BOTH the local and server draft, in parallel, and only
     * resolves once both attempts have settled — so a caller that waits
     * on this promise before opening the saved version can never let the
     * user see a stale "recover?" prompt again for this project. */
    async discard(): Promise<void> {
      if (!projectId) {
        setStatus('resolved');
        return;
      }
      const sessionId = sessionIdFor(projectId);
      await Promise.all([
        openDraftDatabase()
          .then((db) => deleteDraftRecord(db, projectId))
          .catch(() => undefined),
        deleteDraftSync(projectId, sessionId).catch(() => undefined),
      ]);
      setStatus('resolved');
    },
  };
}

export default useDraftRecovery;
