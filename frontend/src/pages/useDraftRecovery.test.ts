import 'fake-indexeddb/auto';

import { act, renderHook, waitFor } from '@testing-library/react';
import { IDBFactory } from 'fake-indexeddb';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { ApiError } from '../api/client';
import * as draftsApi from '../api/drafts';
import type { SceneDocument } from '../api/projects';
import { openDraftDatabase, putDraftRecord, type DraftRecord } from '../storage/draftAutosave';
import { useDraftRecovery } from './useDraftRecovery';

/**
 * Task 44: `useDraftRecovery`'s reconciliation policy — the local
 * IndexedDB draft (Task 42) and the server draft (Task 43) are read in
 * parallel and reconciled into at most one recovery candidate, following
 * the documented safe outcomes for each edge case (expired, corrupt,
 * unauthorized, already-deleted, local/server conflict). Runs against a
 * real (fake) IndexedDB and a mocked `../api/drafts.ts`, matching the
 * conventions `useDraftAutosave.test.ts`/`useDraftServerSync.test.ts`
 * already use for their own respective halves of this same feature.
 *
 * Timestamps are computed relative to the real wall clock (not a mocked
 * one) so this file never depends on `vi.useFakeTimers()`, which fights
 * `@testing-library/react`'s `waitFor` polling.
 */

vi.mock('../api/drafts');

const mockedReadDraftSync = vi.mocked(draftsApi.readDraftSync);
const mockedDeleteDraftSync = vi.mocked(draftsApi.deleteDraftSync);

const HOUR_MS = 60 * 60 * 1000;

function isoOffset(msFromNow: number): string {
  return new Date(Date.now() + msFromNow).toISOString();
}

function validCircleShape(id: string) {
  return {
    id,
    type: 'circle',
    layerId: 'layer-1',
    groupId: null,
    transform: { x: 100, y: 100, scaleX: 1, scaleY: 1, rotation: 0, opacity: 1 },
    style: { fill: '#4f46e5', stroke: null, strokeWidth: 0 },
    radius: 50,
  };
}

function blankScene(overrides: Partial<SceneDocument> = {}): SceneDocument {
  return {
    schemaVersion: 1,
    id: 'scene-1',
    canvas: { width: 800, height: 600, backgroundColor: '#ffffff' },
    renderer: { preferred: 'p5' },
    layers: [{ id: 'layer-1', name: 'Layer 1', order: 0, visible: true, locked: false }],
    shapes: [],
    groups: [],
    bindings: [],
    graph: { nodes: [], connections: [] },
    accessibility: { reducedMotion: 'auto' },
    randomness: { seed: 0, enabled: false },
    ...overrides,
  };
}

async function seedLocalDraft(projectId: string, overrides: Partial<DraftRecord> = {}) {
  const db = await openDraftDatabase();
  const record: DraftRecord = {
    projectId,
    userKey: 'alice',
    sessionId: 'sess-local',
    sceneJson: blankScene(),
    savedAt: isoOffset(0),
    changeSummary: '1 shape added',
    writeSeq: 1,
    ...overrides,
  };
  await putDraftRecord(db, record);
}

function notFound() {
  return new ApiError(404, null);
}

beforeEach(() => {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  (globalThis as any).indexedDB = new IDBFactory();
  mockedReadDraftSync.mockReset();
  mockedDeleteDraftSync.mockReset();
  mockedReadDraftSync.mockRejectedValue(notFound());
  mockedDeleteDraftSync.mockResolvedValue(undefined);
  window.sessionStorage.clear();
});

