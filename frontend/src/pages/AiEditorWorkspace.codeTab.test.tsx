import { fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import * as projectsApi from '../api/projects';
import type { Project, SceneVersion } from '../api/projects';
import AiEditorWorkspace from './AiEditorWorkspace';

/**
 * Issue #225: the embedded Code tab, reusing jsonCodeSync.tsx's
 * useJsonCodeSync/SceneCodeEditor (extracted from EditorWorkspace.tsx,
 * unchanged) -- see EditorWorkspace.codeTab.test.tsx for the exhaustive
 * sync-behavior coverage already exercised there. These tests cover only
 * what's specific to this route: the Visual/Code toggle exists, a valid
 * edit reaches the working scene, and an invalid edit is rejected via the
 * same validateScene path (never applied, never sent to the server).
 */

vi.mock('../api/projects');

const mockedGetProject = vi.mocked(projectsApi.getProject);
const mockedGetSceneVersion = vi.mocked(projectsApi.getSceneVersion);

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

describe('AiEditorWorkspace Code tab', () => {
  it('toggles between Visual and Code views', async () => {
    mockedGetProject.mockResolvedValue(baseProject());
    mockedGetSceneVersion.mockResolvedValue(baseVersion());

    renderWorkspace();
    await screen.findByRole('region', { name: 'Preview' });
    expect(screen.queryByRole('region', { name: 'Code' })).not.toBeInTheDocument();

    const user = userEvent.setup();
    await user.click(screen.getByRole('radio', { name: 'Code' }));

    expect(await screen.findByRole('region', { name: 'Code' })).toBeInTheDocument();
    expect(screen.getByTestId('editor-scene-code-textarea')).toHaveValue(
      JSON.stringify(BLANK_SCENE, null, 2),
    );
  });

  it('applies a valid JSON edit to the working scene on blur', async () => {
    mockedGetProject.mockResolvedValue(baseProject());
    mockedGetSceneVersion.mockResolvedValue(baseVersion());

    renderWorkspace();
    await screen.findByRole('region', { name: 'Preview' });
    const user = userEvent.setup();
    await user.click(screen.getByRole('radio', { name: 'Code' }));

    const textarea = await screen.findByTestId('editor-scene-code-textarea');
    const edited = {
      ...BLANK_SCENE,
      canvas: { ...BLANK_SCENE.canvas, backgroundColor: '#123456' },
    };
    fireEvent.change(textarea, { target: { value: JSON.stringify(edited, null, 2) } });
    fireEvent.blur(textarea);

    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
    // Switching to Visual and back re-syncs the textarea from the (now
    // updated) working scene -- proves the edit actually reached it.
    await user.click(screen.getByRole('radio', { name: 'Visual' }));
    await user.click(screen.getByRole('radio', { name: 'Code' }));
    expect(await screen.findByTestId('editor-scene-code-textarea')).toHaveValue(
      JSON.stringify(edited, null, 2),
    );
  });

  it('rejects an invalid JSON edit without applying it', async () => {
    mockedGetProject.mockResolvedValue(baseProject());
    mockedGetSceneVersion.mockResolvedValue(baseVersion());

    renderWorkspace();
    await screen.findByRole('region', { name: 'Preview' });
    const user = userEvent.setup();
    await user.click(screen.getByRole('radio', { name: 'Code' }));

    const textarea = await screen.findByTestId('editor-scene-code-textarea');
    fireEvent.change(textarea, { target: { value: '{ not valid json' } });
    fireEvent.blur(textarea);

    expect(await screen.findByRole('alert')).toHaveTextContent(/invalid scene json/i);
  });
});
