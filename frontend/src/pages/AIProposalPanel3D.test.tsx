import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import * as ai3dApi from '../api/ai3d';
import * as aiPreferencesApi from '../api/aiPreferences';
import AIProposalPanel3D from './AIProposalPanel3D';
import type { Scene3DDocument } from './scene3dTypes';

vi.mock('../api/ai3d');
vi.mock('../api/aiPreferences');

const mockedCreateAIScene3D = vi.mocked(ai3dApi.createAIScene3D);
const mockedFetchModels = vi.mocked(aiPreferencesApi.fetchMistralModelPreferences);
const mockedFetchPersonas = vi.mocked(aiPreferencesApi.fetchAIPersonas);

const VALID_SCENE_3D: Scene3DDocument = {
  schemaVersion: 1,
  documentType: 'scene3d',
  id: 'scene3d-1',
  scene: { backgroundColor: '#000000' },
  camera: {
    position: { x: 0, y: 0, z: 5 },
    target: { x: 0, y: 0, z: 0 },
    fov: 50,
    near: 0.1,
    far: 1000,
  },
  lights: [],
  groups: [],
  objects: [],
  randomness: { seed: 0, enabled: false },
};

beforeEach(() => {
  vi.clearAllMocks();
  window.localStorage.clear();
  mockedFetchModels.mockResolvedValue([]);
  mockedFetchPersonas.mockResolvedValue([]);
});

function renderPanel() {
  render(
    <AIProposalPanel3D
      projectId="p1"
      workingCopy={VALID_SCENE_3D}
      currentVersionId={1}
      onAccepted={vi.fn()}
    />,
  );
}

describe('AIProposalPanel3D model/persona dropdowns (issue #262)', () => {
  it('shows empty-state pointers to Account settings when nothing is saved', async () => {
    renderPanel();
    expect(await screen.findByText(/no saved models yet/i)).toBeInTheDocument();
    expect(await screen.findByText(/no personas yet/i)).toBeInTheDocument();
  });

  it('populates model and persona dropdowns from saved preferences and sends the selection', async () => {
    mockedFetchModels.mockResolvedValue([
      { id: 1, slug: 'mistral-large-latest', label: 'Large', created_at: '2026-01-01T00:00:00Z' },
    ]);
    mockedFetchPersonas.mockResolvedValue([
      { id: 9, name: 'Bold', prompt_text: 'Be bold.', created_at: '2026-01-01T00:00:00Z' },
    ]);
    mockedCreateAIScene3D.mockResolvedValue({
      draft: true,
      operation: 'create_scene',
      scene: VALID_SCENE_3D,
      usage: { prompt_tokens: 1, completion_tokens: 1, total_tokens: 2, estimated_cost_usd: 0 },
    });
    renderPanel();

    const modelSelect = await screen.findByLabelText(/mistral model/i);
    const personaSelect = await screen.findByLabelText(/^persona/i);
    await userEvent.selectOptions(modelSelect, 'mistral-large-latest');
    await userEvent.selectOptions(personaSelect, '9');
    await userEvent.type(screen.getByLabelText(/describe the scene/i), 'a bare stage');
    await userEvent.click(screen.getByRole('button', { name: /generate scene/i }));

    await screen.findByTestId('ai-3d-proposal-success');
    expect(mockedCreateAIScene3D).toHaveBeenCalledWith(
      'p1',
      'a bare stage',
      expect.anything(),
      'mistral-large-latest',
      9,
    );
  });
});
