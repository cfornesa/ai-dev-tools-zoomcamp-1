import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { ApiError } from '../api/client';
import * as projects3dApi from '../api/projects3d';
import type { PublicProject3D } from '../api/projects3d';
import ImmersiveProject3DViewer from './ImmersiveProject3DViewer';

vi.mock('three/examples/jsm/controls/OrbitControls.js', () => {
  class FakeOrbitControls {
    target = new (class {
      x = 0;
      y = 0;
      z = 0;
      set(x: number, y: number, z: number) {
        this.x = x;
        this.y = y;
        this.z = z;
        return this;
      }
      add(vector: { x: number; y: number; z: number }) {
        this.x += vector.x;
        this.y += vector.y;
        this.z += vector.z;
        return this;
      }
    })();
    enableDamping = false;
    listenToKeyEvents() {}
    update() {}
    dispose() {}
  }
  return { OrbitControls: FakeOrbitControls };
});

vi.mock('three', async (importOriginal) => {
  const actual = await importOriginal<typeof import('three')>();
  class FakeWebGLRenderer {
    private readonly options: { canvas: HTMLCanvasElement };
    constructor(options: { canvas: HTMLCanvasElement }) {
      this.options = options;
    }
    setSize() {}
    getSize(target: { set: (x: number, y: number) => unknown }) {
      return target.set(320, 240);
    }
    render() {}
    dispose() {}
    get domElement() {
      return this.options.canvas;
    }
  }
  return { ...actual, WebGLRenderer: FakeWebGLRenderer };
});

/**
 * Issue #311: the immersive first-person free-fly view -- the Project3D
 * counterpart of `PublicProject3DViewer.test.tsx`'s own load-state
 * coverage (same anonymous-reachable, 404-undifferentiated conventions),
 * scoped to what's actually new here: rendering via `Scene3DPreview.tsx`
 * with `flyControls` enabled and the shared gesture controls available.
 */

vi.mock('../api/projects3d');

const mockedGetPublicProject3D = vi.mocked(projects3dApi.getPublicProject3D);

function basePublicProject3D(overrides: Partial<PublicProject3D> = {}): PublicProject3D {
  return {
    id: 'p1',
    owner: 'alice',
    title: 'Rotating Cube',
    description: '',
    thumbnail_url: '/api/public/projects3d/p1/thumbnail.png',
    versions: [],
    version_count: 0,
    current_version: {
      id: 1,
      sequence: 1,
      origin: 'manual',
      created_by: 'alice',
      created_at: '2026-01-01T00:00:00Z',
      scene_json: {
        schemaVersion: 1,
        documentType: 'scene3d',
        id: 'scene3d-1',
        scene: { backgroundColor: '#000000' },
        camera: {
          position: { x: 0, y: 5, z: 10 },
          target: { x: 0, y: 0, z: 0 },
          fov: 50,
          near: 0.1,
          far: 1000,
        },
        lights: [],
        groups: [],
        objects: [],
        randomness: { seed: 0, enabled: false },
      },
    },
    created_at: '2026-01-01T00:00:00Z',
    updated_at: '2026-01-02T00:00:00Z',
    ...overrides,
  };
}

function renderViewer(id = 'p1') {
  return render(
    <MemoryRouter initialEntries={[`/immersive/p3d/${id}`]}>
      <Routes>
        <Route path="/gallery" element={<p>Gallery placeholder</p>} />
        <Route path="/immersive/p3d/:id" element={<ImmersiveProject3DViewer />} />
      </Routes>
    </MemoryRouter>,
  );
}

function renderViewerAt(path: string) {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <Routes>
        <Route path="/immersive/p3d/:id" element={<ImmersiveProject3DViewer />} />
      </Routes>
    </MemoryRouter>,
  );
}

