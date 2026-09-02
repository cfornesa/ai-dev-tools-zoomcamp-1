import { render, screen, within } from '@testing-library/react';
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
 * must never affect any other section's own open/closed state.
 *
 * Issue #95, point 6: every section now defaults **closed** (flipped from
 * Task 94's "everything open" default, which only existed to preserve
 * other tests' assumptions at the time — see
 * `../testUtils/expandCollapsibleSections.ts` for how those now cope).
 * This file exercises independence in the opposite direction from before:
 * expanding one section must never expand (or otherwise disturb) a
 * different, still-closed section.
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

describe('EditorWorkspace top-level and nested disclosures', () => {
  it('every section starts collapsed', async () => {
    mockedGetProject.mockResolvedValue(baseProject());
    mockedGetSceneVersion.mockResolvedValue(baseVersion());

    renderWorkspace();

    const tools = await screen.findByRole('region', { name: 'Tools' });
    await userEvent.click(within(tools).getByRole('button', { name: 'Expand Tools panel' }));
    const toggles = screen.getAllByRole('button', { name: /Editing preferences/ });
    toggles.forEach((toggle) => expect(toggle).toHaveAttribute('aria-expanded', 'false'));
    expect(screen.getByRole('button', { name: 'Piece controls' })).toHaveAttribute(
      'aria-expanded',
      'false',
    );
  });

  it('expanding editor preferences leaves the stage controls disclosure closed', async () => {
    mockedGetProject.mockResolvedValue(baseProject());
    mockedGetSceneVersion.mockResolvedValue(baseVersion());
    const user = userEvent.setup();

    renderWorkspace();
    const tools = await screen.findByRole('region', { name: 'Tools' });
    await user.click(within(tools).getByRole('button', { name: 'Expand Tools panel' }));

    const addEditToggle = screen.getByRole('button', { name: /Editing preferences/ });
    expect(addEditToggle).toHaveAttribute('aria-expanded', 'false');
    const pieceControls = screen.getByRole('button', { name: 'Piece controls' });
    expect(pieceControls).toHaveAttribute('aria-expanded', 'false');

    await user.click(addEditToggle);

    expect(addEditToggle).toHaveAttribute('aria-expanded', 'true');
    expect(screen.getByRole('heading', { name: 'Snapping' })).toBeInTheDocument();
    expect(pieceControls).toHaveAttribute('aria-expanded', 'false');

    // Collapsing the expanded section again doesn't disturb the other.
    await user.click(addEditToggle);
    expect(addEditToggle).toHaveAttribute('aria-expanded', 'false');
    expect(pieceControls).toHaveAttribute('aria-expanded', 'false');
  });

  it('expanding one Inspector section leaves a different, still-closed section closed', async () => {
    mockedGetProject.mockResolvedValue(baseProject());
    mockedGetSceneVersion.mockResolvedValue(baseVersion());
    const user = userEvent.setup();

    renderWorkspace();
    const inspector = await screen.findByRole('region', { name: 'Inspector' });
    await user.click(within(inspector).getByRole('button', { name: 'Expand Inspector panel' }));

    const shapeInspectorToggle = screen.getByRole('button', { name: /Shape inspector/ });
    const versionHistoryToggle = screen.getByRole('button', { name: /Version history/ });
    expect(shapeInspectorToggle).toHaveAttribute('aria-expanded', 'false');
    expect(versionHistoryToggle).toHaveAttribute('aria-expanded', 'false');

    await user.click(versionHistoryToggle);

    expect(versionHistoryToggle).toHaveAttribute('aria-expanded', 'true');
    expect(await screen.findByText(/Version 1/)).toBeInTheDocument();
    expect(shapeInspectorToggle).toHaveAttribute('aria-expanded', 'false');
  });

  it('starts with only Layers open and collapses top-level panels without unmounting content', async () => {
    mockedGetProject.mockResolvedValue(baseProject());
    mockedGetSceneVersion.mockResolvedValue(baseVersion());
    const user = userEvent.setup();

    renderWorkspace();
    const layers = await screen.findByRole('region', { name: 'Layers' });
    const tools = await screen.findByRole('region', { name: 'Tools' });
    const layersToggle = within(layers).getByRole('button', { name: 'Collapse Layers panel' });
    const toolsToggle = within(tools).getByRole('button', { name: 'Expand Tools panel' });
    const layersContent = document.getElementById('editor-panel-layers-content');
    const toolsContent = document.getElementById('editor-panel-tools-content');
    const canvas = await screen.findByRole('region', { name: 'Canvas' });
    const details = await screen.findByRole('region', { name: 'Details' });
    const inspector = await screen.findByRole('region', { name: 'Inspector' });

    expect(layersToggle).toHaveAttribute('aria-expanded', 'true');
    expect(layersToggle).toHaveAttribute('aria-controls', 'editor-panel-layers-content');
    expect(layersContent).not.toHaveAttribute('hidden');
    expect(toolsContent).toHaveAttribute('hidden', '');
    expect(within(canvas).getByRole('button', { name: 'Expand Canvas panel' })).toHaveAttribute(
      'aria-expanded',
      'false',
    );
    expect(within(details).getByRole('button', { name: 'Expand Details panel' })).toHaveAttribute(
      'aria-expanded',
      'false',
    );
    expect(
      within(inspector).getByRole('button', { name: 'Expand Inspector panel' }),
    ).toHaveAttribute('aria-expanded', 'false');

    await user.click(toolsToggle);
    const nestedToggle = within(tools).getByRole('button', { name: /Editing preferences/ });
    await user.click(nestedToggle);
    expect(nestedToggle).toHaveAttribute('aria-expanded', 'true');

    await user.click(toolsToggle);
    expect(toolsToggle).toHaveAttribute('aria-expanded', 'false');
    expect(toolsToggle).toHaveFocus();
    expect(toolsContent).toHaveAttribute('hidden');
    // The nested control remains mounted and its state is not reset.
    expect(nestedToggle).toHaveAttribute('aria-expanded', 'true');

    await user.keyboard('{Enter}');
    expect(toolsToggle).toHaveAttribute('aria-expanded', 'true');
    expect(toolsContent).not.toHaveAttribute('hidden');
    expect(nestedToggle).toHaveAttribute('aria-expanded', 'true');

    await user.click(layersToggle);
    expect(layersToggle).toHaveAttribute('aria-expanded', 'false');
    expect(layersContent).toHaveAttribute('hidden');
    await user.keyboard(' ');
    expect(layersToggle).toHaveAttribute('aria-expanded', 'true');
    expect(layersContent).not.toHaveAttribute('hidden');
  });
});
