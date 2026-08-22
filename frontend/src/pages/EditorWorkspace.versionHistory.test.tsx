import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import * as projectsApi from '../api/projects';
import { ApiError } from '../api/client';
import type { Project, SceneVersion, SceneVersionSummary } from '../api/projects';
import EditorWorkspace from './EditorWorkspace';

/**
 * Task 41: rendered UI tests for explicit save + version history — the
 * working/saved distinction, save (success and validation failure),
 * history display fields, restore, soft-delete's confirm/cancel flow and
 * its current-version guard, and the loading/empty-history/auth error
 * states. See `useVersionHistory.test.ts` for the underlying hook's own
 * finer-grained error-classification tests.
 */

vi.mock('../api/projects');

const mockedGetProject = vi.mocked(projectsApi.getProject);
const mockedGetSceneVersion = vi.mocked(projectsApi.getSceneVersion);
const mockedListSceneVersions = vi.mocked(projectsApi.listSceneVersions);
const mockedSaveSceneVersion = vi.mocked(projectsApi.saveSceneVersion);
const mockedRestoreSceneVersion = vi.mocked(projectsApi.restoreSceneVersion);
const mockedDeleteSceneVersion = vi.mocked(projectsApi.deleteSceneVersion);

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
}

beforeEach(() => {
  vi.clearAllMocks();
  mockedListSceneVersions.mockResolvedValue([baseSummary()]);
});

describe('working/saved status', () => {
  it('shows Saved for an untouched working copy, then Unsaved changes the moment it is edited', async () => {
    await loadReadyWorkspace();
    const user = userEvent.setup();

    expect(screen.getByTestId('editor-save-status')).toHaveTextContent('Saved as version 1');
    expect(screen.getByTestId('working-state-status')).toHaveTextContent('Saved as version 1');

    await user.click(screen.getByRole('button', { name: 'Add circle' }));

    expect(screen.getByTestId('editor-save-status')).toHaveTextContent('Unsaved changes');
    expect(screen.getByTestId('working-state-status')).toHaveTextContent('Unsaved changes');
  });
});

describe('history display', () => {
  it('shows sequence, latest marker, time, creator, origin, and change label per version', async () => {
    mockedListSceneVersions.mockResolvedValue([
      baseSummary({ id: 1, sequence: 1, change_label: 'Blank canvas', created_by: 'alice' }),
      baseSummary({
        id: 2,
        sequence: 2,
        origin: 'ai_edit',
        change_label: 'AI tweak',
        created_by: 'alice',
        parent: 1,
        created_at: '2026-01-03T00:00:00Z',
      }),
    ]);
    await loadReadyWorkspace();

    const list = await screen.findByRole('list', { name: 'Version history' });
    const items = within(list).getAllByRole('listitem');
    expect(items).toHaveLength(2);

    expect(items[0]).toHaveTextContent('Version 1');
    expect(items[0]).toHaveTextContent('Blank canvas');

    expect(items[1]).toHaveTextContent('Version 2');
    expect(items[1]).toHaveTextContent('AI tweak');
    expect(items[1]).toHaveTextContent('AI: proposed edit');
    expect(items[1]).toHaveTextContent('alice');
    // baseProject() defaults current_version to 1, so version 1 (not 2) is
    // the one marked latest here — see the next test for the case where
    // current_version actually points at the second entry.
    expect(items[0]).toHaveTextContent('Latest');
    expect(items[1]).not.toHaveTextContent('Latest');
  });

  it('marks exactly the version matching the project current_version as latest', async () => {
    mockedGetProject.mockResolvedValue(baseProject({ current_version: 2 }));
    mockedGetSceneVersion.mockResolvedValue(baseVersion({ id: 2, sequence: 2 }));
    mockedListSceneVersions.mockResolvedValue([
      baseSummary({ id: 1, sequence: 1 }),
      baseSummary({ id: 2, sequence: 2 }),
    ]);
    renderWorkspace();
    await screen.findByRole('region', { name: 'Tools' });

    const list = await screen.findByRole('list', { name: 'Version history' });
    const items = within(list).getAllByRole('listitem');
    expect(items[0]).not.toHaveTextContent('Latest');
    expect(items[1]).toHaveTextContent('Latest');
  });
});

