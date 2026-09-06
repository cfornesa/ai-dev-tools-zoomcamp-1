import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import * as ai3dApi from '../api/ai3d';
import * as aiPreferencesApi from '../api/aiPreferences';
import * as aiRetryPreferenceApi from '../api/aiRetryPreference';
import * as aiRunsApi from '../api/aiRuns';
import type { AIRun } from '../api/aiRuns';
import { ApiError } from '../api/client';
import * as projects3dApi from '../api/projects3d';
import type { Project3D, SceneVersion3D } from '../api/projects3d';
import AIProposalPanel3D from './AIProposalPanel3D';
import type { Scene3DDocument } from './scene3dTypes';

vi.mock('../api/ai3d');
vi.mock('../api/aiPreferences');
vi.mock('../api/aiRetryPreference');
vi.mock('../api/aiRuns');
vi.mock('../api/projects3d', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../api/projects3d')>();
  return { ...actual, getProject3D: vi.fn() };
});

const mockedCreateAIScene3D = vi.mocked(ai3dApi.createAIScene3D);
const mockedEditAIScene3D = vi.mocked(ai3dApi.editAIScene3D);
const mockedFetchModels = vi.mocked(aiPreferencesApi.fetchMistralModelPreferences);
const mockedFetchPersonas = vi.mocked(aiPreferencesApi.fetchAIPersonas);
const mockedFetchRetryPreference = vi.mocked(aiRetryPreferenceApi.fetchAIRetryPreference);
const mockedStartAIRun = vi.mocked(aiRunsApi.startAIRun);
const mockedAdvanceAIRun = vi.mocked(aiRunsApi.advanceAIRun);
const mockedAcceptAIRun = vi.mocked(aiRunsApi.acceptAIRun);
const mockedGetProject3D = vi.mocked(projects3dApi.getProject3D);

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

describe('AIProposalPanel3D seed prop (issue #283)', () => {
  it('switches to Edit mode and fills the prompt when a seed is provided', async () => {
    render(
      <AIProposalPanel3D
        projectId="p1"
        workingCopy={VALID_SCENE_3D}
        currentVersionId={1}
        onAccepted={vi.fn()}
        seed={{ prompt: 'Improve this scene: ', nonce: 1 }}
      />,
    );

    const editRadio = await screen.findByRole('radio', { name: 'Edit' });
    expect(editRadio).toHaveAttribute('aria-checked', 'true');
    const promptField = screen.getByLabelText(/describe the change/i) as HTMLTextAreaElement;
    expect(promptField.value).toBe('Improve this scene: ');
  });

  it('re-applies the seed when nonce changes, even with identical prompt text', async () => {
    const { rerender } = render(
      <AIProposalPanel3D
        projectId="p1"
        workingCopy={VALID_SCENE_3D}
        currentVersionId={1}
        onAccepted={vi.fn()}
        seed={{ prompt: 'Improve this scene: ', nonce: 1 }}
      />,
    );
    const promptField = (await screen.findByLabelText(
      /describe the change/i,
    )) as HTMLTextAreaElement;
    await userEvent.clear(promptField);
    expect(promptField.value).toBe('');

    rerender(
      <AIProposalPanel3D
        projectId="p1"
        workingCopy={VALID_SCENE_3D}
        currentVersionId={1}
        onAccepted={vi.fn()}
        seed={{ prompt: 'Improve this scene: ', nonce: 2 }}
      />,
    );

    expect((screen.getByLabelText(/describe the change/i) as HTMLTextAreaElement).value).toBe(
      'Improve this scene: ',
    );
  });
});

function makeRun(overrides: Partial<AIRun> = {}): AIRun {
  return {
    id: 1,
    status: 'running',
    target_type: 'project3d',
    project_id: null,
    project3d_id: 'p1',
    operation: 'create',
    scope: 'whole_scene',
    selected_target_ids: [],
    attempts: 0,
    repairs: 0,
    candidate_scene: null,
    candidate_patch: null,
    change_summary: '',
    plan_summary: '',
    validation_summary: '',
    error_reason: '',
    usage: { prompt_tokens: 0, completion_tokens: 0, estimated_cost_usd: 0 },
    accepted_version_id: null,
    created_at: '2026-01-01T00:00:00Z',
    updated_at: '2026-01-01T00:00:00Z',
    deadline_at: '2026-01-01T00:02:00Z',
    cancelled_at: null,
    ...overrides,
  };
}

