import { ApiError } from '../api/client';
import { upsertDraftSync, type DraftUpsertResponse } from '../api/drafts';
import type { SceneDocument } from '../api/projects';

/**
 * Task 43: the periodic/meaningful-action/page-hide scheduler that syncs
 * the current working scene to the server draft endpoint
 * (`../api/drafts.ts`, `scenes/api.py`'s `DraftDetailView`). Deliberately
 * framework-free (no React), same split as Task 42's
 * `draftAutosave.ts`/`useDraftAutosave.ts` pair — this module owns
 * scheduling and race-safety, `../pages/useDraftServerSync.ts` wires it
 * into the editor's React lifecycle and working-copy stream.
 *
 * Cadence and triggers, per `_docs/plan.md`'s "Active-session autosave and
 * recovery" section:
 * - Periodic: every 20-30 seconds while editing. `DEFAULT_SYNC_INTERVAL_MS`
 *   (25s) sits in the middle of that documented range.
 * - "Meaningful actions" (plan.md's own example: "accepting an AI
 *   revision"): this codebase's only currently-wired equivalent is
 *   restoring a historical version into the working copy (a similarly
 *   large, discontinuous state jump worth persisting immediately rather
 *   than waiting up to 30s) — see `syncAfterMeaningfulAction`'s call site
 *   in `EditorWorkspace.tsx`'s `onRestored` handler. A future AI-accept
 *   flow should call the same method.
 * - Page hide: exactly one bounded, fire-and-forget attempt — see
 *   `syncOnPageHide` below for why this uses `fetch(..., { keepalive:
 *   true })` rather than `navigator.sendBeacon()`, even though plan.md
 *   names both as acceptable.
 *
 * Determinism under failure (offline, timeout, out-of-order/stale
 * response, concurrent-tab races, server-validation rejection): every
 * sync attempt is purely an outbound *report* of the current working
 * copy — this module never mutates the working copy, never mutates the
 * Task 42 local draft, and never blocks editing on a response. A response
 * (success or failure) only ever updates this controller's own read-only
 * bookkeeping (`getLastFailure()`/`getLastSyncedAt()`), guarded by
 * `highestSeenSeq` so a slow, out-of-order response for an older attempt
 * can never regress that bookkeeping after a newer attempt's response (or
 * failure) has already been processed. The actual "newest write wins"
 * guarantee against concurrent tabs/stale writes is enforced authoritatively
 * server-side via `client_seq` comparison inside a locked transaction (see
 * `scenes/api.py`'s `_upsert_draft`) — this module's own sequencing only
 * has to avoid corrupting its *local* status reporting, not re-implement
 * that guarantee client-side.
 */

export const DEFAULT_SYNC_INTERVAL_MS = 25_000;
export const DEFAULT_SYNC_TIMEOUT_MS = 8_000;

export type DraftServerSyncIdentity = {
  projectId: string;
  sessionId: string;
};

export type DraftServerSyncFailureKind =
  'offline' | 'timeout' | 'validation-rejected' | 'unauthorized' | 'unknown';

export type DraftServerSyncFailure = {
  kind: DraftServerSyncFailureKind;
  message: string;
  status?: number;
};

function isOffline(): boolean {
  try {
    return typeof navigator !== 'undefined' && navigator.onLine === false;
  } catch {
    return false;
  }
}

function classifyFailure(err: unknown): DraftServerSyncFailure {
  if (err instanceof ApiError) {
    if (err.status === 400) {
      return {
        kind: 'validation-rejected',
        message: 'The server rejected this draft payload.',
        status: err.status,
      };
    }
    if (err.status === 401 || err.status === 403 || err.status === 404) {
      return {
        kind: 'unauthorized',
        message: 'Not authorized to sync a draft for this project/session.',
        status: err.status,
      };
    }
    return {
      kind: 'unknown',
      message: `Draft sync failed with status ${err.status}.`,
      status: err.status,
    };
  }
  if (err instanceof DOMException && err.name === 'AbortError') {
    return { kind: 'timeout', message: 'Draft sync timed out.' };
  }
  if (isOffline()) {
    return { kind: 'offline', message: 'Browser is offline.' };
  }
  return {
    kind: 'unknown',
    message: err instanceof Error ? err.message : 'Draft sync failed.',
  };
}

export type DraftServerSyncControllerOptions = {
  intervalMs?: number;
  timeoutMs?: number;
  /** Test-only injection point; production callers never pass this. */
  upsert?: typeof upsertDraftSync;
};

export class DraftServerSyncController {
  private readonly intervalMs: number;
  private readonly timeoutMs: number;
  private readonly upsert: typeof upsertDraftSync;
  private timer: ReturnType<typeof setInterval> | null = null;
  private seq = 0;
  private highestSeenSeq = 0;
  private lastFailure: DraftServerSyncFailure | null = null;
  private lastSyncedAt: string | null = null;
  private readonly failureListeners = new Set<() => void>();
  private syncAttempts = 0;
  // Issue #125: "no unsaved changes" baseline set by `markClean()` — see
  // that method's own doc comment for the full rationale. `cleanBaselineSet`
  // is tracked separately from `cleanBaseline` because `null` is itself a
  // valid baseline value (e.g. "no working copy exists").
  private cleanBaselineSet = false;
  private cleanBaseline: SceneDocument | null = null;