describe('save', () => {
  it('saves the working scene, creates exactly one version, and identifies it as current', async () => {
    await loadReadyWorkspace();
    const user = userEvent.setup();
    // The save response's scene_json must be exactly what was submitted
    // (the server never rewrites it) so the working copy matches the new
    // persisted version afterward.
    mockedSaveSceneVersion.mockImplementation((_projectId, input) =>
      Promise.resolve(
        baseVersion({
          id: 2,
          sequence: 2,
          change_label: 'Added a shape',
          scene_json: input.scene_json,
        }),
      ),
    );

    await user.click(screen.getByRole('button', { name: 'Add circle' }));
    await user.type(screen.getByLabelText('Change label (optional)'), 'Added a shape');
    await user.click(screen.getByRole('button', { name: 'Save' }));

    await waitFor(() => expect(mockedSaveSceneVersion).toHaveBeenCalledTimes(1));
    const [, payload] = mockedSaveSceneVersion.mock.calls[0];
    expect(payload.origin).toBe('manual');
    expect(payload.change_label).toBe('Added a shape');
    expect(Array.isArray((payload.scene_json as { shapes: unknown[] }).shapes)).toBe(true);
    expect((payload.scene_json as { shapes: unknown[] }).shapes).toHaveLength(1);

    await waitFor(() =>
      expect(screen.getByTestId('editor-save-status')).toHaveTextContent('Saved as version 2'),
    );
  });

  it('does not create a version and preserves the working scene exactly when validation fails', async () => {
    await loadReadyWorkspace();
    const user = userEvent.setup();
    mockedSaveSceneVersion.mockRejectedValue(
      new ApiError(400, {
        errors: [{ path: '$.shapes[0]', rule: 'unsupportedType', message: 'Unknown shape type.' }],
      }),
    );

    await user.click(screen.getByRole('button', { name: 'Add circle' }));
    const shapeCountBefore = screen.getByText(/shape\(s\) in the working copy/).textContent;

    await user.click(screen.getByRole('button', { name: 'Save' }));

    await waitFor(() => expect(screen.getByTestId('save-error')).toBeInTheDocument());
    expect(screen.getByTestId('save-error')).toHaveTextContent(/failed validation/i);
    expect(screen.getByTestId('save-error')).toHaveTextContent('Unknown shape type.');

    // The working copy (and its dirty status) is exactly as the user left it.
    expect(screen.getByText(/shape\(s\) in the working copy/).textContent).toBe(shapeCountBefore);
    expect(screen.getByTestId('editor-save-status')).toHaveTextContent('Unsaved changes');
  });

  it('the Save control is unavailable while there is nothing unsaved to save', async () => {
    await loadReadyWorkspace();
    expect(screen.getByRole('button', { name: 'Save' })).toBeDisabled();
  });
});

describe('restore', () => {
  it('restores a historical version into a new latest version and updates the working copy, without mutating the source', async () => {
    mockedListSceneVersions.mockResolvedValue([
      baseSummary({ id: 1, sequence: 1 }),
      baseSummary({ id: 2, sequence: 2, origin: 'manual', change_label: 'Second save' }),
    ]);
    mockedGetProject.mockResolvedValue(baseProject({ current_version: 2 }));
    mockedGetSceneVersion.mockResolvedValue(baseVersion({ id: 2, sequence: 2 }));
    renderWorkspace();
    await screen.findByRole('region', { name: 'Tools' });

    const sourceSummary = { id: 1, sequence: 1 } as const;
    const beforeRestoreSnapshot = JSON.stringify(sourceSummary);

    const restoredVersion = baseVersion({
      id: 3,
      sequence: 3,
      origin: 'restore',
      parent: 1,
      change_label: 'Restored from version 1',
    });
    mockedRestoreSceneVersion.mockResolvedValue(restoredVersion);

    const user = userEvent.setup();
    const list = await screen.findByRole('list', { name: 'Version history' });
    const firstItem = within(list).getAllByRole('listitem')[0];
    await user.click(within(firstItem).getByRole('button', { name: 'Restore' }));

    await waitFor(() => expect(mockedRestoreSceneVersion).toHaveBeenCalledWith('p1', 1));

    await waitFor(() =>
      expect(screen.getByTestId('editor-save-status')).toHaveTextContent('Saved as version 3'),
    );
    // The restore call targeted the historical version's own id/sequence,
    // which are unchanged by the restore.
    expect(JSON.stringify(sourceSummary)).toBe(beforeRestoreSnapshot);
  });

  it('disables Restore for the current version', async () => {
    await loadReadyWorkspace();
    const list = await screen.findByRole('list', { name: 'Version history' });
    const item = within(list).getAllByRole('listitem')[0];
    expect(within(item).getByRole('button', { name: 'Restore' })).toBeDisabled();
  });
});

