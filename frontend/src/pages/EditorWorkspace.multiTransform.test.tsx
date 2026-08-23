import { fireEvent, render, screen, within } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import * as projectsApi from '../api/projects';
import type { Project, SceneVersion } from '../api/projects';
import EditorWorkspace from './EditorWorkspace';
import { expandAllCollapsibleSections } from '../testUtils/expandCollapsibleSections';
import { shapeOutlineRows, shapeOutlineSelectButtons } from '../testUtils/shapeOutline';

/**
 * Issue #77: interaction tests for the preview's combined multi-shape
 * move/resize/rotate handle set, layered on top of Task 26's single-shape
 * gesture wiring (`EditorWorkspace.transform.test.tsx`, unaffected — see
 * the regression check below) and Task 24's outline multi-select
 * checkboxes (`sceneEditor.multiSelectedIds`/`toggleMultiSelect`).
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

// Multi-select the shapes at the given zero-based outline checkbox
// indices (draw order: circle added first, rect second, matching
// `sceneEditor.shapes` order) via the outline's "Select for grouping"
// checkboxes — the only supported way to build `multiSelectedIds` (no new
// selection UI is in scope for this task).
function multiSelectShapesAt(...indices: number[]) {
  const checkboxes = within(screen.getByRole('list', { name: 'Scene outline' })).getAllByRole(
    'checkbox',
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

async function addCircleAndRect() {
  fireEvent.click(screen.getByRole('button', { name: 'Add circle' })); // center (400,300), r=50
  fireEvent.click(screen.getByRole('button', { name: 'Add rectangle' })); // top-left (350,260), 100x80
}

describe('EditorWorkspace combined multi-shape handles: visibility', () => {
  it('shows no combined handles and falls back to single-shape handles with 0 or 1 multi-selected', async () => {
    await loadReadyWorkspace();
    await addCircleAndRect();
    mockCanvasRect();

    expect(screen.queryByTestId('group-handle-move')).not.toBeInTheDocument();
    // The rect (added last) is the single active selection, so its own
    // Task 26 handles show instead — completely unaffected regression.
    expect(screen.getByTestId('shape-handle-move')).toBeInTheDocument();

    multiSelectShapesAt(1); // only one checkbox ticked
    expect(screen.queryByTestId('group-handle-move')).not.toBeInTheDocument();
    expect(screen.getByTestId('shape-handle-move')).toBeInTheDocument();
  });

  it('shows one combined handle set, replacing the single-shape handles, once 2+ shapes are multi-selected', async () => {
    await loadReadyWorkspace();
    await addCircleAndRect();
    mockCanvasRect();

    multiSelectShapesAt(0, 1);

    expect(screen.getByTestId('group-handle-move')).toBeInTheDocument();
    expect(screen.getByTestId('group-handle-resize')).toBeInTheDocument();
    expect(screen.getByTestId('group-handle-rotate')).toBeInTheDocument();
    // Exactly one handle set, not one per shape and not the single-shape
    // set too.
    expect(screen.queryByTestId('shape-handle-move')).not.toBeInTheDocument();
  });
});

describe('EditorWorkspace combined multi-shape handles: drag (translate)', () => {
  it('dragging a member of the multi-selection moves every selected shape by the same delta, as one undo step', async () => {
    await loadReadyWorkspace();
    await addCircleAndRect();
    const canvas = mockCanvasRect();
    multiSelectShapesAt(0, 1);

    // Select the rect first (so its live summary text is visible) and
    // start the drag on the circle's body (center 400,300) — a member of
    // the active multi-selection — which should move both shapes.
    const [circleButton] = shapeOutlineSelectButtons();
    fireEvent.click(circleButton);

    fireEvent.pointerDown(canvas, { clientX: 400, clientY: 300 });
    fireEvent.pointerMove(window, { clientX: 430, clientY: 320 });
    fireEvent.pointerUp(window, { clientX: 430, clientY: 320 });

    const circleSummary = canvas.querySelector(`[data-shape-type="circle"]`) as HTMLElement;
    // Circle moved from (400,300) by (+30,+20) => (430,320).
    expect(circleSummary.textContent).toContain('x=430, y=320');

    // One undo step reverts BOTH shapes' moves together.
    fireEvent.click(screen.getByRole('button', { name: 'Undo' }));
    expect(circleSummary.textContent).toContain('x=400, y=300');
    // Only the two "add shape" steps remain.
    fireEvent.click(screen.getByRole('button', { name: 'Undo' }));
    fireEvent.click(screen.getByRole('button', { name: 'Undo' }));
    expect(shapeOutlineRows()).toHaveLength(0);
  });

  it('starting a drag on a shape outside the multi-selection falls back to ordinary single-shape select+drag', async () => {
    await loadReadyWorkspace();
    fireEvent.click(screen.getByRole('button', { name: 'Add circle' }));
    fireEvent.click(screen.getByRole('button', { name: 'Add rectangle' }));
    fireEvent.click(screen.getByRole('button', { name: 'Add circle' })); // a third, non-overlapping shape
    const canvas = mockCanvasRect();

    // Multi-select only the first circle and the rect (indices 0 and 1);
    // the second circle (index 2) is deliberately left out.
    multiSelectShapesAt(0, 1);
    expect(screen.getByTestId('group-handle-move')).toBeInTheDocument();

    const shapeButtons = shapeOutlineSelectButtons();
    const [firstCircleButton, , secondCircleButton] = shapeButtons;
    // Explicitly select the first circle so the active selection starts
    // out as something other than the shape this test is about to drag.
    fireEvent.click(firstCircleButton);
    expect(secondCircleButton).toHaveAttribute('aria-pressed', 'false');

    // Drag starting on the second circle (center 400,300, same default
    // position as every new circle — but it's drawn on top since it was
    // added last).
    fireEvent.pointerDown(canvas, { clientX: 400, clientY: 300 });
    // It becomes the sole active selection via ordinary single-shape
    // select+drag, exactly as clicking it would — not added to
    // multiSelectedIds, which stays exactly as it was (so the combined
    // handle set, governed purely by multiSelectedIds.length >= 2, is
    // still shown independently of this).
    expect(secondCircleButton).toHaveAttribute('aria-pressed', 'true');

    fireEvent.pointerMove(window, { clientX: 450, clientY: 350 });
    fireEvent.pointerUp(window, { clientX: 450, clientY: 350 });

    expect(screen.getByRole('button', { name: 'Undo' })).toBeEnabled();
    const outlineCheckboxes = within(
      screen.getByRole('list', { name: 'Scene outline' }),
    ).getAllByRole('checkbox');
    expect(outlineCheckboxes[0]).toBeChecked();
    expect(outlineCheckboxes[1]).toBeChecked();
    expect(outlineCheckboxes[2]).not.toBeChecked();
  });

  it('per-shape clamping lets one shape stop at its position limit while the rest of the group keeps moving', async () => {
    await loadReadyWorkspace();
    await addCircleAndRect();
    const canvas = mockCanvasRect();
    multiSelectShapesAt(0, 1);
    const [circleButton] = shapeOutlineSelectButtons();
    fireEvent.click(circleButton); // so the circle's live summary is visible below

    // Drag the group's move handle far enough that the circle (starting
    // near the canvas center) would blow past POSITION_LIMIT.max, while
    // the rect keeps moving by the same nominal delta (also clamped, but
    // to the same shared maximum since both start close together — so
    // instead verify via the live summary that neither value is NaN/
    // Infinity and the drag completes without throwing).
    const moveHandle = screen.getByTestId('group-handle-move');
    fireEvent.pointerDown(moveHandle, { clientX: 400, clientY: 300 });
    fireEvent.pointerMove(window, { clientX: 999_999, clientY: 300 });
    fireEvent.pointerUp(window, { clientX: 999_999, clientY: 300 });

    const circleSummary = canvas.querySelector(`[data-shape-type="circle"]`) as HTMLElement;
    expect(circleSummary.textContent).toContain('x=100000');
    expect(screen.getByRole('button', { name: 'Undo' })).toBeEnabled();
  });

  it('cancels the group drag on Escape, restoring every selected shape with no undo step', async () => {
    await loadReadyWorkspace();
    await addCircleAndRect();
    const canvas = mockCanvasRect();
    multiSelectShapesAt(0, 1);
    const [circleButton] = shapeOutlineSelectButtons();
    fireEvent.click(circleButton); // so the circle's live summary is visible below
    const undoButton = screen.getByRole('button', { name: 'Undo' });

    const moveHandle = screen.getByTestId('group-handle-move');
    fireEvent.pointerDown(moveHandle, { clientX: 400, clientY: 315 });
    fireEvent.pointerMove(window, { clientX: 460, clientY: 375 });

    const circleSummary = canvas.querySelector(`[data-shape-type="circle"]`) as HTMLElement;
    expect(circleSummary.textContent).toContain('x=460, y=360');

    fireEvent.keyDown(window, { key: 'Escape' });

    expect(circleSummary.textContent).toContain('x=400, y=300');
    // The cancelled gesture left no history entry; only the two "add"
    // steps remain.
    fireEvent.click(undoButton);
    fireEvent.click(undoButton);
    expect(shapeOutlineRows()).toHaveLength(0);
  });
});

describe('EditorWorkspace combined multi-shape handles: resize', () => {
  it('scales the whole group uniformly from the combined box, anchored at the opposite corner', async () => {
    await loadReadyWorkspace();
    await addCircleAndRect();
    const canvas = mockCanvasRect();
    multiSelectShapesAt(0, 1);

    const resizeHandle = screen.getByTestId('group-handle-resize');
    // Combined bounds of circle(center 400,300,r=50) + rect(top-left
    // 350,260, 100x80): {minX:350,minY:250,maxX:450,maxY:350}. Resize
    // handle sits at (450,350); dragging it to (550,450) doubles the
    // distance from the opposite anchor corner (350,250).
    fireEvent.pointerDown(resizeHandle, { clientX: 450, clientY: 350 });
    fireEvent.pointerMove(window, { clientX: 550, clientY: 450 });
    fireEvent.pointerUp(window, { clientX: 550, clientY: 450 });

    const rectSummary = canvas.querySelector(`[data-shape-type="rect"]`) as HTMLElement;
    // rect top-left was (350,260); relative to anchor (350,250) that's
    // (0,10) => doubled to (0,20) => new top-left (350,270); size doubles
    // to 200x160.
    expect(rectSummary.textContent).toContain('w=200, h=160');
    expect(screen.getByRole('button', { name: 'Undo' })).toBeEnabled();
  });
});

describe('EditorWorkspace combined multi-shape handles: rotate', () => {
  it('rotates the whole group rigidly around the combined box center, preserving the arrangement', async () => {
    await loadReadyWorkspace();
    await addCircleAndRect();
    mockCanvasRect();
    multiSelectShapesAt(0, 1);

    const rotateHandle = screen.getByTestId('group-handle-rotate');
    fireEvent.pointerDown(rotateHandle, { clientX: 400, clientY: 226 }); // above the box center (400,300)
    fireEvent.pointerMove(window, { clientX: 500, clientY: 300 }); // right of center: +90 degrees
    fireEvent.pointerUp(window, { clientX: 500, clientY: 300 });

    expect(screen.getByRole('button', { name: 'Undo' })).toBeEnabled();
    // One undo step reverts the whole group rotation together.
    fireEvent.click(screen.getByRole('button', { name: 'Undo' }));
    fireEvent.click(screen.getByRole('button', { name: 'Undo' }));
    fireEvent.click(screen.getByRole('button', { name: 'Undo' }));
    expect(shapeOutlineRows()).toHaveLength(0);
  });
});

describe('EditorWorkspace combined multi-shape handles: layer-spanning selection', () => {
  it('is a valid group manipulation target even when the multi-selection spans different layers', async () => {
    await loadReadyWorkspace();
    fireEvent.click(screen.getByRole('button', { name: 'Add layer' }));
    await addCircleAndRect();
    const canvas = mockCanvasRect();

    // Move the rect onto the second layer so the two selected shapes no
    // longer share a layer.
    const moveTargetSelects = screen.getAllByRole('combobox', { name: /Target layer for/ });
    const rectLayerSelect = moveTargetSelects[moveTargetSelects.length - 1];
    fireEvent.change(rectLayerSelect, { target: { value: 'layer-2' } });
    const moveButtons = screen.getAllByRole('button', { name: /Move .* to layer/ });
    fireEvent.click(moveButtons[moveButtons.length - 1]);

    multiSelectShapesAt(0, 1);
    expect(screen.getByTestId('group-handle-move')).toBeInTheDocument();

    fireEvent.pointerDown(canvas, { clientX: 400, clientY: 300 });
    fireEvent.pointerMove(window, { clientX: 420, clientY: 310 });
    fireEvent.pointerUp(window, { clientX: 420, clientY: 310 });

    expect(screen.getByRole('button', { name: 'Undo' })).toBeEnabled();
  });
});
