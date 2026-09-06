import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import * as aiPreferencesApi from '../api/aiPreferences';
import * as aiApi from '../api/ai';
import * as aiRetryPreferenceApi from '../api/aiRetryPreference';
import * as aiRunsApi from '../api/aiRuns';
import type { AIRun } from '../api/aiRuns';
import { ApiError } from '../api/client';
import * as projectsApi from '../api/projects';
import type { SceneDocument, SceneVersion } from '../api/projects';
import AIProposalPanel from './AIProposalPanel';

vi.mock('../api/ai');
vi.mock('../api/aiPreferences');
vi.mock('../api/aiRetryPreference');
vi.mock('../api/aiRuns');
vi.mock('../api/projects', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../api/projects')>();
  return { ...actual, getSceneVersion: vi.fn() };
});

const mockedCreateAIScene = vi.mocked(aiApi.createAIScene);
const mockedEditAIScene = vi.mocked(aiApi.editAIScene);
const mockedAcceptAIProposal = vi.mocked(aiApi.acceptAIProposal);
const mockedFetchModels = vi.mocked(aiPreferencesApi.fetchMistralModelPreferences);
const mockedFetchPersonas = vi.mocked(aiPreferencesApi.fetchAIPersonas);
const mockedFetchRetryPreference = vi.mocked(aiRetryPreferenceApi.fetchAIRetryPreference);
const mockedStartAIRun = vi.mocked(aiRunsApi.startAIRun);
const mockedAdvanceAIRun = vi.mocked(aiRunsApi.advanceAIRun);
const mockedGetSceneVersion = vi.mocked(projectsApi.getSceneVersion);

const VALID_SCENE: SceneDocument = {
  schemaVersion: 1,
  id: 'scene-1',
  canvas: { width: 800, height: 600, backgroundColor: '#ffffff' },
  renderer: { preferred: 'p5' },
  layers: [{ id: 'layer-1', name: 'Layer 1', order: 0, visible: true, locked: false }],
  shapes: [],
  groups: [],
  bindings: [],
  graph: { nodes: [], connections: [] },
  accessibility: { reducedMotion: 'auto' },
  randomness: { seed: 0, enabled: false },
};

function makeVersion(overrides: Partial<SceneVersion> = {}): SceneVersion {
  return {
    id: 5,
    sequence: 2,
    origin: 'ai_create',
    change_label: '',
    created_by: 'alice',
    parent: 1,
    fork_source_version: null,
    created_at: '2026-01-01T00:00:00Z',
    scene_json: VALID_SCENE,
    ...overrides,
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  window.localStorage.clear();
  mockedFetchModels.mockResolvedValue([]);
  mockedFetchPersonas.mockResolvedValue([]);
  mockedFetchRetryPreference.mockResolvedValue({ auto_retry_enabled: false, max_retries: 3 });
});

function renderPanel(onAccepted = vi.fn()) {
  render(
    <AIProposalPanel
      projectId="p1"
      workingCopy={VALID_SCENE}
      currentVersionId={1}
      onAccepted={onAccepted}
    />,
  );
  return { onAccepted };
}

