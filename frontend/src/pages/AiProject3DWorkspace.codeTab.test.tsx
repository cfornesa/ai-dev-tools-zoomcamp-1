import { fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import * as projects3dApi from '../api/projects3d';
import type { Project3D } from '../api/projects3d';
import AiProject3DWorkspace from './AiProject3DWorkspace';

/**
 * Issue #233: the 3D AI-assisted editor's Code tab, reusing
 * Scene3DCodeEditor.tsx unchanged from #229 -- see
 * Scene3DCodeEditor.test.tsx for the exhaustive validate/save coverage
 * already exercised there. These tests cover only what's specific to
 * this route: the Visual/Code toggle exists, and a saved edit here
 * updates local state the same way an accepted AI proposal does.
 */

vi.mock('../api/projects3d');

const mockedGetProject3D = vi.mocked(projects3dApi.getProject3D);
const mockedSaveSceneVersion3D = vi.mocked(projects3dApi.saveSceneVersion3D);

function baseProject(overrides: Partial<Project3D> = {}): Project3D {
  return {
    id: 'p1',
    owner: 'alice',
    title: 'My AI 3D scene',
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

function renderWorkspace() {
  return render(
    <MemoryRouter initialEntries={['/ai-projects3d/p1']}>
      <Routes>
        <Route path="/ai-projects3d/:id" element={<AiProject3DWorkspace />} />
      </Routes>
    </MemoryRouter>,
  );
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe('AiProject3DWorkspace Code tab', () => {
  it('toggles between Visual and Code views', async () => {
    mockedGetProject3D.mockResolvedValue(baseProject());
    const user = userEvent.setup();

    renderWorkspace();
    await screen.findByRole('region', { name: 'Preview' });
    expect(screen.queryByRole('region', { name: 'Code' })).not.toBeInTheDocument();

    await user.click(screen.getByRole('radio', { name: 'Code' }));

    expect(await screen.findByRole('region', { name: 'Code' })).toBeInTheDocument();
    expect(screen.queryByRole('region', { name: 'Preview' })).not.toBeInTheDocument();
    expect(screen.queryByRole('region', { name: 'AI assistant' })).not.toBeInTheDocument();
  });

  it('a saved Code-tab edit updates the title-bar scene summary shown on Visual', async () => {
    mockedGetProject3D.mockResolvedValue(baseProject());
    const user = userEvent.setup();

    renderWorkspace();
    await screen.findByRole('region', { name: 'Preview' });
    await user.click(screen.getByRole('radio', { name: 'Code' }));

    const textarea = await screen.findByTestId('scene3d-code-textarea');
    const scene = baseProject().current_version!.scene_json;
    const edited = {
      ...scene,
      objects: [
        {
          id: 'o1',
          type: 'box',
          groupId: null,
          transform: {
            position: { x: 0, y: 0, z: 0 },
            rotation: { x: 0, y: 0, z: 0 },
            scale: { x: 1, y: 1, z: 1 },
            opacity: 1,
          },
          material: { color: '#ffffff' },
          visible: true,
          width: 1,
          height: 1,
          depth: 1,
        },
      ],
    };
    mockedSaveSceneVersion3D.mockResolvedValue({
      id: 2,
      sequence: 2,
      origin: 'manual',
      created_by: 'alice',
      created_at: '2026-01-01T00:00:00Z',
      scene_json: edited,
    });

    fireEvent.change(textarea, { target: { value: JSON.stringify(edited, null, 2) } });
    fireEvent.blur(textarea);
    await vi.waitFor(() => expect(mockedSaveSceneVersion3D).toHaveBeenCalled());

    await user.click(screen.getByRole('radio', { name: 'Visual' }));
    expect(await screen.findByTestId('scene3d-preview-unavailable')).toHaveTextContent(
      '1 object(s), 0 light(s), 0 group(s)',
    );
  });
});
