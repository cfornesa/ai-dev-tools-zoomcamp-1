import { fireEvent, render, screen, within } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import * as projectsApi from '../api/projects';
import type { Project, SceneVersion } from '../api/projects';
import EditorWorkspace from './EditorWorkspace';
import { expandAllCollapsibleSections } from '../testUtils/expandCollapsibleSections';
import { shapeOutlineRows, shapeSelectButton } from '../testUtils/shapeOutline';

/**
 * Task 80 (issue #80): rendered interaction tests for the lock guard's
 * pointer-gesture and handle-visibility surface — a locked shape/group
 * shows no move/resize/rotate handles, a body-drag on a locked shape
 * doesn't start a move gesture (but a plain click still selects it), and a
 * multi-shape group gesture is blocked in its entirety when any member is
 * locked. See `sceneOutline.lock.test.ts` for the underlying
 * `isEffectivelyLocked` cascade tests and `useSceneEditor.lock.test.ts` for
 * every guarded hook-level mutation.
 */

vi.mock('../api/projects');

const mockedGetProject = vi.mocked(projectsApi.getProject);
const mockedGetSceneVersion = vi.mocked(projectsApi.getSceneVersion);
const mockedListSceneVersions = vi.mocked(projectsApi.listSceneVersions);

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
    thumbnail_url: null,
    current_version: 1,
    created_at: '2026-01-01T00:00:00Z',
    updated_at: '2026-01-02T00:00:00Z',
    ...overrides,
  };
}

const BLANK_SCENE = {
  schemaVersion: 1,
  id: 'scene-blank',
  canvas: { width: 800, height: 600, backgroundColor: '#ffffff' },
  renderer: { preferred: 'p5' },
  layers: [{ id: 'layer-1', name: 'Layer 1', order: 0, visible: true, locked: false }],
  shapes: [],
  groups: [],
  bindings: [],
  graph: { nodes: [], connections: [] },
  accessibility: { reducedMotion: 'auto' },
  randomness: { seed: 0, enabled: false },
};