describe('AIProposalPanel prompt/pending/success states', () => {
  it('starts in the prompt state with Generate disabled until text is entered', async () => {
    renderPanel();
    const generateButton = screen.getByRole('button', { name: /generate scene/i });
    expect(generateButton).toBeDisabled();

    await userEvent.type(screen.getByLabelText(/describe the scene/i), 'a red circle');
    expect(generateButton).toBeEnabled();
  });

  it('shows the pending state (aria-live status) while a request is in flight', async () => {
    let resolvePromise: (value: aiApi.AICreateSceneResponse) => void = () => {};
    mockedCreateAIScene.mockReturnValue(
      new Promise((resolve) => {
        resolvePromise = resolve;
      }),
    );
    renderPanel();

    await userEvent.type(screen.getByLabelText(/describe the scene/i), 'a red circle');
    await userEvent.click(screen.getByRole('button', { name: /generate scene/i }));

    expect(await screen.findByTestId('ai-pending-status')).toHaveTextContent(/contacting/i);

    resolvePromise({
      draft: true,
      operation: 'create_scene',
      scene: VALID_SCENE,
      usage: { prompt_tokens: 1, completion_tokens: 1, total_tokens: 2, estimated_cost_usd: 0 },
    });
    await screen.findByTestId('ai-proposal-success');
  });

  it('shows the success state with a preview canvas and a human-readable summary', async () => {
    mockedCreateAIScene.mockResolvedValue({
      draft: true,
      operation: 'create_scene',
      scene: VALID_SCENE,
      usage: { prompt_tokens: 1, completion_tokens: 1, total_tokens: 2, estimated_cost_usd: 0 },
    });
    renderPanel();

    await userEvent.type(screen.getByLabelText(/describe the scene/i), 'a red circle');
    await userEvent.click(screen.getByRole('button', { name: /generate scene/i }));

    await screen.findByTestId('ai-proposal-success');
    expect(screen.getByTestId('ai-proposal-preview-canvas')).toBeInTheDocument();
    expect(screen.getByTestId('ai-proposal-summary')).toHaveTextContent(/generated/i);
    // Nothing has been saved: no call to the accept endpoint yet.
    expect(mockedAcceptAIProposal).not.toHaveBeenCalled();
  });

  // Issue #198.
  it('leaves the model argument undefined when the model field is left blank', async () => {
    mockedCreateAIScene.mockResolvedValue({
      draft: true,
      operation: 'create_scene',
      scene: VALID_SCENE,
      usage: { prompt_tokens: 1, completion_tokens: 1, total_tokens: 2, estimated_cost_usd: 0 },
    });
    renderPanel();

    await userEvent.type(screen.getByLabelText(/describe the scene/i), 'a red circle');
    await userEvent.click(screen.getByRole('button', { name: /generate scene/i }));

    await screen.findByTestId('ai-proposal-success');
    expect(mockedCreateAIScene).toHaveBeenCalledWith(
      'p1',
      'a red circle',
      expect.anything(),
      undefined,
      undefined,
    );
  });

  // Issue #262: the free-text model field was replaced with a dropdown
  // sourced from the user's saved Mistral models.
  it('shows an empty-state pointer to Account settings when no models are saved', async () => {
    renderPanel();
    expect(await screen.findByText(/no saved models yet/i)).toBeInTheDocument();
    expect(screen.getAllByRole('link', { name: /account settings/i }).length).toBeGreaterThan(0);
  });

  it('selects a saved model id and remembers it in localStorage across a fresh mount', async () => {
    mockedFetchModels.mockResolvedValue([
      { id: 1, slug: 'codestral-2405', label: 'Codestral', created_at: '2026-01-01T00:00:00Z' },
    ]);
    mockedCreateAIScene.mockResolvedValue({
      draft: true,
      operation: 'create_scene',
      scene: VALID_SCENE,
      usage: { prompt_tokens: 1, completion_tokens: 1, total_tokens: 2, estimated_cost_usd: 0 },
    });
    const { unmount } = render(
      <AIProposalPanel
        projectId="p1"
        workingCopy={VALID_SCENE}
        currentVersionId={1}
        onAccepted={vi.fn()}
      />,
    );

    await userEvent.type(screen.getByLabelText(/describe the scene/i), 'a red circle');
    await userEvent.selectOptions(await screen.findByLabelText(/mistral model/i), 'codestral-2405');
    await userEvent.click(screen.getByRole('button', { name: /generate scene/i }));

    await screen.findByTestId('ai-proposal-success');
    expect(mockedCreateAIScene).toHaveBeenCalledWith(
      'p1',
      'a red circle',
      expect.anything(),
      'codestral-2405',
      undefined,
    );

    unmount();
    render(
      <AIProposalPanel
        projectId="p1"
        workingCopy={VALID_SCENE}
        currentVersionId={1}
        onAccepted={vi.fn()}
      />,
    );
    expect(await screen.findByLabelText(/mistral model/i)).toHaveValue('codestral-2405');
  });

  it('shows an empty-state pointer for Personas when none are saved, and selects one when present', async () => {
    mockedFetchPersonas.mockResolvedValue([
      { id: 7, name: 'Playful', prompt_text: 'Be playful.', created_at: '2026-01-01T00:00:00Z' },
    ]);
    mockedCreateAIScene.mockResolvedValue({
      draft: true,
      operation: 'create_scene',
      scene: VALID_SCENE,
      usage: { prompt_tokens: 1, completion_tokens: 1, total_tokens: 2, estimated_cost_usd: 0 },
    });
    renderPanel();

    await userEvent.type(screen.getByLabelText(/describe the scene/i), 'a red circle');
    await userEvent.selectOptions(await screen.findByLabelText(/^persona/i), '7');
    await userEvent.click(screen.getByRole('button', { name: /generate scene/i }));

    await screen.findByTestId('ai-proposal-success');
    expect(mockedCreateAIScene).toHaveBeenCalledWith(
      'p1',
      'a red circle',
      expect.anything(),
      undefined,
      7,
    );
  });
});

