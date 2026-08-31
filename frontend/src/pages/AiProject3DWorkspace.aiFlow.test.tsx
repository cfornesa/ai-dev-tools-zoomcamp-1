import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import * as ai3dApi from '../api/ai3d';
import * as projects3dApi from '../api/projects3d';
import type { Project3D } from '../api/projects3d';
import AiProject3DWorkspace from './AiProject3DWorkspace';

vi.mock('../api/projects3d');
vi.mock('../api/ai3d');

const mockedGetProject3D = vi.mocked(projects3dApi.getProject3D);
const mockedCreateAIScene3D = vi.mocked(ai3dApi.createAIScene3D);
const mockedEditAIScene3D = vi.mocked(ai3dApi.editAIScene3D);
const mockedAcceptAIProposal3D = vi.mocked(ai3dApi.acceptAIProposal3D);

function baseProject(overrides: Partial<Project3D> = {}): Project3D {
  return {
    id: 'p1',
    owner: 'alice',
    visibility: 'private',
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

describe('AiProject3DWorkspace AI prompt flow', () => {
  it('shows the AI assistant panel directly', async () => {
    mockedGetProject3D.mockResolvedValue(baseProject());

    renderWorkspace();

    await screen.findByRole('region', { name: 'AI assistant' });
    expect(screen.getByLabelText(/describe the scene/i)).toBeInTheDocument();
  });

  it('a follow-up Edit prompt is generated against the scene from the last accepted proposal', async () => {
    mockedGetProject3D.mockResolvedValue(baseProject());
    const user = userEvent.setup();

    renderWorkspace();
    await screen.findByRole('region', { name: 'AI assistant' });

    const createdScene = {
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
      lights: [{ id: 'l1', name: 'Sun', type: 'ambient', color: '#ffffff', intensity: 1 }],
      groups: [],
      objects: [],
      randomness: { seed: 0, enabled: false },
    };
    mockedCreateAIScene3D.mockResolvedValue({
      draft: true,
      operation: 'create_scene',
      scene: createdScene,
      usage: { prompt_tokens: 1, completion_tokens: 1, total_tokens: 2, estimated_cost_usd: 0 },
    });

    await user.type(screen.getByLabelText(/describe the scene/i), 'add a sun');
    await user.click(screen.getByRole('button', { name: /generate scene/i }));
    await screen.findByTestId('ai-3d-proposal-success');

    const acceptedVersion = {
      id: 2,
      sequence: 2,
      origin: 'ai_create',
      created_by: 'alice',
      created_at: '2026-01-01T00:00:00Z',
      scene_json: createdScene,
    };
    mockedAcceptAIProposal3D.mockResolvedValue(acceptedVersion);
    await user.click(screen.getByTestId('ai-3d-accept-button'));
    await vi.waitFor(() => expect(mockedAcceptAIProposal3D).toHaveBeenCalled());

    await user.click(screen.getByRole('radio', { name: 'Edit' }));
    mockedEditAIScene3D.mockResolvedValue({
      draft: true,
      operation: 'edit_scene',
      scene: createdScene,
      patch: [],
      change_summary: 'Made Sun brighter.',
      usage: { prompt_tokens: 1, completion_tokens: 1, total_tokens: 2, estimated_cost_usd: 0 },
    });
    await user.type(screen.getByLabelText(/describe the change/i), 'make Sun brighter');
    await user.click(screen.getByRole('button', { name: /propose edit/i }));

    await vi.waitFor(() => expect(mockedEditAIScene3D).toHaveBeenCalled());
    const [, , currentSceneArg] = mockedEditAIScene3D.mock.calls[0];
    expect(currentSceneArg).toEqual(createdScene);
  });
});
