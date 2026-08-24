import { act, fireEvent, render, screen, within } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import * as projectsApi from '../api/projects';
import type { Project, SceneVersion } from '../api/projects';
import type { TrackingFrame, TrackingProvider, TrackingProviderError } from '../tracking/types';
import EditorWorkspace from './EditorWorkspace';
import { expandAllCollapsibleSections } from '../testUtils/expandCollapsibleSections';

/**
 * Task 109 (issue #140), continued: `EditorWorkspace.cameraPreview.test.tsx`
 * mocks `CameraControl` itself as a controllable status source, which is
 * enough to prove `EditorWorkspace.tsx`'s Preview `<section>` never reads
 * `cameraStatus` — but it drives `onStatusChange('active')` directly, so it
 * cannot exercise the issue's own leading hypothesis: "a mount-order race
 * between the p5 canvas lifecycle and `CameraControl`'s `onStatusChange`
 * callback." That race, if real, lives in the *timing* of `CameraControl`'s
 * own internal effects (`CameraControl.tsx`'s `status` `useEffect` that
 * calls `onStatusChange`) relative to `EditorWorkspace.tsx`'s p5
 * mount/render effects — something a fully-mocked `CameraControl` cannot
 * reproduce, since it skips that effect entirely.
 *
 * This suite instead renders the REAL `CameraControl` (unmocked) inside the
 * REAL `EditorWorkspace`, and only replaces the one thing that actually
 * needs a physical camera: `../tracking/mediapipeProvider`'s
 * `createMediaPipeTrackingProvider`, swapped for a fully controllable fake
 * `TrackingProvider` (the exact seam `CameraControl.test.tsx` already uses
 * via its `createProvider` prop — `EditorWorkspace.tsx` doesn't forward
 * that prop, so this suite reaches the same fake by mocking the module
 * `CameraControl.tsx` imports it from instead). `window.isSecureContext`
 * is overridden the same way `CameraControl.test.tsx` does, since jsdom
 * always reports it `false`.
 *
 * The result: clicking the real "Enable camera" button runs the real
 * `handleEnable` → `setStatus('starting')` → `getProvider().start()` →
 * (here) the fake provider synchronously emits a frame → the real
 * `provider.onFrame` handler flips `status` to `'active'` → the real
 * `status` `useEffect` fires `onStatusChange('active')` into
 * `EditorWorkspace.tsx`'s real `setCameraStatus`/`trackingSourceRef`
 * wiring — the exact effect-ordering path the issue's hypothesis names,
 * with no manual status injection anywhere in the chain.
 */

function createFakeProvider() {
  const frameListeners: Array<(frame: TrackingFrame) => void> = [];
  const errorListeners: Array<(error: TrackingProviderError) => void> = [];
  const start = vi.fn(() => {
    // Mirrors a real provider: `start()` returns before tracking is
    // provably live — `onFrame` firing is what flips CameraControl's
    // status to 'active', matching the real MediaPipe adapter's contract.
  });
  const stop = vi.fn();
  const provider: TrackingProvider = {
    start,
    stop,
    onFrame: (listener) => {
      frameListeners.push(listener);
      return () => {
        const index = frameListeners.indexOf(listener);
        if (index >= 0) frameListeners.splice(index, 1);
      };
    },
    onError: (listener) => {
      errorListeners.push(listener);
      return () => {
        const index = errorListeners.indexOf(listener);
        if (index >= 0) errorListeners.splice(index, 1);
      };
    },
  };
  function emitFrame(frame: TrackingFrame) {
    frameListeners.forEach((listener) => listener(frame));
  }
  return { provider, start, stop, emitFrame };
}

const FRAME: TrackingFrame = { hands: [], events: [], timestamp: 0 };

const { fakeProviderRef } = vi.hoisted(() => ({
  fakeProviderRef: { current: null as ReturnType<typeof createFakeProvider> | null },
}));

