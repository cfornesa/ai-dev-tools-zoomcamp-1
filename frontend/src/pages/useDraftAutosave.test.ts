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

    rerender({ workingCopy: scene({ shapes: [{ id: 's1', type: 'circle' }] }) });

    await waitFor(async () => {
      const draft = await result.current.readDraft();
      expect(draft).not.toBeNull();
    });

    const draft = await result.current.readDraft();
    expect(draft).toMatchObject({
      projectId: 'proj-1',
      changeSummary: '1 shape added',
    });
    expect(draft?.sceneJson).toEqual(scene({ shapes: [{ id: 's1', type: 'circle' }] }));

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
      rerender({ workingCopy: scene({ shapes: [{ id: `s${i}`, type: 'circle' }] }) });
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
      workingCopy: scene({ shapes: [{ id: 'a1', type: 'circle' }] }),
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
          workingCopy: scene({ shapes: [{ id: 'a1', type: 'circle' }] }),
        },
      },
    );

    // Simulate the route changing before the editor has replaced its
    // previous working copy with project B's scene.
    rerender({
      projectId: 'proj-b',
      workingCopy: scene({ shapes: [{ id: 'a1', type: 'circle' }] }),
    });

    await new Promise((resolve) => setTimeout(resolve, DEBOUNCE_MS + 60));

    const { openDraftDatabase, getDraftRecord } = await import('../storage/draftAutosave');
    const db = await openDraftDatabase();
    expect(await getDraftRecord(db, 'proj-a')).toBeNull();
    expect(await getDraftRecord(db, 'proj-b')).toBeNull();
    db.close();
  });

  it('is safe (does not throw) when indexedDB is unavailable', async () => {
    const original = (globalThis as { indexedDB?: unknown }).indexedDB;
    // @ts-expect-error simulating an environment without IndexedDB
    delete globalThis.indexedDB;
    try {
      const persisted = version(scene());
      const { result } = renderHook(() =>
        useDraftAutosave(
          'proj-no-idb',
          scene({ shapes: [{ id: 's1', type: 'circle' }] }),
          persisted,
          {
            debounceMs: DEBOUNCE_MS,
          },
        ),
      );
      await new Promise((resolve) => setTimeout(resolve, DEBOUNCE_MS + 40));
      await expect(result.current.readDraft()).resolves.toBeNull();
      await expect(result.current.clearDraft()).resolves.toBeUndefined();
    } finally {
      (globalThis as { indexedDB?: unknown }).indexedDB = original;
    }
  });
});
