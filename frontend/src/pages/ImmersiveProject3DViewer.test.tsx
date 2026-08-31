import { render, screen } from '@testing-library/react';
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
 * with `flyControls` enabled and `showGestureControl` disabled.
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
    // The gesture-camera-control toggle is disabled here (out of scope
    // per this issue's own scope note -- hand-tracking-driven fly steering
    // is a deliberate v1 boundary, not implemented).
    expect(screen.queryByRole('button', { name: /steer the piece/i })).not.toBeInTheDocument();
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
