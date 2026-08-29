import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import * as aiApi from '../api/ai';
import * as projectsApi from '../api/projects';
import type { Project, SceneVersion } from '../api/projects';
import AiEditorWorkspace from './AiEditorWorkspace';

/**
 * Issue #224: the prompt-driven create/edit flow, mounted as this
 * editor's primary interaction surface. Reuses AIProposalPanel/
 * useAIProposal wholesale (already covered by AIProposalPanel.test.tsx
 * and EditorWorkspace.aiProposal.test.tsx) -- these tests cover only what's
 * specific to this integration: the panel is present without needing to
 * expand any collapsible section, and Accept updates local state so a
 * follow-up Edit-mode prompt is generated against the newly created scene.
 */

vi.mock('../api/projects');
vi.mock('../api/ai');

const mockedGetProject = vi.mocked(projectsApi.getProject);
const mockedGetSceneVersion = vi.mocked(projectsApi.getSceneVersion);
const mockedCreateAIScene = vi.mocked(aiApi.createAIScene);
const mockedEditAIScene = vi.mocked(aiApi.editAIScene);
const mockedAcceptAIProposal = vi.mocked(aiApi.acceptAIProposal);

function baseProject(overrides: Partial<Project> = {}): Project {
  return {
    id: 'p1',
    owner: 'alice',
    title: 'My AI animation',
    description: '',
    tags: [],
    visibility: 'private',
    allow_public_remix: false,
    export_attribution: false,
    thumbnail_url: null,
    current_version: 1,
    created_at: '2026-01-01T00:00:00Z',
    updated_at: '2026-01-02T00:00:00Z',
    ...overrides,
  };
}

const BLANK_SCENE = {
  schemaVersion: 1,
  id: 'scene-blank',
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

function baseVersion(overrides: Partial<SceneVersion> = {}): SceneVersion {
  return {
    id: 1,
    sequence: 1,
    origin: 'manual',
    change_label: null,
    created_by: 'alice',
    parent: null,
    fork_source_version: null,
    created_at: '2026-01-01T00:00:00Z',
    scene_json: BLANK_SCENE,
    ...overrides,
  };
}

function renderWorkspace() {
  return render(
    <MemoryRouter initialEntries={['/ai-projects/p1']}>
      <Routes>
        <Route path="/ai-projects/:id" element={<AiEditorWorkspace />} />
      </Routes>
    </MemoryRouter>,
  );
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe('AiEditorWorkspace AI prompt flow', () => {
  it('shows the AI assistant panel directly, with no collapsible section to expand', async () => {
    mockedGetProject.mockResolvedValue(baseProject());
    mockedGetSceneVersion.mockResolvedValue(baseVersion());

    renderWorkspace();

    await screen.findByRole('region', { name: 'AI assistant' });
    expect(screen.getByLabelText(/describe the scene/i)).toBeInTheDocument();
  });

  it('a follow-up Edit prompt is generated against the scene from the last accepted proposal', async () => {
    mockedGetProject.mockResolvedValue(baseProject());
    mockedGetSceneVersion.mockResolvedValue(baseVersion());
    const user = userEvent.setup();

    renderWorkspace();
    await screen.findByRole('region', { name: 'AI assistant' });

    const createdScene = {
      ...BLANK_SCENE,
      shapes: [
        {
          id: 's1',
          type: 'circle',
          name: 'Sun',
          layerId: 'layer-1',
          groupId: null,
          transform: { x: 100, y: 100, scaleX: 1, scaleY: 1, rotation: 0, opacity: 1 },
          style: { fill: '#ffdd00', stroke: null, strokeWidth: 0 },
          radius: 20,
        },
      ],
    };
    mockedCreateAIScene.mockResolvedValue({
      draft: true,
      operation: 'create_scene',
      scene: createdScene,
      usage: { prompt_tokens: 1, completion_tokens: 1, total_tokens: 2, estimated_cost_usd: 0 },
    });

    await user.type(screen.getByLabelText(/describe the scene/i), 'add a sun');
    await user.click(screen.getByRole('button', { name: /generate scene/i }));
    await screen.findByTestId('ai-proposal-success');

    const acceptedVersion = baseVersion({ id: 2, sequence: 2, scene_json: createdScene });
    mockedAcceptAIProposal.mockResolvedValue(acceptedVersion);
    await user.click(screen.getByTestId('ai-accept-button'));
    await vi.waitFor(() => expect(mockedAcceptAIProposal).toHaveBeenCalled());

    // Switch to Edit mode and issue a follow-up prompt referencing "Sun" by name.
    await user.click(screen.getByRole('radio', { name: 'Edit' }));
    mockedEditAIScene.mockResolvedValue({
      draft: true,
      operation: 'edit_scene',
      scene: createdScene,
      patch: [],
      change_summary: 'Made Sun bigger.',
      usage: { prompt_tokens: 1, completion_tokens: 1, total_tokens: 2, estimated_cost_usd: 0 },
    });
    await user.type(screen.getByLabelText(/describe the change/i), 'make Sun bigger');
    await user.click(screen.getByRole('button', { name: /propose edit/i }));

    await vi.waitFor(() => expect(mockedEditAIScene).toHaveBeenCalled());
    // The scene passed as "current" to editAIScene is the just-accepted one, not BLANK_SCENE.
    const [, , currentSceneArg] = mockedEditAIScene.mock.calls[0];
    expect(currentSceneArg).toEqual(createdScene);
  });
});
