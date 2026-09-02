import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import * as projectsApi from '../api/projects';
import type { Project, SceneVersion, SceneVersionSummary } from '../api/projects';
import EditorWorkspace from './EditorWorkspace';
import { expandAllCollapsibleSections } from '../testUtils/expandCollapsibleSections';
import { useDraftAutosave } from './useDraftAutosave';

/**
 * Task 42: `EditorWorkspace.tsx`'s wiring of the two defined draft-clearing
 * actions (explicit Save success, confirmed Exit-without-saving) plus the
 * Exit confirmation dialog's cancel/confirm behavior. The debounced write/
 * read/failure-handling engine itself is unit-tested directly against
 * IndexedDB in `../storage/draftAutosave.test.ts` and
 * `useDraftAutosave.test.ts` — this file only has to prove the workspace
 * calls `clearDraft()` from exactly the right places, so `useDraftAutosave`
 * is mocked here rather than driving a real 1.5s debounce through the UI.
 */

vi.mock('../api/projects');
vi.mock('./useDraftAutosave');

const mockedGetProject = vi.mocked(projectsApi.getProject);
const mockedGetSceneVersion = vi.mocked(projectsApi.getSceneVersion);
const mockedListSceneVersions = vi.mocked(projectsApi.listSceneVersions);
const mockedSaveSceneVersion = vi.mocked(projectsApi.saveSceneVersion);
const mockedUseDraftAutosave = vi.mocked(useDraftAutosave);

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
        <Route path="/projects/:id/settings" element={<p>Settings placeholder</p>} />
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
  await userEvent.setup().click(screen.getByRole('button', { name: 'Open piece controls menu' }));
  await userEvent.setup().click(screen.getByRole('button', { name: 'Edit scene' }));
}

let clearDraft: ReturnType<typeof vi.fn<() => Promise<void>>>;

beforeEach(() => {
  vi.clearAllMocks();
  mockedListSceneVersions.mockResolvedValue([baseSummary()]);
  clearDraft = vi.fn(() => Promise.resolve());
  mockedUseDraftAutosave.mockReturnValue({
    clearDraft,
    readDraft: vi.fn().mockResolvedValue(null),
    getLastFailure: vi.fn().mockReturnValue(null),
    onFailureChange: vi.fn(() => () => {}),
  });
});

describe('explicit Save clears the matching local draft', () => {
  it('calls clearDraft only after the version-save API call succeeds', async () => {
    await loadReadyWorkspace();
    const user = userEvent.setup();
    mockedSaveSceneVersion.mockImplementation((_projectId, input) =>
      Promise.resolve(baseVersion({ id: 2, sequence: 2, scene_json: input.scene_json })),
    );

    await user.click(screen.getByRole('button', { name: 'Add circle' }));
    expect(clearDraft).not.toHaveBeenCalled();

    await user.click(screen.getByRole('button', { name: 'Save' }));

    await waitFor(() => expect(clearDraft).toHaveBeenCalledTimes(1));
  });

  it('does not clear the draft when save fails validation', async () => {
    await loadReadyWorkspace();
    const user = userEvent.setup();
    mockedSaveSceneVersion.mockRejectedValue(new Error('boom'));

    await user.click(screen.getByRole('button', { name: 'Add circle' }));
    await user.click(screen.getByRole('button', { name: 'Save' }));

    await waitFor(() => expect(mockedSaveSceneVersion).toHaveBeenCalled());
    expect(clearDraft).not.toHaveBeenCalled();
  });
});

describe('Exit without saving', () => {
  it('shows an accessible confirmation and only clears the draft when confirmed', async () => {
    await loadReadyWorkspace();
    const user = userEvent.setup();

    await user.click(screen.getByRole('button', { name: 'Exit without saving' }));
    const dialog = screen.getByRole('alertdialog', { name: /exit without saving/i });
    expect(dialog).toBeInTheDocument();
    expect(clearDraft).not.toHaveBeenCalled();

    const cancelButton = screen.getAllByRole('button', { name: 'Cancel' })[0];
    await user.click(cancelButton);
    expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument();
    expect(clearDraft).not.toHaveBeenCalled();
  });

  it('clears the draft and navigates away once the user confirms', async () => {
    await loadReadyWorkspace();
    const user = userEvent.setup();

    await user.click(screen.getByRole('button', { name: 'Exit without saving' }));
    const dialog = screen.getByRole('alertdialog', { name: /exit without saving/i });
    const confirmButton = within(dialog).getAllByRole('button', { name: 'Exit without saving' })[0];
    await user.click(confirmButton);

    await waitFor(() => expect(clearDraft).toHaveBeenCalledTimes(1));
    await waitFor(() => expect(screen.getByText('Gallery placeholder')).toBeInTheDocument());
  });
});
