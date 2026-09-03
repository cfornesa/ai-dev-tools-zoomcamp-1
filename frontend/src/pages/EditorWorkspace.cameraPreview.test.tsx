import { act, fireEvent, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { setMotionOverride } from '../a11y/reducedMotion';
import * as projectsApi from '../api/projects';
import type { Project, SceneVersion } from '../api/projects';
import type { CameraStatus } from '../components/CameraControl';
import EditorWorkspace from './EditorWorkspace';
import { expandAllCollapsibleSections } from '../testUtils/expandCollapsibleSections';
import { shapeOutlineSelectButtons } from '../testUtils/shapeOutline';

/**
 * Task 109 (issue #140): live-reproduction checklist for "Preview canvas
 * goes blank after live camera becomes active."
 *
 * The read-only code investigation that proposed this issue found no code
 * path in `EditorWorkspace.tsx` that conditions the Preview panel's shape
 * count text, interaction hint, or canvas wrapper on `cameraStatus` —
 * `panelHidden` explicitly special-cases `'preview'` to always return
 * `false` regardless of viewport, and nothing else in the Preview
 * `<section>` reads `cameraStatus`. This suite exercises every dimension
 * the issue's acceptance criteria call out (first vs. repeated
 * activation, shape count, viewport width, the Camera
 * `CollapsibleSection`'s collapse/expand — which unmounts/remounts
 * `CameraControl` per `CollapsibleSection.tsx`'s `open && children` guard
 * — and reduced motion) as deterministic, no-real-camera regression
 * coverage, since none of those dimensions actually require a live camera
 * or a real browser: `CameraControl` is mocked here (as
 * `CameraControl.test.tsx` already covers its own internal permission/
 * MediaPipe state machine) purely as a controllable status source, the
 * same boundary-mocking pattern `EditorWorkspace.previewRuntime.test.tsx`
 * uses for `p5Adapter`. If any of these assertions ever fail, that's a
 * genuine regression in `EditorWorkspace.tsx` itself; the remaining
 * criteria this issue lists that this suite cannot exercise (an actual
 * `getUserMedia` permission prompt, real MediaPipe frames, and the live
 * production deployment) still need a manual pass — see the issue for
 * that residual checklist.
 */

const { onStatusChangeRef } = vi.hoisted(() => ({
  onStatusChangeRef: { current: null as ((status: CameraStatus) => void) | null },
}));

vi.mock('../components/CameraControl', () => ({
  default: ({ onStatusChange }: { onStatusChange?: (status: CameraStatus) => void }) => {
    onStatusChangeRef.current = onStatusChange ?? null;
    return <div data-testid="fake-camera-control">Camera stub</div>;
  },
}));

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

const CIRCLE_SHAPE = {
  id: 'shape-1',
  type: 'circle',
  layerId: 'layer-1',
  groupId: null,
  transform: { x: 100, y: 100, scaleX: 1, scaleY: 1, rotation: 0, opacity: 1 },
  style: { fill: '#4f46e5', stroke: null, strokeWidth: 0 },
  radius: 20,
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

function setViewportWidth(width: number) {
  Object.defineProperty(window, 'innerWidth', { writable: true, configurable: true, value: width });
  window.dispatchEvent(new Event('resize'));
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

async function loadWorkspace(scene: unknown) {
  mockedGetProject.mockResolvedValue(baseProject());
  mockedGetSceneVersion.mockResolvedValue(baseVersion(scene));
  renderWorkspace();
  await screen.findByRole('region', { name: 'Tools' });
  expandAllCollapsibleSections();
}

function setCameraStatus(status: CameraStatus) {
  act(() => {
    onStatusChangeRef.current?.(status);
  });
}

function assertPreviewFullyRendered(expectedShapeCount: number) {
  const preview = screen.getByRole('region', { name: 'Preview' });
  expect(
    within(preview).getByText(`${expectedShapeCount} shape(s) in the working copy.`),
  ).toBeInTheDocument();
  expect(within(preview).getByTestId('editor-canvas-hint')).toBeInTheDocument();
  expect(within(preview).getByTestId('scene-canvas')).toBeInTheDocument();
  expect(within(preview).queryByRole('alert')).toBeNull();
}

beforeEach(() => {
  vi.clearAllMocks();
  onStatusChangeRef.current = null;
  setViewportWidth(1280);
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

afterEach(() => {
  setMotionOverride('system');
  setViewportWidth(1280);
});

describe('Preview panel stays populated across camera activation (Task 109, issue #140)', () => {
  it('keeps shape count, hint, and canvas visible once the camera reaches active, on an empty scene', async () => {
    await loadWorkspace(baseScene({ shapes: [] }));
    assertPreviewFullyRendered(0);

    setCameraStatus('starting');
    setCameraStatus('active');

    assertPreviewFullyRendered(0);
  });

  it('keeps shape count, hint, and canvas visible once the camera reaches active, on a populated scene', async () => {
    await loadWorkspace(baseScene({ shapes: [CIRCLE_SHAPE] }));
    assertPreviewFullyRendered(1);

    setCameraStatus('starting');
    setCameraStatus('active');

    assertPreviewFullyRendered(1);
  });

  it('stays populated across repeated activation cycles in the same session', async () => {
    await loadWorkspace(baseScene({ shapes: [CIRCLE_SHAPE] }));

    setCameraStatus('active');
    assertPreviewFullyRendered(1);

    setCameraStatus('stopped');
    assertPreviewFullyRendered(1);

    setCameraStatus('active');
    assertPreviewFullyRendered(1);

    setCameraStatus('stopped');
    setCameraStatus('active');
    assertPreviewFullyRendered(1);
  });

  it('stays populated at a narrow (<1024px) viewport, matching issue #93: Preview is never one of the switchable tabs', async () => {
    setViewportWidth(768);
    await loadWorkspace(baseScene({ shapes: [CIRCLE_SHAPE] }));
    assertPreviewFullyRendered(1);

    setCameraStatus('active');
    assertPreviewFullyRendered(1);
  });

  it('stays populated when the camera activates while the viewport is wide and then narrows', async () => {
    await loadWorkspace(baseScene({ shapes: [CIRCLE_SHAPE] }));
    setCameraStatus('active');
    assertPreviewFullyRendered(1);

    setViewportWidth(500);
    assertPreviewFullyRendered(1);
  });

  it('stays populated with reduced motion forced on', async () => {
    act(() => {
      setMotionOverride('reduced');
    });
    await loadWorkspace(baseScene({ shapes: [CIRCLE_SHAPE] }));
    setCameraStatus('active');
    assertPreviewFullyRendered(1);
  });

  it('stays populated with reduced motion forced off', async () => {
    act(() => {
      setMotionOverride('full');
    });
    await loadWorkspace(baseScene({ shapes: [CIRCLE_SHAPE] }));
    setCameraStatus('active');
    assertPreviewFullyRendered(1);
  });

  it('stays populated after the stage controls disclosure is closed post-activation', async () => {
    await loadWorkspace(baseScene({ shapes: [CIRCLE_SHAPE] }));
    setCameraStatus('active');
    assertPreviewFullyRendered(1);

    const user = userEvent.setup();
    await user.click(screen.getByRole('button', { name: 'Open piece controls menu' }));
    await user.click(screen.getByRole('button', { name: 'Piece controls' }));
    const controlsToggle = await screen.findByRole('button', { name: 'Hide piece controls' });
    await user.click(controlsToggle);
    expect(screen.getByTestId('fake-camera-control')).toBeInTheDocument();

    assertPreviewFullyRendered(1);

    await user.click(screen.getByRole('button', { name: 'Piece controls' }));
    assertPreviewFullyRendered(1);
  });

  it('leaves the scene interactive after activation: selecting a shape still highlights it on canvas', async () => {
    await loadWorkspace(baseScene({ shapes: [CIRCLE_SHAPE] }));
    setCameraStatus('active');

    // jsdom reports zero-size layout boxes, so clicking the canvas at a
    // coordinate (`handleCanvasClick`'s real hit test) isn't reliable here
    // — selecting via the Layers panel drives the exact same
    // `sceneEditor.selectedShapeId` state and is what
    // `EditorWorkspace.shapes.test.tsx` already relies on.
    fireEvent.click(shapeOutlineSelectButtons()[0]);

    const canvas = screen.getByTestId('scene-canvas');
    const shapeGroup = within(canvas).getByTestId(/^scene-shape-/);
    expect(shapeGroup.classList.contains('editor-scene-shape-selected')).toBe(true);
  });

  it('leaves Demo signal controls operable after camera activation', async () => {
    await loadWorkspace(baseScene({ shapes: [CIRCLE_SHAPE] }));
    setCameraStatus('active');

    const user = userEvent.setup();
    await user.click(screen.getByRole('button', { name: 'Open piece controls menu' }));
    await user.click(screen.getByRole('button', { name: 'Piece controls' }));
    const presentButton = screen.getByRole('button', { name: /hand (present|absent)/i });
    expect(presentButton).toBeEnabled();
    await user.click(presentButton);
    expect(presentButton).toBeEnabled();
  });

  it('never shows the previewError alert as a side effect of a camera status transition alone', async () => {
    await loadWorkspace(baseScene({ shapes: [CIRCLE_SHAPE] }));

    setCameraStatus('starting');
    expect(screen.queryByRole('alert')).toBeNull();
    setCameraStatus('active');
    expect(screen.queryByRole('alert')).toBeNull();
    setCameraStatus('stopped');
    expect(screen.queryByRole('alert')).toBeNull();
  });
});
