import { fireEvent, render, screen, within } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import * as projectsApi from '../api/projects';
import type { Project, SceneVersion } from '../api/projects';
import EditorWorkspace from './EditorWorkspace';

/**
 * Issue #78: interaction tests for the preview's snap-to-grid and
 * alignment-guide behavior, layered on top of Task 26's single-shape
 * gesture wiring (`EditorWorkspace.transform.test.tsx`) and issue #77's
 * multi-shape group gesture wiring (`EditorWorkspace.multiTransform.test.tsx`,
 * both of which stay unaffected by this task — see the regression check
 * at the bottom of this file).
 *
 * `../editor/snapSettings.ts` is a module-singleton external store (see
 * its own doc comment), so its in-memory state persists across every test
 * in this one file (each test file gets its own fresh module registry,
 * but not a reset between tests within it). Every test therefore starts
 * by explicitly driving the on-screen toggle to the exact state it needs
 * via `setSnapToggles` below, rather than assuming a default.
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
    thumbnail_choice: 'auto',
    export_attribution: false,
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
}

function mockCanvasRect() {
  const canvas = screen.getByTestId('scene-canvas');
  canvas.getBoundingClientRect = () =>
    ({ left: 0, top: 0, right: 800, bottom: 600, width: 800, height: 600 }) as DOMRect;
  return canvas;
}

/** Drives both snap toggles to an explicit on/off state via the on-screen
 * control (never touching the store module directly), so every test's
 * starting state is deterministic regardless of what an earlier test in
 * this file left behind. */
