import { fireEvent, render, screen, within } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import * as projectsApi from '../api/projects';
import type { Project, SceneVersion } from '../api/projects';
import EditorWorkspace from './EditorWorkspace';
import { expandAllCollapsibleSections } from '../testUtils/expandCollapsibleSections';
import { shapeOutlineRows, shapeSelectButton } from '../testUtils/shapeOutline';
import { POSITION_LIMIT } from './sceneShapes';

/**
 * Issue #79: interaction tests for per-vertex path editing — the "Edit
 * points" toggle (`ShapeInspectorPanel.tsx`), the canvas point handles/
 * double-click-insert/keyboard-delete wiring (`EditorWorkspace.tsx`), and
 * the keyboard point-coordinate list, layered on top of Task 26's single-
 * shape handles, Task 60's Inspector fields, Task 77's multi-shape
 * gestures, and Task 78's snapping — the last two are checked here only as
 * a regression guard (this task's own "Out of scope").
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

function pathShape(id: string, points: { x: number; y: number }[]) {
  return {
    id,
    type: 'path' as const,
    layerId: 'layer-1',
    groupId: null,
    transform: { x: 400, y: 300, scaleX: 1, scaleY: 1, rotation: 0, opacity: 1 },
    style: { fill: '#4f46e5', stroke: '#1e1b4b', strokeWidth: 2 },
    points,
    closed: true,
  };
}

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

async function loadReadyWorkspace(sceneOverride?: SceneVersion) {
  mockedGetProject.mockResolvedValue(baseProject());
  mockedGetSceneVersion.mockResolvedValue(sceneOverride ?? baseVersion());
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

// Adds the default polygon (Add polygon -> `createShape('path', ...)`):
// closed square with points (0,-50),(50,0),(0,50),(-50,0), centered at
// (400,300) on the default 800x600 canvas. Auto-selected by `addShape`.
// Absolute handle positions: (400,250), (450,300), (400,350), (350,300).
function addAndSelectPath() {
  fireEvent.click(screen.getByRole('button', { name: 'Add polygon' }));
}

function editPointsToggle() {
  return screen.getByRole('button', { name: /edit points/i });
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

describe('Edit points toggle: visibility gating', () => {
  it('is not rendered when nothing is selected', async () => {
    await loadReadyWorkspace();
    expect(screen.queryByRole('button', { name: /edit points/i })).not.toBeInTheDocument();
  });

  it('is not rendered for a non-path shape', async () => {
    await loadReadyWorkspace();
    fireEvent.click(screen.getByRole('button', { name: 'Add circle' }));
    expect(screen.queryByRole('button', { name: /edit points/i })).not.toBeInTheDocument();
  });

  it('is rendered, unpressed, for a single selected path shape', async () => {
    await loadReadyWorkspace();
    addAndSelectPath();
    const toggle = editPointsToggle();
    expect(toggle).toBeInTheDocument();
    expect(toggle).toHaveAttribute('aria-pressed', 'false');
  });

  it('is not rendered for a multi-selection, even if one member is a path', async () => {
    await loadReadyWorkspace();
    fireEvent.click(screen.getByRole('button', { name: 'Add circle' }));
    addAndSelectPath();
    // Issue #168 (task 136) added Visible/Locked checkboxes to layer rows
    // in this same outline list, so an unscoped `getAllByRole` would also
    // pick those up -- filter to the "Select for grouping" checkboxes.
    const checkboxes = within(screen.getByRole('list', { name: 'Scene outline' })).getAllByRole(
      'checkbox',
      { name: /to group selection$/i },
    );
    fireEvent.click(checkboxes[0]);
    fireEvent.click(checkboxes[1]);
    expect(screen.queryByRole('button', { name: /edit points/i })).not.toBeInTheDocument();
  });
});

describe('Vertex edit mode: entering and exiting', () => {
  it('replaces the whole-shape handles with one handle per point on activation', async () => {
    await loadReadyWorkspace();
    addAndSelectPath();
    mockCanvasRect();
    expect(screen.getByTestId('shape-handle-move')).toBeInTheDocument();

    fireEvent.click(editPointsToggle());

    expect(editPointsToggle()).toHaveAttribute('aria-pressed', 'true');
    expect(screen.queryByTestId('shape-handle-move')).not.toBeInTheDocument();
    expect(screen.queryByTestId('shape-handle-resize')).not.toBeInTheDocument();
    expect(screen.queryByTestId('shape-handle-rotate')).not.toBeInTheDocument();
    expect(screen.getByTestId('path-vertex-handle-0')).toBeInTheDocument();
    expect(screen.getByTestId('path-vertex-handle-1')).toBeInTheDocument();
    expect(screen.getByTestId('path-vertex-handle-2')).toBeInTheDocument();
    expect(screen.getByTestId('path-vertex-handle-3')).toBeInTheDocument();
  });

  it('reverts to whole-shape handles, with no stale vertex handles, when toggled off', async () => {
    await loadReadyWorkspace();
    addAndSelectPath();
    mockCanvasRect();
    fireEvent.click(editPointsToggle());
    expect(screen.getByTestId('path-vertex-handle-0')).toBeInTheDocument();

    fireEvent.click(editPointsToggle());

    expect(screen.queryByTestId('path-vertex-handle-0')).not.toBeInTheDocument();
    expect(screen.getByTestId('shape-handle-move')).toBeInTheDocument();
  });

  it('exits cleanly, with no stale handles, when the selection changes to a different shape', async () => {
    await loadReadyWorkspace();
    addAndSelectPath();
    mockCanvasRect();
    fireEvent.click(editPointsToggle());
    expect(screen.getByTestId('path-vertex-handle-0')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Add circle' }));

    expect(screen.queryByTestId('path-vertex-handle-0')).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /edit points/i })).not.toBeInTheDocument();
    expect(screen.getByTestId('shape-handle-move')).toBeInTheDocument(); // the circle's own handles
  });

  it('exits cleanly when the selection is cleared', async () => {
    await loadReadyWorkspace();
    addAndSelectPath();
    const canvas = mockCanvasRect();
    fireEvent.click(editPointsToggle());
    expect(screen.getByTestId('path-vertex-handle-0')).toBeInTheDocument();

    fireEvent.click(canvas, { clientX: 5, clientY: 5 }); // empty space: deselect

    expect(screen.queryByTestId('path-vertex-handle-0')).not.toBeInTheDocument();
  });

  it('exits vertex edit mode on Escape when no drag is in progress', async () => {
    await loadReadyWorkspace();
    addAndSelectPath();
    mockCanvasRect();
    fireEvent.click(editPointsToggle());
    expect(screen.getByTestId('path-vertex-handle-0')).toBeInTheDocument();

    fireEvent.keyDown(window, { key: 'Escape' });

    expect(screen.queryByTestId('path-vertex-handle-0')).not.toBeInTheDocument();
    expect(screen.getByTestId('shape-handle-move')).toBeInTheDocument();
    // Still selected — Escape only exited the mode, not the selection.
    expect(screen.getByRole('button', { name: /edit points/i })).toHaveAttribute(
      'aria-pressed',
      'false',
    );
  });
});

describe('Vertex drag', () => {
  it('moves only the dragged point, leaving the others in place', async () => {
    await loadReadyWorkspace();
    addAndSelectPath();
    mockCanvasRect();
    fireEvent.click(editPointsToggle());

    const others = ['1', '2', '3'].map((i) =>
      screen.getByTestId(`path-vertex-handle-${i}`).getAttribute('style'),
    );

    fireEvent.pointerDown(screen.getByTestId('path-vertex-handle-0'), {
      clientX: 400,
      clientY: 250,
    });
    fireEvent.pointerMove(window, { clientX: 400, clientY: 200 });
    fireEvent.pointerUp(window, { clientX: 400, clientY: 200 });

    const handle0 = screen.getByTestId('path-vertex-handle-0');
    expect(handle0.style.left).toBe('50%'); // x=400 unchanged
    expect(handle0.style.top).toBe(`${(200 / 600) * 100}%`); // y moved from 250 to 200

    const others2 = ['1', '2', '3'].map((i) =>
      screen.getByTestId(`path-vertex-handle-${i}`).getAttribute('style'),
    );
    expect(others2).toEqual(others);
  });

  it('commits exactly one undo step for the whole drag gesture', async () => {
    await loadReadyWorkspace();
    addAndSelectPath();
    mockCanvasRect();
    fireEvent.click(editPointsToggle());

    fireEvent.pointerDown(screen.getByTestId('path-vertex-handle-0'), {
      clientX: 400,
      clientY: 250,
    });
    fireEvent.pointerMove(window, { clientX: 420, clientY: 220 });
    fireEvent.pointerMove(window, { clientX: 440, clientY: 190 });
    fireEvent.pointerUp(window, { clientX: 440, clientY: 190 });

    const handle0 = screen.getByTestId('path-vertex-handle-0');
    const draggedLeft = handle0.style.left;
    expect(draggedLeft).not.toBe('50%');

    expect(screen.getByRole('button', { name: 'Undo' })).toBeEnabled();
    fireEvent.click(screen.getByRole('button', { name: 'Undo' }));
    // One undo restores the pre-drag point position.
    expect(screen.getByTestId('path-vertex-handle-0').style.left).toBe('50%');
    // The only remaining history entry is the original "add polygon".
    expect(screen.getByRole('button', { name: 'Undo' })).toBeEnabled();
    fireEvent.click(screen.getByRole('button', { name: 'Undo' }));
    expect(shapeOutlineRows()).toHaveLength(0);
  });

  it('clamps live intermediate positions to the schema point range', async () => {
    await loadReadyWorkspace();
    addAndSelectPath();
    mockCanvasRect();
    fireEvent.click(editPointsToggle());

    fireEvent.pointerDown(screen.getByTestId('path-vertex-handle-0'), {
      clientX: 400,
      clientY: 250,
    });
    fireEvent.pointerMove(window, { clientX: 999_999, clientY: -999_999 });

    const handle0 = screen.getByTestId('path-vertex-handle-0');
    const expectedLeft = `${((400 + POSITION_LIMIT.max) / 800) * 100}%`;
    const expectedTop = `${((300 + POSITION_LIMIT.min) / 600) * 100}%`;
    expect(handle0.style.left).toBe(expectedLeft);
    expect(handle0.style.top).toBe(expectedTop);

    fireEvent.pointerUp(window, { clientX: 999_999, clientY: -999_999 });
  });

  it('cancels the drag on Escape, restoring the pre-drag position with no undo step', async () => {
    await loadReadyWorkspace();
    addAndSelectPath();
    mockCanvasRect();
    fireEvent.click(editPointsToggle());
    const undoButton = screen.getByRole('button', { name: 'Undo' });

    fireEvent.pointerDown(screen.getByTestId('path-vertex-handle-0'), {
      clientX: 400,
      clientY: 250,
    });
    fireEvent.pointerMove(window, { clientX: 460, clientY: 180 });
    expect(screen.getByTestId('path-vertex-handle-0').style.left).not.toBe('50%');

    fireEvent.keyDown(window, { key: 'Escape' });

    // Escape cancelled the in-progress drag (restoring the point) rather
    // than exiting vertex edit mode — the handle is still rendered.
    expect(screen.getByTestId('path-vertex-handle-0').style.left).toBe('50%');
    // No extra undo step: only the original "add polygon" remains.
    fireEvent.click(undoButton);
    expect(shapeOutlineRows()).toHaveLength(0);
  });

  it('a plain click on a handle (no movement) selects the vertex without creating an undo step', async () => {
    await loadReadyWorkspace();
    addAndSelectPath();
    mockCanvasRect();
    fireEvent.click(editPointsToggle());

    fireEvent.pointerDown(screen.getByTestId('path-vertex-handle-0'), {
      clientX: 400,
      clientY: 250,
    });
    fireEvent.pointerUp(window, { clientX: 400, clientY: 250 });

    expect(screen.getByTestId('path-vertex-handle-0')).toHaveAttribute('aria-pressed', 'true');
    // Only "add polygon" is on the undo stack — the no-op click/release
    // produced no history entry.
    fireEvent.click(screen.getByRole('button', { name: 'Undo' }));
    expect(shapeOutlineRows()).toHaveLength(0);
    expect(screen.getByRole('button', { name: 'Undo' })).toBeDisabled();
  });
});

describe('Insert via double-click', () => {
  it('inserts a new point on the nearest segment at the double-click location', async () => {
    await loadReadyWorkspace();
    addAndSelectPath();
    const canvas = mockCanvasRect();
    fireEvent.click(editPointsToggle());
    expect(screen.queryByTestId('path-vertex-handle-4')).not.toBeInTheDocument();

    // Midpoint of the segment from point0 (400,250) to point1 (450,300).
    fireEvent.doubleClick(canvas, { clientX: 425, clientY: 275 });

    expect(screen.getByTestId('path-vertex-handle-4')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Undo' })).toBeEnabled();

    fireEvent.click(screen.getByRole('button', { name: 'Undo' }));
    expect(screen.queryByTestId('path-vertex-handle-4')).not.toBeInTheDocument();
  });

  // The MAX_PATH_POINTS (500-point) rejection case is covered at the
  // hook level in useSceneEditor.vertex.test.ts instead of here: mounting
  // a 500-point shape through the full Inspector (which renders one
  // keyboard-accessible X/Y field pair per point — see
  // `PathPointsSection`) is prohibitively expensive for a DOM-rendered
  // test, and the hook-level test already exercises the exact same
  // `insertVertexAtPoint` code path this component calls.
});

describe('Delete via keyboard', () => {
  it('deletes the selected vertex on Delete/Backspace', async () => {
    await loadReadyWorkspace();
    addAndSelectPath();
    mockCanvasRect();
    fireEvent.click(editPointsToggle());

    fireEvent.pointerDown(screen.getByTestId('path-vertex-handle-1'), {
      clientX: 450,
      clientY: 300,
    });
    fireEvent.pointerUp(window, { clientX: 450, clientY: 300 });

    fireEvent.keyDown(window, { key: 'Delete' });

    expect(screen.queryByTestId('path-vertex-handle-3')).not.toBeInTheDocument(); // now only 3 points
    expect(screen.getByRole('button', { name: 'Undo' })).toBeEnabled();
    fireEvent.click(screen.getByRole('button', { name: 'Undo' }));
    expect(screen.getByTestId('path-vertex-handle-3')).toBeInTheDocument();
  });

  it('does nothing when no vertex is selected', async () => {
    await loadReadyWorkspace();
    addAndSelectPath();
    mockCanvasRect();
    fireEvent.click(editPointsToggle());

    fireEvent.keyDown(window, { key: 'Delete' });

    expect(screen.getByTestId('path-vertex-handle-3')).toBeInTheDocument();
    // Only "add polygon" is on the undo stack — the no-op Delete produced
    // no additional history entry.
    fireEvent.click(screen.getByRole('button', { name: 'Undo' }));
    expect(shapeOutlineRows()).toHaveLength(0);
    expect(screen.getByRole('button', { name: 'Undo' })).toBeDisabled();
  });

  it('rejects a delete at MIN_PATH_POINTS with a visible status message and no mutation', async () => {
    const points = [
      { x: 0, y: -50 },
      { x: 50, y: 0 },
    ];
    await loadReadyWorkspace(
      baseVersion({ scene_json: { ...BLANK_SCENE, shapes: [pathShape('p1', points)] } }),
    );
    fireEvent.click(shapeSelectButton(shapeOutlineRows()[0]));
    mockCanvasRect();
    fireEvent.click(editPointsToggle());

    fireEvent.pointerDown(screen.getByTestId('path-vertex-handle-0'), {
      clientX: 400,
      clientY: 250,
    });
    fireEvent.pointerUp(window, { clientX: 400, clientY: 250 });
    fireEvent.keyDown(window, { key: 'Delete' });

    expect(screen.getByText(/at least 2 points/i)).toBeInTheDocument();
    expect(screen.getByTestId('path-vertex-handle-1')).toBeInTheDocument(); // still both points
    expect(screen.getByRole('button', { name: 'Undo' })).toBeDisabled();
  });
});

describe('Keyboard point-coordinate list', () => {
  it('renders while a path is selected, even without vertex edit mode active', async () => {
    await loadReadyWorkspace();
    addAndSelectPath();
    expect(screen.getByRole('group', { name: 'Path points' })).toBeInTheDocument();
    expect(editPointsToggle()).toHaveAttribute('aria-pressed', 'false');
  });

  it('edits a point via its numeric X/Y fields, moving the corresponding canvas handle', async () => {
    await loadReadyWorkspace();
    addAndSelectPath();
    mockCanvasRect();
    fireEvent.click(editPointsToggle());

    const list = screen.getByRole('group', { name: 'Path points' });
    const firstRow = within(list).getAllByRole('listitem')[0];
    const xField = within(firstRow).getByLabelText('X');
    fireEvent.change(xField, { target: { value: '10' } });

    // point0's local x is now 10 -> absolute x = 410.
    expect(screen.getByTestId('path-vertex-handle-0').style.left).toBe(`${(410 / 800) * 100}%`);
    expect(screen.getByRole('button', { name: 'Undo' })).toBeEnabled();
  });

  it('adds a point via the keyboard "Add point" button', async () => {
    await loadReadyWorkspace();
    addAndSelectPath();
    mockCanvasRect();
    fireEvent.click(editPointsToggle());
    expect(screen.queryByTestId('path-vertex-handle-4')).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Add point' }));

    expect(screen.getByTestId('path-vertex-handle-4')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Undo' })).toBeEnabled();
  });

  it('deletes a point via its per-row "Delete point" button', async () => {
    await loadReadyWorkspace();
    addAndSelectPath();
    mockCanvasRect();
    fireEvent.click(editPointsToggle());

    fireEvent.click(screen.getByRole('button', { name: 'Delete point 1' }));

    expect(screen.queryByTestId('path-vertex-handle-3')).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Undo' })).toBeEnabled();
  });

  it('rejects deleting past the floor from the list, with the same visible message as the canvas path', async () => {
    const points = [
      { x: 0, y: -50 },
      { x: 50, y: 0 },
    ];
    await loadReadyWorkspace(
      baseVersion({ scene_json: { ...BLANK_SCENE, shapes: [pathShape('p1', points)] } }),
    );
    fireEvent.click(shapeSelectButton(shapeOutlineRows()[0]));

    fireEvent.click(screen.getByRole('button', { name: 'Delete point 1' }));

    expect(screen.getByText(/at least 2 points/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Undo' })).toBeDisabled();
  });
});

describe('Regression: Task 77 multi-shape gestures and Task 78 snapping are unaffected', () => {
  it('a 2+-shape multi-selection still shows the combined group handle set, not vertex handles', async () => {
    await loadReadyWorkspace();
    fireEvent.click(screen.getByRole('button', { name: 'Add circle' }));
    addAndSelectPath();
    mockCanvasRect();

    // Issue #168 (task 136) added Visible/Locked checkboxes to layer rows
    // in this same outline list, so an unscoped `getAllByRole` would also
    // pick those up -- filter to the "Select for grouping" checkboxes.
    const checkboxes = within(screen.getByRole('list', { name: 'Scene outline' })).getAllByRole(
      'checkbox',
      { name: /to group selection$/i },
    );
    fireEvent.click(checkboxes[0]);
    fireEvent.click(checkboxes[1]);

    expect(screen.getByTestId('group-handle-move')).toBeInTheDocument();
    expect(screen.queryByTestId('path-vertex-handle-0')).not.toBeInTheDocument();
  });

  it('grid snapping still applies to a plain whole-shape move drag', async () => {
    await loadReadyWorkspace();
    fireEvent.click(screen.getByRole('button', { name: 'Add circle' })); // center (400,300)
    const canvas = mockCanvasRect();

    const gridGroup = screen.getByRole('radiogroup', { name: 'Snap to grid' });
    fireEvent.click(within(gridGroup).getByRole('radio', { name: 'On' }));

    fireEvent.pointerDown(canvas, { clientX: 400, clientY: 300 });
    fireEvent.pointerMove(window, { clientX: 404, clientY: 300 }); // 4 units off-grid, within tolerance
    fireEvent.pointerUp(window, { clientX: 404, clientY: 300 });

    const liveSummary = canvas.querySelector('.editor-scene-shape') as HTMLElement;
    // Snapped back onto the 20-unit grid at x=400 rather than drifting to 404.
    expect(liveSummary.textContent).toContain('x=400');
  });
});
