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
 * Issue #159: `previewError`'s localized-message and "Ask AI to fix this"
 * affordances. `p5Adapter.ts` is mocked here (unlike
 * `EditorWorkspace.codeTab.test.tsx`'s general Code-tab coverage, which
 * exercises the real p5/jsdom-canvas pipeline) so `render()` can be forced
 * to throw a controlled, exact-message `SceneRenderError`-shaped error on
 * demand — the most direct way to exercise the localization regex against
 * a known message without needing to coax the real p5/`sceneDrawPlan.ts`
 * pipeline into an actual render failure.
 */

const { renderMock, destroyMock } = vi.hoisted(() => ({
  renderMock: vi.fn(),
  destroyMock: vi.fn(),
}));

vi.mock('../render/p5Adapter', () => ({
  createP5ScenePreview: vi.fn(() => ({
    render: renderMock,
    destroy: destroyMock,
    getCanvasElement: vi.fn(() => null),
  })),
}));

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

async function loadWorkspaceWithRenderFailure(message: string) {
  renderMock.mockImplementation(() => {
    throw new Error(message);
  });
  mockedGetProject.mockResolvedValue(baseProject());
  mockedGetSceneVersion.mockResolvedValue(baseVersion());
  renderWorkspace();
  await screen.findByRole('region', { name: 'Tools' });
  expandAllCollapsibleSections();
  await userEvent.setup().click(screen.getByRole('button', { name: 'Edit scene' }));
  await screen.findByTestId('editor-preview-error');
}

beforeEach(() => {
  vi.clearAllMocks();
  mockedListSceneVersions.mockResolvedValue([baseSummary()]);
});

// The exact message shape render/sceneDrawPlan.ts's `buildScenePlan` throws
// for a shape whose `layerId` doesn't resolve — its pre-pass check, before
// the `validateScene` backstop ever runs. See that module's `readShape`/
// dangling-reference check.
const LOCALIZABLE_MESSAGE =
  'shapes[0] (id "circle-1").layerId: "missing-layer" does not match any layer.';

describe('previewError localization', () => {
  it('extends the generic message with a derived JSON Pointer/field location for a localizable failure', async () => {
    await loadWorkspaceWithRenderFailure(LOCALIZABLE_MESSAGE);

    const alert = screen.getByTestId('editor-preview-error');
    expect(alert).toHaveTextContent("Couldn't render the preview:");
    expect(alert).toHaveTextContent('$.shapes[0].layerId');
    expect(alert).toHaveTextContent('missing-layer" does not match any layer.');
  });

  it('falls back to the plain message for a non-localizable/generic crash', async () => {
    await loadWorkspaceWithRenderFailure('Cannot read properties of undefined (reading "x")');

    const alert = screen.getByTestId('editor-preview-error');
    expect(alert).toHaveTextContent(
      'Couldn\'t render the preview: Cannot read properties of undefined (reading "x")',
    );
    expect(alert).not.toHaveTextContent('$.');
  });

  it('extends the message for the validateScene-backstop error shape too', async () => {
    await loadWorkspaceWithRenderFailure(
      'Cannot render an invalid scene: $.shapes[0].layerId — layerId does not match any layer.',
    );

    const alert = screen.getByTestId('editor-preview-error');
    expect(alert).toHaveTextContent('$.shapes[0].layerId — layerId does not match any layer.');
  });
});

describe('"Ask AI to fix this"', () => {
  it('appears next to a previewError and opens AIProposalPanel in edit mode seeded with the localized error', async () => {
    await loadWorkspaceWithRenderFailure(LOCALIZABLE_MESSAGE);
    const user = userEvent.setup();

    expect(screen.queryByTestId('editor-ai-fix-panel')).not.toBeInTheDocument();

    await user.click(screen.getByTestId('ask-ai-fix-preview-error'));

    const panel = screen.getByTestId('editor-ai-fix-panel');
    expect(panel).toBeInTheDocument();

    // Edit mode is selected (not Create) inside the seeded panel.
    const editRadio = within(panel).getByRole('radio', { name: 'Edit' });
    expect(editRadio).toHaveAttribute('aria-checked', 'true');

    // The prompt is pre-seeded with the localized pointer/field info.
    const promptField = within(panel).getByLabelText(/describe the change/i) as HTMLTextAreaElement;
    expect(promptField.value).toContain('$.shapes[0].layerId');
    expect(promptField.value).toContain('missing-layer');
  });

  it('generating from the seeded panel sends the erroring workingCopy as current_scene via the existing editAIScene path', async () => {
    await loadWorkspaceWithRenderFailure(LOCALIZABLE_MESSAGE);
    const user = userEvent.setup();
    await user.click(screen.getByTestId('ask-ai-fix-preview-error'));

    mockedEditAIScene.mockResolvedValue({
      draft: true,
      operation: 'edit_scene',
      scene: BLANK_SCENE,
      change_summary: 'Removed the dangling layerId reference.',
      patch: [],
      usage: { prompt_tokens: 1, completion_tokens: 1, total_tokens: 2, estimated_cost_usd: 0 },
    });

    const panel = screen.getByTestId('editor-ai-fix-panel');
    await user.click(within(panel).getByRole('button', { name: /propose edit/i }));

    expect(mockedEditAIScene).toHaveBeenCalledTimes(1);
    const [, promptArg, currentSceneArg] = mockedEditAIScene.mock.calls[0];
    expect(promptArg).toContain('$.shapes[0].layerId');
    expect(currentSceneArg).toEqual(BLANK_SCENE);
  });

  it('closes automatically once the render failure is resolved', async () => {
    await loadWorkspaceWithRenderFailure(LOCALIZABLE_MESSAGE);
    const user = userEvent.setup();
    await user.click(screen.getByTestId('ask-ai-fix-preview-error'));
    expect(screen.getByTestId('editor-ai-fix-panel')).toBeInTheDocument();

    renderMock.mockImplementation(() => {});
    await user.click(screen.getByRole('button', { name: 'Add circle' }));

    expect(await screen.findByText(/1 shape\(s\) in the working copy/)).toBeInTheDocument();
    expect(screen.queryByTestId('editor-preview-error')).not.toBeInTheDocument();
    expect(screen.queryByTestId('editor-ai-fix-panel')).not.toBeInTheDocument();
  });
});
