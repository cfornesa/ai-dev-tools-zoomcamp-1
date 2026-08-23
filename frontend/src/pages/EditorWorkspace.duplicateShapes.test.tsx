import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { fireEvent } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import * as aiApi from '../api/ai';
import * as projectsApi from '../api/projects';
import type { Project, SceneVersion, SceneVersionSummary } from '../api/projects';
import EditorWorkspace from './EditorWorkspace';
import { useDraftAutosave } from './useDraftAutosave';
import { useDraftRecovery } from './useDraftRecovery';
import type { RecoveryCandidate } from './useDraftRecovery';
import { expandAllCollapsibleSections } from '../testUtils/expandCollapsibleSections';

/**
 * Issue #126 ("Prevent duplicated shapes from appearing after editor load
 * or recovery") — the groomed spec at
 * `.local/tasks/editor-duplicate-shapes.md` requires a classification
 * (category (a) persisted duplicate IDs, (b) recovery/restore/AI-accept
 * merging old+new shape arrays, or (c) a rendering/selection layer
 * painting more than one instance per shape) backed by a deterministic,
 * checked-in reproduction, plus regression coverage across the operations
 * the original report named (version load, draft recovery, save,
 * reload/navigation, undo/redo): both the canonical shape ID set has no
 * duplicates, AND the rendered/outline instance count matches it.
 *
 * Classification recorded here (see `.local/tasks/editor-duplicate-shapes.md`
 * "Evidence and pending items" for the full writeup):
 *
 * - Category (c) CONFIRMED: `EditorWorkspace.tsx`'s SVG shape-body layer
 *   (`shapeGeometry(shape)`, driven synchronously by `workingCopy`) and the
 *   p5 canvas underneath (driven by `usePreviewRuntime`'s live,
 *   behavior-evaluated positions whenever `hasActiveBehaviors` is true —
 *   see `usePreviewRuntime.ts`) both painted the same shape body
 *   simultaneously once a scene had an active binding/graph node, one
 *   frozen at the shape's static scene-JSON position and one animating.
 *   `'a behavior-driven shape paints its body exactly once (the live p5
 *   canvas), not twice'` below is the reproduction: it fails against the
 *   pre-fix code (which always rendered `shapeGeometry(shape)`
 *   unconditionally) and passes once that call is gated on
 *   `!hasActiveBehaviors`.
 * - Category (b) RULED OUT for every replacement call site actually in the
 *   codebase: `VersionHistoryPanel.onRestored`, `AIProposalPanel.onAccepted`,
 *   and `useDraftRecovery.recover()` all replace `workingCopy` wholesale
 *   (`setWorkingCopy(structuredClone(version.scene_json))` /
 *   `setWorkingCopy(candidate.sceneJson)`) — none append or merge arrays.
 *   `'restoring/recovering/accepting replaces the working copy wholesale,
 *   never merges old and new shapes'` below proves this directly: each
 *   scenario starts from a working copy with one shape id and asserts the
 *   post-operation shape set is *exactly* the incoming scene's shapes, with
 *   no trace of the pre-operation id surviving alongside them.
 * - Category (a) RULED OUT as a *rendering* cause (nothing in this
 *   investigation found scene persistence writing a duplicate-id
 *   `scene_json`), but the spec's acceptance criterion 3 ("confirm
 *   `duplicateId` validation actually fires on every path that can persist
 *   a scene relevant to this bug") found a real gap: unlike every
 *   server-persisted path, the local IndexedDB autosave write in
 *   `draftAutosave.ts` had no `validateScene` gate of its own. That gap is
 *   closed in `draftAutosave.ts`'s `performWrite` (validates before
 *   writing, drops the write and reports `lastFailure` otherwise); see
 *   `draftAutosave.test.ts`'s "issue #126" describe block for that gate's
 *   own dedicated coverage. No normalization/de-duplication step was
 *   needed here since no path was found capable of producing a
 *   duplicate-id scene in the first place — the gap was purely "missing a
 *   defense-in-depth check", not "an existing hole a duplicate could
 *   already have gotten through".
 */

vi.mock('../api/projects');
vi.mock('../api/ai');
vi.mock('./useDraftAutosave');
vi.mock('./useDraftRecovery');

