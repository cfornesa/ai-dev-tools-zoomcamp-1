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

// Issue #126, acceptance criterion 3: the write path now runs every scene
// through `validateScene` before persisting (see `draftAutosave.ts`'s
// `performWrite`), so this fixture must itself be a schema-valid
// `SceneDocument` (every field `schema/scene.schema.json`'s top-level
// `required` lists) rather than the pre-#126 minimal shape (just
// `layers`/`shapes`/`groups`/`bindings`/`graph`) — a scene missing
// `schemaVersion`/`id`/`canvas`/`renderer`/`accessibility`/`randomness`
// would now be silently dropped by the very validation gate this suite
// exercises, which would make every write-path test below fail for a
// reason unrelated to what it's actually testing (debounce/race
// behavior, not schema conformance). Individual tests still layer
// `overrides` on top for the specific field(s) they care about (e.g. a
// duplicate-id `shapes` array).
function scene(overrides: Partial<SceneDocument> = {}): SceneDocument {
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
  } as SceneDocument;
}

// Same rationale as `scene()` above: a shape passed through the (now
// validated) write path needs every field `schema/scene.schema.json`'s
// per-type `allOf` requires (e.g. `radius` for a circle, `width`/`height`/
// `cornerRadius` for a rect) — the tests below only ever vary `id`/`type`,
// so this fills in schema-satisfying defaults for the two types used here.
function testShape(
  id: string,
  type: 'circle' | 'rect' = 'circle',
  layerId = 'layer-1',
): Record<string, unknown> {
  const base = {
    id,
    type,
    layerId,
    groupId: null,
    transform: { x: 0, y: 0, scaleX: 1, scaleY: 1, rotation: 0, opacity: 1 },
    style: { fill: '#000000', stroke: null, strokeWidth: 0 },
  };
  return type === 'circle'
    ? { ...base, radius: 10 }
    : { ...base, width: 10, height: 10, cornerRadius: 0 };
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
      controller.schedule(identity, baseline, scene({ shapes: [testShape(`s${i}`, 'circle')] }));
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
    controller.schedule(identity, scene(), scene({ shapes: [testShape('s1', 'circle')] }));
    await wait(DEBOUNCE_MS + 40);

    const write = controller.getLastWrite();
    expect(write).toMatchObject({
      projectId: 'proj-shape',
      userKey: 'alice',
      sessionId: 'sess-1',
      changeSummary: '1 shape added',
    });
    expect(write?.sceneJson).toEqual(scene({ shapes: [testShape('s1', 'circle')] }));
    expect(new Date(write!.savedAt).getTime()).toBeGreaterThanOrEqual(before.getTime());
  });

  it('never lets an older delayed write overwrite a newer one', async () => {
    const controller = new DraftAutosaveController({ debounceMs: DEBOUNCE_MS });
    const identity = { projectId: 'proj-race', userKey: 'alice', sessionId: 'sess-1' };
    const baseline = scene();

    controller.schedule(identity, baseline, scene({ shapes: [testShape('old', 'circle')] }));
    // Before the first write's debounce fires, a newer edit arrives and
    // reschedules — cancel-and-reschedule means the old timer never fires
    // at all.
    await wait(DEBOUNCE_MS / 2);
    controller.schedule(identity, baseline, scene({ shapes: [testShape('new', 'rect')] }));
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

    controller.schedule(identity, baseline, scene({ shapes: [testShape('stale', 'circle')] }));
    await wait(DEBOUNCE_MS + 20);
    // The first write's DB open is now pending (never resolved yet), so
    // its continuation is blocked before ever reaching the seq check. A
    // newer edit is scheduled and reaches the exact same point, blocked on
    // the same (cached, still-pending) DB handle.
    controller.schedule(identity, baseline, scene({ shapes: [testShape('fresh', 'rect')] }));
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

  it('issue #125 regression: a write mid-flight (timer fired, awaiting the IndexedDB handle) at the exact moment clearDraft() runs during Save is still correctly superseded', async () => {
    const identity = { projectId: 'proj-save-race', userKey: 'alice', sessionId: 'sess-1' };
    const baseline = scene();
    const realDb = await openDraftDatabase();

    let resolveOpen: (db: IDBDatabase) => void = () => {};
    const controller = new DraftAutosaveController({
      debounceMs: DEBOUNCE_MS,
      openDb: () =>
        new Promise<IDBDatabase>((resolve) => {
          resolveOpen = resolve;
        }),
    });

    controller.schedule(
      identity,
      baseline,
      scene({ shapes: [testShape('about-to-be-superseded', 'circle')] }),
    );
    await wait(DEBOUNCE_MS + 20);
    // The debounced write's timer has fired and it's now blocked awaiting
    // the (still-pending, shared) DB handle -- exactly the "mid-flight"
    // moment this criterion is about. Save fires clearDraft() for the same
    // project at this exact instant: `cancelPending()` bumps `seq`
    // synchronously (before clearDraft's own `await this.getDb()`, which
    // shares the same still-pending open), so the stale write is already
    // superseded regardless of when the DB handle actually resolves.
    const clearPromise = controller.clearDraft('proj-save-race');

    // Now unblock the DB handle both clearDraft() and the stale write are
    // awaiting. The stale write's post-open seq check must find itself
    // superseded and abort -- it must never resurrect a draft clearDraft()
    // is in the middle of removing.
    resolveOpen(realDb);
    await clearPromise;
    await wait(40);

    expect(controller.getLastWrite()).toBeNull();
    expect(await controller.readDraft('proj-save-race')).toBeNull();
    realDb.close();
  });

  it('clearDraft cancels any pending write and removes the persisted record', async () => {
    const controller = new DraftAutosaveController({ debounceMs: DEBOUNCE_MS });
    const identity = { projectId: 'proj-clear', userKey: 'alice', sessionId: 'sess-1' };
    controller.schedule(identity, scene(), scene({ shapes: [testShape('s1', 'circle')] }));

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
      scene({ shapes: [testShape('s1', 'circle')] }),
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
      scene({ shapes: [testShape('s1', 'circle')] }),
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
      scene({ shapes: [testShape('a1', 'circle')] }),
    );
    await wait(DEBOUNCE_MS + 40);
    expect(controller.getLastWrite()?.projectId).toBe('proj-a');

    // A pending write scheduled for project A is cancelled (not redirected)
    // when the app switches to project B before it fires.
    controller.schedule(
      { projectId: 'proj-a', userKey: 'alice', sessionId: 'sess-1' },
      scene(),
      scene({ shapes: [testShape('a2', 'circle')] }),
    );
    controller.cancelPending();
    controller.schedule(
      { projectId: 'proj-b', userKey: 'alice', sessionId: 'sess-1' },
      scene(),
      scene({ shapes: [testShape('b1', 'rect')] }),
    );
    await wait(DEBOUNCE_MS + 40);

    expect(controller.getLastWrite()?.projectId).toBe('proj-b');
    // Project A's earlier persisted draft is untouched — still readable,
    // still has its own (older) content, not project B's.
    const draftA = await controller.readDraft('proj-a');
    expect(draftA?.projectId).toBe('proj-a');
    expect((draftA?.sceneJson.shapes as unknown[])?.[0]).toMatchObject({ id: 'a1' });
  });

  // Issue #125: restoring a historical version or accepting an AI proposal
  // both replace the working copy with content that already matches what
  // was just persisted server-side -- which still reaches `schedule()` as
  // an ordinary working-copy change. Without a "nothing unsaved" gate, that
  // would debounce-write a redundant "no changes since last save" draft a
  // moment later, duplicating content the new persisted version already
  // captures. These cover `markClean()`/`resetCleanBaseline()` directly.
  describe('markClean/resetCleanBaseline gating', () => {
    it('prevents scheduling a write for a snapshot matching the clean baseline, cancelling any already-pending one', async () => {
      const controller = new DraftAutosaveController({ debounceMs: DEBOUNCE_MS });
      const identity = { projectId: 'proj-clean', userKey: 'alice', sessionId: 'sess-1' };
      const clean = scene({ shapes: [testShape('saved', 'circle')] });

      // A pending write from before the clean baseline was set.
      controller.schedule(
        identity,
        scene(),
        scene({ shapes: [testShape('stale-pending', 'circle')] }),
      );
      controller.markClean(clean);
      controller.schedule(identity, scene(), clean);

      await wait(DEBOUNCE_MS + 40);
      expect(controller.getLastWrite()).toBeNull();
    });

    it('resumes scheduling once a genuine edit differs from the clean baseline', async () => {
      const controller = new DraftAutosaveController({ debounceMs: DEBOUNCE_MS });
      const identity = { projectId: 'proj-resume', userKey: 'alice', sessionId: 'sess-1' };
      const clean = scene();

      controller.markClean(clean);
      controller.schedule(identity, clean, scene({ shapes: [testShape('new-edit', 'circle')] }));

      await wait(DEBOUNCE_MS + 40);
      const write = controller.getLastWrite();
      expect(write).not.toBeNull();
      expect((write?.sceneJson.shapes as unknown[])?.[0]).toMatchObject({ id: 'new-edit' });
    });

    it('resetCleanBaseline restores normal scheduling', async () => {
      const controller = new DraftAutosaveController({ debounceMs: DEBOUNCE_MS });
      const identity = { projectId: 'proj-reset', userKey: 'alice', sessionId: 'sess-1' };
      const snapshot = scene({ shapes: [testShape('s1', 'circle')] });

      controller.markClean(snapshot);
      controller.resetCleanBaseline();
      controller.schedule(identity, null, snapshot);

      await wait(DEBOUNCE_MS + 40);
      expect(controller.getLastWrite()).not.toBeNull();
    });
  });

  // Issue #126, acceptance criterion 3: `scenes/validation.py` and
  // `../validation/scene.ts` both reject a scene with duplicate shape
  // `id`s within `shapes` (the `duplicateId` rule) on every other path
  // that persists a scene (explicit Save, server draft PUT, version
  // restore, AI-proposal accept — see `scenes/models.py`'s
  // `SceneVersion.save`/`EditSessionDraft.save`, both of which call
  // `validate_scene`), but this local IndexedDB write had no validation
  // gate of its own before this issue. These are the write path's own
  // dedicated pass/fail tests for that gate.
  describe('issue #126: duplicateId validation gate on the local write path', () => {
    it('drops a scene with duplicate shape ids and reports it via getLastFailure, without persisting anything', async () => {
      const controller = new DraftAutosaveController({ debounceMs: DEBOUNCE_MS });
      const identity = { projectId: 'proj-dup-id', userKey: 'alice', sessionId: 'sess-1' };
      const duplicateScene = scene({
        shapes: [testShape('dup', 'circle'), testShape('dup', 'rect')],
      });

      controller.schedule(identity, scene(), duplicateScene);
      await wait(DEBOUNCE_MS + 40);

      expect(controller.getLastWrite()).toBeNull();
      expect(controller.getLastFailure()?.kind).toBe('corrupt-data');
      expect(await controller.readDraft('proj-dup-id')).toBeNull();
    });

    it('a valid (no duplicate ids) scene still writes normally through the same gate', async () => {
      const controller = new DraftAutosaveController({ debounceMs: DEBOUNCE_MS });
      const identity = { projectId: 'proj-valid', userKey: 'alice', sessionId: 'sess-1' };
      const validScene = scene({
        layers: [
          { id: 'layer-1', name: 'Layer 1', order: 0, visible: true, locked: false },
          { id: 'layer-2', name: 'Layer 2', order: 1, visible: true, locked: false },
        ],
        shapes: [testShape('a', 'circle', 'layer-1'), testShape('b', 'rect', 'layer-2')],
      });

      controller.schedule(identity, scene(), validScene);
      await wait(DEBOUNCE_MS + 40);

      expect(controller.getLastFailure()).toBeNull();
      const write = controller.getLastWrite();
      expect(write).not.toBeNull();
      expect(
        ((write as DraftRecord).sceneJson.shapes as unknown[]).map((s) => (s as { id: string }).id),
      ).toEqual(['a', 'b']);
    });

    it('a rejected write is superseded normally: a subsequent valid edit still writes and clears the failure', async () => {
      const controller = new DraftAutosaveController({ debounceMs: DEBOUNCE_MS });
      const identity = {
        projectId: 'proj-recover-after-dup',
        userKey: 'alice',
        sessionId: 'sess-1',
      };
      const duplicateScene = scene({
        shapes: [testShape('dup', 'circle'), testShape('dup', 'rect')],
      });
      const fixedScene = scene({ shapes: [testShape('dup', 'circle')] });

      controller.schedule(identity, scene(), duplicateScene);
      await wait(DEBOUNCE_MS + 40);
      expect(controller.getLastFailure()?.kind).toBe('corrupt-data');

      controller.schedule(identity, duplicateScene, fixedScene);
      await wait(DEBOUNCE_MS + 40);

      expect(controller.getLastFailure()).toBeNull();
      expect(controller.getLastWrite()).not.toBeNull();
      expect(await controller.readDraft('proj-recover-after-dup')).not.toBeNull();
    });
  });
});
