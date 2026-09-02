import { fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import * as projectsApi from '../api/projects';
import type { Project, SceneVersion } from '../api/projects';
import EditorWorkspace, { getCanvasFitScale } from './EditorWorkspace';
import { expandAllCollapsibleSections } from '../testUtils/expandCollapsibleSections';

/**
 * Issue #156: zoom in/out/reset controls, the live percentage readout,
 * Ctrl/Cmd+scroll-wheel and Ctrl/Cmd+"+"/"-"/0 keyboard accelerators, and
 * click-drag panning once zoomed beyond 100% — including the "empty
 * background pans, a shape body still drags the shape" disambiguation and
 * that pointer-to-scene coordinate math (`clientToCanvasPoint`, exercised
 * here only through the real component, never duplicated) stays correct at
 * both the default 100%/no-pan state and while zoomed/panned.
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
  await userEvent.setup().click(screen.getByRole('button', { name: 'Edit scene' }));
}

/** Matches `EditorWorkspace.transform.test.tsx`'s own helper — the 800x600
 * logical canvas rendered 1:1 (unzoomed) on screen. */
function mockUnzoomedCanvasRect() {
  const canvas = screen.getByTestId('scene-canvas');
  canvas.getBoundingClientRect = () =>
    ({ left: 0, top: 0, right: 800, bottom: 600, width: 800, height: 600 }) as DOMRect;
  return canvas;
}

/** A canvas rect scaled 2x (as a real browser's `getBoundingClientRect()`
 * would report once the `transform: scale(2)` this issue applies is in
 * effect) — used to prove pointer math stays correct at a non-100% zoom
 * without any second, zoom-aware conversion path. */
function mockZoomedCanvasRect(scale: number) {
  const canvas = screen.getByTestId('scene-canvas');
  const width = 800 * scale;
  const height = 600 * scale;
  canvas.getBoundingClientRect = () =>
    ({ left: 0, top: 0, right: width, bottom: height, width, height }) as DOMRect;
  return canvas;
}

/** The clipping viewport's own (unscaled) box — pan clamping is bounded
 * against this, not the zoomed canvas box. */
function mockViewportRect() {
  const viewport = screen.getByTestId('scene-canvas-viewport');
  viewport.getBoundingClientRect = () =>
    ({ left: 0, top: 0, right: 800, bottom: 600, width: 800, height: 600 }) as DOMRect;
  return viewport;
}

async function addAndSelectCircle() {
  fireEvent.click(screen.getByRole('button', { name: 'Add circle' }));
  // createShape centers a circle on the 800x600 canvas: (400,300), r=50.
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

describe('EditorWorkspace zoom controls (issue #156)', () => {
  it('starts at 100% with the reset button disabled', async () => {
    await loadReadyWorkspace();

    expect(screen.getByTestId('editor-zoom-readout').textContent).toBe('100%');
    expect(screen.getByRole('button', { name: 'Reset zoom' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Zoom in' })).toBeEnabled();
    expect(screen.getByRole('button', { name: 'Zoom out' })).toBeEnabled();
  });

  it('zooms in on click, updates the readout, and enables the reset button', async () => {
    await loadReadyWorkspace();

    fireEvent.click(screen.getByRole('button', { name: 'Zoom in' }));

    expect(screen.getByTestId('editor-zoom-readout').textContent).toBe('125%');
    expect(screen.getByRole('button', { name: 'Reset zoom' })).toBeEnabled();
  });

  it('zooms out on click and updates the readout', async () => {
    await loadReadyWorkspace();

    fireEvent.click(screen.getByRole('button', { name: 'Zoom out' }));

    expect(screen.getByTestId('editor-zoom-readout').textContent).toBe('75%');
  });

  it('disables the zoom-in button at the 400% max bound', async () => {
    await loadReadyWorkspace();
    const zoomIn = screen.getByRole('button', { name: 'Zoom in' });

    for (let i = 0; i < 12; i++) fireEvent.click(zoomIn);

    expect(screen.getByTestId('editor-zoom-readout').textContent).toBe('400%');
    expect(zoomIn).toBeDisabled();
  });

  it('disables the zoom-out button at the 25% min bound', async () => {
    await loadReadyWorkspace();
    const zoomOut = screen.getByRole('button', { name: 'Zoom out' });

    for (let i = 0; i < 3; i++) fireEvent.click(zoomOut);

    expect(screen.getByTestId('editor-zoom-readout').textContent).toBe('25%');
    expect(zoomOut).toBeDisabled();
  });

  it('resets to 100% on reset button click', async () => {
    await loadReadyWorkspace();
    fireEvent.click(screen.getByRole('button', { name: 'Zoom in' }));
    fireEvent.click(screen.getByRole('button', { name: 'Zoom in' }));

    fireEvent.click(screen.getByRole('button', { name: 'Reset zoom' }));

    expect(screen.getByTestId('editor-zoom-readout').textContent).toBe('100%');
    expect(screen.getByRole('button', { name: 'Reset zoom' })).toBeDisabled();
  });

  it('labels the buttons for screen readers, matching the existing ToolbarButton pattern', async () => {
    await loadReadyWorkspace();

    expect(screen.getByRole('button', { name: 'Zoom in' })).toHaveAccessibleName('Zoom in');
    expect(screen.getByRole('button', { name: 'Zoom out' })).toHaveAccessibleName('Zoom out');
  });
});

describe('EditorWorkspace responsive canvas fit (issue #184)', () => {
  it('uses the largest uniform scale for a canonical scene inside the usable viewport', () => {
    expect(getCanvasFitScale(1200, 700, 800, 600)).toBeCloseTo(7 / 6);
    expect(getCanvasFitScale(500, 500, 800, 600)).toBeCloseTo(0.625);
    expect(getCanvasFitScale(0, 500, 800, 600)).toBe(1);
  });

  it('exposes an accessible fit action and keeps it separate from scene state', async () => {
    await loadReadyWorkspace();
    const canvas = screen.getByTestId('scene-canvas');
    mockViewportRect();

    expect(screen.getByRole('button', { name: 'Fit to viewport' })).toBeEnabled();
    fireEvent.click(screen.getByRole('button', { name: 'Fit to viewport' }));

    expect(screen.getByTestId('editor-zoom-readout').textContent).toBe('100%');
    expect(canvas.style.transform).toContain('translate(0px, 0px) scale(1)');
    expect(mockedGetSceneVersion).toHaveBeenCalledTimes(1);
  });
});

describe('EditorWorkspace zoom keyboard shortcuts (issue #156)', () => {
  it('zooms in on Ctrl/Cmd+"="/"+"', async () => {
    await loadReadyWorkspace();

    fireEvent.keyDown(window, { key: '=', ctrlKey: true });

    expect(screen.getByTestId('editor-zoom-readout').textContent).toBe('125%');
  });

  it('zooms out on Ctrl/Cmd+"-"', async () => {
    await loadReadyWorkspace();

    fireEvent.keyDown(window, { key: '-', metaKey: true });

    expect(screen.getByTestId('editor-zoom-readout').textContent).toBe('75%');
  });

  it('resets to 100% on Ctrl/Cmd+0', async () => {
    await loadReadyWorkspace();
    fireEvent.keyDown(window, { key: '=', ctrlKey: true });
    fireEvent.keyDown(window, { key: '=', ctrlKey: true });

    fireEvent.keyDown(window, { key: '0', ctrlKey: true });

    expect(screen.getByTestId('editor-zoom-readout').textContent).toBe('100%');
  });

  it('ignores the zoom shortcuts while a text field has focus, matching isTypingTarget', async () => {
    await loadReadyWorkspace();
    const titleEditButton = screen.getByRole('button', { name: 'Edit title' });
    fireEvent.click(titleEditButton);
    const titleInput = screen.getByLabelText('Title');
    titleInput.focus();

    fireEvent.keyDown(titleInput, { key: '=', ctrlKey: true });

    expect(screen.getByTestId('editor-zoom-readout').textContent).toBe('100%');
  });

  it('does not zoom on the shortcut keys without Ctrl/Cmd held', async () => {
    await loadReadyWorkspace();

    fireEvent.keyDown(window, { key: '=' });

    expect(screen.getByTestId('editor-zoom-readout').textContent).toBe('100%');
  });
});

describe('EditorWorkspace Ctrl/Cmd+scroll-wheel zoom accelerator (issue #156)', () => {
  it('zooms in on Ctrl+scroll-up (negative deltaY)', async () => {
    await loadReadyWorkspace();
    const viewport = mockViewportRect();

    fireEvent.wheel(viewport, { deltaY: -100, ctrlKey: true });

    const readout = Number(screen.getByTestId('editor-zoom-readout').textContent!.replace('%', ''));
    expect(readout).toBeGreaterThan(100);
  });

  it('zooms out on Ctrl+scroll-down (positive deltaY)', async () => {
    await loadReadyWorkspace();
    const viewport = mockViewportRect();

    fireEvent.wheel(viewport, { deltaY: 100, ctrlKey: true });

    const readout = Number(screen.getByTestId('editor-zoom-readout').textContent!.replace('%', ''));
    expect(readout).toBeLessThan(100);
  });

  it('does not hijack a plain scroll (no Ctrl/Cmd) — zoom stays unchanged', async () => {
    await loadReadyWorkspace();
    const viewport = mockViewportRect();

    fireEvent.wheel(viewport, { deltaY: 100 });

    expect(screen.getByTestId('editor-zoom-readout').textContent).toBe('100%');
  });
});

describe('EditorWorkspace pan-vs-shape-drag disambiguation (issue #156)', () => {
  it('does not pan at 100% zoom — dragging empty canvas leaves the transform at translate(0px, 0px) scale(1)', async () => {
    await loadReadyWorkspace();
    const canvas = mockUnzoomedCanvasRect();
    mockViewportRect();

    fireEvent.pointerDown(canvas, { clientX: 10, clientY: 10 }); // empty background
    fireEvent.pointerMove(window, { clientX: 60, clientY: 50 });
    fireEvent.pointerUp(window, { clientX: 60, clientY: 50 });

    expect(canvas.style.transform).toContain('translate(0px, 0px)');
    expect(canvas.style.transform).toContain('scale(1)');
  });

  it('pans the view when dragging empty canvas background once zoomed beyond 100%', async () => {
    await loadReadyWorkspace();
    fireEvent.click(screen.getByRole('button', { name: 'Zoom in' })); // 125%
    fireEvent.click(screen.getByRole('button', { name: 'Zoom in' })); // 150%
    fireEvent.click(screen.getByRole('button', { name: 'Zoom in' })); // 175%
    fireEvent.click(screen.getByRole('button', { name: 'Zoom in' })); // 200%
    const canvas = mockZoomedCanvasRect(2);
    mockViewportRect();

    fireEvent.pointerDown(canvas, { clientX: 10, clientY: 10 }); // far from any shape
    fireEvent.pointerMove(window, { clientX: 70, clientY: 50 });
    fireEvent.pointerUp(window, { clientX: 70, clientY: 50 });

    expect(canvas.style.transform).toContain('translate(60px, 40px)');
    expect(canvas.style.transform).toContain('scale(2)');
  });

  it('cancels an in-progress pan on Escape, reverting to the pre-gesture offset', async () => {
    await loadReadyWorkspace();
    fireEvent.click(screen.getByRole('button', { name: 'Zoom in' }));
    fireEvent.click(screen.getByRole('button', { name: 'Zoom in' }));
    fireEvent.click(screen.getByRole('button', { name: 'Zoom in' }));
    fireEvent.click(screen.getByRole('button', { name: 'Zoom in' })); // 200%
    const canvas = mockZoomedCanvasRect(2);
    mockViewportRect();

    fireEvent.pointerDown(canvas, { clientX: 10, clientY: 10 });
    fireEvent.pointerMove(window, { clientX: 70, clientY: 50 });
    expect(canvas.style.transform).toContain('translate(60px, 40px)');

    fireEvent.keyDown(window, { key: 'Escape' });

    expect(canvas.style.transform).toContain('translate(0px, 0px)');
  });

  it('still drags a shape body (not the view) when a gesture starts on a shape, even while zoomed', async () => {
    await loadReadyWorkspace();
    await addAndSelectCircle();
    fireEvent.click(screen.getByRole('button', { name: 'Zoom in' })); // 125%
    fireEvent.click(screen.getByRole('button', { name: 'Zoom in' })); // 150%
    fireEvent.click(screen.getByRole('button', { name: 'Zoom in' })); // 175%
    fireEvent.click(screen.getByRole('button', { name: 'Zoom in' })); // 200%
    // A real browser's rendered rect for the 800x600 canvas at 200% zoom:
    // 1600x1200. `clientToCanvasPoint`'s own scale derivation (rect vs.
    // logical canvasWidth/canvasHeight) is exercised unmodified here.
    const canvas = mockZoomedCanvasRect(2);
    mockViewportRect();

    // The circle sits at scene (400,300); at 2x that's visual (800,600).
    fireEvent.pointerDown(canvas, { clientX: 800, clientY: 600 });
    // Move by a visual 100px right => 50 scene units at 2x scale.
    fireEvent.pointerMove(window, { clientX: 900, clientY: 600 });
    fireEvent.pointerUp(window, { clientX: 900, clientY: 600 });

    // The shape moved (proving the correct shape was hit and dragged by
    // the correct scene-space delta) and the canvas's own view transform
    // was never touched by this gesture (no pan occurred).
    const liveSummary = canvas.querySelector('.editor-scene-shape') as HTMLElement;
    expect(liveSummary.textContent).toContain('x=450, y=300');
    expect(canvas.style.transform).toContain('translate(0px, 0px)');
    expect(canvas.style.transform).toContain('scale(2)');
  });

  it('resets pan to centered when zooming back to 100% or below', async () => {
    await loadReadyWorkspace();
    fireEvent.click(screen.getByRole('button', { name: 'Zoom in' })); // 125%
    fireEvent.click(screen.getByRole('button', { name: 'Zoom in' })); // 150%
    fireEvent.click(screen.getByRole('button', { name: 'Zoom in' })); // 175%
    fireEvent.click(screen.getByRole('button', { name: 'Zoom in' })); // 200%
    const canvas = mockZoomedCanvasRect(2);
    mockViewportRect();
    fireEvent.pointerDown(canvas, { clientX: 10, clientY: 10 });
    fireEvent.pointerMove(window, { clientX: 70, clientY: 50 });
    fireEvent.pointerUp(window, { clientX: 70, clientY: 50 });
    expect(canvas.style.transform).toContain('translate(60px, 40px)');

    fireEvent.click(screen.getByRole('button', { name: 'Reset zoom' }));

    expect(canvas.style.transform).toContain('translate(0px, 0px)');
    expect(canvas.style.transform).toContain('scale(1)');
  });
});
