import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import * as projectsApi from '../api/projects';
import type { Project, SceneVersion, SceneVersionSummary } from '../api/projects';
import EditorWorkspace from './EditorWorkspace';
import { expandAllCollapsibleSections } from '../testUtils/expandCollapsibleSections';
import { useDraftAutosave } from './useDraftAutosave';
import type { DraftAutosaveFailure } from '../storage/draftAutosave';
import { useDraftServerSync } from './useDraftServerSync';
import type { DraftServerSyncFailure } from '../storage/draftServerSync';

/**
 * Issue #112: a failed local or server draft-sync write must never look
 * like an unexplained interruption. `useDraftAutosave`/`useDraftServerSync`
 * already record a classified failure via `getLastFailure()` (covered
 * directly against IndexedDB/the API in their own unit tests); this file
 * proves `EditorWorkspace.tsx` actually reads that back and shows an
 * actionable, non-blocking notice — and that a successful explicit Save
 * clears a stale one — rather than the failure staying silent.
 */

vi.mock('../api/projects');
vi.mock('./useDraftAutosave');
vi.mock('./useDraftServerSync');

const mockedGetProject = vi.mocked(projectsApi.getProject);
const mockedGetSceneVersion = vi.mocked(projectsApi.getSceneVersion);
const mockedListSceneVersions = vi.mocked(projectsApi.listSceneVersions);
const mockedSaveSceneVersion = vi.mocked(projectsApi.saveSceneVersion);
const mockedUseDraftAutosave = vi.mocked(useDraftAutosave);
const mockedUseDraftServerSync = vi.mocked(useDraftServerSync);

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
}

let getAutosaveFailure: ReturnType<typeof vi.fn<() => DraftAutosaveFailure | null>>;
let getSyncFailure: ReturnType<typeof vi.fn<() => DraftServerSyncFailure | null>>;

beforeEach(() => {
  vi.clearAllMocks();
  mockedListSceneVersions.mockResolvedValue([baseSummary()]);

  getAutosaveFailure = vi.fn().mockReturnValue(null);
  mockedUseDraftAutosave.mockReturnValue({
    clearDraft: vi.fn(() => Promise.resolve()),
    readDraft: vi.fn().mockResolvedValue(null),
    getLastFailure: getAutosaveFailure,
    onFailureChange: vi.fn(() => () => {}),
  });

  getSyncFailure = vi.fn().mockReturnValue(null);
  mockedUseDraftServerSync.mockReturnValue({
    syncAfterMeaningfulAction: vi.fn(),
    deleteServerDraft: vi.fn(() => Promise.resolve()),
    getLastFailure: getSyncFailure,
    getLastSyncedAt: vi.fn().mockReturnValue(null),
    onFailureChange: vi.fn(() => () => {}),
  });
});

describe('draft-sync failure notice', () => {
  it('shows no notice while neither controller has recorded a failure', async () => {
    await loadReadyWorkspace();
    expect(screen.queryByTestId('draft-sync-error')).not.toBeInTheDocument();
  });

  it('surfaces a recorded local draft failure as an actionable, non-blocking notice', async () => {
    getAutosaveFailure.mockReturnValue({
      kind: 'quota-exceeded',
      message: 'Local storage quota was exceeded.',
    });
    await loadReadyWorkspace();

    const notice = await screen.findByTestId('draft-sync-error');
    expect(notice).toHaveTextContent('Local storage quota was exceeded.');
    // The editor stays fully interactive — the notice is informational only.
    expect(screen.getByRole('button', { name: 'Add circle' })).toBeEnabled();
  });

  it('prefers the server-sync failure when both controllers report one', async () => {
    getAutosaveFailure.mockReturnValue({ kind: 'unknown', message: 'Local draft storage failed.' });
    getSyncFailure.mockReturnValue({ kind: 'offline', message: 'The browser is offline.' });
    await loadReadyWorkspace();

    const notice = await screen.findByTestId('draft-sync-error');
    expect(notice).toHaveTextContent('The browser is offline.');
  });

  it('clears a stale notice once an explicit Save succeeds', async () => {
    getSyncFailure.mockReturnValue({ kind: 'timeout', message: 'Draft sync timed out.' });
    await loadReadyWorkspace();
    await screen.findByTestId('draft-sync-error');

    getSyncFailure.mockReturnValue(null);
    mockedSaveSceneVersion.mockImplementation((_projectId, input) =>
      Promise.resolve(baseVersion({ id: 2, sequence: 2, scene_json: input.scene_json })),
    );

    const user = userEvent.setup();
    await user.click(screen.getByRole('button', { name: 'Add circle' }));
    await user.click(screen.getByRole('button', { name: 'Save' }));

    await waitFor(() => expect(screen.queryByTestId('draft-sync-error')).not.toBeInTheDocument());
  });
});
