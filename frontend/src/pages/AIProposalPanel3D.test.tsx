import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import * as ai3dApi from '../api/ai3d';
import * as aiPreferencesApi from '../api/aiPreferences';
import * as aiRetryPreferenceApi from '../api/aiRetryPreference';
import { ApiError } from '../api/client';
import AIProposalPanel3D from './AIProposalPanel3D';
import type { Scene3DDocument } from './scene3dTypes';

vi.mock('../api/ai3d');
vi.mock('../api/aiPreferences');
vi.mock('../api/aiRetryPreference');

const mockedCreateAIScene3D = vi.mocked(ai3dApi.createAIScene3D);
const mockedEditAIScene3D = vi.mocked(ai3dApi.editAIScene3D);
const mockedFetchModels = vi.mocked(aiPreferencesApi.fetchMistralModelPreferences);
const mockedFetchPersonas = vi.mocked(aiPreferencesApi.fetchAIPersonas);
const mockedFetchRetryPreference = vi.mocked(aiRetryPreferenceApi.fetchAIRetryPreference);

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
  mockedFetchRetryPreference.mockResolvedValue({ auto_retry_enabled: false, max_retries: 3 });
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

describe('AIProposalPanel3D retry (#266)', () => {
  it('offers an explicit Retry action for a retryable failure and retries on click', async () => {
    mockedCreateAIScene3D
      .mockRejectedValueOnce(new ApiError(502, { error: 'provider_failure', detail: 'Down.' }))
      .mockResolvedValueOnce({
        draft: true,
        operation: 'create_scene',
        scene: VALID_SCENE_3D,
        usage: { prompt_tokens: 1, completion_tokens: 1, total_tokens: 2, estimated_cost_usd: 0 },
      });
    renderPanel();

    await userEvent.type(screen.getByLabelText(/describe the scene/i), 'a bare stage');
    await userEvent.click(screen.getByRole('button', { name: /generate scene/i }));

    const alert = await screen.findByTestId('ai-3d-error-provider-error');
    const retryButton = await screen.findByTestId('ai-3d-retry-generation');
    expect(alert).toContainElement(retryButton);

    await userEvent.click(retryButton);

    await screen.findByTestId('ai-3d-proposal-success');
    expect(mockedCreateAIScene3D).toHaveBeenCalledTimes(2);
  });

  it('does not offer Retry for a non-retryable failure', async () => {
    mockedCreateAIScene3D.mockRejectedValue(
      new ApiError(429, { error: 'quota_exceeded', detail: 'Daily limit reached.' }),
    );
    renderPanel();

    await userEvent.type(screen.getByLabelText(/describe the scene/i), 'a bare stage');
    await userEvent.click(screen.getByRole('button', { name: /generate scene/i }));

    await screen.findByTestId('ai-3d-error-quota-error');
    expect(screen.queryByTestId('ai-3d-retry-generation')).not.toBeInTheDocument();
  });
});

// Issue #267: the success state must render a live visual preview of
// `proposal.scene` before Accept/Reject, mirroring
// AIProposalPanel.test.tsx's own preview-canvas coverage.
describe('AIProposalPanel3D visual preview before Accept/Reject (#267)', () => {
  it('shows a preview for a successful Create proposal, before any Accept', async () => {
    mockedCreateAIScene3D.mockResolvedValue({
      draft: true,
      operation: 'create_scene',
      scene: VALID_SCENE_3D,
      usage: { prompt_tokens: 1, completion_tokens: 1, total_tokens: 2, estimated_cost_usd: 0 },
    });
    renderPanel();

    await userEvent.type(screen.getByLabelText(/describe the scene/i), 'a bare stage');
    await userEvent.click(screen.getByRole('button', { name: /generate scene/i }));

    await screen.findByTestId('ai-3d-proposal-success');
    expect(screen.getByTestId('ai-3d-proposal-preview')).toBeInTheDocument();
    // Nothing has been saved: no call to the accept endpoint yet.
    expect(screen.queryByTestId('ai-3d-accept-error')).not.toBeInTheDocument();
  });

  it('shows a preview for a successful Edit proposal, previewing the patched scene', async () => {
    mockedEditAIScene3D.mockResolvedValue({
      draft: true,
      operation: 'edit_scene',
      patch: [{ op: 'replace', path: '/objects/0/name', value: 'Renamed' }],
      scene: { ...VALID_SCENE_3D, id: 'scene3d-1-edited' },
      change_summary: 'Renamed an object.',
      usage: { prompt_tokens: 1, completion_tokens: 1, total_tokens: 2, estimated_cost_usd: 0 },
    });
    renderPanel();

    await userEvent.click(screen.getByRole('radio', { name: 'Edit' }));
    await userEvent.type(screen.getByLabelText(/describe the change/i), 'rename the box');
    await userEvent.click(screen.getByRole('button', { name: /propose edit/i }));

    await screen.findByTestId('ai-3d-proposal-success');
    expect(screen.getByTestId('ai-3d-proposal-preview')).toBeInTheDocument();
  });

  it('removes the preview on Reject without ever calling the accept endpoint', async () => {
    mockedCreateAIScene3D.mockResolvedValue({
      draft: true,
      operation: 'create_scene',
      scene: VALID_SCENE_3D,
      usage: { prompt_tokens: 1, completion_tokens: 1, total_tokens: 2, estimated_cost_usd: 0 },
    });
    renderPanel();

    await userEvent.type(screen.getByLabelText(/describe the scene/i), 'a bare stage');
    await userEvent.click(screen.getByRole('button', { name: /generate scene/i }));

    await screen.findByTestId('ai-3d-proposal-preview');
    await userEvent.click(screen.getByTestId('ai-3d-reject-button'));

    expect(screen.queryByTestId('ai-3d-proposal-preview')).not.toBeInTheDocument();
    expect(screen.queryByTestId('ai-3d-proposal-success')).not.toBeInTheDocument();
  });
});