const mockedGetProject = vi.mocked(projectsApi.getProject);
const mockedGetSceneVersion = vi.mocked(projectsApi.getSceneVersion);
const mockedListSceneVersions = vi.mocked(projectsApi.listSceneVersions);
const mockedRestoreSceneVersion = vi.mocked(projectsApi.restoreSceneVersion);
const mockedCreateAIScene = vi.mocked(aiApi.createAIScene);
const mockedAcceptAIProposal = vi.mocked(aiApi.acceptAIProposal);
const mockedUseDraftAutosave = vi.mocked(useDraftAutosave);
const mockedUseDraftRecovery = vi.mocked(useDraftRecovery);

function baseProject(overrides: Partial<Project> = {}): Project {
  return {
    id: 'p1',
    owner: 'alice',
    title: 'My animation',
    description: '',
    tags: [],
    visibility: 'private',
    allow_public_remix: false,
    export_attribution: false,
    current_version: 1,
    created_at: '2026-01-01T00:00:00Z',
    updated_at: '2026-01-02T00:00:00Z',
    ...overrides,
  };
}

function circleShape(id: string, overrides: Record<string, unknown> = {}) {
  return {
    id,
    type: 'circle',
    layerId: 'layer-1',
    groupId: null,
    transform: { x: 100, y: 100, scaleX: 1, scaleY: 1, rotation: 0, opacity: 1 },
    style: { fill: '#4f46e5', stroke: null, strokeWidth: 0 },
    radius: 20,
    ...overrides,
  };
}

const FOLLOW_HAND_BINDING = {
  id: 'binding-1',
  signal: 'indexTipX',
  handTarget: 'primary',
  targetScope: 'shape',
  targetId: 'shape-a',
  targetProperty: 'positionX',
  composition: 'replace',
  mapping: { inMin: 0, inMax: 1, outMin: 0, outMax: 800 },
  smoothing: 0,
};

