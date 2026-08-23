import { act, render, screen, waitFor } from '@testing-library/react';
import { fireEvent } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { setMotionOverride } from '../a11y/reducedMotion';
import * as projectsApi from '../api/projects';
import type { Project, SceneVersion } from '../api/projects';
import EditorWorkspace from './EditorWorkspace';
import { expandAllCollapsibleSections } from '../testUtils/expandCollapsibleSections';

/**
 * Task 83 (issue #83): wires `behaviorRuntime.ts`/`particleSystem.ts`/
 * `trailSystem.ts` into the editor's own live p5 preview — see
 * `usePreviewRuntime.ts`'s own doc comment for the full design. This suite
 * covers the issue's 4 named acceptance scenarios; `EditorWorkspace.test.tsx`
 * and its many other sibling suites cover everything about canvas
 * authoring/selection this task must not change (unaffected by design,
 * since this task only takes effect for a scene with active
 * bindings/graph — see `usePreviewRuntime.ts`'s "When does the runtime
 * run" decision).
 *
 * `createP5ScenePreview` is mocked here (unlike most `EditorWorkspace.*`
 * suites, which exercise the real p5/jsdom-canvas pipeline) so every
 * assertion below can read exactly what scene/particles/trails
 * `p5Adapter.ts`'s `render()` was actually called with, per tick — the
 * most direct, least flaky way to observe "did the live preview receive
 * the runtime's evaluated output" (this task's whole point) without
 * depending on canvas pixel sampling timing.
 */

const { renderMock, destroyMock } = vi.hoisted(() => ({
  renderMock: vi.fn(),
  destroyMock: vi.fn(),
}));

vi.mock('../render/p5Adapter', () => ({
  createP5ScenePreview: vi.fn(() => ({
    render: renderMock,
    destroy: destroyMock,
    getCanvasElement: vi.fn(() => null),
  })),
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

const CIRCLE_SHAPE = {
  id: 'shape-1',
  type: 'circle',
  layerId: 'layer-1',
  groupId: null,
  transform: { x: 100, y: 100, scaleX: 1, scaleY: 1, rotation: 0, opacity: 1 },
  style: { fill: '#4f46e5', stroke: null, strokeWidth: 0 },
  radius: 20,
};

const FOLLOW_HAND_BINDING = {
  id: 'binding-1',
  signal: 'indexTipX',
  handTarget: 'primary',
  targetScope: 'shape',
  targetId: 'shape-1',
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
    shapes: [CIRCLE_SHAPE],
    groups: [],
    bindings: [],
    graph: { nodes: [], connections: [] },
    accessibility: { reducedMotion: 'auto' },
    randomness: { seed: 0, enabled: false },
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

function lastRenderCall(): [unknown, unknown, unknown] | undefined {
  return renderMock.mock.calls.at(-1) as [unknown, unknown, unknown] | undefined;
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

afterEach(() => {
  setMotionOverride('system');
});

describe('live preview runtime (Task 83, issue #83)', () => {
  it('a Follow-hand binding visibly moves a shape in the live preview as demo input changes', async () => {
    await loadWorkspace(baseScene({ bindings: [FOLLOW_HAND_BINDING] }));

    // Set the slider to its target value *before* the hand becomes
    // present, so the one frame `setPresent(true)` emits is the first
    // frame of a brand-new presence segment — `handSignals.ts`'s own
    // documented "first frame of a new presence segment seeds the EMA at
    // the raw value" rule, giving this test a deterministic single-tick
    // result instead of an asymptotically-converging one.
    const slider = screen.getByLabelText(/Index fingertip X/i);
    fireEvent.change(slider, { target: { value: '0.9' } });

    const presentButton = screen.getByRole('button', { name: /hand (present|absent)/i });
    await act(async () => {
      fireEvent.click(presentButton);
    });

    await waitFor(() => {
      const call = lastRenderCall();
      expect(call).toBeDefined();
      const scene = call![0] as { shapes: Array<{ id: string; transform: { x: number } }> };
      const shape = scene.shapes.find((s) => s.id === 'shape-1');
      expect(shape?.transform.x).toBeCloseTo(720, 0);
    });
  });

  it('a particle-emitter binding renders live particles in the editor, not just on export', async () => {
    const scene = baseScene({
      shapes: [
        CIRCLE_SHAPE,
        {
          id: 'shape-emitter',
          type: 'particleEmitter',
          layerId: 'layer-1',
          groupId: null,
          transform: { x: 400, y: 300, scaleX: 1, scaleY: 1, rotation: 0, opacity: 1 },
          style: { fill: '#111111', stroke: null, strokeWidth: 0 },
          rate: 60,
          size: 8,
          lifespan: 2,
          speed: 10,
          palette: ['#ff00ff'],
        },
      ],
      // A binding (unrelated to the emitter) is enough to mark this scene
      // "running" (see `usePreviewRuntime.ts`'s "when does the runtime
      // run" decision) — continuous particle emission itself needs no
      // hand input or event trigger.
      bindings: [FOLLOW_HAND_BINDING],
    });
    await loadWorkspace(scene);

    await waitFor(
      () => {
        const call = lastRenderCall();
        expect(call).toBeDefined();
        const particles = call![1] as unknown[];
        expect(particles.length).toBeGreaterThan(0);
      },
      { timeout: 3000 },
    );
  });

  it("toggling reduced motion live-updates the preview's continuous trail effect", async () => {
    const scene = baseScene({
      shapes: [{ ...CIRCLE_SHAPE, trail: { length: 5 } }],
      bindings: [FOLLOW_HAND_BINDING],
    });
    await loadWorkspace(scene);

    const slider = screen.getByLabelText(/Index fingertip X/i);
    fireEvent.change(slider, { target: { value: '0.9' } });
    const presentButton = screen.getByRole('button', { name: /hand (present|absent)/i });
    await act(async () => {
      fireEvent.click(presentButton);
    });

    // Let several ticks run (real rAF, real timers) so the trail buffer
    // accumulates more than one sample.
    await waitFor(
      () => {
        const call = lastRenderCall();
        expect(call).toBeDefined();
        const trails = call![2] as Array<{ points: unknown[] }>;
        expect(trails.length).toBeGreaterThan(0);
        expect(trails[0].points.length).toBeGreaterThan(1);
      },
      { timeout: 3000 },
    );

    act(() => {
      setMotionOverride('reduced');
    });

    await waitFor(() => {
      const call = lastRenderCall();
      const trails = call![2] as Array<{ points: unknown[] }>;
      expect(trails.length).toBeGreaterThan(0);
      expect(trails[0].points.length).toBe(1);
    });
  });

  it('an unbound scene (no bindings, no graph) renders identically to before this task', async () => {
    await loadWorkspace(baseScene());

    await waitFor(() => {
      expect(renderMock).toHaveBeenCalled();
    });

    // The plain, pre-existing render path: called with the raw scene only
    // — never particles, never trails, and never a continuously-looping
    // rAF-driven re-render (no bindings/graph means `usePreviewRuntime`'s
    // own effect never starts a loop at all).
    const call = lastRenderCall();
    expect(call).toHaveLength(1);

    const callCountAfterMount = renderMock.mock.calls.length;
    await new Promise((resolve) => setTimeout(resolve, 200));
    expect(renderMock.mock.calls.length).toBe(callCountAfterMount);
  });
});