  constructor(options: DraftServerSyncControllerOptions = {}) {
    this.intervalMs = options.intervalMs ?? DEFAULT_SYNC_INTERVAL_MS;
    this.timeoutMs = options.timeoutMs ?? DEFAULT_SYNC_TIMEOUT_MS;
    this.upsert = options.upsert ?? upsertDraftSync;
  }

  /** Begins periodic syncing. `getSnapshot` is read fresh at every tick
   * (rather than captured once) so the timer never needs restarting just
   * because the working copy changed — only a project/session switch
   * should call `stop()`+`start()` again.
   *
   * Issue #125: each tick also re-checks `isClean()` against whatever
   * baseline the most recent `markClean()` call set — a tick whose
   * snapshot matches that baseline is skipped entirely (not even counted
   * as a sync attempt), which is what stops this timer from recreating a
   * server draft after `deleteServerDraft()` clears it. `start()` itself
   * does not touch the clean baseline (a meaningful-action restart, see
   * `syncAfterMeaningfulAction`, must not silently discard a baseline
   * `markClean()` just set) — callers that need a fresh baseline call
   * `resetCleanBaseline()` explicitly (see `../pages/useDraftServerSync.ts`'s
   * project-switch effect). */
  start(identity: DraftServerSyncIdentity, getSnapshot: () => SceneDocument | null): void {
    this.stop();
    this.timer = setInterval(() => {
      const snapshot = getSnapshot();
      if (this.isClean(snapshot)) return;
      void this.performSync(identity, snapshot);
    }, this.intervalMs);
  }

  stop(): void {
    if (this.timer !== null) {
      clearInterval(this.timer);
      this.timer = null;
    }
  }

  /** Task 43's meaningful-action trigger: syncs immediately rather than
   * waiting for the next periodic tick. Restarts the periodic timer (when
   * one is running) so the immediate sync and the next scheduled tick
   * don't land back-to-back a moment later. Issue #125: skips the
   * immediate sync (but still restarts the timer) when `snapshot` matches
   * the current clean baseline — see `start()`'s doc comment. */
  syncAfterMeaningfulAction(
    identity: DraftServerSyncIdentity,
    snapshot: SceneDocument | null,
    getSnapshot?: () => SceneDocument | null,
  ): void {
    if (!this.isClean(snapshot)) {
      void this.performSync(identity, snapshot);
    }
    if (this.timer !== null && getSnapshot) {
      this.start(identity, getSnapshot);
    }
  }

  /**
   * Issue #125: marks `snapshot` (typically the working copy at the exact
   * moment of an explicit Save, a confirmed Exit-without-saving, a version
   * restore, or an AI-proposal accept) as "nothing unsaved" — every sync
   * path above (periodic tick, meaningful action, page hide) skips writing
   * for as long as the snapshot it would send still matches this baseline.
   * The moment a real edit makes the working copy differ from `snapshot`
   * again, every path resumes writing on its normal schedule with no
   * further action needed — there is nothing to "unmark," since the
   * comparison is re-evaluated fresh every time. Passing `null` marks "no
   * draft should exist for any snapshot" as the clean state (matches a
   * project with no working copy at all). */
  markClean(snapshot: SceneDocument | null): void {
    this.cleanBaselineSet = true;
    this.cleanBaseline = snapshot;
  }

  /** Discards the current clean baseline (if any), returning to this
   * controller's original always-sync behavior until `markClean()` is
   * called again. Used when the identity a baseline was scoped to (e.g.
   * project) is about to change — a baseline recorded for one project must
   * never gate syncing for a different one. */
  resetCleanBaseline(): void {
    this.cleanBaselineSet = false;
    this.cleanBaseline = null;
  }

  private isClean(snapshot: SceneDocument | null): boolean {
    if (!this.cleanBaselineSet) return false;
    return JSON.stringify(snapshot) === JSON.stringify(this.cleanBaseline);
  }