describe('AIProposalPanel error states', () => {
  it('shows a distinct, accessible validation-error state', async () => {
    mockedCreateAIScene.mockRejectedValue(
      new ApiError(400, { error: 'prompt_invalid', detail: 'Prompt is required.' }),
    );
    renderPanel();

    await userEvent.type(screen.getByLabelText(/describe the scene/i), 'x');
    await userEvent.click(screen.getByRole('button', { name: /generate scene/i }));

    const alert = await screen.findByTestId('ai-error-validation-error');
    expect(alert).toHaveAttribute('aria-live', 'assertive');
    expect(alert).toHaveTextContent(/prompt is required/i);
  });

  it('shows model_invalid as a validation-error, distinct from prompt_invalid (issue #198)', async () => {
    mockedCreateAIScene.mockRejectedValue(
      new ApiError(400, { error: 'model_invalid', detail: 'Model id must be lowercase.' }),
    );
    renderPanel();

    await userEvent.type(screen.getByLabelText(/describe the scene/i), 'x');
    await userEvent.click(screen.getByRole('button', { name: /generate scene/i }));

    const alert = await screen.findByTestId('ai-error-validation-error');
    expect(alert).toHaveTextContent(/model id must be lowercase/i);
  });

  it('shows a distinct, accessible quota-error state', async () => {
    mockedCreateAIScene.mockRejectedValue(
      new ApiError(429, { error: 'quota_exceeded', detail: 'Daily limit reached.' }),
    );
    renderPanel();

    await userEvent.type(screen.getByLabelText(/describe the scene/i), 'x');
    await userEvent.click(screen.getByRole('button', { name: /generate scene/i }));

    const alert = await screen.findByTestId('ai-error-quota-error');
    expect(alert).toHaveTextContent(/daily limit/i);
  });

  it('shows a distinct, accessible provider-error state', async () => {
    mockedCreateAIScene.mockRejectedValue(
      new ApiError(502, { error: 'provider_failure', detail: 'Upstream failure.' }),
    );
    renderPanel();

    await userEvent.type(screen.getByLabelText(/describe the scene/i), 'x');
    await userEvent.click(screen.getByRole('button', { name: /generate scene/i }));

    const alert = await screen.findByTestId('ai-error-provider-error');
    expect(alert).toHaveTextContent(/upstream failure/i);
  });

  it('offers an explicit Retry action for a retryable failure and retries on click (#266)', async () => {
    mockedCreateAIScene
      .mockRejectedValueOnce(new ApiError(502, { error: 'provider_failure', detail: 'Down.' }))
      .mockResolvedValueOnce({
        draft: true,
        operation: 'create_scene',
        scene: VALID_SCENE,
        usage: { prompt_tokens: 1, completion_tokens: 1, total_tokens: 2, estimated_cost_usd: 0 },
      });
    renderPanel();

    await userEvent.type(screen.getByLabelText(/describe the scene/i), 'x');
    await userEvent.click(screen.getByRole('button', { name: /generate scene/i }));

    const alert = await screen.findByTestId('ai-error-provider-error');
    const retryButton = await screen.findByTestId('ai-retry-generation');
    expect(alert).toContainElement(retryButton);

    await userEvent.click(retryButton);

    await screen.findByTestId('ai-proposal-success');
    expect(mockedCreateAIScene).toHaveBeenCalledTimes(2);
  });

  it('does not offer Retry for a non-retryable failure (#266)', async () => {
    mockedCreateAIScene.mockRejectedValue(
      new ApiError(429, { error: 'quota_exceeded', detail: 'Daily limit reached.' }),
    );
    renderPanel();

    await userEvent.type(screen.getByLabelText(/describe the scene/i), 'x');
    await userEvent.click(screen.getByRole('button', { name: /generate scene/i }));

    await screen.findByTestId('ai-error-quota-error');
    expect(screen.queryByTestId('ai-retry-generation')).not.toBeInTheDocument();
  });
});

