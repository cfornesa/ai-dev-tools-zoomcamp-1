import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import * as projectsApi from '../api/projects';
import type { Project, SceneVersion } from '../api/projects';
import EditorWorkspace from './EditorWorkspace';

/**
 * Task 94 (issue #94), point 3: the Tools/Inspector panels' sub-sections
 * are independently collapsible `CollapsibleSection`s, not a
 * single-open-at-a-time accordion — expanding (or collapsing) one section
 * must never affect any other section's own open/closed state. Every
 * section defaults open (matching the pre-#94 "everything always visible"
 * behavior every other `EditorWorkspace*.test.tsx` file already depends
 * on), so this exercises independence by collapsing one and confirming a
 * different, untouched section is still expanded.
 */

vi.mock('../api/projects');

const mockedGetProject = vi.mocked(projectsApi.getProject);
const mockedGetSceneVersion = vi.mocked(projectsApi.getSceneVersion);
const mockedListSceneVersions = vi.mocked(projectsApi.listSceneVersions);

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
    <MemoryRouter initialEntries={['/projects/p1']}>
      <Routes>
        <Route path="/" element={<p>Gallery placeholder</p>} />
        <Route path="/projects/:id" element={<EditorWorkspace />} />
      </Routes>
    </MemoryRouter>,
  );
}

beforeEach(() => {
  vi.clearAllMocks();
  mockedListSceneVersions.mockResolvedValue([
    {
      id: 1,
      sequence: 1,
      origin: 'manual',
      change_label: null,
      created_by: 'alice',
      parent: null,
      fork_source_version: null,
      created_at: '2026-01-01T00:00:00Z',
    },
  ]);
});

describe('EditorWorkspace Tools/Inspector accordion sections', () => {
  it('every section starts expanded', async () => {
    mockedGetProject.mockResolvedValue(baseProject());
    mockedGetSceneVersion.mockResolvedValue(baseVersion());

    renderWorkspace();

    await screen.findByRole('region', { name: 'Tools' });
    const toggles = screen.getAllByRole('button', { name: /Add & edit shapes|Scene outline/ });
    toggles.forEach((toggle) => expect(toggle).toHaveAttribute('aria-expanded', 'true'));
  });

  it('collapsing one Tools section leaves a different, already-open section still open', async () => {
    mockedGetProject.mockResolvedValue(baseProject());
    mockedGetSceneVersion.mockResolvedValue(baseVersion());
    const user = userEvent.setup();

    renderWorkspace();
    await screen.findByRole('region', { name: 'Tools' });

    const sceneOutlineToggle = screen.getByRole('button', { name: /Scene outline/ });
    const addEditToggle = screen.getByRole('button', { name: /Add & edit shapes/ });
    expect(sceneOutlineToggle).toHaveAttribute('aria-expanded', 'true');
    expect(addEditToggle).toHaveAttribute('aria-expanded', 'true');

    await user.click(sceneOutlineToggle);

    expect(sceneOutlineToggle).toHaveAttribute('aria-expanded', 'false');
    // The Add & edit shapes section was never touched -- it must still be
    // open, and its content (the Add shape group) still rendered.
    expect(addEditToggle).toHaveAttribute('aria-expanded', 'true');
    expect(screen.getByRole('group', { name: 'Add shape' })).toBeInTheDocument();

    // Re-expanding the collapsed section doesn't disturb the other either.
    await user.click(sceneOutlineToggle);
    expect(sceneOutlineToggle).toHaveAttribute('aria-expanded', 'true');
    expect(addEditToggle).toHaveAttribute('aria-expanded', 'true');
  });

  it('collapsing one Inspector section leaves a different, already-open section still open', async () => {
    mockedGetProject.mockResolvedValue(baseProject());
    mockedGetSceneVersion.mockResolvedValue(baseVersion());
    const user = userEvent.setup();

    renderWorkspace();
    await screen.findByRole('region', { name: 'Inspector' });

    const shapeInspectorToggle = screen.getByRole('button', { name: /Shape inspector/ });
    const versionHistoryToggle = screen.getByRole('button', { name: /Version history/ });
    expect(shapeInspectorToggle).toHaveAttribute('aria-expanded', 'true');
    expect(versionHistoryToggle).toHaveAttribute('aria-expanded', 'true');

    await user.click(shapeInspectorToggle);

    expect(shapeInspectorToggle).toHaveAttribute('aria-expanded', 'false');
    expect(versionHistoryToggle).toHaveAttribute('aria-expanded', 'true');
    expect(screen.getByText(/Version 1/)).toBeInTheDocument();
  });
});