  /**
   * Task 43's page-hide handler: exactly one bounded, fire-and-forget
   * update attempt.
   *
   * Uses `fetch(..., { keepalive: true })` rather than
   * `navigator.sendBeacon()` even though plan.md names both as
   * acceptable: `sendBeacon()` can only send a same-origin POST with no
   * custom headers, which cannot carry the `X-CSRFToken` header this
   * CSRF-protected `PUT` endpoint requires (see `../api/client.ts`) — a
   * beacon call would be silently rejected by Django's CSRF middleware on
   * every browser, not just occasionally. `fetch(..., { keepalive: true
   * })` keeps the request alive past navigation/tab-close the same way a
   * beacon would, while still allowing the real method and headers.
   *
   * Never awaited by the caller — the returned promise is intentionally
   * not returned from this method, so nothing here can delay or block
   * navigation.
   *
   * Issue #125: also skipped when `snapshot` matches the current clean
   * baseline (see `markClean()`) — e.g. the page is hidden immediately
   * after a Save completed and nothing has changed since. Still fires
   * normally whenever the working copy is genuinely dirty at hide time,
   * preserving the crash-recovery purpose this exists for.
   */
  syncOnPageHide(identity: DraftServerSyncIdentity, snapshot: SceneDocument | null): void {
    if (!snapshot) return;
    if (this.isClean(snapshot)) return;
    const localSeq = ++this.seq;
    this.syncAttempts += 1;
    this.upsert(
      identity.projectId,
      identity.sessionId,
      { draft_json: snapshot, client_seq: localSeq },
      { keepalive: true },
    )
      .then((response) => this.applyResult(localSeq, response))
      .catch((err: unknown) => this.applyFailure(localSeq, err));
  }

  private async performSync(
    identity: DraftServerSyncIdentity,
    snapshot: SceneDocument | null,
  ): Promise<void> {
    if (!snapshot) return;
    const localSeq = ++this.seq;
    this.syncAttempts += 1;
    const controller = new AbortController();
    const timeoutHandle = setTimeout(() => controller.abort(), this.timeoutMs);
    try {
      const response = await this.upsert(
        identity.projectId,
        identity.sessionId,
        { draft_json: snapshot, client_seq: localSeq },
        { signal: controller.signal },
      );
      this.applyResult(localSeq, response);
    } catch (err) {
      this.applyFailure(localSeq, err);
    } finally {
      clearTimeout(timeoutHandle);
    }
  }

  /** Stale-response guard: only the highest-`localSeq` outcome processed
   * so far (success or failure) is ever allowed to update bookkeeping — an
   * older attempt's response arriving late, after a newer attempt already
   * resolved, is discarded rather than regressing `lastSyncedAt`/
   * `lastFailure`. */
  private isStale(localSeq: number): boolean {
    return localSeq < this.highestSeenSeq;
  }

  private applyResult(localSeq: number, response: DraftUpsertResponse): void {
    if (this.isStale(localSeq)) return;
    this.highestSeenSeq = localSeq;
    if (response.applied) {
      this.lastSyncedAt = response.last_autosaved_at;
      this.setLastFailure(null);
    }
    // response.applied === false: the server already had a newer draft
    // (e.g. this request lost a race with another sync for the same
    // session) — not a failure, just a no-op this round.
  }

  private applyFailure(localSeq: number, err: unknown): void {
    if (this.isStale(localSeq)) return;
    this.highestSeenSeq = localSeq;
    this.setLastFailure(classifyFailure(err));
  }

  /** Issue #112 follow-up: `EditorWorkspace.tsx`'s failure notice originally
   * read `getLastFailure()` on a 3s `setInterval` poll — a real timer
   * established at component mount, which made the notice's e2e coverage
   * race against real wall-clock time (see
   * `frontend/e2e/aiAndRecovery.spec.ts`'s "a failing server draft sync"
   * test, which still flaked under CI load even with a 30s budget). This
   * setter notifies subscribers synchronously whenever the failure state
   * actually changes, so callers can react immediately instead of polling. */
  private setLastFailure(value: DraftServerSyncFailure | null): void {
    this.lastFailure = value;
    for (const listener of this.failureListeners) listener();
  }

  /** Subscribes to every `lastFailure` change (including clearing back to
   * `null` on a subsequent success); returns an unsubscribe function. */
  onFailureChange(listener: () => void): () => void {
    this.failureListeners.add(listener);
    return () => this.failureListeners.delete(listener);
  }

  /**
   * Issue #125: the cleanup `DELETE /draft/<session>/` call
   * (`../pages/useDraftServerSync.ts`'s `deleteServerDraft`) is made
   * directly against the API, not through this controller's own scheduler
   * — routed through here on failure so it is visible via the same
   * `getLastFailure()` the periodic/meaningful-action/page-hide paths
   * already use, and therefore surfaced through `EditorWorkspace.tsx`'s
   * existing `draftFailureNotice` polling. A failed cleanup must never
   * roll back or hide a successful Save — this only records the failure
   * for display, it never affects `markClean()`'s own gating, so the
   * orphaned row simply stays stale/inert until it expires or a cleanup
   * command reclaims it, per this controller's periodic-sync gate.
   */
  reportDeleteFailure(err: unknown): void {
    this.setLastFailure(classifyFailure(err));
  }

  getLastFailure(): DraftServerSyncFailure | null {
    return this.lastFailure;
  }

  getLastSyncedAt(): string | null {
    return this.lastSyncedAt;
  }

  /** Test/inspection hook: how many sync attempts (periodic +
   * meaningful-action + page-hide) this controller has made. */
  getSyncAttemptCount(): number {
    return this.syncAttempts;
  }
}