vi.mock('../tracking/mediapipeProvider', () => ({
  createMediaPipeTrackingProvider: () => {
    const fake = fakeProviderRef.current;
    if (!fake) throw new Error('fakeProviderRef not set before CameraControl created a provider');
    return fake.provider;
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
    shapes: [CIRCLE_SHAPE],
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

async function loadWorkspace(scene: unknown) {
  mockedGetProject.mockResolvedValue(baseProject());
  mockedGetSceneVersion.mockResolvedValue(baseVersion(scene));
  renderWorkspace();
  await screen.findByRole('region', { name: 'Tools' });
  expandAllCollapsibleSections();
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

let originalIsSecureContext: PropertyDescriptor | undefined;

beforeEach(() => {
  vi.clearAllMocks();
  fakeProviderRef.current = createFakeProvider();
  originalIsSecureContext = Object.getOwnPropertyDescriptor(window, 'isSecureContext');
  Object.defineProperty(window, 'isSecureContext', {
    configurable: true,
    value: true,
  });
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
  if (originalIsSecureContext) {
    Object.defineProperty(window, 'isSecureContext', originalIsSecureContext);
  }
  fakeProviderRef.current = null;
});

describe('Preview panel through the REAL CameraControl lifecycle (Task 109, issue #140)', () => {
  it('stays populated across the real Enable-camera click -> starting -> active transition', async () => {
    await loadWorkspace(baseScene());
    assertPreviewFullyRendered(1);

    const enableButton = await screen.findByRole('button', { name: /enable camera/i });
    await act(async () => {
      fireEvent.click(enableButton);
    });

    // Real CameraControl: clicking Enable moves status to 'starting'
    // synchronously (handleEnable's setStatus call), before the fake
    // provider has emitted anything.
    expect(await screen.findByTestId('camera-status')).toHaveTextContent('Starting camera');
    assertPreviewFullyRendered(1);

    // The fake provider now does what a real one does once tracking is
    // actually live: emits a frame. This is what flips CameraControl's
    // internal status to 'active' via its real onFrame handler, which in
    // turn runs its real `status` effect and calls the real
    // `onStatusChange('active')` into EditorWorkspace.
    await act(async () => {
      fakeProviderRef.current!.emitFrame(FRAME);
    });

    expect(await screen.findByTestId('camera-status')).toHaveTextContent('Camera is active');
    assertPreviewFullyRendered(1);
  });

  it('stays populated across a real Stop camera -> re-Enable cycle', async () => {
    await loadWorkspace(baseScene());

    const enableButton = await screen.findByRole('button', { name: /enable camera/i });
    await act(async () => {
      fireEvent.click(enableButton);
    });
    await act(async () => {
      fakeProviderRef.current!.emitFrame(FRAME);
    });
    expect(await screen.findByTestId('camera-status')).toHaveTextContent('Camera is active');
    assertPreviewFullyRendered(1);

    const stopButton = await screen.findByRole('button', { name: /stop camera/i });
    await act(async () => {
      fireEvent.click(stopButton);
    });
    expect(await screen.findByTestId('camera-status')).toHaveTextContent('Camera stopped');
    assertPreviewFullyRendered(1);

    const retryButton = await screen.findByRole('button', { name: /enable camera/i });
    await act(async () => {
      fireEvent.click(retryButton);
    });
    await act(async () => {
      fakeProviderRef.current!.emitFrame(FRAME);
    });
    expect(await screen.findByTestId('camera-status')).toHaveTextContent('Camera is active');
    assertPreviewFullyRendered(1);
  });

  it('surfaces no render-time error and leaves the rest of the editor usable through the real activation path', async () => {
    await loadWorkspace(baseScene());

    const enableButton = await screen.findByRole('button', { name: /enable camera/i });
    await act(async () => {
      fireEvent.click(enableButton);
    });
    await act(async () => {
      fakeProviderRef.current!.emitFrame(FRAME);
    });
    await screen.findByText(/Camera is active/i);

    expect(screen.queryByRole('alert')).toBeNull();
    // Layers, Tools/Details/Inspector chrome, and Demo signal controls all
    // remain present and operable — a Preview-only failure (if any
    // occurred) would leave these untouched; a whole-tree crash would take
    // all of them down together, which is what distinguishes "Preview
    // failed" from "the app crashed."
    expect(screen.getByRole('region', { name: 'Layers' })).toBeInTheDocument();
    const presentButton = screen.getByRole('button', { name: /hand (present|absent)/i });
    expect(presentButton).toBeEnabled();
  });
});