describe('AIProposalPanel Accept/Reject', () => {
  async function reachSuccessState() {
    mockedCreateAIScene.mockResolvedValue({
      draft: true,
      operation: 'create_scene',
      scene: VALID_SCENE,
      usage: { prompt_tokens: 1, completion_tokens: 1, total_tokens: 2, estimated_cost_usd: 0 },
    });
    const utils = renderPanel();
    await userEvent.type(screen.getByLabelText(/describe the scene/i), 'a red circle');
    await userEvent.click(screen.getByRole('button', { name: /generate scene/i }));
    await screen.findByTestId('ai-proposal-success');
    return utils;
  }

  it('Accept calls onAccepted with the new version and returns to the prompt state', async () => {
    const accepted = makeVersion();
    mockedAcceptAIProposal.mockResolvedValue(accepted);
    const { onAccepted } = await reachSuccessState();

    await userEvent.click(screen.getByTestId('ai-accept-button'));

    await waitFor(() => expect(onAccepted).toHaveBeenCalledWith(accepted));
    expect(screen.queryByTestId('ai-proposal-success')).not.toBeInTheDocument();
  });

  it('Reject discards the proposal without calling the accept API or onAccepted', async () => {
    const { onAccepted } = await reachSuccessState();

    await userEvent.click(screen.getByTestId('ai-reject-button'));

    expect(mockedAcceptAIProposal).not.toHaveBeenCalled();
    expect(onAccepted).not.toHaveBeenCalled();
    expect(screen.queryByTestId('ai-proposal-success')).not.toBeInTheDocument();
  });

  it('disables Accept while a request is already in flight (double-click guard)', async () => {
    let resolveAccept: (value: SceneVersion) => void = () => {};
    mockedAcceptAIProposal.mockReturnValue(
      new Promise((resolve) => {
        resolveAccept = resolve;
      }),
    );
    await reachSuccessState();

    const acceptButton = screen.getByTestId('ai-accept-button');
    await userEvent.click(acceptButton);
    expect(acceptButton).toBeDisabled();

    resolveAccept(makeVersion());
    await waitFor(() => expect(mockedAcceptAIProposal).toHaveBeenCalledTimes(1));
  });

  it('shows a distinct, accessible stale-base message on a 409 accept response', async () => {
    mockedAcceptAIProposal.mockRejectedValue(
      new ApiError(409, { error: 'stale_base', detail: 'The project changed.' }),
    );
    await reachSuccessState();

    await userEvent.click(screen.getByTestId('ai-accept-button'));

    const alert = await screen.findByTestId('ai-accept-error');
    expect(alert).toHaveAttribute('aria-live', 'assertive');
    expect(alert).toHaveTextContent(/the project changed/i);
    // The proposal preview is still shown so the user can reject/retry.
    expect(screen.getByTestId('ai-proposal-success')).toBeInTheDocument();
  });
});

