import 'fake-indexeddb/auto';

import { IDBFactory } from 'fake-indexeddb';
import { beforeEach, describe, expect, it } from 'vitest';

import type { SceneDocument } from '../api/projects';
import {
  DEFAULT_DEBOUNCE_MS,
  DraftAutosaveController,
  deleteDraftRecord,
  getDraftRecord,
  openDraftDatabase,
  putDraftRecord,
  summarizeSceneChange,
  type DraftRecord,
} from './draftAutosave';

function scene(overrides: Partial<SceneDocument> = {}): SceneDocument {
  return {
    layers: [{ id: 'layer-1' }],
    shapes: [],
    groups: [],
    bindings: [],
    graph: { nodes: [], connections: [] },
    ...overrides,
  };
}

function wait(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

beforeEach(() => {
  // Fresh in-memory IndexedDB per test so writes from one test never leak
  // into another.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  (globalThis as any).indexedDB = new IDBFactory();
});

describe('DEFAULT_DEBOUNCE_MS', () => {
  it('matches the plan\'s "approximately 1-2 seconds after the last edit" window', () => {
    expect(DEFAULT_DEBOUNCE_MS).toBeGreaterThanOrEqual(1000);
    expect(DEFAULT_DEBOUNCE_MS).toBeLessThanOrEqual(2000);
  });
});

describe('summarizeSceneChange', () => {
  it('is deterministic for the same before/after pair', () => {
    const before = scene({ shapes: [{ id: 's1', type: 'circle' }] });
    const after = scene({
      shapes: [
        { id: 's1', type: 'circle' },
        { id: 's2', type: 'rect' },
        { id: 's3', type: 'rect' },
      ],
      bindings: [{ id: 'b1', targetScope: 'shape', targetId: 's2' }],
    });
    const first = summarizeSceneChange(before, after);
    const second = summarizeSceneChange(before, after);
    expect(first).toBe(second);
    expect(first).toBe('2 shapes added, 1 binding added');
  });

  it('reports changed items, not just added/removed', () => {
    const before = scene({ shapes: [{ id: 's1', type: 'circle', radius: 10 }] });
    const after = scene({ shapes: [{ id: 's1', type: 'circle', radius: 20 }] });
    expect(summarizeSceneChange(before, after)).toBe('1 shape changed');
  });

  it('reports removals', () => {
    const before = scene({
      shapes: [
        { id: 's1', type: 'circle' },
        { id: 's2', type: 'rect' },
      ],
    });
    const after = scene({ shapes: [{ id: 's1', type: 'circle' }] });
    expect(summarizeSceneChange(before, after)).toBe('1 shape removed');
  });

  it('falls back to a null baseline treating everything as added', () => {
    const after = scene({ shapes: [{ id: 's1', type: 'circle' }] });
    expect(summarizeSceneChange(null, after)).toBe('1 shape added, 1 layer added');
  });

  it('reports no changes when before and after are equivalent', () => {
    const before = scene({ shapes: [{ id: 's1', type: 'circle' }] });
    const after = scene({ shapes: [{ id: 's1', type: 'circle' }] });
    expect(summarizeSceneChange(before, after)).toBe('No changes detected');
  });
});

describe('IndexedDB read/write/delete primitives', () => {
  it('round-trips a well-formed record', async () => {
    const db = await openDraftDatabase();
    const record: DraftRecord = {
      projectId: 'proj-1',
      userKey: 'alice',
      sessionId: 'sess-1',
      sceneJson: scene(),
      savedAt: new Date().toISOString(),
      changeSummary: 'No changes detected',
      writeSeq: 1,
    };
    await putDraftRecord(db, record);
    const read = await getDraftRecord(db, 'proj-1');
    expect(read).toEqual(record);

    await deleteDraftRecord(db, 'proj-1');
    expect(await getDraftRecord(db, 'proj-1')).toBeNull();
    db.close();
  });

  it('treats a corrupt stored record as no draft, and clears it', async () => {
    const db = await openDraftDatabase();
    // Bypass the typed API to write a malformed record directly, simulating
    // corrupt/unreadable existing data (e.g. from a previous schema).
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction('drafts', 'readwrite');
      tx.objectStore('drafts').put({ projectId: 'proj-2', garbage: true });
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });

    const read = await getDraftRecord(db, 'proj-2');
    expect(read).toBeNull();

    // And it was cleaned up, not left behind to resurface later.
    const readAgain = await getDraftRecord(db, 'proj-2');
    expect(readAgain).toBeNull();
    db.close();
  });
});

