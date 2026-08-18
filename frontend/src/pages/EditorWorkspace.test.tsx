import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { ApiError } from '../api/client';
import * as projectsApi from '../api/projects';
import type { Project, SceneVersion } from '../api/projects';
import EditorWorkspace from './EditorWorkspace';

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
    thumbnail_choice: 'auto',
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

function setViewportWidth(width: number) {
  Object.defineProperty(window, 'innerWidth', { writable: true, configurable: true, value: width });
  window.dispatchEvent(new Event('resize'));
}

function renderWorkspace() {
  return render(
    <MemoryRouter initialEntries={['/projects/p1']}>
      <Routes>
        <Route path="/" element={<p>Gallery placeholder</p>} />
        <Route path="/projects/:id" element={<EditorWorkspace />} />
        <Route path="/projects/:id/settings" element={<p>Settings placeholder</p>} />
      </Routes>
    </MemoryRouter>,
  );
}

beforeEach(() => {
  vi.clearAllMocks();
  // Task 41: VersionHistoryPanel always loads history on mount; default
  // to an empty (but successfully loaded) list so tests unrelated to
  // version history don't need to know about it.
  // A single-entry history (matching the default current_version: 1)
  // so unrelated tests don't trip the empty-history 'impossible state'
  // alert VersionHistoryPanel renders for a genuinely empty list.
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
  setViewportWidth(1024); // wide layout by default
});

afterEach(() => {
  setViewportWidth(1024);
});

