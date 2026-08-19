import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { axe } from 'jest-axe';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import * as projectsApi from '../api/projects';
import type { Project, SceneDocument, SceneVersion, SceneVersionSummary } from '../api/projects';
import Layout from '../components/Layout';
import ExportConfigDialog, { type ExportConfig } from './ExportConfigDialog';

/**
 * Task 63 (issue #63): automated accessibility checks for the export
 * configuration dialog (Task 55) — the open dialog in its default state,
 * renderer-compatibility blocking, metadata-blocking, and generation-error
 * states, all of which are surfaced via `role="alert"` regions rather than
 * color/position alone.
 */

vi.mock('../api/projects');

const mockedListSceneVersions = vi.mocked(projectsApi.listSceneVersions);
const mockedGetSceneVersion = vi.mocked(projectsApi.getSceneVersion);

const BASE_SCENE: SceneDocument = {
  schemaVersion: 1,
  id: 'scene-1',
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

function summary(overrides: Partial<SceneVersionSummary> = {}): SceneVersionSummary {
  return {
    id: 1,
    sequence: 1,
    origin: 'manual',
    change_label: null,
    created_by: 'alice',
    parent: null,
    fork_source_version: null,
    created_at: '2026-01-01T00:00:00Z',
    ...overrides,
  };
}

function versionDetail(
  overrides: Partial<SceneVersion> = {},
  scene: SceneDocument = BASE_SCENE,
): SceneVersion {
  return { ...summary(), scene_json: scene, ...overrides };
}

function baseProject(overrides: Partial<Project> = {}): Project {
  return {
    id: 'p1',
    owner: 'alice',
    title: 'My animation',
    description: 'A description that says something.',
    tags: [],
    visibility: 'private',
    allow_public_remix: false,
    thumbnail_choice: 'auto',
    export_attribution: false,
    current_version: 2,
    created_at: '2026-01-01T00:00:00Z',
    updated_at: '2026-01-01T00:00:00Z',
    ...overrides,
  };
}

const TWO_VERSIONS: SceneVersionSummary[] = [
  summary({ id: 1, sequence: 1 }),
  summary({ id: 2, sequence: 2 }),
];

beforeEach(() => {
  vi.clearAllMocks();
  mockedListSceneVersions.mockResolvedValue(TWO_VERSIONS);
  mockedGetSceneVersion.mockImplementation((_projectId, versionId) =>
    Promise.resolve(versionDetail({ id: versionId, sequence: versionId })),
  );
});

function renderDialog(project: Project, onExport?: (config: ExportConfig) => void | Promise<void>) {
  return render(
    <MemoryRouter initialEntries={['/projects/p1']}>
      <Routes>
        <Route path="/" element={<Layout />}>
          <Route
            path="projects/:id"
            element={
              // A bare h2/h3 ancestor, matching `EditorWorkspace.tsx`'s real
              // nesting — see `VersionHistoryPanel.a11y.test.tsx`'s
              // identical comment for why this dialog's own `<h4>` is only
              // valid with that ancestor present.
              <>
                <h2>My animation</h2>
                <h3>Export section</h3>
                <ExportConfigDialog projectId="p1" project={project} onExport={onExport} />
              </>
            }
          />
        </Route>
      </Routes>
    </MemoryRouter>,
  );
}

async function openDialog(project = baseProject()) {
  const user = userEvent.setup();
  const utils = renderDialog(project);
  await user.click(screen.getByRole('button', { name: /export…/i }));
  const dialog = await screen.findByRole('dialog', { name: /export project/i });
  await waitFor(() => expect(mockedGetSceneVersion).toHaveBeenCalled());
  return { user, dialog, ...utils };
}

describe('ExportConfigDialog accessibility', () => {
  it('has no axe violations in the default open state', async () => {
    const { container } = await openDialog();
    expect(await axe(container)).toHaveNoViolations();
  });

  it('has no axe violations when renderer compatibility blocks export', async () => {
    mockedGetSceneVersion.mockResolvedValue(
      versionDetail(
        {},
        { ...BASE_SCENE, shapes: [{ id: 's1', type: 'sprite3d', layerId: 'layer-1' } as never] },
      ),
    );
    const { container, dialog } = await openDialog();
    await within(dialog).findByTestId('export-compatibility-errors');
    expect(await axe(container)).toHaveNoViolations();
  });

  it('has no axe violations when export is blocked by metadata errors', async () => {
    const { container, dialog } = await openDialog(
      baseProject({ title: 'Untitled animation', description: '' }),
    );
    await within(dialog).findByTestId('export-metadata-errors');
    expect(await axe(container)).toHaveNoViolations();
  });

  it('has no axe violations when export generation fails', async () => {
    const { ExportGenerationBlockedError } = await import('../export/generateHtmlExport');
    const onExport = vi
      .fn()
      .mockRejectedValue(new ExportGenerationBlockedError(['Could not read canvas pixel data.']));

    const user = userEvent.setup();
    const { container } = renderDialog(baseProject(), onExport);
    await user.click(screen.getByRole('button', { name: /export…/i }));
    const dialog = await screen.findByRole('dialog', { name: /export project/i });
    await waitFor(() => expect(mockedGetSceneVersion).toHaveBeenCalled());
    await waitFor(() =>
      expect(within(dialog).getByRole('button', { name: /^export$/i })).toBeEnabled(),
    );

    await user.click(within(dialog).getByRole('button', { name: /^export$/i }));
    await within(dialog).findByTestId('export-generation-errors');

    expect(await axe(container)).toHaveNoViolations();
  });
});