describe('AIProposalPanel edit mode', () => {
  it('switches to edit mode and sends the working copy as current_scene', async () => {
    mockedEditAIScene.mockResolvedValue({
      draft: true,
      operation: 'edit_scene',
      patch: [],
      scene: VALID_SCENE,
      change_summary: '1 change: canvas updated.',
      usage: { prompt_tokens: 1, completion_tokens: 1, total_tokens: 2, estimated_cost_usd: 0 },
    });
    renderPanel();

    await userEvent.click(screen.getByRole('radio', { name: /edit/i }));
    await userEvent.type(screen.getByLabelText(/describe the change/i), 'make it black');
    await userEvent.click(screen.getByRole('button', { name: /propose edit/i }));

    await screen.findByTestId('ai-proposal-success');
    expect(mockedEditAIScene).toHaveBeenCalledWith(
      'p1',
      'make it black',
      VALID_SCENE,
      1,
      expect.anything(),
      undefined,
      undefined,
    );
    expect(screen.getByTestId('ai-proposal-summary')).toHaveTextContent(
      '1 change: canvas updated.',
    );
  });

  it('shows the pending state while an editAIScene request is in flight', async () => {
    let resolvePromise: (value: aiApi.AIEditSceneResponse) => void = () => {};
    mockedEditAIScene.mockReturnValue(
      new Promise((resolve) => {
        resolvePromise = resolve;
      }),
    );
    renderPanel();

    await userEvent.click(screen.getByRole('radio', { name: /edit/i }));
    await userEvent.type(screen.getByLabelText(/describe the change/i), 'make it black');
    await userEvent.click(screen.getByRole('button', { name: /propose edit/i }));

    expect(await screen.findByTestId('ai-pending-status')).toHaveTextContent(/contacting/i);
    expect(screen.queryByTestId('ai-proposal-success')).not.toBeInTheDocument();

    resolvePromise({
      draft: true,
      operation: 'edit_scene',
      patch: [],
      scene: VALID_SCENE,
      change_summary: '1 change: canvas updated.',
      usage: { prompt_tokens: 1, completion_tokens: 1, total_tokens: 2, estimated_cost_usd: 0 },
    });
    await screen.findByTestId('ai-proposal-success');
  });

  it('shows a distinct, accessible quota-error state for an edit-scene request', async () => {
    mockedEditAIScene.mockRejectedValue(
      new ApiError(429, { error: 'provider_quota_exceeded', detail: 'Provider quota reached.' }),
    );
    renderPanel();

    await userEvent.click(screen.getByRole('radio', { name: /edit/i }));
    await userEvent.type(screen.getByLabelText(/describe the change/i), 'make it black');
    await userEvent.click(screen.getByRole('button', { name: /propose edit/i }));

    const alert = await screen.findByTestId('ai-error-quota-error');
    expect(alert).toHaveAttribute('aria-live', 'assertive');
    expect(alert).toHaveTextContent(/provider quota reached/i);
  });

  it('shows a distinct, accessible provider-error state for an edit-scene request', async () => {
    mockedEditAIScene.mockRejectedValue(
      new ApiError(502, { error: 'provider_failure', detail: 'Mistral is down.' }),
    );
    renderPanel();

    await userEvent.click(screen.getByRole('radio', { name: /edit/i }));
    await userEvent.type(screen.getByLabelText(/describe the change/i), 'make it black');
    await userEvent.click(screen.getByRole('button', { name: /propose edit/i }));

    const alert = await screen.findByTestId('ai-error-provider-error');
    expect(alert).toHaveAttribute('aria-live', 'assertive');
    expect(alert).toHaveTextContent(/mistral is down/i);
  });
});

describe('AIProposalPanel keyboard operability', () => {
  it('every control (mode toggle, prompt, generate, accept, reject) is reachable via Tab and activatable via keyboard', async () => {
    mockedCreateAIScene.mockResolvedValue({
      draft: true,
      operation: 'create_scene',
      scene: VALID_SCENE,
      usage: { prompt_tokens: 1, completion_tokens: 1, total_tokens: 2, estimated_cost_usd: 0 },
    });
    mockedAcceptAIProposal.mockResolvedValue(makeVersion());
    renderPanel();

    const createRadio = screen.getByRole('radio', { name: /create/i });
    const editRadio = screen.getByRole('radio', { name: /edit/i });
    const promptField = screen.getByLabelText(/describe the scene/i);

    // Roving tabindex: only the checked radio is in the Tab sequence, and
    // arrow keys move focus AND selection within the "AI action" group —
    // Tab itself moves out of the group entirely (see
    // useRovingRadioGroup.ts).
    createRadio.focus();
    expect(createRadio).toHaveFocus();
    expect(createRadio).toHaveAttribute('tabindex', '0');
    expect(editRadio).toHaveAttribute('tabindex', '-1');

    await userEvent.keyboard('{ArrowRight}');
    expect(editRadio).toHaveFocus();
    expect(editRadio).toHaveAttribute('aria-checked', 'true');
    expect(editRadio).toHaveAttribute('tabindex', '0');
    expect(createRadio).toHaveAttribute('aria-checked', 'false');
    expect(createRadio).toHaveAttribute('tabindex', '-1');

    await userEvent.keyboard('{ArrowLeft}');
    expect(createRadio).toHaveFocus();
    expect(createRadio).toHaveAttribute('aria-checked', 'true');

    promptField.focus();
    await userEvent.keyboard('a circle');
    expect(promptField).toHaveValue('a circle');

    const generateButton = screen.getByRole('button', { name: /generate scene/i });
    generateButton.focus();
    await userEvent.keyboard('{Enter}');

    const acceptButton = await screen.findByTestId('ai-accept-button');
    acceptButton.focus();
    expect(acceptButton).toHaveFocus();
    await userEvent.keyboard('{Enter}');

    await waitFor(() => expect(mockedAcceptAIProposal).toHaveBeenCalledTimes(1));
  });
});

