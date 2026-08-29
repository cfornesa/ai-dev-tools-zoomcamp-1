import { fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { ApiError } from '../api/client';
import * as projectsApi from '../api/projects';
import type { Project, SceneVersion } from '../api/projects';
import AiEditorWorkspace from './AiEditorWorkspace';

vi.mock('../api/projects');

const mockedGetProject = vi.mocked(projectsApi.getProject);
const mockedGetSceneVersion = vi.mocked(projectsApi.getSceneVersion);
const mockedUpdateProjectMetadata = vi.mocked(projectsApi.updateProjectMetadata);

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

describe('AiEditorWorkspace', () => {
  it('shows an accessible loading state while the project/version fetch is in flight', () => {
    mockedGetProject.mockReturnValue(new Promise(() => {}));

    renderWorkspace();

    expect(screen.getByRole('status')).toHaveTextContent(/loading ai-assisted editor/i);
  });

  it('renders the preview region and title once loaded', async () => {
    mockedGetProject.mockResolvedValue(baseProject());
    mockedGetSceneVersion.mockResolvedValue(baseVersion());

    renderWorkspace();

    await screen.findByRole('region', { name: 'Preview' });
    expect(screen.getByLabelText('Project title')).toHaveValue('My AI animation');
  });

  it('shows access-denied for a 404', async () => {
    mockedGetProject.mockRejectedValue(new ApiError(404, null));

    renderWorkspace();

    expect(await screen.findByRole('alert')).toHaveTextContent(/don't have access/i);
  });

  it('shows a no-scene message when the project has no current version', async () => {
    mockedGetProject.mockResolvedValue(baseProject({ current_version: null }));

    renderWorkspace();

    expect(await screen.findByRole('alert')).toHaveTextContent(/no saved scene/i);
  });

  it('saves the title on blur when it changed', async () => {
    mockedGetProject.mockResolvedValue(baseProject());
    mockedGetSceneVersion.mockResolvedValue(baseVersion());
    mockedUpdateProjectMetadata.mockResolvedValue(baseProject({ title: 'Renamed' }));

    renderWorkspace();

    const input = await screen.findByLabelText('Project title');
    fireEvent.change(input, { target: { value: 'Renamed' } });
    fireEvent.blur(input);

    await vi.waitFor(() => {
      expect(mockedUpdateProjectMetadata).toHaveBeenCalledWith('p1', { title: 'Renamed' });
    });
  });
});
