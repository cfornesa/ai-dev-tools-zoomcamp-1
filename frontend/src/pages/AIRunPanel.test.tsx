import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import * as aiPreferencesApi from '../api/aiPreferences';
import type { AIRun } from '../api/aiRuns';
import type { SceneVersion } from '../api/projects';
import type { UseAIRunResult } from './useAIRun';
import AIRunPanel from './AIRunPanel';

vi.mock('../api/aiPreferences');

const runBase: AIRun = {
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
  plan: {
    revision: 1,
    scope: 'overhaul',
    steps: [{ id: 'step-1', action: 'generate_scene', target_ids: [] }],
    target_ids: [],
    success_criteria: [{ type: 'renders_nonblank', parameters: {} }],
  },
  auto_retry_enabled: true,
  max_retries: 2,
  retries_remaining: 2,
  criterion_results: [],
  validation_summary: '',
  error_reason: '',
  usage: { prompt_tokens: 0, completion_tokens: 0, estimated_cost_usd: 0 },
  accepted_version_id: null,
  created_at: '2026-01-01T00:00:00Z',
  updated_at: '2026-01-01T00:00:00Z',
  deadline_at: '2026-01-01T00:02:00Z',
  cancelled_at: null,
};

function makeAiRun(run: AIRun, approve = vi.fn()): UseAIRunResult<SceneVersion> {
  return {
    targetMode: 'create',
    setTargetMode: vi.fn(),
    selectedShapeId: null,
    setSelectedShapeId: vi.fn(),
    prompt: 'make a circle',
    setPrompt: vi.fn(),
    vendor: 'mistral',
    setVendor: vi.fn(),
    model: '',
    setModel: vi.fn(),
    personaId: null,
    setPersonaId: vi.fn(),
    run,
    starting: false,
    startError: null,
    advanceError: null,
    accepting: false,
    acceptError: null,
    reconnecting: false,
    start: vi.fn(),
    approve,
    stop: vi.fn(),
    accept: vi.fn(),
    dismiss: vi.fn(),
  } as unknown as UseAIRunResult<SceneVersion>;
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(aiPreferencesApi.fetchSavedAIModelPreferences).mockResolvedValue([]);
  vi.mocked(aiPreferencesApi.fetchAIPersonas).mockResolvedValue([]);
});

describe('AIRunPanel plan review', () => {
  it('shows the plan and waits for explicit approval', async () => {
    const approve = vi.fn();
    render(
      <AIRunPanel
        aiRun={makeAiRun(runBase, approve)}
        workingCopy={null}
        onAccepted={vi.fn()}
        selectableObjects={[]}
        renderCandidatePreview={() => null}
      />,
    );

    expect(screen.getByTestId('ai-run-plan-review')).toBeInTheDocument();
    expect(screen.getByText('generate_scene')).toBeInTheDocument();
    expect(screen.getByTestId('ai-run-plan-scope')).toHaveTextContent('Scope: overhaul');
    expect(screen.getByText('renders_nonblank')).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Approve plan' }));
    expect(approve).toHaveBeenCalledOnce();
  });

  it('shows attempt count and each criterion result after implementation starts', () => {
    render(
      <AIRunPanel
        aiRun={makeAiRun({
          ...runBase,
          attempts: 2,
          criterion_results: [
            {
              attempt: 1,
              results: [
                {
                  type: 'renders_nonblank',
                  parameters: {},
                  passed: false,
                  detail: 'Candidate scene was blank.',
                },
              ],
            },
          ],
          validation_summary: 'Candidate scene was blank.',
        })}
        workingCopy={null}
        onAccepted={vi.fn()}
        selectableObjects={[]}
        renderCandidatePreview={() => null}
      />,
    );

    expect(screen.getByText('Attempts (2 of 3)')).toBeInTheDocument();
    expect(screen.getAllByText(/Candidate scene was blank/).length).toBeGreaterThanOrEqual(1);
    expect(screen.getByLabelText('Failed')).toBeInTheDocument();
  });
});