function renderInitialViewer(project: PublicProject3D) {
  return render(
    <MemoryRouter initialEntries={['/users/@alice/immersive/rotating-cube']}>
      <Routes>
        <Route
          path="/users/:handle/immersive/:pieceSlug"
          element={
            <ImmersiveProject3DViewer
              initialProject={project}
              authorDisplayName="Alice Artist"
              canonicalHref="/users/@alice/immersive/rotating-cube"
            />
          }
        />
      </Routes>
    </MemoryRouter>,
  );
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe('ImmersiveProject3DViewer load states', () => {
  it('shows an accessible loading state while the fetch is in flight', () => {
    mockedGetPublicProject3D.mockReturnValue(new Promise(() => {}));
    renderViewer();
    expect(screen.getByRole('status')).toHaveTextContent(/loading project/i);
  });

  it('renders the title, attribution, and 3D preview with fly controls once loaded', async () => {
    mockedGetPublicProject3D.mockResolvedValue(basePublicProject3D());
    renderViewer();

    expect(await screen.findByRole('heading', { name: 'Rotating Cube' })).toBeInTheDocument();
    expect(screen.getByText('By alice')).toBeInTheDocument();
    expect(mockedGetPublicProject3D).toHaveBeenCalledWith('p1');
    expect(
      screen.queryByRole('button', { name: 'Open piece controls menu' }),
    ).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: /steer the piece/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /show hand gesture guide/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Embed (Custom)' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Embed (CMS)' })).toBeInTheDocument();
  });

  it('copies reference-equivalent Custom and CMS immersive embed snippets', async () => {
    const user = userEvent.setup();
    const writeText = vi.fn().mockResolvedValue(undefined);
    vi.stubGlobal('navigator', { ...navigator, clipboard: { writeText } });
    mockedGetPublicProject3D.mockResolvedValue(basePublicProject3D());
    renderViewer();

    await screen.findByRole('heading', { name: 'Rotating Cube' });
    await user.click(screen.getByRole('button', { name: 'Embed (Custom)' }));
    expect(writeText).toHaveBeenLastCalledWith(
      expect.stringContaining('/immersive/p3d/p1?embed=1'),
    );
    await user.click(screen.getByRole('button', { name: 'Embed (CMS)' }));
    expect(writeText).toHaveBeenLastCalledWith(
      expect.stringContaining('/immersive/p3d/p1?embed=1&cms=1'),
    );
  });

  it('places canonical metadata, actions, and versions below the immersive stage', async () => {
    const project = basePublicProject3D({
      description: 'A study in spatial repetition.',
      version_count: 3,
      versions: [
        { sequence: 1, created_at: '2026-01-01T00:00:00Z', is_current: false },
        { sequence: 3, created_at: '2026-01-03T00:00:00Z', is_current: true },
        { sequence: 2, created_at: '2026-01-02T00:00:00Z', is_current: false },
      ],
    });
    const user = userEvent.setup();
    const writeText = vi.spyOn(navigator.clipboard, 'writeText').mockResolvedValue(undefined);

    renderInitialViewer(project);

    const info = await screen.findByTestId('immersive-info-block');
    const stage = screen.getByRole('region', { name: 'Preview' });
    expect(stage.compareDocumentPosition(info) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(
      within(info).getByRole('heading', { name: 'Rotating Cube', level: 1 }),
    ).toBeInTheDocument();
    expect(within(info).getByText('A study in spatial repetition.')).toBeInTheDocument();
    expect(within(info).getByRole('button', { name: 'Share' })).toBeInTheDocument();
    expect(within(info).getByRole('button', { name: 'Embed (Custom)' })).toBeInTheDocument();
    expect(within(info).getByRole('button', { name: 'Embed (CMS)' })).toBeInTheDocument();
    expect(
      within(info).getByRole('heading', { name: 'Current version context' }),
    ).toBeInTheDocument();
    expect(within(info).getByRole('heading', { name: 'Versions' })).toBeInTheDocument();
    expect(within(info).getByText('CURRENT')).toBeInTheDocument();
    expect(within(info).getByText('Version 3')).toBeInTheDocument();
    expect(within(info).getByText('Version 2')).toBeInTheDocument();
    expect(within(info).getByText('Version 1')).toBeInTheDocument();

    await user.click(within(info).getByRole('button', { name: 'Share' }));
    expect(writeText).toHaveBeenCalledWith(window.location.href);
    expect(within(info).getByRole('status')).toHaveTextContent('Link copied.');
  });

  it('keeps only the stage preview and controls on Custom/CMS embed routes', async () => {
    mockedGetPublicProject3D.mockResolvedValue(basePublicProject3D());
    renderViewerAt('/immersive/p3d/p1?embed=1&cms=1');

    expect(
      screen.queryByRole('button', { name: 'Open piece controls menu' }),
    ).not.toBeInTheDocument();
    await screen.findByRole('button', { name: /show hand gesture guide/i });
    expect(screen.queryByRole('heading', { name: 'Rotating Cube' })).not.toBeInTheDocument();
    expect(screen.getByTestId('immersive-project3d-viewer')).toHaveAttribute(
      'data-immersive-embed-mode',
      'cms',
    );
  });

  it('shows a safe, undifferentiated message for a 404 (never-existed or not public)', async () => {
    mockedGetPublicProject3D.mockRejectedValue(new ApiError(404, null));
    renderViewer();

    const alert = await screen.findByRole('alert');
    expect(alert).toHaveTextContent(/isn't available/i);
    expect(screen.getByRole('link', { name: /back to the public gallery/i })).toBeInTheDocument();
  });

  it('shows a generic error state (distinct from "unavailable") for a network/server failure', async () => {
    mockedGetPublicProject3D.mockRejectedValue(new Error('network down'));
    renderViewer();

    expect(await screen.findByRole('alert')).toHaveTextContent(/something went wrong/i);
  });
});