function baseVersion(overrides: Partial<SceneVersion> = {}): SceneVersion {
  return {
    id: 1,
    sequence: 1,
    origin: 'manual',
    change_label: null,
    created_by: 'alice',
    parent: null,
    fork_source_version: null,
    created_at: '2026-01-01T00:00:00Z',
    scene_json: BLANK_SCENE,
    ...overrides,
  };
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

async function loadReadyWorkspace() {
  mockedGetProject.mockResolvedValue(baseProject());
  mockedGetSceneVersion.mockResolvedValue(baseVersion());
  renderWorkspace();
  await screen.findByRole('region', { name: 'Tools' });
  expandAllCollapsibleSections();
}

function mockCanvasRect() {
  const canvas = screen.getByTestId('scene-canvas');
  canvas.getBoundingClientRect = () =>
    ({ left: 0, top: 0, right: 800, bottom: 600, width: 800, height: 600 }) as DOMRect;
  return canvas;
}

async function addAndSelectCircle() {
  fireEvent.click(screen.getByRole('button', { name: 'Add circle' }));
  // createShape centers a circle on the 800x600 canvas: (400,300), r=50.
}

// Task 111 (issue #142): every shape gets its own fresh layer now, so more
// than one Locked layer-row checkbox can exist at once (the scene's
// original empty layer, plus one per added shape) -- this locks the layer
// belonging to the `shapeIndex`-th shape row specifically (shape rows and
// their own layer row are adjacent in the flat outline list, the layer row
// immediately preceding its shape), rather than whichever Locked checkbox
// happens to be first in the DOM. Issue #168 (task 136): the layer row's
// Locked toggle is now a checkbox with a static accessible name ("Layer
// <name> locked"), regardless of checked state -- unlike the old button
// whose label text flipped between "Unlocked"/"Locked", so there's no
// longer a need to try one name then fall back to the other.
function toggleLayerLock(shapeIndex = 0) {
  const outline = screen.getByRole('list', { name: 'Scene outline' });
  const rows = within(outline).getAllByRole('listitem') as HTMLElement[];
  const shapeRows = rows.filter((row) => row.dataset.outlineKind === 'shape');
  const targetShapeRow = shapeRows[shapeIndex];
  const targetIndex = rows.indexOf(targetShapeRow);
  const layerRow = rows
    .slice(0, targetIndex)
    .reverse()
    .find((row) => row.dataset.outlineKind === 'layer')!;
  const checkbox = within(layerRow).getByRole('checkbox', { name: /locked$/i });
  fireEvent.click(checkbox);
}

function multiSelectShapesAt(...indices: number[]) {
  // Issue #168 (task 136) added Visible/Locked checkboxes to layer rows
  // in this same outline list, so an unscoped `getAllByRole` would also
  // pick those up -- filter to the "Select for grouping" checkboxes this
  // helper actually means.
  const checkboxes = within(screen.getByRole('list', { name: 'Scene outline' })).getAllByRole(
    'checkbox',
    { name: /to group selection$/i },
  );
  for (const index of indices) {
    fireEvent.click(checkboxes[index]);
  }
}

beforeEach(() => {
  vi.clearAllMocks();
  mockedListSceneVersions.mockResolvedValue([
    {
      id: 1,
      sequence: 1,
      origin: 'manual',
      change_label: null,
      created_by: 'alice',
      parent: null,
      fork_source_version: null,
      created_at: '2026-01-01T00:00:00Z',
    },
  ]);
});

describe('EditorWorkspace lock guard: handle visibility', () => {
  it('shows no move/resize/rotate handles for a shape on a locked layer', async () => {
    await loadReadyWorkspace();
    await addAndSelectCircle();
    expect(screen.getByTestId('shape-handle-move')).toBeInTheDocument();

    toggleLayerLock();

    expect(screen.queryByTestId('shape-handle-move')).not.toBeInTheDocument();
    expect(screen.queryByTestId('shape-handle-resize')).not.toBeInTheDocument();
    expect(screen.queryByTestId('shape-handle-rotate')).not.toBeInTheDocument();
  });

  it('handles reappear once the layer is unlocked again', async () => {
    await loadReadyWorkspace();
    await addAndSelectCircle();
    toggleLayerLock();
    fireEvent.click(shapeSelectButton(shapeOutlineRows()[0]));
    expect(screen.queryByTestId('shape-handle-move')).not.toBeInTheDocument();

    toggleLayerLock(); // toggles back to Unlocked
    fireEvent.click(shapeSelectButton(shapeOutlineRows()[0]));

    expect(screen.getByTestId('shape-handle-move')).toBeInTheDocument();
  });

  it('clicking the body of a locked shape still selects it (handles just do not render)', async () => {
    await loadReadyWorkspace();
    await addAndSelectCircle();
    toggleLayerLock();
    const canvas = mockCanvasRect();
    // Deselect first.
    fireEvent.click(canvas, { clientX: 5, clientY: 5 });

    const shapeListButton = shapeSelectButton(shapeOutlineRows()[0]);
    expect(shapeListButton).toHaveAttribute('aria-pressed', 'false');

    // Click on the shape body (circle center, 400,300).
    fireEvent.click(canvas, { clientX: 400, clientY: 300 });

    expect(shapeListButton).toHaveAttribute('aria-pressed', 'true');
    // Selected, but still no handles — it's still locked.
    expect(screen.queryByTestId('shape-handle-move')).not.toBeInTheDocument();
  });
});

describe('EditorWorkspace lock guard: single-shape gesture blocked', () => {
  it('a body-drag on a locked shape selects it but does not start a move gesture, and surfaces lockError', async () => {
    await loadReadyWorkspace();
    await addAndSelectCircle();
    toggleLayerLock();
    const canvas = mockCanvasRect();
    fireEvent.click(canvas, { clientX: 5, clientY: 5 }); // deselect

    fireEvent.pointerDown(canvas, { clientX: 400, clientY: 300 });
    fireEvent.pointerMove(window, { clientX: 460, clientY: 260 });
    fireEvent.pointerUp(window, { clientX: 460, clientY: 260 });

    const shapeListButton = shapeSelectButton(shapeOutlineRows()[0]);
    // Selection happened (the pointerdown click-to-select still fires)...
    expect(shapeListButton).toHaveAttribute('aria-pressed', 'true');
    // ...but the shape never moved, and no undo step was produced.
    const liveSummary = canvas.querySelector('.editor-scene-shape') as HTMLElement;
    expect(liveSummary.textContent).not.toContain('x=460, y=260');
    expect(screen.getByRole('alert')).toHaveTextContent(/locked/i);
  });
});

describe('EditorWorkspace lock guard: hover affordance (issue #111)', () => {
  it('shows a distinct locked-hover outline instead of the ordinary hover outline for a locked shape', async () => {
    await loadReadyWorkspace();
    await addAndSelectCircle();
    toggleLayerLock();
    const canvas = mockCanvasRect();
    fireEvent.click(canvas, { clientX: 5, clientY: 5 }); // deselect, so it's hover-only

    fireEvent.pointerMove(canvas, { clientX: 400, clientY: 300 }); // over the circle body

    const shapeId = canvas.querySelector('[data-shape-type="circle"]')!.getAttribute('data-testid');
    const outline = canvas.querySelector(
      `[data-testid="scene-shape-hover-outline-${shapeId!.replace('scene-shape-', '')}"]`,
    );
    expect(outline).toHaveClass('editor-scene-shape-hover-outline-locked');
  });

  it('shows the ordinary (non-locked) hover outline for an unlocked shape', async () => {
    await loadReadyWorkspace();
    await addAndSelectCircle();
    const canvas = mockCanvasRect();
    fireEvent.click(canvas, { clientX: 5, clientY: 5 }); // deselect, so it's hover-only

    fireEvent.pointerMove(canvas, { clientX: 400, clientY: 300 }); // over the circle body

    const shapeId = canvas.querySelector('[data-shape-type="circle"]')!.getAttribute('data-testid');
    const outline = canvas.querySelector(
      `[data-testid="scene-shape-hover-outline-${shapeId!.replace('scene-shape-', '')}"]`,
    );
    expect(outline).toHaveClass('editor-scene-shape-hover-outline');
    expect(outline).not.toHaveClass('editor-scene-shape-hover-outline-locked');
  });
});

describe('EditorWorkspace lock guard: multi-shape whole-gesture block (issue #77)', () => {
  it('one locked shape among several selected blocks the entire group gesture, not just that shape', async () => {
    await loadReadyWorkspace();
    fireEvent.click(screen.getByRole('button', { name: 'Add circle' })); // center (400,300)
    fireEvent.click(screen.getByRole('button', { name: 'Add rectangle' })); // top-left (350,260)
    const canvas = mockCanvasRect();
    multiSelectShapesAt(0, 1);
    expect(screen.getByTestId('group-handle-move')).toBeInTheDocument();

    // Task 111 (issue #142): each shape has its own layer now, so this
    // locks only the circle's layer -- exactly matching this test's own
    // point (one locked shape among several selected still blocks the
    // whole group gesture).
    toggleLayerLock(0);

    // The combined group handle set is gone entirely — not just for the
    // locked member.
    expect(screen.queryByTestId('group-handle-move')).not.toBeInTheDocument();

    // Starting a drag on the circle's body (a member of the still-active
    // multi-selection) must not move anything.
    const rectSummaryBefore = canvas.querySelector(
      '[data-shape-type="rect"]',
    ) as HTMLElement | null;
    fireEvent.pointerDown(canvas, { clientX: 400, clientY: 300 });
    fireEvent.pointerMove(window, { clientX: 430, clientY: 320 });
    fireEvent.pointerUp(window, { clientX: 430, clientY: 320 });

    const circleSummary = canvas.querySelector('[data-shape-type="circle"]') as HTMLElement;
    // Neither shape moved: the circle's summary only renders when selected,
    // and since the gesture never started, nothing in the scene changed.
    expect(circleSummary.textContent ?? '').not.toContain('x=430, y=320');
    void rectSummaryBefore;
    expect(screen.getByRole('alert')).toHaveTextContent(/locked/i);
  });
});
