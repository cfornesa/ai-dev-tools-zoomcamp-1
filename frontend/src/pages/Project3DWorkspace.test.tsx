import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { ApiError } from '../api/client';
import * as projects3dApi from '../api/projects3d';
import type { Project3D } from '../api/projects3d';
import Project3DWorkspace from './Project3DWorkspace';

vi.mock('../api/projects3d');

const mockedGetProject3D = vi.mocked(projects3dApi.getProject3D);

function baseProject(overrides: Partial<Project3D> = {}): Project3D {
  return {
    id: 'p1',
    owner: 'alice',
    title: 'My 3D scene',
    thumbnail_url: null,
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
        lights: [{ id: 'l1', type: 'ambient', color: '#ffffff', intensity: 1 }],
        groups: [],
        objects: [
          { id: 'o1', type: 'box' },
          { id: 'o2', type: 'sphere' },
        ],
        randomness: { seed: 0, enabled: false },
      },
    },
    created_at: '2026-01-01T00:00:00Z',
    updated_at: '2026-01-02T00:00:00Z',
    ...overrides,
  };
}

function renderWorkspace() {
  return render(
    <MemoryRouter initialEntries={['/projects3d/p1']}>
      <Routes>
        <Route path="/projects3d/:id" element={<Project3DWorkspace />} />
      </Routes>
    </MemoryRouter>,
  );
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe('Project3DWorkspace', () => {
  it('shows an accessible loading state while the fetch is in flight', () => {
    mockedGetProject3D.mockReturnValue(new Promise(() => {}));

    renderWorkspace();

    expect(screen.getByRole('status')).toHaveTextContent(/loading 3d editor/i);
  });

  it('shows the title and a scene summary once loaded', async () => {
    mockedGetProject3D.mockResolvedValue(baseProject());

    renderWorkspace();

    expect(await screen.findByRole('heading', { name: 'My 3D scene' })).toBeInTheDocument();
    expect(screen.getByTestId('project3d-preview-placeholder')).toHaveTextContent(
      '2 object(s), 1 light(s), 0 group(s)',
    );
  });

  it('shows access-denied for a 404', async () => {
    mockedGetProject3D.mockRejectedValue(new ApiError(404, null));

    renderWorkspace();

    expect(await screen.findByRole('alert')).toHaveTextContent(/don't have access/i);
  });

  it('shows a no-scene message when the project has no current version', async () => {
    mockedGetProject3D.mockResolvedValue(baseProject({ current_version: null }));

    renderWorkspace();

    expect(await screen.findByRole('alert')).toHaveTextContent(/no saved scene/i);
  });

  // Issue #229: the Visual/Code toggle.
  it('toggles between Visual and Code views', async () => {
    mockedGetProject3D.mockResolvedValue(baseProject());
    const user = userEvent.setup();

    renderWorkspace();
    await screen.findByRole('region', { name: 'Preview' });
    expect(screen.queryByRole('region', { name: 'Code' })).not.toBeInTheDocument();

    await user.click(screen.getByRole('radio', { name: 'Code' }));

    expect(await screen.findByRole('region', { name: 'Code' })).toBeInTheDocument();
    expect(screen.queryByRole('region', { name: 'Preview' })).not.toBeInTheDocument();
  });
});
