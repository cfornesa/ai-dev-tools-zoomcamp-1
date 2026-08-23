import { renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import type { SceneDocument } from '../api/projects';
import * as draftsApi from '../api/drafts';
import { useDraftServerSync } from './useDraftServerSync';

/**
 * Task 43: the React-hook wiring layer over `../storage/draftServerSync.ts`
 * — that the hook actually starts/stops the periodic timer per project,
 * registers page-hide listeners, and calls through to the real
 * `../api/drafts.ts` functions (mocked here) with the project's own
 * per-tab session id. Cadence/race-safety/failure-classification behavior
 * itself is covered exhaustively against the engine directly in
 * `../storage/draftServerSync.test.ts`.
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

beforeEach(() => {
  vi.useFakeTimers();
  window.sessionStorage.clear();
});

afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
});

describe('useDraftServerSync', () => {
  it('starts periodic sync once a projectId and working copy are present', async () => {
    const upsertSpy = vi.spyOn(draftsApi, 'upsertDraftSync').mockResolvedValue({
      draft_json: scene(),
      client_seq: 1,
      last_autosaved_at: '2026-01-01T00:00:00Z',
      expires_at: '2026-01-02T00:00:00Z',
      applied: true,
    });

    renderHook(() => useDraftServerSync('proj-1', scene(), { intervalMs: 1000 }));

    await vi.advanceTimersByTimeAsync(1000);

    expect(upsertSpy).toHaveBeenCalledTimes(1);
    const [projectId, sessionId] = upsertSpy.mock.calls[0];
    expect(projectId).toBe('proj-1');
    expect(typeof sessionId).toBe('string');
    expect(sessionId.length).toBeGreaterThan(0);
  });

  it('stops the previous project timer when projectId changes', async () => {
    const upsertSpy = vi.spyOn(draftsApi, 'upsertDraftSync').mockResolvedValue({
      draft_json: scene(),
      client_seq: 1,
      last_autosaved_at: '2026-01-01T00:00:00Z',
      expires_at: '2026-01-02T00:00:00Z',
      applied: true,
    });

    const { rerender } = renderHook(
      ({ projectId }: { projectId: string }) =>
        useDraftServerSync(projectId, scene(), { intervalMs: 1000 }),
      { initialProps: { projectId: 'proj-a' } },
    );

    rerender({ projectId: 'proj-b' });

    await vi.advanceTimersByTimeAsync(1000);

    // Only proj-b's timer should have fired — proj-a's was stopped on switch.
    expect(upsertSpy).toHaveBeenCalledTimes(1);
    expect(upsertSpy.mock.calls[0][0]).toBe('proj-b');
  });

  it('does not start any timer when projectId is undefined', async () => {
    const upsertSpy = vi.spyOn(draftsApi, 'upsertDraftSync').mockResolvedValue({
      draft_json: scene(),
      client_seq: 1,
      last_autosaved_at: '2026-01-01T00:00:00Z',
      expires_at: '2026-01-02T00:00:00Z',
      applied: true,
    });

    renderHook(() => useDraftServerSync(undefined, scene(), { intervalMs: 1000 }));
    await vi.advanceTimersByTimeAsync(5000);

    expect(upsertSpy).not.toHaveBeenCalled();
  });

  it('syncAfterMeaningfulAction triggers an immediate sync with the overridden snapshot', async () => {
    const upsertSpy = vi.spyOn(draftsApi, 'upsertDraftSync').mockResolvedValue({
      draft_json: scene(),
      client_seq: 1,
      last_autosaved_at: '2026-01-01T00:00:00Z',
      expires_at: '2026-01-02T00:00:00Z',
      applied: true,
    });

    const { result } = renderHook(() =>
      useDraftServerSync('proj-1', scene(), { intervalMs: 10_000 }),
    );

    result.current.syncAfterMeaningfulAction(scene('restored'));
    await vi.advanceTimersByTimeAsync(0);

    expect(upsertSpy).toHaveBeenCalledTimes(1);
    expect(upsertSpy.mock.calls[0][2].draft_json).toEqual(scene('restored'));
  });

  it('fires a bounded, non-blocking keepalive sync on pagehide', async () => {
    const upsertSpy = vi.spyOn(draftsApi, 'upsertDraftSync').mockResolvedValue({
      draft_json: scene(),
      client_seq: 1,
      last_autosaved_at: '2026-01-01T00:00:00Z',
      expires_at: '2026-01-02T00:00:00Z',
      applied: true,
    });

    renderHook(() => useDraftServerSync('proj-1', scene(), { intervalMs: 10_000 }));

    const before = performance.now();
    window.dispatchEvent(new Event('pagehide'));
    const dispatchDuration = performance.now() - before;

    // Dispatch itself must return immediately — the sync call is
    // fire-and-forget, never awaited synchronously inside the handler.
    expect(dispatchDuration).toBeLessThan(50);
    expect(upsertSpy).toHaveBeenCalledTimes(1);
    expect(upsertSpy.mock.calls[0][3]).toEqual({ keepalive: true });
  });

  it('fires the same bounded keepalive sync when the tab becomes hidden', async () => {
    const upsertSpy = vi.spyOn(draftsApi, 'upsertDraftSync').mockResolvedValue({
      draft_json: scene(),
      client_seq: 1,
      last_autosaved_at: '2026-01-01T00:00:00Z',
      expires_at: '2026-01-02T00:00:00Z',
      applied: true,
    });

    renderHook(() => useDraftServerSync('proj-1', scene(), { intervalMs: 10_000 }));

    Object.defineProperty(document, 'visibilityState', { value: 'hidden', configurable: true });
    document.dispatchEvent(new Event('visibilitychange'));

    expect(upsertSpy).toHaveBeenCalledTimes(1);
    expect(upsertSpy.mock.calls[0][3]).toEqual({ keepalive: true });
  });

  it('deleteServerDraft calls through to deleteDraftSync and swallows failures', async () => {
    const deleteSpy = vi
      .spyOn(draftsApi, 'deleteDraftSync')
      .mockRejectedValue(new Error('network down'));

    const { result } = renderHook(() => useDraftServerSync('proj-1', scene()));

    await expect(result.current.deleteServerDraft()).resolves.toBeUndefined();
    expect(deleteSpy).toHaveBeenCalledWith('proj-1', expect.any(String));
  });

  it('stops the periodic timer on unmount, so no dangling interval outlives the component', async () => {
    const upsertSpy = vi.spyOn(draftsApi, 'upsertDraftSync').mockResolvedValue({
      draft_json: scene(),
      client_seq: 1,
      last_autosaved_at: '2026-01-01T00:00:00Z',
      expires_at: '2026-01-02T00:00:00Z',
      applied: true,
    });

    const { unmount } = renderHook(() =>
      useDraftServerSync('proj-1', scene(), { intervalMs: 1000 }),
    );
    unmount();

    await vi.advanceTimersByTimeAsync(5000);
    expect(upsertSpy).not.toHaveBeenCalled();
  });

  // Issue #125: `DraftServerSyncController`'s periodic setInterval kept
  // firing after `deleteServerDraft()` cleared the row once, unconditionally
  // PUTing the working copy back on its next tick even though nothing had
  // changed. These reproduce that regression against the hook (the real
  // wiring `EditorWorkspace.tsx` calls into) rather than only the
  // underlying controller.
  describe('issue #125: deleteServerDraft gates further writes until a real edit', () => {
    function okResponse() {
      return {
        draft_json: scene(),
        client_seq: 1,
        last_autosaved_at: '2026-01-01T00:00:00Z',
        expires_at: '2026-01-02T00:00:00Z',
        applied: true,
      };
    }

    it('reproduces the evidence sequence (POST /versions/ -> DELETE /draft/<session>/ -> would-be PUT /draft/<session>/) and asserts the PUT no longer happens', async () => {
      const upsertSpy = vi.spyOn(draftsApi, 'upsertDraftSync').mockResolvedValue(okResponse());
      vi.spyOn(draftsApi, 'deleteDraftSync').mockResolvedValue(undefined);
      const snapshot = scene();

      const { result } = renderHook(() =>
        useDraftServerSync('proj-1', snapshot, { intervalMs: 1000 }),
      );

      // Simulates EditorWorkspace.tsx's handleVersionSaved: an explicit
      // Save (POST /versions/, not modeled here since this hook doesn't
      // call it) already completed, and this is the cleanup call it makes
      // right after.
      await result.current.deleteServerDraft();

      // The next two periodic ticks (well past DEFAULT_SYNC_INTERVAL_MS)
      // must not recreate the draft, since the working copy hasn't changed.
      await vi.advanceTimersByTimeAsync(1000);
      await vi.advanceTimersByTimeAsync(1000);

      expect(upsertSpy).not.toHaveBeenCalled();
    });

    it('resumes periodic writes once the working copy actually changes after deleteServerDraft', async () => {
      const upsertSpy = vi.spyOn(draftsApi, 'upsertDraftSync').mockResolvedValue(okResponse());
      vi.spyOn(draftsApi, 'deleteDraftSync').mockResolvedValue(undefined);

      const { result, rerender } = renderHook(
        ({ workingCopy }: { workingCopy: ReturnType<typeof scene> }) =>
          useDraftServerSync('proj-1', workingCopy, { intervalMs: 1000 }),
        { initialProps: { workingCopy: scene() } },
      );

      await result.current.deleteServerDraft();
      rerender({ workingCopy: scene('scene-2') });

      await vi.advanceTimersByTimeAsync(1000);
      expect(upsertSpy).toHaveBeenCalledTimes(1);
    });

    it('deleteServerDraft accepts a snapshotOverride (for restore/AI-accept, whose workingCopy prop has not re-rendered yet)', async () => {
      const upsertSpy = vi.spyOn(draftsApi, 'upsertDraftSync').mockResolvedValue(okResponse());
      vi.spyOn(draftsApi, 'deleteDraftSync').mockResolvedValue(undefined);
      const restoredScene = scene('restored-scene');

      // The hook's own `workingCopy` prop still holds the pre-restore
      // scene (mirroring EditorWorkspace.tsx calling this synchronously
      // before its own re-render lands) -- the override must be what gets
      // marked clean, not the stale prop.
      const { result } = renderHook(() =>
        useDraftServerSync('proj-1', scene('pre-restore-scene'), { intervalMs: 1000 }),
      );

      await result.current.deleteServerDraft(restoredScene);
      result.current.syncAfterMeaningfulAction(restoredScene);
      await vi.advanceTimersByTimeAsync(0);

      expect(upsertSpy).not.toHaveBeenCalled();
    });

    it('surfaces a failed cleanup delete via getLastFailure instead of silently swallowing it', async () => {
      vi.spyOn(draftsApi, 'deleteDraftSync').mockRejectedValue(new Error('network down'));

      const { result } = renderHook(() => useDraftServerSync('proj-1', scene()));

      await result.current.deleteServerDraft();

      expect(result.current.getLastFailure()).toMatchObject({
        kind: 'unknown',
        message: 'network down',
      });
    });

    it('a failed cleanup delete still gates periodic sync (the orphaned row stays inert rather than being kept alive)', async () => {
      const upsertSpy = vi.spyOn(draftsApi, 'upsertDraftSync').mockResolvedValue(okResponse());
      vi.spyOn(draftsApi, 'deleteDraftSync').mockRejectedValue(new Error('network down'));
      const snapshot = scene();

      const { result } = renderHook(() =>
        useDraftServerSync('proj-1', snapshot, { intervalMs: 1000 }),
      );

      await result.current.deleteServerDraft();
      await vi.advanceTimersByTimeAsync(2000);

      expect(upsertSpy).not.toHaveBeenCalled();
    });
  });

  it('offline/timeout/validation failures surface via getLastFailure without throwing', async () => {
    const upsertSpy = vi
      .spyOn(draftsApi, 'upsertDraftSync')
      .mockRejectedValue(new DOMException('aborted', 'AbortError'));

    const { result } = renderHook(() =>
      useDraftServerSync('proj-1', scene(), { intervalMs: 1000 }),
    );

    await vi.advanceTimersByTimeAsync(1000);

    expect(upsertSpy).toHaveBeenCalled();
    expect(result.current.getLastFailure()).toMatchObject({ kind: 'timeout' });
    expect(result.current.getLastSyncedAt()).toBeNull();
  });
});
