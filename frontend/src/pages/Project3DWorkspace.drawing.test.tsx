import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import * as projects3dApi from '../api/projects3d';
import type { Project3D } from '../api/projects3d';
import Project3DWorkspace from './Project3DWorkspace';

vi.mock('../api/projects3d');

const mockedGetProject3D = vi.mocked(projects3dApi.getProject3D);

function baseProject(overrides: Partial<Project3D> = {}): Project3D {
  return {
    id: 'p1',
    owner: 'alice',
    visibility: 'private',
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

describe('Project3DWorkspace drawing planes (#781)', () => {
  it('adds a drawing plane (with a neutral light in an unlit scene) and enters/leaves Draw mode (#781)', async () => {
    const project = baseProject();
    (project.current_version!.scene_json as { lights: unknown[] }).lights = [];
    mockedGetProject3D.mockResolvedValue(project);
    const user = userEvent.setup();

    renderWorkspace();
    await screen.findByRole('region', { name: 'Preview' });
    // The workspace can remount once while the scene finishes loading (dropping any open menu under
    // load), so open the menu until it is actually open.
    await waitFor(
      async () => {
        if (!screen.queryByRole('dialog', { name: 'Preview actions' })) {
          await user.click(screen.getByRole('button', { name: 'Open piece controls menu' }));
        }
        expect(screen.getByRole('dialog', { name: 'Preview actions' })).toBeInTheDocument();
      },
      { timeout: 5000 },
    );

    // Contextual: no Draw action until a drawing plane is selected.
    expect(screen.queryByTestId('draw-plane-button')).toBeNull();
    await user.click(
      await screen.findByRole('button', { name: '3D authoring' }, { timeout: 5000 }),
    );
    await user.click(
      await screen.findByRole('button', { name: 'Add drawing plane' }, { timeout: 5000 }),
    );

    const outline = screen.getByRole('region', { name: 'Outline' });
    expect(within(outline).getByText('Drawing plane 1')).toBeInTheDocument();
    expect(within(outline).getByText(/Ambient light/)).toBeInTheDocument();

    await user.click(await screen.findByTestId('draw-plane-button', undefined, { timeout: 5000 }));
    expect(
      await screen.findByTestId('ink-editor', undefined, { timeout: 5000 }),
    ).toBeInTheDocument();
    expect(screen.getByTestId('ink-frozen-indicator')).toBeInTheDocument();
    expect(screen.getByTestId('ink-canvas')).toHaveAttribute('width', '1024');
    expect(screen.getByTestId('ink-canvas')).toHaveAttribute('height', '768');

    await user.click(screen.getByTestId('ink-cancel'));
    expect(screen.queryByTestId('ink-editor')).toBeNull();
  });
});