const SCENE_WITH_CUBE: Scene3DDocument = {
  ...VALID_SCENE_3D,
  objects: [
    {
      id: 'obj-cube',
      type: 'box',
      groupId: null,
      transform: {
        position: { x: 0, y: 0, z: 0 },
        rotation: { x: 0, y: 0, z: 0 },
        scale: { x: 1, y: 1, z: 1 },
        opacity: 1,
      },
      material: { color: '#ff0000' },
      visible: true,
      width: 1,
      height: 1,
      depth: 1,
    },
  ],
};

// Issue #463: the Agent workflow toggle -- offered alongside the one-shot
// flow every test above exercises, reusing the exact same `useAIRun`/
// `AIRunPanel` this session's 2D counterpart (#462) already ships, not a
// second orchestrator or a duplicated progress/review UI.
describe('AIProposalPanel3D Agent workflow (issue #463)', () => {
  it('toggles to the Agent workflow form and back without disturbing the one-shot fields', async () => {
    render(
      <AIProposalPanel3D
        projectId="p1"
        workingCopy={SCENE_WITH_CUBE}
        currentVersionId={1}
        onAccepted={vi.fn()}
      />,
    );
    await userEvent.type(screen.getByLabelText(/describe the scene/i), 'a red cube');

    await userEvent.click(screen.getByRole('radio', { name: /agent workflow/i }));
    expect(screen.getByTestId('ai-run-form')).toBeInTheDocument();
    expect(screen.queryByRole('radio', { name: /^create$/i })).not.toBeInTheDocument();

    await userEvent.click(screen.getByRole('radio', { name: /one-shot/i }));
    expect(screen.getByLabelText(/describe the scene/i)).toHaveValue('a red cube');
  });

  it('offers scene objects (e.g. the cube) as selectable for "Edit selected object"', async () => {
    render(
      <AIProposalPanel3D
        projectId="p1"
        workingCopy={SCENE_WITH_CUBE}
        currentVersionId={1}
        onAccepted={vi.fn()}
      />,
    );

    await userEvent.click(screen.getByRole('radio', { name: /agent workflow/i }));
    await userEvent.click(screen.getByRole('radio', { name: /edit selected object/i }));

    expect(screen.getByRole('option', { name: /Box 1/i })).toBeInTheDocument();
  });

  it('starts an agent run, advances to an awaiting-review preview, and accepts it', async () => {
    mockedStartAIRun.mockResolvedValue(makeRun({ status: 'running' }));
    mockedAdvanceAIRun.mockResolvedValueOnce(
      makeRun({
        status: 'awaiting_review',
        attempts: 1,
        candidate_scene: SCENE_WITH_CUBE,
        change_summary: 'Generated a scene.',
      }),
    );
    const onAccepted = vi.fn();
    mockedAcceptAIRun.mockResolvedValue(
      makeRun({ status: 'accepted', accepted_version_id: 9, candidate_scene: SCENE_WITH_CUBE }),
    );
    const acceptedVersion: SceneVersion3D = {
      id: 9,
      sequence: 1,
      origin: 'ai_create',
      scene_json: SCENE_WITH_CUBE,
      created_by: 'alice',
      created_at: '2026-01-01T00:00:00Z',
    };
    mockedGetProject3D.mockResolvedValue({
      id: 'p1',
      owner: 'alice',
      title: 'Untitled',
      visibility: 'private',
      thumbnail_url: null,
      current_version: acceptedVersion,
      created_at: '2026-01-01T00:00:00Z',
      updated_at: '2026-01-01T00:00:00Z',
    } satisfies Project3D);

    render(
      <AIProposalPanel3D
        projectId="p1"
        workingCopy={SCENE_WITH_CUBE}
        currentVersionId={1}
        onAccepted={onAccepted}
      />,
    );

    await userEvent.click(screen.getByRole('radio', { name: /agent workflow/i }));
    await userEvent.type(screen.getByLabelText(/describe the scene/i), 'a red cube');
    await userEvent.click(screen.getByTestId('ai-run-start'));

    expect(mockedStartAIRun).toHaveBeenCalledWith(
      expect.objectContaining({
        target_type: 'project3d',
        project3d_id: 'p1',
        operation: 'create',
      }),
    );

    await screen.findByTestId('ai-run-preview');
    expect(screen.getByTestId('ai-run-change-summary')).toHaveTextContent('Generated a scene.');

    await userEvent.click(screen.getByTestId('ai-run-accept'));

    await waitFor(() => expect(onAccepted).toHaveBeenCalledWith(acceptedVersion));
  });
});
