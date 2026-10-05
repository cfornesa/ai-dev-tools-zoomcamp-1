import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import * as activityApi from '../api/projectActivity';
import * as projectsApi from '../api/projects';
import type { Project, SceneDocument, SceneVersion, SceneVersionSummary } from '../api/projects';
import VersionHistoryPanel from './VersionHistoryPanel';

vi.mock('../api/projectActivity');
vi.mock('../api/projects');

const mockedActivity = vi.mocked(activityApi.listProjectActivity);
const mockedVersions = vi.mocked(projectsApi.listSceneVersions);
const mockedGetVersion = vi.mocked(projectsApi.getSceneVersion);

const blankScene: SceneDocument = {
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

const changedScene: SceneDocument = {
  ...structuredClone(blankScene),
  canvas: { width: 900, height: 600, backgroundColor: '#ffffff' },
  layers: [{ id: 'foreground', name: 'Foreground', order: 0, visible: true, locked: false }],
  shapes: [
    {
      id: 'circle-1',
      type: 'circle',
      layerId: 'foreground',
      groupId: null,
      transform: { x: 40, y: 30, scaleX: 1, scaleY: 1, rotation: 0, opacity: 1 },
      style: { fill: '#112233', stroke: null, strokeWidth: 0 },
      radius: 10,
    },
  ],
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

const summaries: SceneVersionSummary[] = [
  {
    id: 1,
    sequence: 1,
    origin: 'manual',
    change_label: 'Initial scene',
    created_by: 'alice',
    parent: null,
    fork_source_version: null,
    created_at: '2026-01-01T00:00:00Z',
  },
  {
    id: 2,
    sequence: 2,
    origin: 'manual',
    change_label: 'Added a circle',
    created_by: 'alice',
    parent: 1,
    fork_source_version: null,
    created_at: '2026-01-02T00:00:00Z',
  },
];

function version(summary: SceneVersionSummary, scene_json: SceneDocument): SceneVersion {
  return { ...summary, scene_json };
}

function renderPanel() {
  return render(
    <VersionHistoryPanel
      projectId={project.id}
      project={project}
      persistedVersion={version(summaries[1], changedScene)}
      isDirty={false}
      onRestored={vi.fn()}
    />,
  );
}

beforeEach(() => {
  vi.clearAllMocks();
  mockedVersions.mockResolvedValue(summaries);
  mockedActivity.mockResolvedValue({ results: [], next_cursor: null });
  mockedGetVersion.mockImplementation(async (_projectId, id) =>
    id === 1 ? version(summaries[0], blankScene) : version(summaries[1], changedScene),
  );
});

describe('VersionHistoryPanel version comparison', () => {
  it('compares two different versions with grouped shape, layer, and canvas summaries', async () => {
    const user = userEvent.setup();
    renderPanel();

    const rows = await screen.findByRole('list', { name: 'Version history' });
    const firstVersion = within(rows).getByText('Version 1').closest('li');
    expect(firstVersion).not.toBeNull();
    await user.click(
      within(firstVersion as HTMLElement).getByRole('button', { name: 'Compare with…' }),
    );

    const target = screen.getByLabelText('Compare with');
    expect(within(target).queryByRole('option', { name: 'Version 1' })).not.toBeInTheDocument();
    await user.selectOptions(target, '2');
    await user.click(screen.getByRole('button', { name: 'Compare versions' }));

    const result = await screen.findByLabelText('Differences between versions 1 and 2');
    expect(within(result).getByRole('heading', { name: 'Shapes (1)' })).toBeVisible();
    expect(within(result).getByText('Added: circle-1')).toBeVisible();
    expect(within(result).getByRole('heading', { name: 'Layers (1)' })).toBeVisible();
    expect(within(result).getByText('Added: foreground')).toBeVisible();
    expect(within(result).getByRole('heading', { name: 'Canvas (1)' })).toBeVisible();
    expect(within(result).getByText('width changed')).toBeVisible();
    expect(mockedGetVersion).toHaveBeenNthCalledWith(1, project.id, 1);
    expect(mockedGetVersion).toHaveBeenNthCalledWith(2, project.id, 2);
    expect(vi.mocked(projectsApi.saveSceneVersion)).not.toHaveBeenCalled();
    expect(vi.mocked(projectsApi.restoreSceneVersion)).not.toHaveBeenCalled();
    expect(vi.mocked(projectsApi.deleteSceneVersion)).not.toHaveBeenCalled();
    expect(mockedActivity).not.toHaveBeenCalled();
  });

  it('announces an empty diff and excludes the selected version from its comparison options', async () => {
    mockedGetVersion.mockImplementation(async (_projectId, id) =>
      version(id === 1 ? summaries[0] : summaries[1], blankScene),
    );
    const user = userEvent.setup();
    renderPanel();

    const rows = await screen.findByRole('list', { name: 'Version history' });
    const firstVersion = within(rows).getByText('Version 1').closest('li') as HTMLElement;
    await user.click(within(firstVersion).getByRole('button', { name: 'Compare with…' }));
    expect(
      within(screen.getByLabelText('Compare with')).queryByRole('option', { name: 'Version 1' }),
    ).not.toBeInTheDocument();
    await user.selectOptions(screen.getByLabelText('Compare with'), '2');
    await user.click(screen.getByRole('button', { name: 'Compare versions' }));

    expect(await screen.findByText('No differences')).toHaveAttribute('role', 'status');
  });

  it('announces while full scene versions are loading', async () => {
    let resolveVersion!: (value: SceneVersion) => void;
    mockedGetVersion.mockReturnValue(
      new Promise((resolve) => {
        resolveVersion = resolve;
      }),
    );
    const user = userEvent.setup();
    renderPanel();

    const rows = await screen.findByRole('list', { name: 'Version history' });
    const firstVersion = within(rows).getByText('Version 1').closest('li') as HTMLElement;
    await user.click(within(firstVersion).getByRole('button', { name: 'Compare with…' }));
    await user.selectOptions(screen.getByLabelText('Compare with'), '2');
    await user.click(screen.getByRole('button', { name: 'Compare versions' }));
    expect(screen.getByText('Loading versions to compare…')).toHaveAttribute('aria-live', 'polite');

    resolveVersion(version(summaries[0], blankScene));
    expect(await screen.findByText('No differences')).toHaveAttribute('role', 'status');
  });

  it('shows an unavailable-version error if either full scene cannot be fetched', async () => {
    mockedGetVersion.mockRejectedValueOnce(new Error('deleted'));
    const user = userEvent.setup();
    renderPanel();

    const rows = await screen.findByRole('list', { name: 'Version history' });
    const firstVersion = within(rows).getByText('Version 1').closest('li') as HTMLElement;
    await user.click(within(firstVersion).getByRole('button', { name: 'Compare with…' }));
    await user.selectOptions(screen.getByLabelText('Compare with'), '2');
    await user.click(screen.getByRole('button', { name: 'Compare versions' }));

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'One may have been deleted or is unavailable',
    );
    await waitFor(() => expect(mockedGetVersion).toHaveBeenCalledTimes(2));
  });
});
