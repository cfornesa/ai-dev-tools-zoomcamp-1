import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import * as aiApi from '../api/ai';
import { ApiError } from '../api/client';
import type { SceneDocument, SceneVersion } from '../api/projects';
import AIProposalPanel from './AIProposalPanel';

vi.mock('../api/ai');

const mockedCreateAIScene = vi.mocked(aiApi.createAIScene);
const mockedEditAIScene = vi.mocked(aiApi.editAIScene);
const mockedAcceptAIProposal = vi.mocked(aiApi.acceptAIProposal);

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
    );
  });

  it('sends a typed model id and remembers it in localStorage across a fresh mount', async () => {
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
    await userEvent.type(screen.getByLabelText(/mistral model/i), 'codestral-2405');
    await userEvent.click(screen.getByRole('button', { name: /generate scene/i }));

    await screen.findByTestId('ai-proposal-success');
    expect(mockedCreateAIScene).toHaveBeenCalledWith(
      'p1',
      'a red circle',
      expect.anything(),
      'codestral-2405',
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
    expect(screen.getByLabelText(/mistral model/i)).toHaveValue('codestral-2405');
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
    await userEvent.type(screen.getByLabelText(/mistral model/i), 'Not Valid!');
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
