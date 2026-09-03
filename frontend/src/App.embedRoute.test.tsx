import { render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { ApiError } from './api/client';
import * as projectsApi from './api/projects';
import type { PublicProject } from './api/projects';
import * as projects3dApi from './api/projects3d';
import type { PublicProject3D } from './api/projects3d';
import App from './App';

/**
 * Issue #292: `/embed/p/:id` is a chrome-less sibling of `/p/:id` --
 * registered as a sibling `<Route>` outside `Layout`'s nested route in
 * `App.tsx`, so it never renders `Layout.tsx`'s app-shell chrome (nav
 * header, account links, mobile menu). This exercises the real `App`
 * (not a synthetic `MemoryRouter`/`Routes` harness) so the actual route
 * registration in `App.tsx` is what's under test, matching `App.test.tsx`'s
 * own "render the real App" convention -- navigation happens via
 * `window.history.pushState` before render, since `App` owns its own
 * `BrowserRouter` internally.
 */

vi.mock('./api/projects');
vi.mock('./api/projects3d');
vi.mock('./api/auth', () => ({
  fetchCurrentUser: vi.fn().mockResolvedValue(null),
}));

const mockedGetPublicProject = vi.mocked(projectsApi.getPublicProject);
const mockedGetPublicProject3D = vi.mocked(projects3dApi.getPublicProject3D);

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

function basePublicProject(overrides: Partial<PublicProject> = {}): PublicProject {
  return {
    id: 'p1',
    owner: 'alice',
    title: 'Hand Follower',
    description: 'A hand-reactive circle.',
    tags: [],
    allow_public_remix: false,
    thumbnail_url: '/api/public/projects/p1/thumbnail.png',
    remix_provenance: null,
    current_version: { sequence: 1, scene_json: BLANK_SCENE, created_at: '2026-01-01T00:00:00Z' },
    created_at: '2026-01-01T00:00:00Z',
    updated_at: '2026-01-02T00:00:00Z',
    ...overrides,
  };
}

function basePublicProject3D(overrides: Partial<PublicProject3D> = {}): PublicProject3D {
  return {
    id: 'p1',
    owner: 'alice',
    title: 'Rotating Cube',
    thumbnail_url: '/api/public/projects3d/p1/thumbnail.png',
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

function navigateTo(path: string) {
  window.history.pushState({}, '', path);
}

beforeEach(() => {
  vi.clearAllMocks();
});

afterEach(() => {
  window.history.pushState({}, '', '/');
});

describe('/embed/p/:id (issue #292)', () => {
  it('renders the public project viewer with no app-shell chrome', async () => {
    mockedGetPublicProject.mockResolvedValue(basePublicProject());
    navigateTo('/embed/p/p1');

    render(<App />);

    expect(await screen.findByTestId('public-scene-canvas')).toBeInTheDocument();
    expect(screen.queryByRole('heading', { name: 'Hand Follower' })).not.toBeInTheDocument();
    expect(mockedGetPublicProject).toHaveBeenCalledWith('p1');
    expect(document.querySelector('.app-shell-header')).not.toBeInTheDocument();
    expect(screen.queryByRole('link', { name: 'Public gallery' })).not.toBeInTheDocument();
  });

  it('preserves the existing Layout-wrapped chrome at /p/:id (unchanged)', async () => {
    mockedGetPublicProject.mockResolvedValue(basePublicProject());
    navigateTo('/p/p1');

    render(<App />);

    expect(await screen.findByRole('heading', { name: 'Hand Follower' })).toBeInTheDocument();
    expect(document.querySelector('.app-shell-header')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Public gallery' })).toBeInTheDocument();
  });

  it('treats an unpublished/nonexistent project identically to /p/:id -- no privacy regression', async () => {
    mockedGetPublicProject.mockRejectedValue(new ApiError(404, null));
    navigateTo('/embed/p/does-not-exist');

    render(<App />);

    expect(await screen.findByText(/this project isn't available/i)).toBeInTheDocument();
  });
});

describe('/embed/p3d/:id (issue #296)', () => {
  it('renders the public 3D project viewer with no app-shell chrome', async () => {
    mockedGetPublicProject3D.mockResolvedValue(basePublicProject3D());
    navigateTo('/embed/p3d/p1');

    render(<App />);

    expect(await screen.findByRole('heading', { name: 'Rotating Cube' })).toBeInTheDocument();
    expect(mockedGetPublicProject3D).toHaveBeenCalledWith('p1');
    expect(document.querySelector('.app-shell-header')).not.toBeInTheDocument();
    expect(screen.queryByRole('link', { name: 'Public gallery' })).not.toBeInTheDocument();
  });

  it('preserves the existing Layout-wrapped chrome at /p3d/:id (unchanged)', async () => {
    mockedGetPublicProject3D.mockResolvedValue(basePublicProject3D());
    navigateTo('/p3d/p1');

    render(<App />);

    expect(await screen.findByRole('heading', { name: 'Rotating Cube' })).toBeInTheDocument();
    expect(document.querySelector('.app-shell-header')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Public gallery' })).toBeInTheDocument();
  });

  it('treats an unpublished/nonexistent 3D project identically to /p3d/:id -- no privacy regression', async () => {
    mockedGetPublicProject3D.mockRejectedValue(new ApiError(404, null));
    navigateTo('/embed/p3d/does-not-exist');

    render(<App />);

    expect(await screen.findByText(/this project isn't available/i)).toBeInTheDocument();
  });
});

describe('/immersive/p3d/:id (issue #311)', () => {
  it('renders the immersive first-person view with no app-shell chrome', async () => {
    mockedGetPublicProject3D.mockResolvedValue(basePublicProject3D());
    navigateTo('/immersive/p3d/p1');

    render(<App />);

    expect(await screen.findByRole('heading', { name: 'Rotating Cube' })).toBeInTheDocument();
    expect(mockedGetPublicProject3D).toHaveBeenCalledWith('p1');
    expect(document.querySelector('.app-shell-header')).not.toBeInTheDocument();
    expect(screen.queryByRole('link', { name: 'Public gallery' })).not.toBeInTheDocument();
  });

  it('treats an unpublished/nonexistent 3D project identically to /p3d/:id -- no privacy regression', async () => {
    mockedGetPublicProject3D.mockRejectedValue(new ApiError(404, null));
    navigateTo('/immersive/p3d/does-not-exist');

    render(<App />);

    expect(await screen.findByText(/this project isn't available/i)).toBeInTheDocument();
  });
});