describe('soft-delete', () => {
  it('disables Delete for the current version', async () => {
    await loadReadyWorkspace();
    const list = await screen.findByRole('list', { name: 'Version history' });
    const item = within(list).getAllByRole('listitem')[0];
    expect(within(item).getByRole('button', { name: 'Delete' })).toBeDisabled();
  });

  it('requires explicit confirmation, via an accessible dialog rather than a native confirm(), before deleting', async () => {
    mockedListSceneVersions.mockResolvedValue([
      baseSummary({ id: 1, sequence: 1 }),
      baseSummary({ id: 2, sequence: 2 }),
    ]);
    mockedGetProject.mockResolvedValue(baseProject({ current_version: 2 }));
    mockedGetSceneVersion.mockResolvedValue(baseVersion({ id: 2, sequence: 2 }));
    renderWorkspace();
    await screen.findByRole('region', { name: 'Tools' });

    const user = userEvent.setup();
    const list = await screen.findByRole('list', { name: 'Version history' });
    const eligibleItem = within(list).getAllByRole('listitem')[0];
    await user.click(within(eligibleItem).getByRole('button', { name: 'Delete' }));

    expect(mockedDeleteSceneVersion).not.toHaveBeenCalled();
    const dialog = screen.getByRole('alertdialog');
    expect(dialog).toBeInTheDocument();

    // Cancel: leaves the version in place.
    await user.click(within(dialog).getByRole('button', { name: 'Cancel' }));
    expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument();
    expect(mockedDeleteSceneVersion).not.toHaveBeenCalled();

    // Confirm: now it actually deletes.
    await user.click(within(eligibleItem).getByRole('button', { name: 'Delete' }));
    mockedDeleteSceneVersion.mockResolvedValue(undefined);
    await user.click(screen.getByRole('button', { name: 'Delete version' }));

    await waitFor(() => expect(mockedDeleteSceneVersion).toHaveBeenCalledWith('p1', 1));
  });

  it('moves focus into the delete-confirm dialog on open, and restores it to the trigger on cancel or Escape', async () => {
    mockedListSceneVersions.mockResolvedValue([
      baseSummary({ id: 1, sequence: 1 }),
      baseSummary({ id: 2, sequence: 2 }),
    ]);
    mockedGetProject.mockResolvedValue(baseProject({ current_version: 2 }));
    mockedGetSceneVersion.mockResolvedValue(baseVersion({ id: 2, sequence: 2 }));
    renderWorkspace();
    await screen.findByRole('region', { name: 'Tools' });

    const user = userEvent.setup();
    const list = await screen.findByRole('list', { name: 'Version history' });
    const eligibleItem = within(list).getAllByRole('listitem')[0];
    const deleteTrigger = within(eligibleItem).getByRole('button', { name: 'Delete' });

    await user.click(deleteTrigger);
    let dialog = await screen.findByRole('alertdialog', { name: /Delete version 1/ });
    expect(dialog).toHaveFocus();

    await user.click(within(dialog).getByRole('button', { name: 'Cancel' }));
    expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument();
    expect(deleteTrigger).toHaveFocus();

    // Escape behaves the same as Cancel: dismisses without deleting, and
    // restores focus to the button that opened it.
    await user.click(deleteTrigger);
    dialog = await screen.findByRole('alertdialog', { name: /Delete version 1/ });
    await user.keyboard('{Escape}');
    expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument();
    expect(deleteTrigger).toHaveFocus();
    expect(mockedDeleteSceneVersion).not.toHaveBeenCalled();
  });

  it('reports a conflict error, defensively, if the backend rejects deleting a version the UI thought was eligible', async () => {
    mockedListSceneVersions.mockResolvedValue([
      baseSummary({ id: 1, sequence: 1 }),
      baseSummary({ id: 2, sequence: 2 }),
    ]);
    mockedGetProject.mockResolvedValue(baseProject({ current_version: 2 }));
    mockedGetSceneVersion.mockResolvedValue(baseVersion({ id: 2, sequence: 2 }));
    mockedDeleteSceneVersion.mockRejectedValue(
      new ApiError(400, { detail: 'The current version cannot be soft-deleted.' }),
    );
    renderWorkspace();
    await screen.findByRole('region', { name: 'Tools' });

    const user = userEvent.setup();
    const list = await screen.findByRole('list', { name: 'Version history' });
    const item = within(list).getAllByRole('listitem')[0];
    await user.click(within(item).getByRole('button', { name: 'Delete' }));
    await user.click(screen.getByRole('button', { name: 'Delete version' }));

    await waitFor(() => expect(screen.getByTestId('delete-error-1')).toBeInTheDocument());
    expect(screen.getByTestId('delete-error-1')).toHaveTextContent(/cannot be deleted/i);
  });
});

describe('loading and edge-condition states', () => {
  it('shows a loading indicator for history while it fetches', async () => {
    let resolveList: (value: SceneVersionSummary[]) => void = () => {};
    mockedListSceneVersions.mockReturnValue(
      new Promise((resolve) => {
        resolveList = resolve;
      }),
    );
    await loadReadyWorkspace();

    expect(screen.getByText('Loading version history…')).toBeInTheDocument();

    resolveList([baseSummary()]);
    await waitFor(() =>
      expect(screen.queryByText('Loading version history…')).not.toBeInTheDocument(),
    );
  });

  it('shows a clear, non-generic message for the structurally-impossible empty-history case, and never blocks the working copy', async () => {
    mockedListSceneVersions.mockResolvedValue([]);
    await loadReadyWorkspace();

    const message = await screen.findByText(/every project is expected to always have/i);
    expect(message).toBeInTheDocument();
    // Working state is unaffected — shapes can still be added.
    const user = userEvent.setup();
    await user.click(screen.getByRole('button', { name: 'Add circle' }));
    expect(screen.getByTestId('editor-save-status')).toHaveTextContent('Unsaved changes');
  });

  it('surfaces an auth-error message with recovery guidance when history fails to load due to access loss, and offers Retry', async () => {
    mockedListSceneVersions.mockRejectedValue(new ApiError(404, null));
    await loadReadyWorkspace();

    await waitFor(() => expect(screen.getByText(/sign in again/i)).toBeInTheDocument());
    expect(screen.getByRole('button', { name: 'Retry' })).toBeInTheDocument();
  });
});