function baseScene(overrides: Record<string, unknown> = {}) {
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

function baseVersion(scene: unknown, overrides: Partial<SceneVersion> = {}): SceneVersion {
  return {
    id: 1,
    sequence: 1,
    origin: 'manual',
    change_label: null,
    created_by: 'alice',
    parent: null,
    fork_source_version: null,
    created_at: '2026-01-01T00:00:00Z',
    scene_json: scene as SceneVersion['scene_json'],
    ...overrides,
  };
}

function baseSummary(overrides: Partial<SceneVersionSummary> = {}): SceneVersionSummary {
  const { scene_json: _scene_json, ...rest } = baseVersion(baseScene(), overrides);
  return rest;
}

function renderWorkspace() {
  return render(
    <MemoryRouter initialEntries={['/projects/p1']}>
      <Routes>
        <Route path="/" element={<p>Gallery placeholder</p>} />
        <Route path="/projects/:id" element={<EditorWorkspace />} />
        <Route path="/projects/:id/settings" element={<p>Settings placeholder</p>} />
      </Routes>
    </MemoryRouter>,
  );
}

async function loadWorkspace(scene: unknown, project: Partial<Project> = {}) {
  mockedGetProject.mockResolvedValue(baseProject(project));
  mockedGetSceneVersion.mockResolvedValue(baseVersion(scene));
  const rendered = renderWorkspace();
  await screen.findByRole('region', { name: 'Tools' });
  expandAllCollapsibleSections();
  return rendered;
}

/** Every child of a shape's SVG `<g>` that is the shape's own painted body
 * — i.e. neither the selection outline, the hover outline, nor the
 * `<title>` summary (see `EditorWorkspace.tsx`'s `shapeGeometry`/selection
 * outline/hover outline JSX). Zero means this layer painted no body for
 * that shape this render (the p5 canvas is the sole body layer); more than
 * one would itself be a duplication bug in the SVG layer alone. */
function svgBodyElementCount(container: HTMLElement, shapeId: string): number {
  const group = container.querySelector(`[data-testid="scene-shape-${shapeId}"]`);
  if (!group) return 0;
  return Array.from(group.children).filter((child) => {
    const tag = child.tagName.toLowerCase();
    if (tag === 'title') return false;
    if (child.classList.contains('editor-scene-shape-selection-outline')) return false;
    if (child.classList.contains('editor-scene-shape-hover-outline')) return false;
    return true;
  }).length;
}

/** The shape ids the outline (Layers list) currently renders one row for
 * each of — see `SceneOutlinePanel.tsx`'s `data-outline-kind="shape"` /
 * `data-outline-id` on each shape row. */
function outlineShapeIds(container: HTMLElement): string[] {
  return Array.from(container.querySelectorAll('[data-outline-kind="shape"]')).map(
    (el) => el.getAttribute('data-outline-id') as string,
  );
}

/** The ids of every shape body element currently painted in the SVG
 * overlay layer, across all shapes (not scoped to one id) — used to assert
 * total instance counts, not just per-id presence. */
function svgShapeGroupIds(container: HTMLElement): string[] {
  return Array.from(container.querySelectorAll('[data-testid^="scene-shape-"]'))
    .filter((el) => !el.getAttribute('data-testid')?.includes('hover-outline'))
    .map((el) => el.getAttribute('data-testid')!.replace('scene-shape-', ''));
}

/** Criterion: "the persisted/working-copy shape ID set has no duplicates"
 * AND "the rendered instance count ... matches that set's size" — checked
 * together, since either alone could pass while the other still shows
 * duplication. `canonicalIds` is the scene's own `shapes` array id list
 * (the source of truth); this asserts both the outline and the SVG overlay
 * are exactly one-to-one with it. */
function assertOneToOnePerShape(container: HTMLElement, canonicalIds: string[]) {
  expect(new Set(canonicalIds).size).toBe(canonicalIds.length); // no duplicate canonical ids
  const outlineIds = outlineShapeIds(container);
  expect(new Set(outlineIds).size).toBe(outlineIds.length); // no duplicate outline rows
  expect([...outlineIds].sort()).toEqual([...canonicalIds].sort());
  const svgIds = svgShapeGroupIds(container);
  expect(new Set(svgIds).size).toBe(svgIds.length); // no duplicate SVG shape groups
  expect([...svgIds].sort()).toEqual([...canonicalIds].sort());
}

beforeEach(() => {
  vi.clearAllMocks();
  mockedListSceneVersions.mockResolvedValue([baseSummary()]);
  mockedUseDraftAutosave.mockReturnValue({
    clearDraft: vi.fn(() => Promise.resolve()),
    readDraft: vi.fn().mockResolvedValue(null),
    getLastFailure: vi.fn().mockReturnValue(null),
  });
  mockedUseDraftRecovery.mockReturnValue({
    status: 'none',
    candidate: null,
    recover: vi.fn(() => null),
    discard: vi.fn(() => Promise.resolve()),
  });
});

describe('issue #126 category (c): rendering-overlay duplication', () => {
  it('a behavior-driven shape paints its body exactly once (the live p5 canvas), not twice', async () => {
    const scene = baseScene({
      shapes: [circleShape('shape-a')],
      // Any binding is enough to flip `hasActiveBehaviors` true (see
      // `usePreviewRuntime.ts`'s `sceneHasActiveBehaviors`), which is what
      // makes the p5 canvas independently, continuously repaint this
      // shape's body from live runtime output.
      bindings: [FOLLOW_HAND_BINDING],
    });
    const { container } = await loadWorkspace(scene);

    // The reproduction: before the fix, `shapeGeometry(shape)` always ran
    // unconditionally here, so this would be 1 (a second, static body
    // painted on top of/underneath the live p5 canvas' own copy) instead
    // of 0. The canonical shape set still has exactly one shape — this is
    // purely about how many *bodies* the SVG layer paints for it while the
    // p5 canvas is also painting one.
    expect(svgBodyElementCount(container, 'shape-a')).toBe(0);
    assertOneToOnePerShape(container, ['shape-a']);
  });

  it('an unbound (no active behaviors) shape still paints its body in the SVG layer exactly once, unaffected by the fix', async () => {
    const scene = baseScene({ shapes: [circleShape('shape-a'), circleShape('shape-b')] });
    const { container } = await loadWorkspace(scene);

    // No bindings/graph -> `hasActiveBehaviors` is false -> the p5 canvas
    // and this SVG layer are both driven synchronously by the same
    // `workingCopy`, so the SVG layer remains the (only, still
    // synchronous) source of the visible body per issue #93's original
    // behavior.
    expect(svgBodyElementCount(container, 'shape-a')).toBe(1);
    expect(svgBodyElementCount(container, 'shape-b')).toBe(1);
    assertOneToOnePerShape(container, ['shape-a', 'shape-b']);
  });

  it('selecting a shape in the outline highlights exactly one canvas object, never more', async () => {
    const scene = baseScene({ shapes: [circleShape('shape-a'), circleShape('shape-b')] });
    const { container } = await loadWorkspace(scene);
    const user = userEvent.setup();

    const outlineButton = within(
      container.querySelector('[data-outline-id="shape-a"]') as HTMLElement,
    ).getByRole('button', { name: 'Circle 1' });
    await user.click(outlineButton);

    const selectedOutlines = container.querySelectorAll('.editor-scene-shape-selection-outline');
    expect(selectedOutlines).toHaveLength(1);
    expect(
      container
        .querySelector('[data-testid="scene-shape-shape-a"]')!
        .querySelector('.editor-scene-shape-selection-outline'),
    ).not.toBeNull();
    assertOneToOnePerShape(container, ['shape-a', 'shape-b']);
  });
});

describe('issue #126 category (b) ruled out: replace, never merge', () => {
  it('restoring a historical version replaces the working copy — the pre-restore shape does not survive alongside the restored ones', async () => {
    mockedListSceneVersions.mockResolvedValue([
      baseSummary({ id: 1, sequence: 1 }),
      baseSummary({ id: 2, sequence: 2, origin: 'manual', change_label: 'Second save' }),
    ]);
    const scene = baseScene({ shapes: [circleShape('current-shape')] });
    const { container } = await loadWorkspace(scene, { current_version: 2 });
    const user = userEvent.setup();

    // An unsaved edit on top of the loaded version, so a merge bug would
    // have two clear candidates (the unsaved add plus the restored shape)
    // to wrongly combine.
    await user.click(screen.getByRole('button', { name: 'Add circle' }));
    assertOneToOnePerShape(container, [
      'current-shape',
      ...outlineShapeIds(container).filter((id) => id !== 'current-shape'),
    ]);
    const preRestoreIds = outlineShapeIds(container);
    expect(preRestoreIds).toContain('current-shape');

    const restoredScene = baseScene({
      shapes: [circleShape('restored-shape-1'), circleShape('restored-shape-2')],
    });
    mockedRestoreSceneVersion.mockResolvedValue(
      baseVersion(restoredScene, { id: 3, sequence: 3, origin: 'restore', parent: 1 }),
    );

    const list = await screen.findByRole('list', { name: 'Version history' });
    const firstItem = within(list).getAllByRole('listitem')[0];
    await user.click(within(firstItem).getByRole('button', { name: 'Restore' }));

    await waitFor(() =>
      expect(screen.getByTestId('editor-save-status')).toHaveTextContent('Saved as version 3'),
    );

    // Wholesale replace: exactly the restored version's two shapes, no
    // trace of `current-shape` or the unsaved add.
    assertOneToOnePerShape(container, ['restored-shape-1', 'restored-shape-2']);
  });

  it('accepting an AI proposal replaces the working copy — the pre-accept shape does not survive alongside the proposed ones', async () => {
    const scene = baseScene({ shapes: [circleShape('current-shape')] });
    const { container } = await loadWorkspace(scene);
    const user = userEvent.setup();
    assertOneToOnePerShape(container, ['current-shape']);

    const proposedScene = baseScene({
      shapes: [circleShape('ai-shape-1'), circleShape('ai-shape-2')],
    });
    mockedCreateAIScene.mockResolvedValue({
      draft: true,
      operation: 'create_scene',
      scene: proposedScene as never,
      usage: { prompt_tokens: 1, completion_tokens: 1, total_tokens: 2, estimated_cost_usd: 0 },
    });
    await user.type(screen.getByLabelText(/describe the scene/i), 'two circles');
    await user.click(screen.getByRole('button', { name: /generate scene/i }));
    await screen.findByTestId('ai-proposal-success');

    mockedAcceptAIProposal.mockResolvedValue(
      baseVersion(proposedScene, { id: 2, sequence: 2, origin: 'ai_create' }),
    );
    await user.click(screen.getByTestId('ai-accept-button'));

    await waitFor(() =>
      expect(screen.getByTestId('editor-save-status')).toHaveTextContent('Saved as version 2'),
    );

    assertOneToOnePerShape(container, ['ai-shape-1', 'ai-shape-2']);
  });

  it('recovering a local/server draft replaces the working copy — the persisted shape does not survive alongside the recovered ones', async () => {
    const persistedScene = baseScene({ shapes: [circleShape('persisted-shape')] });
    const recoveredScene = baseScene({
      shapes: [circleShape('recovered-shape-1'), circleShape('recovered-shape-2')],
    });
    const candidate: RecoveryCandidate = {
      source: 'local',
      sceneJson: recoveredScene as never,
      savedAt: '2026-01-02T00:05:00Z',
      changeSummary: '2 shapes added',
    };
    let status: 'prompt' | 'resolved' = 'prompt';
    const statefulRecover = vi.fn(() => {
      status = 'resolved';
      return recoveredScene;
    });
    mockedUseDraftRecovery.mockImplementation(() => ({
      status,
      candidate: status === 'prompt' ? candidate : null,
      recover: statefulRecover as never,
      discard: vi.fn(() => Promise.resolve()),
    }));

    mockedGetProject.mockResolvedValue(baseProject());
    mockedGetSceneVersion.mockResolvedValue(baseVersion(persistedScene));
    const { container } = renderWorkspace();
    const dialog = await screen.findByRole('alertdialog', { name: /recover unsaved work/i });
    const user = userEvent.setup();
    await user.click(within(dialog).getByRole('button', { name: 'Recover draft' }));

    await screen.findByRole('region', { name: 'Tools' });
    expandAllCollapsibleSections();

    // Wholesale replace: exactly the recovered candidate's two shapes, no
    // trace of the persisted version's shape.
    assertOneToOnePerShape(container, ['recovered-shape-1', 'recovered-shape-2']);
  });
});

describe('issue #126: one-to-one across undo/redo', () => {
  it('add, add, undo, redo each leave the canonical/outline/SVG shape sets in exact agreement, no duplicates', async () => {
    const scene = baseScene({ shapes: [] });
    const { container } = await loadWorkspace(scene);
    const user = userEvent.setup();

    await user.click(screen.getByRole('button', { name: 'Add circle' }));
    let ids = outlineShapeIds(container);
    expect(ids).toHaveLength(1);
    assertOneToOnePerShape(container, ids);

    await user.click(screen.getByRole('button', { name: 'Add circle' }));
    ids = outlineShapeIds(container);
    expect(ids).toHaveLength(2);
    assertOneToOnePerShape(container, ids);

    fireEvent.keyDown(window, { key: 'z', ctrlKey: true });
    await waitFor(() => expect(outlineShapeIds(container)).toHaveLength(1));
    assertOneToOnePerShape(container, outlineShapeIds(container));

    fireEvent.keyDown(window, { key: 'z', ctrlKey: true, shiftKey: true });
    await waitFor(() => expect(outlineShapeIds(container)).toHaveLength(2));
    assertOneToOnePerShape(container, outlineShapeIds(container));
  });
});

describe('issue #126: one-to-one across explicit save and reload/navigation', () => {
  it('saving, then reloading the page (a fresh mount re-fetching the same version) shows exactly one instance per shape, not the saved set plus anything stale', async () => {
    const scene = baseScene({ shapes: [circleShape('shape-a'), circleShape('shape-b')] });
    const { container, unmount } = await loadWorkspace(scene);
    const user = userEvent.setup();
    assertOneToOnePerShape(container, ['shape-a', 'shape-b']);

    await user.click(screen.getByRole('button', { name: 'Add circle' }));
    const idsAfterAdd = outlineShapeIds(container);
    expect(idsAfterAdd).toHaveLength(3);

    let savedVersion: SceneVersion | null = null;
    vi.mocked(projectsApi.saveSceneVersion).mockImplementation((_projectId, input) => {
      savedVersion = baseVersion(input.scene_json, { id: 2, sequence: 2 });
      return Promise.resolve(savedVersion);
    });
    await user.click(screen.getByRole('button', { name: 'Save' }));
    await waitFor(() =>
      expect(screen.getByTestId('editor-save-status')).toHaveTextContent('Saved as version 2'),
    );
    assertOneToOnePerShape(container, outlineShapeIds(container));
    expect(savedVersion).not.toBeNull();

    // Simulate a page reload/navigation: unmount entirely and mount fresh,
    // re-fetching the now-saved version from the server — a stale-render
    // bug (category (c)'s "a stale render call not superseded by a newer
    // one") would show the pre-reload DOM's shapes still present alongside
    // the freshly-fetched ones; a genuinely fresh mount cannot carry any
    // stale state over.
    unmount();
    mockedGetProject.mockResolvedValue(baseProject({ current_version: 2 }));
    mockedGetSceneVersion.mockResolvedValue(savedVersion!);
    mockedListSceneVersions.mockResolvedValue([baseSummary({ id: 2, sequence: 2 })]);
    const reloaded = renderWorkspace();
    await screen.findByRole('region', { name: 'Tools' });
    expandAllCollapsibleSections();

    assertOneToOnePerShape(reloaded.container, outlineShapeIds(reloaded.container));
    expect(outlineShapeIds(reloaded.container)).toHaveLength(3);
  });
});