describe('useDraftRecovery', () => {
  it('resolves to "none" when neither a local nor a server draft exists', async () => {
    const { result } = renderHook(() => useDraftRecovery('proj-1', true, blankScene()));
    await waitFor(() => expect(result.current.status).toBe('none'));
    expect(result.current.candidate).toBeNull();
  });

  it('does not start checking until `ready` is true', async () => {
    await seedLocalDraft('proj-1');
    const { result, rerender } = renderHook(
      ({ ready }: { ready: boolean }) => useDraftRecovery('proj-1', ready, blankScene()),
      { initialProps: { ready: false } },
    );
    expect(result.current.status).toBe('checking');
    // Give any stray microtasks a chance to run — nothing should resolve
    // while `ready` is still false.
    await new Promise((resolve) => setTimeout(resolve, 20));
    expect(result.current.status).toBe('checking');

    rerender({ ready: true });
    await waitFor(() => expect(result.current.status).toBe('prompt'));
  });

  it("shows the prompt with the local draft's stored autosave time and change summary", async () => {
    await seedLocalDraft('proj-1', {
      savedAt: isoOffset(-2 * 60_000),
      changeSummary: '2 shapes changed, 1 binding added',
    });
    const { result } = renderHook(() => useDraftRecovery('proj-1', true, blankScene()));
    await waitFor(() => expect(result.current.status).toBe('prompt'));
    expect(result.current.candidate).toMatchObject({
      source: 'local',
      changeSummary: '2 shapes changed, 1 binding added',
    });
  });

  it('shows the prompt with a computed summary when only the server draft exists', async () => {
    const baseline = blankScene();
    const serverScene = blankScene({ shapes: [validCircleShape('s1')] });
    mockedReadDraftSync.mockResolvedValue({
      draft_json: serverScene,
      client_seq: 3,
      last_autosaved_at: isoOffset(-60_000),
      expires_at: isoOffset(HOUR_MS),
    });

    const { result } = renderHook(() => useDraftRecovery('proj-1', true, baseline));
    await waitFor(() => expect(result.current.status).toBe('prompt'));
    expect(result.current.candidate).toMatchObject({
      source: 'server',
      changeSummary: '1 shape added',
    });
  });

  it('picks the genuinely newer draft when both local and server drafts conflict', async () => {
    await seedLocalDraft('proj-1', {
      savedAt: isoOffset(-2 * HOUR_MS),
      changeSummary: 'older local draft',
    });
    mockedReadDraftSync.mockResolvedValue({
      draft_json: blankScene({ shapes: [validCircleShape('s1')] }),
      client_seq: 1,
      last_autosaved_at: isoOffset(-60_000),
      expires_at: isoOffset(HOUR_MS),
    });

    const { result } = renderHook(() => useDraftRecovery('proj-1', true, blankScene()));
    await waitFor(() => expect(result.current.status).toBe('prompt'));
    expect(result.current.candidate?.source).toBe('server');
  });

  it('prefers the local draft on an exact timestamp tie', async () => {
    const tie = isoOffset(-60_000);
    await seedLocalDraft('proj-1', { savedAt: tie });
    mockedReadDraftSync.mockResolvedValue({
      draft_json: blankScene({ shapes: [validCircleShape('s1')] }),
      client_seq: 1,
      last_autosaved_at: tie,
      expires_at: isoOffset(HOUR_MS),
    });

    const { result } = renderHook(() => useDraftRecovery('proj-1', true, blankScene()));
    await waitFor(() => expect(result.current.status).toBe('prompt'));
    expect(result.current.candidate?.source).toBe('local');
  });

  it('policy: an expired local draft (>24h old) behaves as no draft, and is cleared', async () => {
    await seedLocalDraft('proj-1', { savedAt: isoOffset(-25 * HOUR_MS) });
    const { result } = renderHook(() => useDraftRecovery('proj-1', true, blankScene()));
    await waitFor(() => expect(result.current.status).toBe('none'));

    const db = await openDraftDatabase();
    const { getDraftRecord } = await import('../storage/draftAutosave');
    expect(await getDraftRecord(db, 'proj-1')).toBeNull();
  });

  it('policy: corrupt local draft data (fails scene validation) behaves as no draft, and is cleared', async () => {
    await seedLocalDraft('proj-1', {
      sceneJson: { not: 'a valid scene' } as unknown as SceneDocument,
    });
    const { result } = renderHook(() => useDraftRecovery('proj-1', true, blankScene()));
    await waitFor(() => expect(result.current.status).toBe('none'));

    const db = await openDraftDatabase();
    const { getDraftRecord } = await import('../storage/draftAutosave');
    expect(await getDraftRecord(db, 'proj-1')).toBeNull();
  });

  it('policy: unauthorized server draft access fails safe (no prompt, no leaked data)', async () => {
    mockedReadDraftSync.mockRejectedValue(new ApiError(403, null));
    const { result } = renderHook(() => useDraftRecovery('proj-1', true, blankScene()));
    await waitFor(() => expect(result.current.status).toBe('none'));
    expect(result.current.candidate).toBeNull();
  });

  it('policy: a corrupt server draft behaves as no draft and is deleted server-side', async () => {
    mockedReadDraftSync.mockResolvedValue({
      draft_json: { not: 'valid' } as unknown as SceneDocument,
      client_seq: 1,
      last_autosaved_at: isoOffset(-60_000),
      expires_at: isoOffset(HOUR_MS),
    });
    const { result } = renderHook(() => useDraftRecovery('proj-1', true, blankScene()));
    await waitFor(() => expect(result.current.status).toBe('none'));
    expect(mockedDeleteDraftSync).toHaveBeenCalledWith('proj-1', expect.any(String));
  });

  it('policy: an already-deleted server draft (local still present) reconciles to the local draft', async () => {
    await seedLocalDraft('proj-1');
    mockedReadDraftSync.mockRejectedValue(notFound());
    const { result } = renderHook(() => useDraftRecovery('proj-1', true, blankScene()));
    await waitFor(() => expect(result.current.status).toBe('prompt'));
    expect(result.current.candidate?.source).toBe('local');
  });

  it('policy: an already-deleted local draft (server still present) reconciles to the server draft', async () => {
    mockedReadDraftSync.mockResolvedValue({
      draft_json: blankScene({ shapes: [validCircleShape('s1')] }),
      client_seq: 1,
      last_autosaved_at: isoOffset(-60_000),
      expires_at: isoOffset(HOUR_MS),
    });
    const { result } = renderHook(() => useDraftRecovery('proj-1', true, blankScene()));
    await waitFor(() => expect(result.current.status).toBe('prompt'));
    expect(result.current.candidate?.source).toBe('server');
  });

  it('recover() returns the candidate scene and moves status to resolved, without any save/restore call', async () => {
    const recoveredScene = blankScene({ shapes: [validCircleShape('s1')] });
    await seedLocalDraft('proj-1', { sceneJson: recoveredScene });
    const { result } = renderHook(() => useDraftRecovery('proj-1', true, blankScene()));
    await waitFor(() => expect(result.current.status).toBe('prompt'));

    let scene: SceneDocument | null = null;
    act(() => {
      scene = result.current.recover();
    });
    expect(scene).toEqual(recoveredScene);
    expect(result.current.status).toBe('resolved');
  });

  it('discard() clears both the local and server draft before resolving', async () => {
    await seedLocalDraft('proj-1');
    mockedReadDraftSync.mockResolvedValue({
      draft_json: blankScene(),
      client_seq: 1,
      last_autosaved_at: isoOffset(-60_000),
      expires_at: isoOffset(HOUR_MS),
    });
    const { result } = renderHook(() => useDraftRecovery('proj-1', true, blankScene()));
    await waitFor(() => expect(result.current.status).toBe('prompt'));

    await result.current.discard();

    expect(mockedDeleteDraftSync).toHaveBeenCalledTimes(1);
    const db = await openDraftDatabase();
    const { getDraftRecord } = await import('../storage/draftAutosave');
    expect(await getDraftRecord(db, 'proj-1')).toBeNull();
    expect(result.current.status).toBe('resolved');
  });

  it('cancel (never calling recover/discard) leaves both drafts untouched and recoverable', async () => {
    await seedLocalDraft('proj-1');
    const { result, unmount } = renderHook(() => useDraftRecovery('proj-1', true, blankScene()));
    await waitFor(() => expect(result.current.status).toBe('prompt'));

    unmount();

    expect(mockedDeleteDraftSync).not.toHaveBeenCalled();
    const db = await openDraftDatabase();
    const { getDraftRecord } = await import('../storage/draftAutosave');
    expect(await getDraftRecord(db, 'proj-1')).not.toBeNull();
  });
});
