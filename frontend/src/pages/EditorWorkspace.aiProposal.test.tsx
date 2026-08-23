import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import * as aiApi from '../api/ai';
import * as projectsApi from '../api/projects';
import type { Project, SceneVersion, SceneVersionSummary } from '../api/projects';
import EditorWorkspace from './EditorWorkspace';
import { expandAllCollapsibleSections } from '../testUtils/expandCollapsibleSections';

/**
 * Task 48: rendered integration tests for the AI proposal panel embedded
 * in the editor workspace — specifically the two properties that only
 * show up at this integration level (not in AIProposalPanel.test.tsx's
 * isolated unit tests): Reject leaving BOTH the saved version and any
 * pre-existing unsaved working edits completely untouched, and Accept
 * actually updating the workspace's persisted-version/current-version
 * state the same way Save/Restore already do.
 */

vi.mock('../api/projects');
vi.mock('../api/ai');

const mockedGetProject = vi.mocked(projectsApi.getProject);
const mockedGetSceneVersion = vi.mocked(projectsApi.getSceneVersion);
const mockedListSceneVersions = vi.mocked(projectsApi.listSceneVersions);
const mockedCreateAIScene = vi.mocked(aiApi.createAIScene);
const mockedAcceptAIProposal = vi.mocked(aiApi.acceptAIProposal);

function baseProject(overrides: Partial<Project> = {}): Project {
  return {
    id: 'p1',
    owner: 'alice',
    title: 'My animation',
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

function baseSummary(overrides: Partial<SceneVersionSummary> = {}): SceneVersionSummary {
  const { scene_json: _scene_json, ...rest } = baseVersion(overrides);
  return rest;
}

function renderWorkspace() {
  return render(
    <MemoryRouter initialEntries={['/projects/p1']}>
      <Routes>
        <Route path="/" element={<p>Gallery placeholder</p>} />
        <Route path="/projects/:id" element={<EditorWorkspace />} />
      </Routes>
    </MemoryRouter>,
  );
}

async function loadReadyWorkspace() {
  mockedGetProject.mockResolvedValue(baseProject());
  mockedGetSceneVersion.mockResolvedValue(baseVersion());
  renderWorkspace();
  await screen.findByRole('region', { name: 'Tools' });
  expandAllCollapsibleSections();
}

async function generateProposal(user: ReturnType<typeof userEvent.setup>) {
  mockedCreateAIScene.mockResolvedValue({
    draft: true,
    operation: 'create_scene',
    scene: { ...BLANK_SCENE, canvas: { ...BLANK_SCENE.canvas, backgroundColor: '#123456' } },
    usage: { prompt_tokens: 1, completion_tokens: 1, total_tokens: 2, estimated_cost_usd: 0 },
  });
  await user.type(screen.getByLabelText(/describe the scene/i), 'a scene');
  await user.click(screen.getByRole('button', { name: /generate scene/i }));
  await screen.findByTestId('ai-proposal-success');
}

beforeEach(() => {
  vi.clearAllMocks();
  mockedListSceneVersions.mockResolvedValue([baseSummary()]);
});

describe('AI proposal Reject leaves state untouched', () => {
  it('Reject with no pre-existing unsaved edits leaves the saved/working state exactly as it was', async () => {
    await loadReadyWorkspace();
    const user = userEvent.setup();

    expect(screen.getByTestId('editor-save-status')).toHaveTextContent('Saved as version 1');

    await generateProposal(user);
    await user.click(screen.getByTestId('ai-reject-button'));

    expect(mockedAcceptAIProposal).not.toHaveBeenCalled();
    expect(screen.getByTestId('editor-save-status')).toHaveTextContent('Saved as version 1');
    expect(screen.queryByTestId('ai-proposal-success')).not.toBeInTheDocument();
  });

  it('Reject with a pre-existing unsaved edit preserves that exact unsaved working state', async () => {
    await loadReadyWorkspace();
    const user = userEvent.setup();

    // Make an unsaved edit before ever touching the AI panel.
    await user.click(screen.getByRole('button', { name: 'Add circle' }));
    expect(screen.getByTestId('editor-save-status')).toHaveTextContent('Unsaved changes');
    const shapeCountBeforeProposal = screen.getByText(/shape\(s\) in the working copy/).textContent;

    await generateProposal(user);
    await user.click(screen.getByTestId('ai-reject-button'));

    // The unsaved edit from before opening the AI panel is exactly as it
    // was — the proposal never touched workingCopy, and rejecting it
    // didn't either.
    expect(screen.getByTestId('editor-save-status')).toHaveTextContent('Unsaved changes');
    expect(screen.getByText(/shape\(s\) in the working copy/).textContent).toBe(
      shapeCountBeforeProposal,
    );
    expect(mockedAcceptAIProposal).not.toHaveBeenCalled();
  });
});

describe('AI proposal Accept updates workspace state', () => {
  it('Accept creates the new current version and reflects it as the saved state', async () => {
    await loadReadyWorkspace();
    const user = userEvent.setup();

    await generateProposal(user);

    const acceptedVersion = baseVersion({
      id: 2,
      sequence: 2,
      origin: 'ai_create',
      scene_json: { ...BLANK_SCENE, canvas: { ...BLANK_SCENE.canvas, backgroundColor: '#123456' } },
    });
    mockedAcceptAIProposal.mockResolvedValue(acceptedVersion);

    await user.click(screen.getByTestId('ai-accept-button'));

    await waitFor(() =>
      expect(screen.getByTestId('editor-save-status')).toHaveTextContent('Saved as version 2'),
    );
    expect(screen.queryByTestId('ai-proposal-success')).not.toBeInTheDocument();
  });
});
