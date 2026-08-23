import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { ApiError } from '../api/client';
import type { DraftUpsertResponse } from '../api/drafts';
import type { SceneDocument } from '../api/projects';
import { DraftServerSyncController } from './draftServerSync';

/**
 * Task 43: the framework-free sync engine. Covers the documented policy
 * directly against the controller (no React) — periodic cadence,
 * meaningful-action out-of-band sync, page-hide fire-and-forget keepalive
 * behavior, and the offline/timeout/stale-response/validation-rejection
 * cases that must all leave the controller's own bookkeeping deterministic
 * without ever throwing or blocking a caller.
 */

function scene(id = 'scene-1'): SceneDocument {
  return {
    id,
    shapes: [],
    layers: [],
    groups: [],
    bindings: [],
    graph: { nodes: [], connections: [] },
  };
}

function okResponse(overrides: Partial<DraftUpsertResponse> = {}): DraftUpsertResponse {
  return {
    draft_json: scene(),
    client_seq: 1,
    last_autosaved_at: '2026-01-01T00:00:00Z',
    expires_at: '2026-01-02T00:00:00Z',
    applied: true,
    ...overrides,
  };
}

const IDENTITY = { projectId: 'proj-1', sessionId: 'sess-1' };

describe('DraftServerSyncController', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('syncs periodically at the configured interval while a snapshot is available', async () => {
    const upsert = vi.fn().mockResolvedValue(okResponse());
    const controller = new DraftServerSyncController({ intervalMs: 1000, upsert });

    controller.start(IDENTITY, () => scene());

    await vi.advanceTimersByTimeAsync(1000);
    expect(upsert).toHaveBeenCalledTimes(1);

    await vi.advanceTimersByTimeAsync(1000);
    expect(upsert).toHaveBeenCalledTimes(2);

    // Each periodic tick sends a strictly increasing client_seq.
    expect(upsert.mock.calls[0][2].client_seq).toBe(1);
    expect(upsert.mock.calls[1][2].client_seq).toBe(2);

    controller.stop();
    await vi.advanceTimersByTimeAsync(5000);
    expect(upsert).toHaveBeenCalledTimes(2);
  });

  it('does not sync periodically when there is no snapshot yet', async () => {
    const upsert = vi.fn().mockResolvedValue(okResponse());
    const controller = new DraftServerSyncController({ intervalMs: 1000, upsert });

    controller.start(IDENTITY, () => null);
    await vi.advanceTimersByTimeAsync(3000);

    expect(upsert).not.toHaveBeenCalled();
  });

  it('records a successful periodic sync via getLastSyncedAt/getLastFailure', async () => {
    const upsert = vi
      .fn()
      .mockResolvedValue(okResponse({ last_autosaved_at: '2026-05-01T00:00:00Z' }));
    const controller = new DraftServerSyncController({ intervalMs: 1000, upsert });

    controller.start(IDENTITY, () => scene());
    await vi.advanceTimersByTimeAsync(1000);

    expect(controller.getLastSyncedAt()).toBe('2026-05-01T00:00:00Z');
    expect(controller.getLastFailure()).toBeNull();
  });

  it('syncAfterMeaningfulAction fires immediately, ahead of the next periodic tick', async () => {
    const upsert = vi.fn().mockResolvedValue(okResponse());
    const controller = new DraftServerSyncController({ intervalMs: 10_000, upsert });

    controller.start(IDENTITY, () => scene());
    expect(upsert).not.toHaveBeenCalled();

    controller.syncAfterMeaningfulAction(IDENTITY, scene('restored-scene'), () => scene());
    await vi.advanceTimersByTimeAsync(0);

    expect(upsert).toHaveBeenCalledTimes(1);
    expect(upsert.mock.calls[0][2].draft_json).toEqual(scene('restored-scene'));
  });

  it('syncAfterMeaningfulAction restarts the periodic timer so it does not double-fire soon after', async () => {
    const upsert = vi.fn().mockResolvedValue(okResponse());
    const controller = new DraftServerSyncController({ intervalMs: 1000, upsert });

    controller.start(IDENTITY, () => scene());
    await vi.advanceTimersByTimeAsync(900); // just before the first tick would fire

    controller.syncAfterMeaningfulAction(IDENTITY, scene('meaningful'), () => scene());
    await vi.advanceTimersByTimeAsync(0);
    expect(upsert).toHaveBeenCalledTimes(1); // only the meaningful-action sync so far

    // The old schedule (which would have fired ~100ms from here) must not
    // also fire — the timer was restarted from the meaningful action.
    await vi.advanceTimersByTimeAsync(100);
    expect(upsert).toHaveBeenCalledTimes(1);

    await vi.advanceTimersByTimeAsync(900);
    expect(upsert).toHaveBeenCalledTimes(2);
  });

  it('syncOnPageHide fires exactly one keepalive upsert without being awaited', () => {
    const upsert = vi.fn().mockResolvedValue(okResponse());
    const controller = new DraftServerSyncController({ upsert });

    const result = controller.syncOnPageHide(IDENTITY, scene());

    // Fire-and-forget: nothing is returned to await.
    expect(result).toBeUndefined();
    expect(upsert).toHaveBeenCalledTimes(1);
    expect(upsert).toHaveBeenCalledWith(
      IDENTITY.projectId,
      IDENTITY.sessionId,
      { draft_json: scene(), client_seq: 1 },
      { keepalive: true },
    );
  });

  it('syncOnPageHide does nothing when there is no snapshot to send', () => {
    const upsert = vi.fn();
    const controller = new DraftServerSyncController({ upsert });

    controller.syncOnPageHide(IDENTITY, null);

    expect(upsert).not.toHaveBeenCalled();
  });

  it('classifies a timeout (AbortError) failure without throwing', async () => {
    const upsert = vi.fn().mockRejectedValue(new DOMException('aborted', 'AbortError'));
    const controller = new DraftServerSyncController({ intervalMs: 1000, upsert });

    controller.start(IDENTITY, () => scene());
    await vi.advanceTimersByTimeAsync(1000);

    expect(controller.getLastFailure()).toMatchObject({ kind: 'timeout' });
    expect(controller.getLastSyncedAt()).toBeNull();
  });

  it('classifies a server validation rejection (400) without crashing or losing local state', async () => {
    const upsert = vi
      .fn()
      .mockRejectedValue(new ApiError(400, { errors: [{ path: '$', rule: 'x', message: 'bad' }] }));
    const controller = new DraftServerSyncController({ intervalMs: 1000, upsert });

    controller.start(IDENTITY, () => scene());
    await vi.advanceTimersByTimeAsync(1000);

    expect(controller.getLastFailure()).toMatchObject({ kind: 'validation-rejected', status: 400 });
    // The snapshot itself was only ever read via getSnapshot(); nothing
    // here mutates or discards it — the controller has no state that
    // could regress the caller's own working copy.
  });

  it('classifies an offline network failure without throwing', async () => {
    const originalOnLine = navigator.onLine;
    Object.defineProperty(navigator, 'onLine', { value: false, configurable: true });
    try {
      const upsert = vi.fn().mockRejectedValue(new TypeError('Failed to fetch'));
      const controller = new DraftServerSyncController({ intervalMs: 1000, upsert });

      controller.start(IDENTITY, () => scene());
      await vi.advanceTimersByTimeAsync(1000);

      expect(controller.getLastFailure()).toMatchObject({ kind: 'offline' });
    } finally {
      Object.defineProperty(navigator, 'onLine', { value: originalOnLine, configurable: true });
    }
  });

  it('an out-of-order (stale) response arriving after a newer one does not regress bookkeeping', async () => {
    let resolveFirst!: (value: DraftUpsertResponse) => void;
    const firstPromise = new Promise<DraftUpsertResponse>((resolve) => {
      resolveFirst = resolve;
    });
    const upsert = vi
      .fn()
      .mockImplementationOnce(() => firstPromise) // first (older) request: stays pending
      .mockImplementationOnce(() =>
        Promise.resolve(okResponse({ last_autosaved_at: '2026-09-01T00:00:00Z' })),
      );
    const controller = new DraftServerSyncController({ intervalMs: 1000, upsert });

    controller.start(IDENTITY, () => scene());
    await vi.advanceTimersByTimeAsync(1000); // fires request #1 (client_seq 1), still pending
    await vi.advanceTimersByTimeAsync(1000); // fires request #2 (client_seq 2), resolves immediately

    await Promise.resolve();
    await Promise.resolve();
    expect(controller.getLastSyncedAt()).toBe('2026-09-01T00:00:00Z');

    // Now the older, still-pending first request finally resolves — its
    // (older) result must not overwrite the newer one already recorded.
    resolveFirst(okResponse({ last_autosaved_at: '2026-01-01T00:00:00Z' }));
    await Promise.resolve();
    await Promise.resolve();

    expect(controller.getLastSyncedAt()).toBe('2026-09-01T00:00:00Z');
  });

  it('a server response with applied: false (lost a race) is not treated as a failure', async () => {
    const upsert = vi.fn().mockResolvedValue(okResponse({ applied: false }));
    const controller = new DraftServerSyncController({ intervalMs: 1000, upsert });

    controller.start(IDENTITY, () => scene());
    await vi.advanceTimersByTimeAsync(1000);

    expect(controller.getLastFailure()).toBeNull();
    // Not applied, so lastSyncedAt is not updated to this response's value either.
    expect(controller.getLastSyncedAt()).toBeNull();
  });

  // Issue #125: `DraftServerSyncController`'s periodic `setInterval` used to
  // fire unconditionally with whatever `getSnapshot()` currently returns —
  // including right after `deleteServerDraft()` (`../pages/useDraftServerSync.ts`)
  // had just cleared the row, recreating it on the very next tick. These
  // cover the "no unsaved changes since the last markClean() baseline"
  // gate directly against the controller for every path that can write:
  // periodic tick, meaningful action, and page hide.
  describe('markClean/resetCleanBaseline gating', () => {
    it('stops periodic ticks whose snapshot matches the clean baseline', async () => {
      const upsert = vi.fn().mockResolvedValue(okResponse());
      const controller = new DraftServerSyncController({ intervalMs: 1000, upsert });
      const snapshot = scene();

      controller.start(IDENTITY, () => snapshot);
      controller.markClean(snapshot);

      await vi.advanceTimersByTimeAsync(3000);
      expect(upsert).not.toHaveBeenCalled();
    });

    it('does not gate a snapshot that genuinely differs from the clean baseline', async () => {
      const upsert = vi.fn().mockResolvedValue(okResponse());
      const controller = new DraftServerSyncController({ intervalMs: 1000, upsert });

      controller.markClean(scene('clean-baseline'));
      controller.start(IDENTITY, () => scene('dirty-again'));

      await vi.advanceTimersByTimeAsync(1000);
      expect(upsert).toHaveBeenCalledTimes(1);
    });

    it('resumes writing on the normal schedule once a real edit follows markClean, with no further action needed', async () => {
      const upsert = vi.fn().mockResolvedValue(okResponse());
      const controller = new DraftServerSyncController({ intervalMs: 1000, upsert });
      let snapshot = scene('clean');

      controller.start(IDENTITY, () => snapshot);
      controller.markClean(scene('clean'));

      await vi.advanceTimersByTimeAsync(1000);
      expect(upsert).not.toHaveBeenCalled();

      // A real edit changes what getSnapshot() returns -- every subsequent
      // tick sees a snapshot differing from the (unchanged) baseline and
      // resumes writing, with no explicit "un-gate" call required.
      snapshot = scene('edited');
      await vi.advanceTimersByTimeAsync(1000);
      expect(upsert).toHaveBeenCalledTimes(1);

      await vi.advanceTimersByTimeAsync(1000);
      expect(upsert).toHaveBeenCalledTimes(2);
    });

    it('resetCleanBaseline restores normal always-sync behavior', async () => {
      const upsert = vi.fn().mockResolvedValue(okResponse());
      const controller = new DraftServerSyncController({ intervalMs: 1000, upsert });
      const snapshot = scene();

      controller.markClean(snapshot);
      controller.resetCleanBaseline();
      controller.start(IDENTITY, () => snapshot);

      await vi.advanceTimersByTimeAsync(1000);
      expect(upsert).toHaveBeenCalledTimes(1);
    });

    it('syncOnPageHide is skipped when the snapshot matches the clean baseline, but still fires when genuinely dirty at hide time', () => {
      const upsert = vi.fn().mockResolvedValue(okResponse());
      const controller = new DraftServerSyncController({ upsert });
      const snapshot = scene();

      controller.markClean(snapshot);
      controller.syncOnPageHide(IDENTITY, snapshot);
      expect(upsert).not.toHaveBeenCalled();

      controller.syncOnPageHide(IDENTITY, scene('genuinely-dirty'));
      expect(upsert).toHaveBeenCalledTimes(1);
    });

    it('syncAfterMeaningfulAction skips the immediate sync when clean, but still restarts the periodic timer', async () => {
      const upsert = vi.fn().mockResolvedValue(okResponse());
      const controller = new DraftServerSyncController({ intervalMs: 1000, upsert });
      const snapshot = scene();

      controller.start(IDENTITY, () => snapshot);
      controller.markClean(snapshot);

      controller.syncAfterMeaningfulAction(IDENTITY, snapshot, () => snapshot);
      await vi.advanceTimersByTimeAsync(0);
      expect(upsert).not.toHaveBeenCalled();

      // The restarted timer is still gated the same way -- no PUT even
      // once the (restarted) interval elapses, since nothing changed.
      await vi.advanceTimersByTimeAsync(1000);
      expect(upsert).not.toHaveBeenCalled();
    });

    it('two controllers (representing two tabs/sessions of the same project) gate independently', async () => {
      const upsertA = vi.fn().mockResolvedValue(okResponse());
      const upsertB = vi.fn().mockResolvedValue(okResponse());
      const controllerA = new DraftServerSyncController({ intervalMs: 1000, upsert: upsertA });
      const controllerB = new DraftServerSyncController({ intervalMs: 1000, upsert: upsertB });
      const snapshot = scene();

      // Tab A just saved (clean); tab B is still actively editing the same
      // project under a different session id and never calls markClean.
      controllerA.start(IDENTITY, () => snapshot);
      controllerA.markClean(snapshot);
      controllerB.start({ projectId: IDENTITY.projectId, sessionId: 'sess-2' }, () => snapshot);

      await vi.advanceTimersByTimeAsync(1000);

      expect(upsertA).not.toHaveBeenCalled();
      expect(upsertB).toHaveBeenCalledTimes(1);
    });
  });

  describe('reportDeleteFailure', () => {
    it('records a classified failure retrievable via getLastFailure, for the cleanup delete call made outside this controller', () => {
      const controller = new DraftServerSyncController({ upsert: vi.fn() });
      expect(controller.getLastFailure()).toBeNull();

      controller.reportDeleteFailure(new Error('network down'));

      expect(controller.getLastFailure()).toMatchObject({
        kind: 'unknown',
        message: 'network down',
      });
    });
  });
});
