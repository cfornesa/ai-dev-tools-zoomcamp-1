import 'fake-indexeddb/auto';

import { renderHook, waitFor } from '@testing-library/react';
import { IDBFactory } from 'fake-indexeddb';
import { beforeEach, describe, expect, it } from 'vitest';

import type { SceneDocument, SceneVersion } from '../api/projects';
import { useDraftAutosave } from './useDraftAutosave';

/**
 * Task 42: the React-hook wiring layer over `../storage/draftAutosave.ts`
 * — that this hook actually schedules writes off real `workingCopy`
 * changes, keys them by project, and exposes `clearDraft`/`readDraft` that
 * `EditorWorkspace.tsx` calls into. The debounce/race-safety/failure-
 * classification behavior itself is covered exhaustively against the
 * engine directly in `draftAutosave.test.ts`; a short `debounceMs` (a
 * test-only hook option, see `UseDraftAutosaveOptions`) keeps these tests
 * fast without changing production behavior, which never passes it.
 */

const DEBOUNCE_MS = 30;

// Issue #126, acceptance criterion 3: `draftAutosave.ts`'s write path now
// runs every scene through `validateScene` before persisting, so this
// fixture must be a schema-valid `SceneDocument` (every field
// `schema/scene.schema.json`'s top-level `required` lists), not the
// pre-#126 minimal shape — otherwise every write in this suite would be
// silently dropped for a reason unrelated to what's under test.
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

// Same rationale: a shape passed through the write path needs every field
// its type requires (e.g. `radius` for a circle) — these tests only ever
// vary `id`/`type`.
function testShape(id: string, type: 'circle' | 'rect' = 'circle'): Record<string, unknown> {
  const base = {
    id,
    type,
    layerId: 'layer-1',
    groupId: null,
    transform: { x: 0, y: 0, scaleX: 1, scaleY: 1, rotation: 0, opacity: 1 },
    style: { fill: '#000000', stroke: null, strokeWidth: 0 },
  };
  return type === 'circle'
    ? { ...base, radius: 10 }
    : { ...base, width: 10, height: 10, cornerRadius: 0 };
}

function version(sceneJson: SceneDocument): SceneVersion {
  return {
    id: 1,
    sequence: 1,
    origin: 'manual',
    change_label: null,
    created_by: 'alice',
    parent: null,
    fork_source_version: null,
    created_at: '2026-01-01T00:00:00Z',
    scene_json: sceneJson,
  };
}

beforeEach(() => {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  (globalThis as any).indexedDB = new IDBFactory();
});

