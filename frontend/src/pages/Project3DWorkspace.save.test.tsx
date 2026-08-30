import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import * as projects3dApi from '../api/projects3d';
import type { Project3D } from '../api/projects3d';
import Project3DWorkspace from './Project3DWorkspace';

/**
 * Issue #234: the outline/inspector's own explicit Save action -- until
 * now its edits (#227) were only ever held in memory. Covers: the Save
 * button starts disabled (nothing dirty), an outline edit enables it and
 * flips the status to "Unsaved changes", a successful save calls
 * saveSceneVersion3D and returns the status to "Saved as version N", and
 * a validation/network failure surfaces an inline error without
 * clearing the dirty state.
 */

vi.mock('../api/projects3d');

const mockedGetProject3D = vi.mocked(projects3dApi.getProject3D);
const mockedSaveSceneVersion3D = vi.mocked(projects3dApi.saveSceneVersion3D);

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
        objects: [],
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

describe('Project3DWorkspace Save action', () => {
  it('starts with the Save button disabled and status "Saved as version 1"', async () => {
    mockedGetProject3D.mockResolvedValue(baseProject());

    renderWorkspace();

    expect(await screen.findByTestId('project3d-save-status')).toHaveTextContent(
      'Saved as version 1',
    );
    expect(screen.getByTestId('project3d-save-button')).toBeDisabled();
  });

  it('an outline edit enables Save and flips the status to Unsaved changes', async () => {
    mockedGetProject3D.mockResolvedValue(baseProject());
    const user = userEvent.setup();

    renderWorkspace();
    await screen.findByTestId('project3d-save-status');

    await user.click(screen.getByRole('button', { name: 'Ambient light 1' }));
    const intensityInput = screen.getByLabelText('Intensity');
    await user.clear(intensityInput);
    await user.type(intensityInput, '5');

    expect(screen.getByTestId('project3d-save-status')).toHaveTextContent('Unsaved changes');
    expect(screen.getByTestId('project3d-save-button')).toBeEnabled();
  });

  it('Save persists the working scene and returns to the Saved status', async () => {
    mockedGetProject3D.mockResolvedValue(baseProject());
    const user = userEvent.setup();

    renderWorkspace();
    await screen.findByTestId('project3d-save-status');
    await user.click(screen.getByRole('button', { name: 'Ambient light 1' }));
    const intensityInput = screen.getByLabelText('Intensity');
    await user.clear(intensityInput);
    await user.type(intensityInput, '5');

    const savedVersion = {
      id: 2,
      sequence: 2,
      origin: 'manual',
      created_by: 'alice',
      created_at: '2026-01-01T00:00:01Z',
      scene_json: { ...baseProject().current_version!.scene_json },
    };
    mockedSaveSceneVersion3D.mockResolvedValue(savedVersion);

    await user.click(screen.getByTestId('project3d-save-button'));

    await waitFor(() =>
      expect(screen.getByTestId('project3d-save-status')).toHaveTextContent('Saved as version 2'),
    );
    expect(mockedSaveSceneVersion3D).toHaveBeenCalledWith('p1', expect.any(Object));
    expect(screen.getByTestId('project3d-save-button')).toBeDisabled();
  });

  it('shows an inline error and keeps the dirty state when saving fails', async () => {
    mockedGetProject3D.mockResolvedValue(baseProject());
    mockedSaveSceneVersion3D.mockRejectedValue(new Error('network down'));
    const user = userEvent.setup();

    renderWorkspace();
    await screen.findByTestId('project3d-save-status');
    await user.click(screen.getByRole('button', { name: 'Ambient light 1' }));
    const intensityInput = screen.getByLabelText('Intensity');
    await user.clear(intensityInput);
    await user.type(intensityInput, '5');

    await user.click(screen.getByTestId('project3d-save-button'));

    expect(await screen.findByTestId('project3d-save-error')).toBeInTheDocument();
    expect(screen.getByTestId('project3d-save-status')).toHaveTextContent('Unsaved changes');
    expect(screen.getByTestId('project3d-save-button')).toBeEnabled();
  });
});
