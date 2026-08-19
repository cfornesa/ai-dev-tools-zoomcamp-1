import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { axe } from 'jest-axe';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import * as aiApi from '../api/ai';
import { ApiError } from '../api/client';
import type { SceneDocument } from '../api/projects';
import Layout from '../components/Layout';
import AIProposalPanel from './AIProposalPanel';

/**
 * Task 63 (issue #63): automated accessibility checks for the AI proposal
 * panel's six documented states (Task 48) — prompt entry, pending,
 * success, and the three error states (validation/quota/provider).
 */

vi.mock('../api/ai');

const mockedCreateAIScene = vi.mocked(aiApi.createAIScene);

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

function renderPanel() {
  return render(
    <MemoryRouter initialEntries={['/projects/p1']}>
      <Routes>
        <Route path="/" element={<Layout />}>
          <Route
            path="projects/:id"
            element={
              // A bare h2/h3 ancestor, matching `EditorWorkspace.tsx`'s real
              // nesting (this panel's own top-level heading is an `<h4>`,
              // valid only with that ancestor present) — see
              // `VersionHistoryPanel.a11y.test.tsx`'s identical comment.
              <>
                <h2>My animation</h2>
                <h3>AI section</h3>
                <AIProposalPanel
                  projectId="p1"
                  workingCopy={VALID_SCENE}
                  currentVersionId={1}
                  onAccepted={vi.fn()}
                />
              </>
            }
          />
        </Route>
      </Routes>
    </MemoryRouter>,
  );
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe('AIProposalPanel accessibility', () => {
  it('has no axe violations in the prompt state', async () => {
    const { container } = renderPanel();
    await screen.findByLabelText(/describe the scene/i);
    expect(await axe(container)).toHaveNoViolations();
  });

  it('has no axe violations in the pending state', async () => {
    mockedCreateAIScene.mockReturnValue(new Promise(() => {}));
    const { container } = renderPanel();
    await userEvent.type(screen.getByLabelText(/describe the scene/i), 'a red circle');
    await userEvent.click(screen.getByRole('button', { name: /generate scene/i }));
    await screen.findByTestId('ai-pending-status');
    expect(await axe(container)).toHaveNoViolations();
  });

  it('has no axe violations in the success state', async () => {
    mockedCreateAIScene.mockResolvedValue({
      draft: true,
      operation: 'create_scene',
      scene: VALID_SCENE,
      usage: { prompt_tokens: 1, completion_tokens: 1, total_tokens: 2, estimated_cost_usd: 0 },
    });
    const { container } = renderPanel();
    await userEvent.type(screen.getByLabelText(/describe the scene/i), 'a red circle');
    await userEvent.click(screen.getByRole('button', { name: /generate scene/i }));
    await screen.findByTestId('ai-proposal-success');
    expect(await axe(container)).toHaveNoViolations();
  });

  it('has no axe violations in the validation-error state', async () => {
    mockedCreateAIScene.mockRejectedValue(
      new ApiError(400, { error: 'prompt_invalid', detail: 'Prompt is required.' }),
    );
    const { container } = renderPanel();
    await userEvent.type(screen.getByLabelText(/describe the scene/i), 'x');
    await userEvent.click(screen.getByRole('button', { name: /generate scene/i }));
    await screen.findByTestId('ai-error-validation-error');
    expect(await axe(container)).toHaveNoViolations();
  });

  it('has no axe violations in the quota-error state', async () => {
    mockedCreateAIScene.mockRejectedValue(
      new ApiError(429, { error: 'quota_exceeded', detail: 'Daily limit reached.' }),
    );
    const { container } = renderPanel();
    await userEvent.type(screen.getByLabelText(/describe the scene/i), 'x');
    await userEvent.click(screen.getByRole('button', { name: /generate scene/i }));
    await screen.findByTestId('ai-error-quota-error');
    expect(await axe(container)).toHaveNoViolations();
  });

  it('has no axe violations in the provider-error state', async () => {
    mockedCreateAIScene.mockRejectedValue(
      new ApiError(502, { error: 'provider_failure', detail: 'Upstream failure.' }),
    );
    const { container } = renderPanel();
    await userEvent.type(screen.getByLabelText(/describe the scene/i), 'x');
    await userEvent.click(screen.getByRole('button', { name: /generate scene/i }));
    await screen.findByTestId('ai-error-provider-error');
    expect(await axe(container)).toHaveNoViolations();
  });
});
