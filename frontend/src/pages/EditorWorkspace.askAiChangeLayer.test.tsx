import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import * as aiApi from '../api/ai';
import * as projectsApi from '../api/projects';
import type { Project, SceneVersion, SceneVersionSummary } from '../api/projects';
import EditorWorkspace from './EditorWorkspace';
import { expandAllCollapsibleSections } from '../testUtils/expandCollapsibleSections';

/**
 * Issue #282: each `LayersPanel.tsx` row (layer/group/shape) gets an "Ask
 * AI to change this" action seeding `AIProposalPanel`'s Edit-mode prompt
 * with a reference to that item by name — mirrors #159's "Ask AI to fix
 * this" seed mechanism
 * (`EditorWorkspace.previewErrorLocalization.test.tsx`) exactly, but as an
 * independent panel/state pair, not a reuse of that one (see
 * `EditorWorkspace.tsx`'s `showAiLayerPanel` doc comment for why).
 */

vi.mock('../api/projects');
vi.mock('../api/ai');

const mockedGetProject = vi.mocked(projectsApi.getProject);
const mockedGetSceneVersion = vi.mocked(projectsApi.getSceneVersion);
const mockedListSceneVersions = vi.mocked(projectsApi.listSceneVersions);
const mockedEditAIScene = vi.mocked(aiApi.editAIScene);

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

function circleShape(id: string, overrides: Record<string, unknown> = {}) {
  return {
    id,
    type: 'circle',
    layerId: 'layer-1',
    groupId: null,
    transform: { x: 100, y: 100, scaleX: 1, scaleY: 1, rotation: 0, opacity: 1 },
    style: { fill: '#4f46e5', stroke: null, strokeWidth: 0 },
    radius: 20,
    ...overrides,
  };
}

function baseScene(overrides: Record<string, unknown> = {}) {
  return {
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
    ...overrides,
  };
}

function baseVersion(scene: unknown, overrides: Partial<SceneVersion> = {}): SceneVersion {
  return {
    id: 1,
    sequence: 1,
    origin: 'manual',
    change_label: null,
    created_by: 'alice',
    parent: null,
    fork_source_version: null,
    created_at: '2026-01-01T00:00:00Z',
    scene_json: scene as SceneVersion['scene_json'],
    ...overrides,
  };
}

function baseSummary(overrides: Partial<SceneVersionSummary> = {}): SceneVersionSummary {
  const { scene_json: _scene_json, ...rest } = baseVersion(baseScene(), overrides);
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

async function loadWorkspaceWithShape() {
  const scene = baseScene({ shapes: [circleShape('shape-a')] });
  mockedGetProject.mockResolvedValue(baseProject());
  mockedGetSceneVersion.mockResolvedValue(baseVersion(scene));
  mockedListSceneVersions.mockResolvedValue([baseSummary()]);
  renderWorkspace();
  await screen.findByRole('region', { name: 'Tools' });
  expandAllCollapsibleSections();
  await screen.findByRole('button', { name: /ask ai to change layer 1/i });
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe('"Ask AI to change this" (LayersPanel rows)', () => {
  it('offers the action on the layer row and seeds the Edit-mode prompt with its name', async () => {
    await loadWorkspaceWithShape();
    const user = userEvent.setup();

    expect(screen.queryByTestId('editor-ai-layer-panel')).not.toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: /ask ai to change layer 1/i }));

    const panel = screen.getByTestId('editor-ai-layer-panel');
    expect(panel).toBeInTheDocument();

    const editRadio = within(panel).getByRole('radio', { name: 'Edit' });
    expect(editRadio).toHaveAttribute('aria-checked', 'true');

    const promptField = within(panel).getByLabelText(/describe the change/i) as HTMLTextAreaElement;
    expect(promptField.value).toContain('Layer 1');
  });

  it('offers the action on a shape row and seeds the prompt with the shape label', async () => {
    await loadWorkspaceWithShape();
    const user = userEvent.setup();

    await user.click(screen.getByRole('button', { name: /ask ai to change circle 1/i }));

    const panel = screen.getByTestId('editor-ai-layer-panel');
    const promptField = within(panel).getByLabelText(/describe the change/i) as HTMLTextAreaElement;
    expect(promptField.value).toContain('Circle 1');
  });

  it('never auto-submits — generating still goes through the existing editAIScene path only after an explicit click', async () => {
    await loadWorkspaceWithShape();
    const user = userEvent.setup();
    await user.click(screen.getByRole('button', { name: /ask ai to change layer 1/i }));

    expect(mockedEditAIScene).not.toHaveBeenCalled();

    mockedEditAIScene.mockResolvedValue({
      draft: true,
      operation: 'edit_scene',
      scene: baseScene(),
      change_summary: 'Recolored the layer.',
      patch: [],
      usage: { prompt_tokens: 1, completion_tokens: 1, total_tokens: 2, estimated_cost_usd: 0 },
    });

    const panel = screen.getByTestId('editor-ai-layer-panel');
    await user.click(within(panel).getByRole('button', { name: /propose edit/i }));

    expect(mockedEditAIScene).toHaveBeenCalledTimes(1);
    const [, promptArg] = mockedEditAIScene.mock.calls[0];
    expect(promptArg).toContain('Layer 1');
  });

  it('can be closed without submitting', async () => {
    await loadWorkspaceWithShape();
    const user = userEvent.setup();
    await user.click(screen.getByRole('button', { name: /ask ai to change layer 1/i }));
    expect(screen.getByTestId('editor-ai-layer-panel')).toBeInTheDocument();

    await user.click(screen.getByTestId('close-ai-layer-panel'));

    expect(screen.queryByTestId('editor-ai-layer-panel')).not.toBeInTheDocument();
    expect(mockedEditAIScene).not.toHaveBeenCalled();
  });
});

describe('"Ask AI to improve this scene" (whole-scene, issue #283)', () => {
  it('offers an unscoped action that seeds a generic Edit-mode prompt', async () => {
    await loadWorkspaceWithShape();
    const user = userEvent.setup();

    await user.click(screen.getByRole('button', { name: 'Ask AI to improve this scene' }));

    const panel = screen.getByTestId('editor-ai-layer-panel');
    const editRadio = within(panel).getByRole('radio', { name: 'Edit' });
    expect(editRadio).toHaveAttribute('aria-checked', 'true');
    const promptField = within(panel).getByLabelText(/describe the change/i) as HTMLTextAreaElement;
    expect(promptField.value).toBe('Improve this scene: ');
  });
});