describe('useDraftAutosave', () => {
  it('schedules a debounced write from workingCopy changes and clearDraft removes it', async () => {
    const persisted = version(scene());
    const { result, rerender } = renderHook(
      ({ workingCopy }: { workingCopy: SceneDocument }) =>
        useDraftAutosave('proj-1', workingCopy, persisted, { debounceMs: DEBOUNCE_MS }),
      { initialProps: { workingCopy: scene() } },
    );

    expect(await result.current.readDraft()).toBeNull();

    rerender({ workingCopy: scene({ shapes: [testShape('s1', 'circle')] }) });

    await waitFor(async () => {
      const draft = await result.current.readDraft();
      expect(draft).not.toBeNull();
    });

    const draft = await result.current.readDraft();
    expect(draft).toMatchObject({
      projectId: 'proj-1',
      changeSummary: '1 shape added',
    });
    expect(draft?.sceneJson).toEqual(scene({ shapes: [testShape('s1', 'circle')] }));

    await result.current.clearDraft();
    expect(await result.current.readDraft()).toBeNull();
  });

  it('does not write on every keystroke — only once after the debounce settles', async () => {
    const persisted = version(scene());
    const { result, rerender } = renderHook(
      ({ workingCopy }: { workingCopy: SceneDocument }) =>
        useDraftAutosave('proj-burst', workingCopy, persisted, { debounceMs: DEBOUNCE_MS }),
      { initialProps: { workingCopy: scene() } },
    );

    for (let i = 1; i <= 4; i++) {
      rerender({ workingCopy: scene({ shapes: [testShape(`s${i}`, 'circle')] }) });
      await new Promise((resolve) => setTimeout(resolve, 5));
    }

    await waitFor(async () => {
      const draft = await result.current.readDraft();
      expect(draft).not.toBeNull();
    });

    const draft = await result.current.readDraft();
    expect((draft?.sceneJson.shapes as unknown[])?.[0]).toMatchObject({ id: 's4' });
  });

  it('scopes drafts per project: switching projectId cancels the pending write for the old project', async () => {
    const persisted = version(scene());
    const { rerender } = renderHook(
      ({ projectId, workingCopy }: { projectId: string; workingCopy: SceneDocument }) =>
        useDraftAutosave(projectId, workingCopy, persisted, { debounceMs: DEBOUNCE_MS }),
      { initialProps: { projectId: 'proj-a', workingCopy: scene() } },
    );

    rerender({
      projectId: 'proj-a',
      workingCopy: scene({ shapes: [testShape('a1', 'circle')] }),
    });
    // Switch projects before the debounce for project A's edit fires —
    // that pending write must be cancelled, never landing under project A
    // (or leaking into project B) once the switch happens.
    rerender({ projectId: 'proj-b', workingCopy: scene() });

    await new Promise((resolve) => setTimeout(resolve, DEBOUNCE_MS + 60));

    // `readDraft()` reads whichever projectId is current in the hook
    // (proj-b at this point); reach into IndexedDB directly for proj-a's
    // key to confirm the cancelled write for it never persisted.
    const { openDraftDatabase, getDraftRecord } = await import('../storage/draftAutosave');
    const db = await openDraftDatabase();
    expect(await getDraftRecord(db, 'proj-a')).toBeNull();
    db.close();
  });

  it('does not autosave the previous project scene during the switch render', async () => {
    const persisted = version(scene());
    const { rerender } = renderHook(
      ({ projectId, workingCopy }: { projectId: string; workingCopy: SceneDocument }) =>
        useDraftAutosave(projectId, workingCopy, persisted, { debounceMs: DEBOUNCE_MS }),
      {
        initialProps: {
          projectId: 'proj-a',
          workingCopy: scene({ shapes: [testShape('a1', 'circle')] }),
        },
      },
    );

    // Simulate the route changing before the editor has replaced its
    // previous working copy with project B's scene.
    rerender({
      projectId: 'proj-b',
      workingCopy: scene({ shapes: [testShape('a1', 'circle')] }),
    });

    await new Promise((resolve) => setTimeout(resolve, DEBOUNCE_MS + 60));

    const { openDraftDatabase, getDraftRecord } = await import('../storage/draftAutosave');
    const db = await openDraftDatabase();
    expect(await getDraftRecord(db, 'proj-a')).toBeNull();
    expect(await getDraftRecord(db, 'proj-b')).toBeNull();
    db.close();
  });

  // Issue #125: restoring a historical version or accepting an AI proposal
  // replace `workingCopy` with content matching what was just persisted —
  // which still reaches this hook's `schedule()` effect as an ordinary
  // working-copy change. Without gating, that would debounce-write a
  // redundant "no changes since last save" local draft a moment later.
  describe('issue #125: clearDraft gates further scheduling until a real edit', () => {
    it('a workingCopy change matching clearDraft(snapshotOverride) does not write a redundant draft', async () => {
      const persisted = version(scene());
      const restoredScene = scene({ shapes: [testShape('restored', 'circle')] });
      const { result, rerender } = renderHook(
        ({ workingCopy }: { workingCopy: SceneDocument }) =>
          useDraftAutosave('proj-1', workingCopy, persisted, { debounceMs: DEBOUNCE_MS }),
        { initialProps: { workingCopy: scene() } },
      );

      // Mirrors EditorWorkspace.tsx's onRestored: clearDraft() is called
      // with the restored scene explicitly (workingCopy hasn't re-rendered
      // into this hook yet), then the component's own setWorkingCopy call
      // lands as an ordinary prop change on the next render.
      await result.current.clearDraft(restoredScene);
      rerender({ workingCopy: restoredScene });

      await new Promise((resolve) => setTimeout(resolve, DEBOUNCE_MS + 60));
      expect(await result.current.readDraft()).toBeNull();
    });

    it('resumes autosave once a genuine edit follows clearDraft', async () => {
      const persisted = version(scene());
      const { result, rerender } = renderHook(
        ({ workingCopy }: { workingCopy: SceneDocument }) =>
          useDraftAutosave('proj-2', workingCopy, persisted, { debounceMs: DEBOUNCE_MS }),
        { initialProps: { workingCopy: scene() } },
      );

      await result.current.clearDraft();
      rerender({ workingCopy: scene({ shapes: [testShape('new-edit', 'rect')] }) });

      await waitFor(async () => {
        const draft = await result.current.readDraft();
        expect(draft).not.toBeNull();
      });
    });

    it('resetCleanBaseline (via a project switch) does not leak a clean baseline from one project to another', async () => {
      const persisted = version(scene());
      const { result, rerender } = renderHook(
        ({ projectId, workingCopy }: { projectId: string; workingCopy: SceneDocument }) =>
          useDraftAutosave(projectId, workingCopy, persisted, { debounceMs: DEBOUNCE_MS }),
        { initialProps: { projectId: 'proj-a', workingCopy: scene() } },
      );

      // Project A was just saved/cleared with this exact scene as the
      // clean baseline.
      await result.current.clearDraft(scene());

      // Switching to project B with the SAME scene content must not be
      // gated by project A's now-stale baseline.
      rerender({ projectId: 'proj-b', workingCopy: scene() });
      rerender({
        projectId: 'proj-b',
        workingCopy: scene({ shapes: [testShape('b1', 'circle')] }),
      });

      await waitFor(async () => {
        const draft = await result.current.readDraft();
        expect(draft).not.toBeNull();
      });
    });
  });

  it('is safe (does not throw) when indexedDB is unavailable', async () => {
    const original = (globalThis as { indexedDB?: unknown }).indexedDB;
    // @ts-expect-error simulating an environment without IndexedDB
    delete globalThis.indexedDB;
    try {
      const persisted = version(scene());
      const { result } = renderHook(() =>
        useDraftAutosave('proj-no-idb', scene({ shapes: [testShape('s1', 'circle')] }), persisted, {
          debounceMs: DEBOUNCE_MS,
        }),
      );
      await new Promise((resolve) => setTimeout(resolve, DEBOUNCE_MS + 40));
      await expect(result.current.readDraft()).resolves.toBeNull();
      await expect(result.current.clearDraft()).resolves.toBeUndefined();
    } finally {
      (globalThis as { indexedDB?: unknown }).indexedDB = original;
    }
  });
});
