import { act, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { axe } from 'jest-axe';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import * as activityApi from '../api/projectActivity';
import type { ProjectActivityItem, ProjectActivityPage } from '../api/projectActivity';
import * as projectsApi from '../api/projects';
import type { Project, SceneDocument, SceneVersion, SceneVersionSummary } from '../api/projects';
import VersionHistoryPanel from './VersionHistoryPanel';

vi.mock('../api/projectActivity');
vi.mock('../api/projects');

const mockedActivity = vi.mocked(activityApi.listProjectActivity);
const mockedVersions = vi.mocked(projectsApi.listSceneVersions);

const scene: SceneDocument = {
  schemaVersion: 1,
  id: 'scene-1',
  canvas: { width: 800, height: 600, backgroundColor: '#ffffff' },
  renderer: { preferred: 'p5' },
  layers: [],
  shapes: [],
  groups: [],
  bindings: [],
  graph: { nodes: [], connections: [] },
  accessibility: { reducedMotion: 'auto' },
  randomness: { seed: 0, enabled: false },
};

const project: Project = {
  id: 'public-project-id',
  owner: 'alice',
  title: 'My animation',
  description: '',
  tags: [],
  visibility: 'private',
  allow_public_remix: false,
  export_attribution: false,
  thumbnail_url: null,
  current_version: 2,
  created_at: '2026-01-01T00:00:00Z',
  updated_at: '2026-01-01T00:00:00Z',
};

const versionSummary: SceneVersionSummary = {
  id: 2,
  sequence: 2,
  origin: 'manual',
  change_label: null,
  created_by: 'alice',
  parent: 1,
  fork_source_version: null,
  created_at: '2026-01-01T00:00:00Z',
};

const persistedVersion: SceneVersion = { ...versionSummary, scene_json: scene };

function item(overrides: Partial<ProjectActivityItem> = {}): ProjectActivityItem {
  return {
    id: 1,
    action_type: 'version_saved',
    label: 'Version saved',
    actor_display: 'alice',
    created_at: '2026-10-01T12:00:00Z',
    details: { sequence: 2 },
    ...overrides,
  };
}

function page(
  results: ProjectActivityItem[],
  next_cursor: string | null = null,
): ProjectActivityPage {
  return { results, next_cursor };
}

function renderPanel() {
  return render(
    <>
      <h2>My animation</h2>
      <h3>Save section</h3>
      <VersionHistoryPanel
        projectId={project.id}
        project={project}
        persistedVersion={persistedVersion}
        isDirty={false}
        onRestored={vi.fn()}
      />
    </>,
  );
}

beforeEach(() => {
  vi.clearAllMocks();
  mockedVersions.mockResolvedValue([versionSummary]);
  mockedActivity.mockResolvedValue(page([]));
});

describe('VersionHistoryPanel activity tab', () => {
  it('starts on Versions and provides linked tab semantics and complete keyboard navigation', async () => {
    const user = userEvent.setup();
    renderPanel();

    const tablist = screen.getByRole('tablist', { name: 'Project history views' });
    const versions = within(tablist).getByRole('tab', { name: 'Versions' });
    const activity = within(tablist).getByRole('tab', { name: 'Activity' });
    expect(versions).toHaveAttribute('aria-selected', 'true');
    expect(versions).toHaveAttribute('tabindex', '0');
    expect(activity).toHaveAttribute('aria-selected', 'false');
    expect(activity).toHaveAttribute('tabindex', '-1');
    expect(versions).toHaveAttribute('aria-controls', 'version-history-panel-versions');
    expect(activity).toHaveAttribute('aria-controls', 'version-history-panel-activity');
    expect(screen.getByRole('tabpanel', { name: 'Versions' })).toBeVisible();
    expect(document.getElementById('version-history-panel-activity')).toHaveAttribute(
      'aria-labelledby',
      'version-history-tab-activity',
    );
    expect(await screen.findByRole('list', { name: 'Version history' })).toBeVisible();
    expect(mockedActivity).not.toHaveBeenCalled();

    versions.focus();
    await user.keyboard('{ArrowLeft}');
    expect(activity).toHaveFocus();
    expect(activity).toHaveAttribute('aria-selected', 'true');
    await screen.findByText('No history yet');

    await user.keyboard('{ArrowRight}');
    expect(versions).toHaveFocus();
    await user.keyboard('{End}');
    expect(activity).toHaveFocus();
    await user.keyboard('{Home}');
    expect(versions).toHaveFocus();
  });

  it('labels named and fallback actions, renders reason as text, and exposes semantic time', async () => {
    const unsafeLookingText = '<img src=x onerror="alert(1)"> keep this as text';
    mockedActivity.mockResolvedValue(
      page([
        item({ id: 1, action_type: 'version_saved', details: { sequence: 3 } }),
        item({ id: 2, action_type: 'version_restored', details: { sequence: 4 } }),
        item({
          id: 3,
          action_type: 'ai_proposal_accepted',
          details: { reason: unsafeLookingText },
        }),
        item({ id: 4, action_type: 'ai_proposal_rejected', details: {} }),
        item({
          id: 5,
          action_type: 'metadata_updated',
          label: 'Updated project details',
          details: {},
        }),
      ]),
    );
    const user = userEvent.setup();
    const { container } = renderPanel();
    await user.click(screen.getByRole('tab', { name: 'Activity' }));

    const list = await screen.findByRole('list', { name: 'Project activity' });
    const rows = within(list).getAllByRole('listitem');
    expect(rows).toHaveLength(5);
    expect(rows[0]).toHaveTextContent('Saved version 3');
    expect(rows[1]).toHaveTextContent('Restored version 4');
    expect(rows[2]).toHaveTextContent('Accepted an AI change');
    expect(rows[2]).toHaveTextContent(unsafeLookingText);
    expect(within(rows[2]).queryByRole('img')).not.toBeInTheDocument();
    expect(rows[3]).toHaveTextContent('Discarded an AI change');
    expect(rows[4]).toHaveTextContent('Updated project details');
    const time = within(rows[0]).getByRole('time');
    expect(time).toHaveAttribute('dateTime', '2026-10-01T12:00:00Z');
    expect(time).toHaveAttribute('title', new Date('2026-10-01T12:00:00Z').toLocaleString());
    expect(await axe(container)).toHaveNoViolations();
  });

  it('announces loading, empty, and end states politely and requests the API default page', async () => {
    let resolvePage!: (value: ProjectActivityPage) => void;
    mockedActivity.mockReturnValue(
      new Promise((resolve) => {
        resolvePage = resolve;
      }),
    );
    const user = userEvent.setup();
    renderPanel();
    await user.click(screen.getByRole('tab', { name: 'Activity' }));
    expect(screen.getByText('Loading activity…')).toHaveAttribute('role', 'status');
    expect(mockedActivity).toHaveBeenCalledWith(project.id);

    await act(async () => resolvePage(page([])));
    expect(await screen.findByText('No history yet')).toHaveAttribute('role', 'status');
    expect(screen.queryByRole('button', { name: 'Load more' })).not.toBeInTheDocument();
  });

  it('retries the first page after an error and replaces the error state', async () => {
    mockedActivity
      .mockRejectedValueOnce(new Error('offline'))
      .mockResolvedValueOnce(page([item()]));
    const user = userEvent.setup();
    renderPanel();
    await user.click(screen.getByRole('tab', { name: 'Activity' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('Could not load project activity');
    await user.click(screen.getByRole('button', { name: 'Retry' }));
    expect(await screen.findByText('Saved version 2')).toBeInTheDocument();
    expect(mockedActivity).toHaveBeenNthCalledWith(1, project.id);
    expect(mockedActivity).toHaveBeenNthCalledWith(2, project.id);
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });

  it('appends a cursor page in server order without duplicates and removes Load more at the end', async () => {
    const opaqueCursor = 'signed/cursor+opaque==';
    mockedActivity
      .mockResolvedValueOnce(page([item({ id: 1, details: { sequence: 1 } })], opaqueCursor))
      .mockResolvedValueOnce(
        page([
          item({ id: 1, details: { sequence: 1 } }),
          item({ id: 2, details: { sequence: 2 } }),
        ]),
      );
    const user = userEvent.setup();
    renderPanel();
    await user.click(screen.getByRole('tab', { name: 'Activity' }));
    const list = await screen.findByRole('list', { name: 'Project activity' });
    await user.click(screen.getByRole('button', { name: 'Load more' }));
    await waitFor(() => expect(within(list).getAllByRole('listitem')).toHaveLength(2));
    expect(within(list).getAllByRole('listitem')[0]).toHaveTextContent('Saved version 1');
    expect(within(list).getAllByRole('listitem')[1]).toHaveTextContent('Saved version 2');
    expect(mockedActivity).toHaveBeenNthCalledWith(1, project.id);
    expect(mockedActivity).toHaveBeenNthCalledWith(2, project.id, opaqueCursor);
    expect(screen.queryByRole('button', { name: 'Load more' })).not.toBeInTheDocument();
    expect(screen.getByText('End of activity')).toHaveAttribute('role', 'status');
  });

  it('disables Load more while the next page is pending and announces page loading', async () => {
    let resolvePage!: (value: ProjectActivityPage) => void;
    mockedActivity.mockResolvedValueOnce(page([item()], 'cursor-1')).mockReturnValueOnce(
      new Promise((resolve) => {
        resolvePage = resolve;
      }),
    );
    const user = userEvent.setup();
    renderPanel();
    await user.click(screen.getByRole('tab', { name: 'Activity' }));
    await screen.findByRole('list', { name: 'Project activity' });
    await user.click(screen.getByRole('button', { name: 'Load more' }));
    expect(screen.getByRole('button', { name: 'Load more' })).toBeDisabled();
    expect(screen.getByText('Loading more activity…')).toHaveAttribute('role', 'status');
    await act(async () => resolvePage(page([item({ id: 2 })])));
  });
});
