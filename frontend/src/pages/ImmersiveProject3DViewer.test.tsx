import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { ApiError } from '../api/client';
import * as projects3dApi from '../api/projects3d';
import type { PublicProject3D } from '../api/projects3d';
import ImmersiveProject3DViewer from './ImmersiveProject3DViewer';

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

  it('keeps only the stage preview and controls on Custom/CMS embed routes', async () => {
    mockedGetPublicProject3D.mockResolvedValue(basePublicProject3D());
    renderViewerAt('/immersive/p3d/p1?embed=1&cms=1');

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
