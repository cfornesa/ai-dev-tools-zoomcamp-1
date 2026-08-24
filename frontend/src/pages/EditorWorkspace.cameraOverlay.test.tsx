import { act, fireEvent, render, screen, within } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import * as projectsApi from '../api/projects';
import type { Project, SceneVersion } from '../api/projects';
import type { CameraStatus } from '../components/CameraControl';
import EditorWorkspace from './EditorWorkspace';
import { expandAllCollapsibleSections } from '../testUtils/expandCollapsibleSections';

/**
 * Task 110 (issue #141): the camera video overlay + opacity slider in the
 * editor Preview panel.
 *
 * `CameraControl` is mocked as a controllable status/stream source only
 * (its own permission/MediaPipe state machine is already covered by
 * `CameraControl.test.tsx`, and the `onStream`/`mediapipeProvider.ts` wiring
 * by `mediapipeProvider.test.ts`), the same boundary-mocking convention
 * `EditorWorkspace.cameraPreview.test.tsx` uses.
 */

const { onStatusChangeRef, onStreamChangeRef } = vi.hoisted(() => ({
  onStatusChangeRef: { current: null as ((status: CameraStatus) => void) | null },
  onStreamChangeRef: { current: null as ((stream: MediaStream | null) => void) | null },
}));

vi.mock('../components/CameraControl', () => ({
  default: ({
    onStatusChange,
    onStreamChange,
  }: {
    onStatusChange?: (status: CameraStatus) => void;
    onStreamChange?: (stream: MediaStream | null) => void;
  }) => {
    onStatusChangeRef.current = onStatusChange ?? null;
    onStreamChangeRef.current = onStreamChange ?? null;
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

async function loadWorkspace(scene: unknown = baseScene()) {
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

function setCameraStream(stream: MediaStream | null) {
  act(() => {
    onStreamChangeRef.current?.(stream);
  });
}

function fakeStream(): MediaStream {
  return {} as MediaStream;
}

beforeEach(() => {
  vi.clearAllMocks();
  onStatusChangeRef.current = null;
  onStreamChangeRef.current = null;
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
  vi.restoreAllMocks();
});

describe('camera video overlay + opacity slider (Task 110, issue #141)', () => {
  it('renders no overlay and no slider while idle', async () => {
    await loadWorkspace();
    expect(screen.queryByTestId('camera-overlay-video')).toBeNull();
    expect(screen.queryByLabelText('Camera overlay opacity')).toBeNull();
  });

  it('renders no overlay while starting, even once the stream is available', async () => {
    await loadWorkspace();
    setCameraStatus('starting');
    setCameraStream(fakeStream());
    expect(screen.queryByTestId('camera-overlay-video')).toBeNull();
    // The slider criterion is scoped to 'active' only, per issue #141.
    expect(screen.queryByLabelText('Camera overlay opacity')).toBeNull();
  });

  it('renders the overlay and slider once active with a stream, defaulting to 50% opacity', async () => {
    await loadWorkspace();
    setCameraStatus('starting');
    setCameraStream(fakeStream());
    setCameraStatus('active');

    const preview = screen.getByRole('region', { name: 'Preview' });
    const video = within(preview).getByTestId('camera-overlay-video') as HTMLVideoElement;
    expect(video).toBeInTheDocument();
    expect(video.style.opacity).toBe('0.5');
    expect(video.style.transform).toBe('scaleX(-1)');

    const slider = screen.getByLabelText('Camera overlay opacity') as HTMLInputElement;
    expect(slider).toBeInTheDocument();
    expect(slider.value).toBe('50');
  });

  it('moving the slider updates the overlay opacity live, keyboard-operable', async () => {
    await loadWorkspace();
    setCameraStream(fakeStream());
    setCameraStatus('active');

    const slider = screen.getByLabelText('Camera overlay opacity') as HTMLInputElement;
    fireEvent.change(slider, { target: { value: '100' } });

    const video = screen.getByTestId('camera-overlay-video') as HTMLVideoElement;
    expect(video.style.opacity).toBe('1');
    expect(slider.getAttribute('aria-valuetext')).toBe('100%');

    fireEvent.change(slider, { target: { value: '0' } });
    expect(screen.getByTestId('camera-overlay-video').style.opacity).toBe('0');
  });

  it('resets opacity to the 50% default on every fresh activation', async () => {
    await loadWorkspace();
    setCameraStream(fakeStream());
    setCameraStatus('active');

    const slider = screen.getByLabelText('Camera overlay opacity') as HTMLInputElement;
    fireEvent.change(slider, { target: { value: '90' } });
    expect(slider.value).toBe('90');

    setCameraStatus('stopped');
    setCameraStream(fakeStream());
    setCameraStatus('active');

    expect(screen.getByLabelText('Camera overlay opacity')).toHaveProperty('value', '50');
  });

  it('removes the overlay and slider immediately on Stop (no frozen frame)', async () => {
    await loadWorkspace();
    setCameraStream(fakeStream());
    setCameraStatus('active');
    expect(screen.getByTestId('camera-overlay-video')).toBeInTheDocument();

    setCameraStream(null);
    setCameraStatus('stopped');

    expect(screen.queryByTestId('camera-overlay-video')).toBeNull();
    expect(screen.queryByLabelText('Camera overlay opacity')).toBeNull();
  });

  it('removes the overlay on error status', async () => {
    await loadWorkspace();
    setCameraStream(fakeStream());
    setCameraStatus('active');
    expect(screen.getByTestId('camera-overlay-video')).toBeInTheDocument();

    setCameraStatus('error');
    expect(screen.queryByTestId('camera-overlay-video')).toBeNull();
    expect(screen.queryByLabelText('Camera overlay opacity')).toBeNull();
  });

  it('never triggers the previewError alert as a side effect of the overlay appearing', async () => {
    await loadWorkspace();
    setCameraStream(fakeStream());
    setCameraStatus('active');
    expect(screen.queryByRole('alert')).toBeNull();
  });

  it('scene shapes stay present in the DOM and the canvas wrapper is unaffected while the overlay is active', async () => {
    await loadWorkspace(
      baseScene({
        shapes: [
          {
            id: 'shape-1',
            type: 'circle',
            layerId: 'layer-1',
            groupId: null,
            transform: { x: 100, y: 100, scaleX: 1, scaleY: 1, rotation: 0, opacity: 1 },
            style: { fill: '#4f46e5', stroke: null, strokeWidth: 0 },
            radius: 20,
          },
        ],
      }),
    );
    setCameraStream(fakeStream());
    setCameraStatus('active');

    expect(screen.getByTestId('scene-canvas')).toBeInTheDocument();
    expect(screen.getByText('1 shape(s) in the working copy.')).toBeInTheDocument();
  });
});