function setSnapToggles(gridOn: boolean, guidesOn: boolean) {
  const gridGroup = screen.getByRole('radiogroup', { name: 'Snap to grid' });
  fireEvent.click(within(gridGroup).getByRole('radio', { name: gridOn ? 'On' : 'Off' }));
  const guidesGroup = screen.getByRole('radiogroup', { name: 'Align to shapes' });
  fireEvent.click(within(guidesGroup).getByRole('radio', { name: guidesOn ? 'On' : 'Off' }));
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

describe('EditorWorkspace snap preference: grid overlay', () => {
  it('renders no grid overlay by default (off)', async () => {
    await loadReadyWorkspace();
    setSnapToggles(false, false);
    expect(screen.queryByTestId('editor-snap-grid-overlay')).not.toBeInTheDocument();
  });

  it('renders the grid overlay once grid snapping is turned on, and removes it when turned back off', async () => {
    await loadReadyWorkspace();
    setSnapToggles(true, false);
    expect(screen.getByTestId('editor-snap-grid-overlay')).toBeInTheDocument();

    setSnapToggles(false, false);
    expect(screen.queryByTestId('editor-snap-grid-overlay')).not.toBeInTheDocument();
  });
});

describe('EditorWorkspace snap preference: grid snapping on move', () => {
  it('snaps live position to the nearest grid line within tolerance', async () => {
    await loadReadyWorkspace();
    setSnapToggles(true, false);
    fireEvent.click(screen.getByRole('button', { name: 'Add circle' })); // center (400,300), r=50
    const canvas = mockCanvasRect();

    fireEvent.pointerDown(canvas, { clientX: 400, clientY: 300 });
    // Moves the shape to (424,304); nearest grid line for each axis (420,
    // 300) is within the 8-unit tolerance on both.
    fireEvent.pointerMove(window, { clientX: 424, clientY: 304 });

    const liveSummary = canvas.querySelector('.editor-scene-shape') as HTMLElement;
    expect(liveSummary.textContent).toContain('x=420, y=300');

    fireEvent.pointerUp(window, { clientX: 424, clientY: 304 });
  });

  it('does not snap once the position is farther than tolerance from any grid line', async () => {
    await loadReadyWorkspace();
    setSnapToggles(true, false);
    fireEvent.click(screen.getByRole('button', { name: 'Add circle' }));
    const canvas = mockCanvasRect();

    fireEvent.pointerDown(canvas, { clientX: 400, clientY: 300 });
    fireEvent.pointerMove(window, { clientX: 430, clientY: 300 }); // 10 units from grid line 420/440

    const liveSummary = canvas.querySelector('.editor-scene-shape') as HTMLElement;
    expect(liveSummary.textContent).toContain('x=430, y=300');

    fireEvent.pointerUp(window, { clientX: 430, clientY: 300 });
  });

  it('a lone shape in the scene grid-snaps normally with no alignment guides possible', async () => {
    await loadReadyWorkspace();
    setSnapToggles(true, true);
    fireEvent.click(screen.getByRole('button', { name: 'Add circle' }));
    const canvas = mockCanvasRect();

    fireEvent.pointerDown(canvas, { clientX: 400, clientY: 300 });
    fireEvent.pointerMove(window, { clientX: 424, clientY: 300 });

    const liveSummary = canvas.querySelector('.editor-scene-shape') as HTMLElement;
    expect(liveSummary.textContent).toContain('x=420, y=300');
    expect(screen.queryByTestId('snap-guide-x')).not.toBeInTheDocument();
    expect(screen.queryByTestId('snap-guide-y')).not.toBeInTheDocument();

    fireEvent.pointerUp(window, { clientX: 424, clientY: 300 });
  });
});

describe('EditorWorkspace snap preference: grid snapping on resize', () => {
  it('snaps the resize handle to the grid within tolerance', async () => {
    await loadReadyWorkspace();
    setSnapToggles(true, false);
    fireEvent.click(screen.getByRole('button', { name: 'Add circle' })); // center (400,300), r=50
    const canvas = mockCanvasRect();
    const resizeHandle = screen.getByTestId('shape-handle-resize');

    // Handle starts at (450,300); dragging to (454,300) puts the live
    // radius at 54, whose absolute handle point (454,300) is 6 units from
    // the grid line 460 — within tolerance.
    fireEvent.pointerDown(resizeHandle, { clientX: 450, clientY: 300 });
    fireEvent.pointerMove(window, { clientX: 454, clientY: 300 });

    const liveSummary = canvas.querySelector('.editor-scene-shape') as HTMLElement;
    expect(liveSummary.textContent).toContain('r=60');

    fireEvent.pointerUp(window, { clientX: 454, clientY: 300 });
  });
});

describe('EditorWorkspace snap preference: alignment guides on move', () => {
  it('shows a guide line and snaps onto a sibling edge, removing the guide on release', async () => {
    await loadReadyWorkspace();
    // Snapping starts off so the two rects can be positioned exactly,
    // unsnapped, before guides are turned on.
    setSnapToggles(false, false);
    fireEvent.click(screen.getByRole('button', { name: 'Add rectangle' })); // A: top-left (350,260) 100x80
    fireEvent.click(screen.getByRole('button', { name: 'Add rectangle' })); // B: same spot, drawn on top
    const canvas = mockCanvasRect();

    // Relocate B (topmost, so this pointerdown hits it) well clear of A.
    fireEvent.pointerDown(canvas, { clientX: 400, clientY: 300 });
    fireEvent.pointerMove(window, { clientX: 700, clientY: 300 });
    fireEvent.pointerUp(window, { clientX: 700, clientY: 300 });
    // B's transform.x moved from 350 to 650 (dx=300); bounds now 650-750.

    // Now enable guides (and grid, to also exercise the "guide wins"
    // precedence rule) and select+drag A toward B.
    setSnapToggles(true, true);
    const [aButton] = within(screen.getByRole('list', { name: 'Shape list' })).getAllByRole(
      'button',
    );
    fireEvent.click(aButton);

    fireEvent.pointerDown(canvas, { clientX: 400, clientY: 300 }); // A's body (350-450, 260-340)
    // Drags A's right edge to 646 (4 units short of B's left edge, 650) —
    // within guide tolerance, and also within grid tolerance of 640 (6
    // units) on the same axis, so this also proves the guide (650), not
    // the grid (640), wins.
    fireEvent.pointerMove(window, { clientX: 596, clientY: 300 });

    const guideLine = screen.getByTestId('snap-guide-x');
    expect(guideLine).toHaveAttribute('x1', '650');

    const liveSummary = canvas.querySelector('.editor-scene-shape') as HTMLElement;
    expect(liveSummary.textContent).toContain('x=550, y=260'); // snapped so maxX (x+100) = 650

    fireEvent.pointerUp(window, { clientX: 596, clientY: 300 });
    // No stale guide line left rendered after pointerup.
    expect(screen.queryByTestId('snap-guide-x')).not.toBeInTheDocument();
    expect(screen.queryByTestId('snap-guide-y')).not.toBeInTheDocument();
  });

  it('never aligns a shape against itself', async () => {
    await loadReadyWorkspace();
    setSnapToggles(false, true);
    fireEvent.click(screen.getByRole('button', { name: 'Add circle' })); // the only shape
    const canvas = mockCanvasRect();

    fireEvent.pointerDown(canvas, { clientX: 400, clientY: 300 });
    fireEvent.pointerMove(window, { clientX: 420, clientY: 300 });

    expect(screen.queryByTestId('snap-guide-x')).not.toBeInTheDocument();
    fireEvent.pointerUp(window, { clientX: 420, clientY: 300 });
  });
});

describe('EditorWorkspace snap preference: cancel and toggling', () => {
  it('Escape cancels a snapped drag, restoring the pre-drag position with no undo step and no stale guide', async () => {
    await loadReadyWorkspace();
    setSnapToggles(true, false);
    fireEvent.click(screen.getByRole('button', { name: 'Add circle' })); // (400,300)
    const canvas = mockCanvasRect();
    const undoButton = screen.getByRole('button', { name: 'Undo' });

    fireEvent.pointerDown(canvas, { clientX: 400, clientY: 300 });
    fireEvent.pointerMove(window, { clientX: 424, clientY: 300 });
    const liveSummary = canvas.querySelector('.editor-scene-shape') as HTMLElement;
    expect(liveSummary.textContent).toContain('x=420, y=300'); // snapped mid-gesture

    fireEvent.keyDown(window, { key: 'Escape' });

    expect(liveSummary.textContent).toContain('x=400, y=300');
    expect(screen.queryByTestId('snap-guide-x')).not.toBeInTheDocument();
    // Only the original "add circle" is left to undo — the cancelled,
    // snapped drag created no history entry of its own.
    fireEvent.click(undoButton);
    expect(screen.getByText('No shapes yet.')).toBeInTheDocument();
  });

  it('turning grid snapping off mid-gesture stops snapping later frames of that same gesture', async () => {
    await loadReadyWorkspace();
    setSnapToggles(true, false);
    fireEvent.click(screen.getByRole('button', { name: 'Add circle' }));
    const canvas = mockCanvasRect();

    fireEvent.pointerDown(canvas, { clientX: 400, clientY: 300 });
    fireEvent.pointerMove(window, { clientX: 424, clientY: 300 });
    const liveSummary = canvas.querySelector('.editor-scene-shape') as HTMLElement;
    expect(liveSummary.textContent).toContain('x=420, y=300'); // snapped

    // Flip the toggle off without ending the gesture.
    setSnapToggles(false, false);

    fireEvent.pointerMove(window, { clientX: 444, clientY: 300 }); // 44 units from the 8-unit tolerance grid line 440
    expect(liveSummary.textContent).toContain('x=444, y=300'); // no longer snapping

    fireEvent.pointerUp(window, { clientX: 444, clientY: 300 });
  });
});

describe('EditorWorkspace snap preference: rotate is unaffected', () => {
  it('rotating with both snap settings enabled behaves exactly as with them disabled', async () => {
    await loadReadyWorkspace();
    setSnapToggles(true, true);
    fireEvent.click(screen.getByRole('button', { name: 'Add rectangle' })); // top-left (350,260)
    mockCanvasRect();
    const rotateHandle = screen.getByTestId('shape-handle-rotate');

    fireEvent.pointerDown(rotateHandle, { clientX: 400, clientY: 236 });
    fireEvent.pointerMove(window, { clientX: 500, clientY: 300 });
    fireEvent.pointerUp(window, { clientX: 500, clientY: 300 });

    expect(screen.getByRole('button', { name: 'Undo' })).toBeEnabled();
    expect(screen.queryByTestId('snap-guide-x')).not.toBeInTheDocument();
  });
});

describe('EditorWorkspace snap preference: multi-shape group gestures are unaffected (regression)', () => {
  it('a group drag with both snap settings enabled follows the pointer exactly, unsnapped', async () => {
    await loadReadyWorkspace();
    setSnapToggles(true, true);
    fireEvent.click(screen.getByRole('button', { name: 'Add circle' })); // (400,300)
    fireEvent.click(screen.getByRole('button', { name: 'Add rectangle' })); // (350,260)
    const canvas = mockCanvasRect();

    const checkboxes = within(screen.getByRole('list', { name: 'Scene outline' })).getAllByRole(
      'checkbox',
    );
    fireEvent.click(checkboxes[0]);
    fireEvent.click(checkboxes[1]);

    expect(screen.getByTestId('group-handle-move')).toBeInTheDocument();

    // Select the circle explicitly so its live summary text is visible
    // (only the actively selected shape renders one) — matching
    // EditorWorkspace.multiTransform.test.tsx's own convention.
    const [circleButton] = within(screen.getByRole('list', { name: 'Shape list' })).getAllByRole(
      'button',
    );
    fireEvent.click(circleButton);

    fireEvent.pointerDown(canvas, { clientX: 400, clientY: 300 }); // circle body, a group member
    // A delta chosen to land 4 units off a grid line, which the
    // single-shape path above would snap — the group path must not.
    fireEvent.pointerMove(window, { clientX: 424, clientY: 300 });
    fireEvent.pointerUp(window, { clientX: 424, clientY: 300 });

    const circleSummary = canvas.querySelector(`[data-shape-type="circle"]`) as HTMLElement;
    // Unsnapped: moved by exactly the pointer delta (+24), landing on 424,
    // not the grid-snapped 420.
    expect(circleSummary.textContent).toContain('x=424, y=300');
    expect(screen.queryByTestId('snap-guide-x')).not.toBeInTheDocument();
  });
});
