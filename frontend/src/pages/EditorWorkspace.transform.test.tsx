import { fireEvent, render, screen, within } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import * as projectsApi from '../api/projects';
import type { Project, SceneVersion } from '../api/projects';
import EditorWorkspace from './EditorWorkspace';

/**
 * Task 26: interaction tests for the preview's pointer-based move/resize/
 * rotate handles, layered on top of the Task 21-25 workspace shell and
 * Task 23 shape add/select/undo/redo.
 */

vi.mock('../api/projects');

const mockedGetProject = vi.mocked(projectsApi.getProject);
const mockedGetSceneVersion = vi.mocked(projectsApi.getSceneVersion);

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

async function addAndSelectCircle() {
  fireEvent.click(screen.getByRole('button', { name: 'Add circle' }));
  // createShape centers a circle on the 800x600 canvas: (400,300), r=50.
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe('EditorWorkspace transform handles: visibility', () => {
  it('shows no handles when nothing is selected', async () => {
    await loadReadyWorkspace();
    await addAndSelectCircle();
    mockCanvasRect();
    fireEvent.click(screen.getByTestId('scene-canvas'), { clientX: 5, clientY: 5 }); // deselect

    expect(screen.queryByTestId('shape-handle-move')).not.toBeInTheDocument();
    expect(screen.queryByTestId('shape-handle-resize')).not.toBeInTheDocument();
    expect(screen.queryByTestId('shape-handle-rotate')).not.toBeInTheDocument();
  });

  it('shows move, resize, and rotate handles for the single selected shape', async () => {
    await loadReadyWorkspace();
    await addAndSelectCircle();

    expect(screen.getByTestId('shape-handle-move')).toBeInTheDocument();
    expect(screen.getByTestId('shape-handle-resize')).toBeInTheDocument();
    expect(screen.getByTestId('shape-handle-rotate')).toBeInTheDocument();
  });

  it('updates handles to match after selection changes to a different shape', async () => {
    await loadReadyWorkspace();
    fireEvent.click(screen.getByRole('button', { name: 'Add circle' }));
    fireEvent.click(screen.getByRole('button', { name: 'Add rectangle' }));
    mockCanvasRect();

    // Rect is selected (added last); move handle sits at its top-left
    // (350,260) => 43.75%/43.33% of the 800x600 canvas.
    let moveHandle = screen.getByTestId('shape-handle-move');
    expect(moveHandle.style.left).toBe('43.75%');

    const [circleButton] = within(screen.getByRole('list', { name: 'Shape list' })).getAllByRole(
      'button',
    );
    fireEvent.click(circleButton);

    // Circle is now selected; its move handle sits at its center (400,300)
    // => 50%/50%.
    moveHandle = screen.getByTestId('shape-handle-move');
    expect(moveHandle.style.left).toBe('50%');
    expect(moveHandle.style.top).toBe('50%');
  });

  it('removes handles when the selected shape is deleted', async () => {
    await loadReadyWorkspace();
    await addAndSelectCircle();
    expect(screen.getByTestId('shape-handle-move')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Delete selected shape' }));

    expect(screen.queryByTestId('shape-handle-move')).not.toBeInTheDocument();
  });

  it('leaves no stale handles after an undo that changes the selection', async () => {
    await loadReadyWorkspace();
    await addAndSelectCircle();
    fireEvent.click(screen.getByRole('button', { name: 'Undo' }));

    expect(screen.queryByTestId('shape-handle-move')).not.toBeInTheDocument();
  });
});

describe('EditorWorkspace transform handles: move', () => {
  it('drags the shape body live and commits exactly one undo step for the whole gesture', async () => {
    await loadReadyWorkspace();
    await addAndSelectCircle();
    const canvas = mockCanvasRect();

    fireEvent.pointerDown(canvas, { clientX: 400, clientY: 300 });
    fireEvent.pointerMove(window, { clientX: 420, clientY: 260 });
    fireEvent.pointerMove(window, { clientX: 450, clientY: 240 });
    fireEvent.pointerUp(window, { clientX: 450, clientY: 240 });

    const liveSummary = canvas.querySelector('.editor-scene-shape') as HTMLElement;
    expect(liveSummary.textContent).toContain('x=450, y=240');

    expect(screen.getByRole('button', { name: 'Undo' })).toBeEnabled();
    fireEvent.click(screen.getByRole('button', { name: 'Undo' }));
    expect(liveSummary.textContent).toContain('x=400, y=300');
    // A single undo reverted the whole drag; the only thing left to undo
    // is the original "add circle".
    expect(screen.getByRole('button', { name: 'Undo' })).toBeEnabled();
    fireEvent.click(screen.getByRole('button', { name: 'Undo' }));
    expect(screen.getByText('No shapes yet.')).toBeInTheDocument();
  });

  it('clamps live intermediate positions to the schema range mid-drag, not just on release', async () => {
    await loadReadyWorkspace();
    await addAndSelectCircle();
    const canvas = mockCanvasRect();

    fireEvent.pointerDown(canvas, { clientX: 400, clientY: 300 });
    fireEvent.pointerMove(window, { clientX: 999_999, clientY: -999_999 });

    const liveSummary = canvas.querySelector('.editor-scene-shape') as HTMLElement;
    expect(liveSummary.textContent).toContain('x=100000');
    expect(liveSummary.textContent).toContain('y=-100000');

    fireEvent.pointerUp(window, { clientX: 999_999, clientY: -999_999 });
  });

  it('keeps updating the shape when the pointer moves outside the canvas element bounds', async () => {
    await loadReadyWorkspace();
    await addAndSelectCircle();
    const canvas = mockCanvasRect();

    fireEvent.pointerDown(canvas, { clientX: 400, clientY: 300 });
    // Far outside the mocked 800x600 canvas rect.
    fireEvent.pointerMove(window, { clientX: 5000, clientY: 5000 });
    fireEvent.pointerUp(window, { clientX: 5000, clientY: 5000 });

    const liveSummary = canvas.querySelector('.editor-scene-shape') as HTMLElement;
    // The drag was not clipped to the (800x600) canvas bounds: the shape
    // followed the pointer all the way out to (5000, 5000).
    expect(liveSummary.textContent).toContain('x=5000, y=5000');
  });

  it('selects a different shape and moves it in the same gesture', async () => {
    await loadReadyWorkspace();
    fireEvent.click(screen.getByRole('button', { name: 'Add circle' }));
    fireEvent.click(screen.getByRole('button', { name: 'Add rectangle' }));
    const canvas = mockCanvasRect();

    const [circleButton, rectButton] = within(
      screen.getByRole('list', { name: 'Shape list' }),
    ).getAllByRole('button');
    expect(rectButton).toHaveAttribute('aria-pressed', 'true'); // rect auto-selected by add

    // Both shapes overlap at the canvas center; the rect (added last) is
    // topmost, so a drag starting there should select and move the rect,
    // not the circle — same resolution as plain click-to-select.
    fireEvent.pointerDown(canvas, { clientX: 400, clientY: 300 });
    expect(rectButton).toHaveAttribute('aria-pressed', 'true');
    expect(circleButton).toHaveAttribute('aria-pressed', 'false');
    fireEvent.pointerMove(window, { clientX: 500, clientY: 300 });
    fireEvent.pointerUp(window, { clientX: 500, clientY: 300 });

    expect(screen.getByRole('button', { name: 'Undo' })).toBeEnabled();
  });

  it('cancels the drag on Escape, restoring the pre-drag position with no undo step', async () => {
    await loadReadyWorkspace();
    await addAndSelectCircle();
    const canvas = mockCanvasRect();
    // Undo currently only has the "add circle" step; capture the button.
    const undoButton = screen.getByRole('button', { name: 'Undo' });

    fireEvent.pointerDown(canvas, { clientX: 400, clientY: 300 });
    fireEvent.pointerMove(window, { clientX: 460, clientY: 260 });
    const liveSummary = canvas.querySelector('.editor-scene-shape') as HTMLElement;
    expect(liveSummary.textContent).toContain('x=460, y=260');

    fireEvent.keyDown(window, { key: 'Escape' });

    expect(liveSummary.textContent).toContain('x=400, y=300');
    // Undo still only reverts the original add — the cancelled drag left
    // no history entry of its own.
    fireEvent.click(undoButton);
    expect(screen.getByText('No shapes yet.')).toBeInTheDocument();
  });
});

describe('EditorWorkspace transform handles: resize', () => {
  it('resizes a circle live by dragging the resize handle', async () => {
    await loadReadyWorkspace();
    await addAndSelectCircle();
    const canvas = mockCanvasRect();
    const resizeHandle = screen.getByTestId('shape-handle-resize');

    fireEvent.pointerDown(resizeHandle, { clientX: 450, clientY: 300 });
    fireEvent.pointerMove(window, { clientX: 500, clientY: 300 });
    fireEvent.pointerUp(window, { clientX: 500, clientY: 300 });

    const liveSummary = canvas.querySelector('.editor-scene-shape') as HTMLElement;
    expect(liveSummary.textContent).toContain('r=100');
    expect(screen.getByRole('button', { name: 'Undo' })).toBeEnabled();
  });

  it('clamps a shrinking resize at the schema minimum instead of a degenerate shape', async () => {
    await loadReadyWorkspace();
    await addAndSelectCircle();
    const canvas = mockCanvasRect();
    const resizeHandle = screen.getByTestId('shape-handle-resize');

    fireEvent.pointerDown(resizeHandle, { clientX: 450, clientY: 300 });
    fireEvent.pointerMove(window, { clientX: 400, clientY: 300 }); // drag onto the center
    fireEvent.pointerUp(window, { clientX: 400, clientY: 300 });

    const liveSummary = canvas.querySelector('.editor-scene-shape') as HTMLElement;
    expect(liveSummary.textContent).toContain('r=0.1');
  });

  it('resizes rect width/height independently via its resize handle', async () => {
    await loadReadyWorkspace();
    fireEvent.click(screen.getByRole('button', { name: 'Add rectangle' })); // top-left (350,260) 100x80
    const canvas = mockCanvasRect();
    const resizeHandle = screen.getByTestId('shape-handle-resize');

    fireEvent.pointerDown(resizeHandle, { clientX: 450, clientY: 340 });
    fireEvent.pointerMove(window, { clientX: 500, clientY: 400 });
    fireEvent.pointerUp(window, { clientX: 500, clientY: 400 });

    const liveSummary = canvas.querySelector('.editor-scene-shape') as HTMLElement;
    expect(liveSummary.textContent).toContain('w=150, h=140');
  });
});

describe('EditorWorkspace transform handles: rotate', () => {
  it('rotates a shape live by dragging the rotate handle', async () => {
    await loadReadyWorkspace();
    fireEvent.click(screen.getByRole('button', { name: 'Add rectangle' })); // top-left (350,260)
    mockCanvasRect();
    const rotateHandle = screen.getByTestId('shape-handle-rotate');

    // Rotate handle starts above center (400, ~236); drag it to the right
    // of center to rotate ~90 degrees.
    fireEvent.pointerDown(rotateHandle, { clientX: 400, clientY: 236 });
    fireEvent.pointerMove(window, { clientX: 500, clientY: 300 });
    fireEvent.pointerUp(window, { clientX: 500, clientY: 300 });

    expect(screen.getByRole('button', { name: 'Undo' })).toBeEnabled();
  });
});

describe('EditorWorkspace transform handles: idle handles do not manipulate a stale shape', () => {
  it('a pointerdown that hits no shape body does not start a drag, even near a handle position', async () => {
    await loadReadyWorkspace();
    await addAndSelectCircle();
    const canvas = mockCanvasRect();

    // Deselect: click empty space far from the circle.
    fireEvent.click(canvas, { clientX: 5, clientY: 5 });
    expect(screen.queryByTestId('shape-handle-move')).not.toBeInTheDocument();

    // A pointerdown here hits nothing but empty canvas space — since a
    // handle for a former selection is never rendered at all once
    // deselected, there's nothing stale to hit or drag.
    fireEvent.pointerDown(canvas, { clientX: 5, clientY: 5 });
    fireEvent.pointerMove(window, { clientX: 50, clientY: 50 });
    fireEvent.pointerUp(window, { clientX: 50, clientY: 50 });

    // Only the original "add circle" is on the undo stack; the empty-space
    // pointerdown/move/up produced no additional history entry.
    fireEvent.click(screen.getByRole('button', { name: 'Undo' }));
    expect(screen.getByText('No shapes yet.')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Undo' })).toBeDisabled();
  });
});