// These use a short real debounce window (rather than mocking timers, which
// fights with fake-indexeddb's own internal scheduling) so the tests run
// fast while still exercising real setTimeout/clearTimeout and real async
// IndexedDB operations end to end.
describe('DraftAutosaveController debounce and race safety', () => {
  const DEBOUNCE_MS = 40;

  it('collapses a rapid burst of edits into a single write, timed from the last edit', async () => {
    const controller = new DraftAutosaveController({ debounceMs: DEBOUNCE_MS });
    const identity = { projectId: 'proj-burst', userKey: 'alice', sessionId: 'sess-1' };
    const baseline = scene();

    // A rapid burst: an edit every 10ms, well under the debounce window
    // each time, so only the very last one should ever persist.
    for (let i = 1; i <= 5; i++) {
      controller.schedule(identity, baseline, scene({ shapes: [{ id: `s${i}`, type: 'circle' }] }));
      await wait(10);
    }

    // Not yet written: less than DEBOUNCE_MS has passed since the *last*
    // edit in the burst.
    expect(controller.getLastWrite()).toBeNull();

    // Advance past the debounce window measured from the last edit.
    await wait(DEBOUNCE_MS + 40);

    const write = controller.getLastWrite();
    expect(write).not.toBeNull();
    expect(write?.writeSeq).toBe(5); // only the last scheduled write ever fired
    expect((write?.sceneJson.shapes as unknown[])?.[0]).toMatchObject({ id: 's5' });
  });

  it('records project/session identity, scene data, a timestamp, and a deterministic summary', async () => {
    const controller = new DraftAutosaveController({ debounceMs: DEBOUNCE_MS });
    const identity = { projectId: 'proj-shape', userKey: 'alice', sessionId: 'sess-1' };
    const before = new Date();
    controller.schedule(identity, scene(), scene({ shapes: [{ id: 's1', type: 'circle' }] }));
    await wait(DEBOUNCE_MS + 40);

    const write = controller.getLastWrite();
    expect(write).toMatchObject({
      projectId: 'proj-shape',
      userKey: 'alice',
      sessionId: 'sess-1',
      changeSummary: '1 shape added',
    });
    expect(write?.sceneJson).toEqual(scene({ shapes: [{ id: 's1', type: 'circle' }] }));
    expect(new Date(write!.savedAt).getTime()).toBeGreaterThanOrEqual(before.getTime());
  });

  it('never lets an older delayed write overwrite a newer one', async () => {
    const controller = new DraftAutosaveController({ debounceMs: DEBOUNCE_MS });
    const identity = { projectId: 'proj-race', userKey: 'alice', sessionId: 'sess-1' };
    const baseline = scene();

    controller.schedule(identity, baseline, scene({ shapes: [{ id: 'old', type: 'circle' }] }));
    // Before the first write's debounce fires, a newer edit arrives and
    // reschedules — cancel-and-reschedule means the old timer never fires
    // at all.
    await wait(DEBOUNCE_MS / 2);
    controller.schedule(identity, baseline, scene({ shapes: [{ id: 'new', type: 'rect' }] }));
    await wait(DEBOUNCE_MS + 40);

    const write = controller.getLastWrite();
    expect(write).not.toBeNull();
    expect((write?.sceneJson.shapes as unknown[])?.[0]).toMatchObject({ id: 'new' });

    // Confirm nothing else fires later that would clobber it.
    await wait(DEBOUNCE_MS + 40);
    const stillWrite = controller.getLastWrite();
    expect((stillWrite?.sceneJson.shapes as unknown[])?.[0]).toMatchObject({ id: 'new' });
  });

  it('aborts a write that is superseded while its DB open is still pending', async () => {
    const identity = { projectId: 'proj-async-race', userKey: 'alice', sessionId: 'sess-1' };
    const baseline = scene();
    const realDb = await openDraftDatabase();

    let resolveFirstOpen: (db: IDBDatabase) => void = () => {};
    let openCalls = 0;
    const controller = new DraftAutosaveController({
      debounceMs: DEBOUNCE_MS,
      openDb: () =>
        new Promise<IDBDatabase>((resolve) => {
          openCalls += 1;
          if (openCalls === 1) {
            resolveFirstOpen = resolve; // deliberately left pending for now
          } else {
            resolve(realDb);
          }
        }),
    });

    controller.schedule(identity, baseline, scene({ shapes: [{ id: 'stale', type: 'circle' }] }));
    await wait(DEBOUNCE_MS + 20);
    // The first write's DB open is now pending (never resolved yet), so
    // its continuation is blocked before ever reaching the seq check. A
    // newer edit is scheduled and reaches the exact same point, blocked on
    // the same (cached, still-pending) DB handle.
    controller.schedule(identity, baseline, scene({ shapes: [{ id: 'fresh', type: 'rect' }] }));
    await wait(DEBOUNCE_MS + 40);
    expect(controller.getLastWrite()).toBeNull(); // neither has persisted yet

    // Now unblock the DB handle both writes are awaiting. The stale
    // (first) write's post-open seq check must find itself superseded and
    // abort; only the fresh (second, latest) write may persist.
    resolveFirstOpen(realDb);
    await wait(20);
    expect(controller.getLastWrite()).not.toBeNull();
    expect((controller.getLastWrite()?.sceneJson.shapes as unknown[])?.[0]).toMatchObject({
      id: 'fresh',
    });
    realDb.close();
  });

  it('clearDraft cancels any pending write and removes the persisted record', async () => {
    const controller = new DraftAutosaveController({ debounceMs: DEBOUNCE_MS });
    const identity = { projectId: 'proj-clear', userKey: 'alice', sessionId: 'sess-1' };
    controller.schedule(identity, scene(), scene({ shapes: [{ id: 's1', type: 'circle' }] }));

    await controller.clearDraft('proj-clear');
    // The pending write must not fire after clear, even once its debounce
    // window would otherwise have elapsed.
    await wait(DEBOUNCE_MS + 40);

    expect(controller.getLastWrite()).toBeNull();
    expect(await controller.readDraft('proj-clear')).toBeNull();
  });

  it('failure modes are contained: unavailable storage and quota exceeded never throw or crash', async () => {
    const unavailable = new DraftAutosaveController({
      debounceMs: DEBOUNCE_MS,
      openDb: () => Promise.reject(new ReferenceError('indexedDB is not available')),
    });
    unavailable.schedule(
      { projectId: 'proj-unavailable', userKey: 'alice', sessionId: 'sess-1' },
      scene(),
      scene({ shapes: [{ id: 's1', type: 'circle' }] }),
    );
    await wait(DEBOUNCE_MS + 40);
    expect(unavailable.getLastWrite()).toBeNull();
    expect(unavailable.getLastFailure()?.kind).toBe('unavailable');
    // clearDraft/readDraft must resolve safely rather than reject/throw.
    await expect(unavailable.clearDraft('proj-unavailable')).resolves.toBeUndefined();
    await expect(unavailable.readDraft('proj-unavailable')).resolves.toBeNull();

    const quotaFull = new DraftAutosaveController({
      debounceMs: DEBOUNCE_MS,
      openDb: () => Promise.reject(new DOMException('quota', 'QuotaExceededError')),
    });
    quotaFull.schedule(
      { projectId: 'proj-quota', userKey: 'alice', sessionId: 'sess-1' },
      scene(),
      scene({ shapes: [{ id: 's1', type: 'circle' }] }),
    );
    await wait(DEBOUNCE_MS + 40);
    expect(quotaFull.getLastFailure()?.kind).toBe('quota-exceeded');
    expect(quotaFull.getLastWrite()).toBeNull();
  });

  it('scopes writes per project so switching projects cannot leak or overwrite another project draft', async () => {
    const controller = new DraftAutosaveController({ debounceMs: DEBOUNCE_MS });
    controller.schedule(
      { projectId: 'proj-a', userKey: 'alice', sessionId: 'sess-1' },
      scene(),
      scene({ shapes: [{ id: 'a1', type: 'circle' }] }),
    );
    await wait(DEBOUNCE_MS + 40);
    expect(controller.getLastWrite()?.projectId).toBe('proj-a');

    // A pending write scheduled for project A is cancelled (not redirected)
    // when the app switches to project B before it fires.
    controller.schedule(
      { projectId: 'proj-a', userKey: 'alice', sessionId: 'sess-1' },
      scene(),
      scene({ shapes: [{ id: 'a2', type: 'circle' }] }),
    );
    controller.cancelPending();
    controller.schedule(
      { projectId: 'proj-b', userKey: 'alice', sessionId: 'sess-1' },
      scene(),
      scene({ shapes: [{ id: 'b1', type: 'rect' }] }),
    );
    await wait(DEBOUNCE_MS + 40);

    expect(controller.getLastWrite()?.projectId).toBe('proj-b');
    // Project A's earlier persisted draft is untouched — still readable,
    // still has its own (older) content, not project B's.
    const draftA = await controller.readDraft('proj-a');
    expect(draftA?.projectId).toBe('proj-a');
    expect((draftA?.sceneJson.shapes as unknown[])?.[0]).toMatchObject({ id: 'a1' });
  });
});