function makeRun(overrides: Partial<AIRun> = {}): AIRun {
  return {
    id: 1,
    status: 'running',
    target_type: 'project',
    project_id: 'p1',
    project3d_id: null,
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

// Issue #462: the "Agent workflow" toggle offered alongside the one-shot
// flow every test above exercises -- switching to it must never disturb
// that flow's own DOM/behavior (already proven by every passing test
// above, all of which stay in the default 'one-shot' workflow).
describe('AIProposalPanel Agent workflow', () => {
  it('toggles to the Agent workflow form and back without disturbing the one-shot fields', async () => {
    renderPanel();
    await userEvent.type(screen.getByLabelText(/describe the scene/i), 'a red circle');

    await userEvent.click(screen.getByRole('radio', { name: /agent workflow/i }));
    expect(screen.getByTestId('ai-run-form')).toBeInTheDocument();
    expect(screen.queryByRole('radio', { name: /^create$/i })).not.toBeInTheDocument();

    await userEvent.click(screen.getByRole('radio', { name: /one-shot/i }));
    expect(screen.getByLabelText(/describe the scene/i)).toHaveValue('a red circle');
  });

  it('starts an agent run, advances to an awaiting-review preview, and accepts it', async () => {
    mockedStartAIRun.mockResolvedValue(makeRun({ status: 'running' }));
    mockedAdvanceAIRun.mockResolvedValueOnce(
      makeRun({
        status: 'awaiting_review',
        attempts: 1,
        candidate_scene: VALID_SCENE,
        change_summary: 'Generated a scene.',
      }),
    );
    const acceptedVersion = makeVersion({ id: 9 });
    const { onAccepted } = renderPanel();
    // acceptAIRun itself isn't exercised by this test's mocks, so accept()
    // must resolve via the run's own accepted_version_id + a
    // getSceneVersion fetch -- set up both.
    vi.mocked(aiRunsApi.acceptAIRun).mockResolvedValue(
      makeRun({ status: 'accepted', accepted_version_id: 9, candidate_scene: VALID_SCENE }),
    );
    mockedGetSceneVersion.mockResolvedValue(acceptedVersion);

    await userEvent.click(screen.getByRole('radio', { name: /agent workflow/i }));
    await userEvent.type(screen.getByLabelText(/describe the scene/i), 'a red circle');
    await userEvent.click(screen.getByTestId('ai-run-start'));

    expect(mockedStartAIRun).toHaveBeenCalledWith(
      expect.objectContaining({ target_type: 'project', project_id: 'p1', operation: 'create' }),
    );

    await screen.findByTestId('ai-run-preview');
    expect(screen.getByTestId('ai-run-change-summary')).toHaveTextContent('Generated a scene.');

    await userEvent.click(screen.getByTestId('ai-run-accept'));

    await waitFor(() => expect(onAccepted).toHaveBeenCalledWith(acceptedVersion));
  });

  it('offers only shape objects (never a locked one) when editing a selection', async () => {
    const sceneWithShapes: SceneDocument = {
      ...VALID_SCENE,
      layers: [
        { id: 'layer-locked', name: 'Locked layer', order: 0, visible: true, locked: true },
        { id: 'layer-open', name: 'Open layer', order: 1, visible: true, locked: false },
      ],
      shapes: [
        {
          id: 'shape-locked',
          type: 'circle',
          layerId: 'layer-locked',
          groupId: null,
          transform: { x: 0, y: 0, scaleX: 1, scaleY: 1, rotation: 0, opacity: 1 },
          style: { fill: '#000000', stroke: null, strokeWidth: 0 },
          radius: 10,
        },
        {
          id: 'shape-open',
          type: 'rect',
          layerId: 'layer-open',
          groupId: null,
          transform: { x: 0, y: 0, scaleX: 1, scaleY: 1, rotation: 0, opacity: 1 },
          style: { fill: '#000000', stroke: null, strokeWidth: 0 },
          width: 10,
          height: 10,
        },
      ],
    };
    render(
      <AIProposalPanel
        projectId="p1"
        workingCopy={sceneWithShapes}
        currentVersionId={1}
        onAccepted={vi.fn()}
      />,
    );

    await userEvent.click(screen.getByRole('radio', { name: /agent workflow/i }));
    await userEvent.click(screen.getByRole('radio', { name: /edit selected layer\/object/i }));

    const openOption = screen.getByRole('option', { name: /Rectangle/i });
    expect(openOption).not.toBeDisabled();
    const lockedOption = screen.getByRole('option', { name: /Circle.*locked/i });
    expect(lockedOption).toBeDisabled();
  });
});