describe('EditorWorkspace load states', () => {
  it('shows an accessible loading state while the project/version fetch is in flight', () => {
    mockedGetProject.mockReturnValue(new Promise(() => {}));

    renderWorkspace();

    expect(screen.getByRole('status')).toHaveTextContent(/loading editor/i);
  });

  it('renders the three landmark regions, in DOM order, once the working copy loads', async () => {
    mockedGetProject.mockResolvedValue(baseProject());
    mockedGetSceneVersion.mockResolvedValue(baseVersion());

    renderWorkspace();

    await screen.findByRole('region', { name: 'Tools' });
    const regions = screen.getAllByRole('region');
    expect(regions.map((r) => r.getAttribute('data-panel'))).toEqual([
      'tools',
      'preview',
      'inspector',
    ]);
    expect(screen.getByRole('region', { name: 'Tools' })).toHaveAttribute('data-panel', 'tools');
    expect(screen.getByRole('region', { name: 'Preview' })).toHaveAttribute(
      'data-panel',
      'preview',
    );
    expect(screen.getByRole('region', { name: 'Inspector' })).toHaveAttribute(
      'data-panel',
      'inspector',
    );
  });

  it('shows an access-denied message with a link back to the gallery on a 401', async () => {
    mockedGetProject.mockRejectedValue(new ApiError(401, { detail: 'nope' }));

    renderWorkspace();

    expect(await screen.findByRole('alert')).toHaveTextContent(/don't have access/i);
    expect(screen.getByRole('link', { name: /back to your projects/i })).toHaveAttribute(
      'href',
      '/',
    );
  });

  it('shows an access-denied message with a link back to the gallery on a 403', async () => {
    mockedGetProject.mockRejectedValue(new ApiError(403, { detail: 'nope' }));

    renderWorkspace();

    expect(await screen.findByRole('alert')).toHaveTextContent(/don't have access/i);
  });

  it('shows a "no valid scene" message when current_version is null', async () => {
    mockedGetProject.mockResolvedValue(baseProject({ current_version: null }));

    renderWorkspace();

    expect(await screen.findByRole('alert')).toHaveTextContent(/no valid scene to load/i);
    expect(mockedGetSceneVersion).not.toHaveBeenCalled();
  });

  it('shows a "no valid scene" message when the fetched version fails validation', async () => {
    mockedGetProject.mockResolvedValue(baseProject());
    mockedGetSceneVersion.mockResolvedValue(baseVersion({ scene_json: { bogus: true } }));

    renderWorkspace();

    expect(await screen.findByRole('alert')).toHaveTextContent(/no valid scene to load/i);
  });

  it('shows an error message with a working retry action on any other failure', async () => {
    mockedGetProject.mockRejectedValueOnce(new Error('network down'));
    mockedGetProject.mockResolvedValueOnce(baseProject());
    mockedGetSceneVersion.mockResolvedValue(baseVersion());
    const user = userEvent.setup();

    renderWorkspace();

    expect(await screen.findByRole('alert')).toHaveTextContent(/went wrong loading/i);
    const retryButton = screen.getByRole('button', { name: /retry/i });

    await user.click(retryButton);

    await screen.findByRole('region', { name: 'Preview' });
    expect(mockedGetProject).toHaveBeenCalledTimes(2);
  });
});

describe('EditorWorkspace responsive layout', () => {
  it('shows all three panels simultaneously at >=1024px, with no switcher', async () => {
    mockedGetProject.mockResolvedValue(baseProject());
    mockedGetSceneVersion.mockResolvedValue(baseVersion());
    setViewportWidth(1024);

    renderWorkspace();

    await screen.findByRole('region', { name: 'Tools' });
    expect(screen.getByRole('region', { name: 'Tools' })).toBeVisible();
    expect(screen.getByRole('region', { name: 'Preview' })).toBeVisible();
    expect(screen.getByRole('region', { name: 'Inspector' })).toBeVisible();
    expect(screen.queryByRole('tablist')).not.toBeInTheDocument();
  });

  it('shows one panel at a time via a keyboard-operable switcher below 1024px, Preview by default', async () => {
    mockedGetProject.mockResolvedValue(baseProject());
    mockedGetSceneVersion.mockResolvedValue(baseVersion());
    setViewportWidth(320);

    renderWorkspace();

    await screen.findByRole('tablist', { name: /editor panels/i });
    expect(screen.getByRole('region', { name: 'Preview' })).toBeVisible();
    expect(document.querySelector('[data-panel="tools"]')).not.toBeVisible();
    expect(document.querySelector('[data-panel="inspector"]')).not.toBeVisible();

    const previewTab = screen.getByRole('tab', { name: 'Preview' });
    expect(previewTab).toHaveAttribute('aria-selected', 'true');
  });

  it('switches the visible panel when a switcher tab is activated by keyboard', async () => {
    mockedGetProject.mockResolvedValue(baseProject());
    mockedGetSceneVersion.mockResolvedValue(baseVersion());
    setViewportWidth(320);
    const user = userEvent.setup();

    renderWorkspace();

    const toolsTab = await screen.findByRole('tab', { name: 'Tools' });
    toolsTab.focus();
    await user.keyboard('{Enter}');

    expect(screen.getByRole('region', { name: 'Tools' })).toBeVisible();
    expect(document.querySelector('[data-panel="preview"]')).not.toBeVisible();
    expect(toolsTab).toHaveAttribute('aria-selected', 'true');
  });

  it('does not overlap or hide the switcher itself at the 320px minimum width', async () => {
    mockedGetProject.mockResolvedValue(baseProject());
    mockedGetSceneVersion.mockResolvedValue(baseVersion());
    setViewportWidth(320);

    renderWorkspace();

    const tablist = await screen.findByRole('tablist');
    const tabs = within(tablist).getAllByRole('tab');
    expect(tabs).toHaveLength(3);
    tabs.forEach((tab) => expect(tab).toBeVisible());
  });
});

describe('EditorWorkspace keyboard accessibility', () => {
  it('has a single logical forward Tab order through the narrow-layout switcher', async () => {
    mockedGetProject.mockResolvedValue(baseProject());
    mockedGetSceneVersion.mockResolvedValue(baseVersion());
    setViewportWidth(320);
    const user = userEvent.setup();

    renderWorkspace();
    await screen.findByRole('tablist');

    await user.tab();
    expect(screen.getByRole('link', { name: /edit project details/i })).toHaveFocus();

    await user.tab();
    expect(screen.getByRole('button', { name: 'Exit without saving' })).toHaveFocus();

    await user.tab();
    expect(screen.getByRole('tab', { name: 'Tools' })).toHaveFocus();

    await user.tab();
    expect(screen.getByRole('tab', { name: 'Preview' })).toHaveFocus();

    await user.tab();
    expect(screen.getByRole('tab', { name: 'Inspector' })).toHaveFocus();

    // Shift+Tab reverses the same order, with no trap.
    await user.tab({ shift: true });
    expect(screen.getByRole('tab', { name: 'Preview' })).toHaveFocus();
  });
});
