import { fireEvent, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import * as projectsApi from '../api/projects';
import type { Project, SceneVersion } from '../api/projects';
import EditorWorkspace from './EditorWorkspace';
import { expandAllCollapsibleSections } from '../testUtils/expandCollapsibleSections';

/**
 * Issue #173 (task 141): `SelectionHud.tsx` gained a collapse/expand
 * toggle in its header. Collapsing hides the HUD's body (Visible/Locked/
 * color/opacity/delete/move controls) while leaving the underlying
 * selection — `selectedShapeId`/`multiSelectedIds`, the canvas handles,
 * and the Layers-panel row's `[data-selected='true']` highlight —
 * completely untouched. A collapsed HUD keeps a small persistent header
 * (title + toggle) so it can be reopened without reselecting. A fresh
 * selection always resets to expanded, per this issue's own groomed
 * decision. Deselecting still dismisses the HUD entirely, unaffected by
 * this task.
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
  await userEvent.setup().click(screen.getByRole('button', { name: 'Edit scene' }));
}

function outlineList() {
  return screen.getByRole('list', { name: 'Scene outline' });
}

function hud() {
  return screen.queryByTestId('selection-hud');
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

describe('SelectionHud collapse/expand toggle (issue #173)', () => {
  it('starts expanded for a freshly selected shape', async () => {
    await loadReadyWorkspace();
    const user = userEvent.setup();
    await user.click(screen.getByRole('button', { name: 'Add circle' }));

    const toggle = within(hud()!).getByRole('button', { name: 'Collapse selection panel' });
    expect(toggle).toHaveAttribute('aria-expanded', 'true');
    expect(within(hud()!).getByRole('button', { name: 'Visible' })).toBeInTheDocument();
  });

  it('collapsing hides the body but keeps a persistent header with the toggle', async () => {
    await loadReadyWorkspace();
    const user = userEvent.setup();
    await user.click(screen.getByRole('button', { name: 'Add circle' }));

    const toggle = within(hud()!).getByRole('button', { name: 'Collapse selection panel' });
    await user.click(toggle);

    expect(hud()).toBeInTheDocument();
    expect(within(hud()!).queryByRole('button', { name: 'Visible' })).not.toBeInTheDocument();
    expect(within(hud()!).getByText('Circle 1')).toBeInTheDocument();
    const reopenToggle = within(hud()!).getByRole('button', { name: 'Expand selection panel' });
    expect(reopenToggle).toHaveAttribute('aria-expanded', 'false');
  });

  it('re-expands the body when the toggle is activated again', async () => {
    await loadReadyWorkspace();
    const user = userEvent.setup();
    await user.click(screen.getByRole('button', { name: 'Add circle' }));

    await user.click(within(hud()!).getByRole('button', { name: 'Collapse selection panel' }));
    await user.click(within(hud()!).getByRole('button', { name: 'Expand selection panel' }));

    expect(within(hud()!).getByRole('button', { name: 'Visible' })).toBeInTheDocument();
    expect(
      within(hud()!).getByRole('button', { name: 'Collapse selection panel' }),
    ).toHaveAttribute('aria-expanded', 'true');
  });

  it('collapsing does not change the underlying selection or Layers-panel highlight', async () => {
    await loadReadyWorkspace();
    const user = userEvent.setup();
    await user.click(screen.getByRole('button', { name: 'Add circle' }));

    const circleRow = within(outlineList())
      .getByRole('button', { name: 'Circle 1' })
      .closest('li')!;
    expect(circleRow).toHaveAttribute('data-selected', 'true');

    await user.click(within(hud()!).getByRole('button', { name: 'Collapse selection panel' }));

    // Selection state is unaffected: the row highlight persists, and the
    // HUD still reports the same selected shape via its accessible name.
    expect(circleRow).toHaveAttribute('data-selected', 'true');
    expect(hud()).toHaveAttribute('aria-label', 'Selected: Circle 1');
  });

  it('resets to expanded when a different shape is newly selected', async () => {
    await loadReadyWorkspace();
    const user = userEvent.setup();
    await user.click(screen.getByRole('button', { name: 'Add circle' })); // Circle 1
    await user.click(screen.getByRole('button', { name: 'Add rectangle' })); // Rectangle 1, auto-selected

    await user.click(within(hud()!).getByRole('button', { name: 'Collapse selection panel' }));
    expect(within(hud()!).queryByRole('button', { name: 'Visible' })).not.toBeInTheDocument();

    const circleButton = within(outlineList()).getByRole('button', { name: 'Circle 1' });
    await user.click(circleButton);

    // A brand-new selection (a different shape) always resets to expanded,
    // regardless of the previous shape's collapsed state.
    expect(within(hud()!).getByText('Circle 1')).toBeInTheDocument();
    expect(within(hud()!).getByRole('button', { name: 'Visible' })).toBeInTheDocument();
    expect(
      within(hud()!).getByRole('button', { name: 'Collapse selection panel' }),
    ).toHaveAttribute('aria-expanded', 'true');
  });

  it('still dismisses the HUD entirely on deselect, even while collapsed', async () => {
    await loadReadyWorkspace();
    const user = userEvent.setup();
    await user.click(screen.getByRole('button', { name: 'Add circle' }));
    await user.click(within(hud()!).getByRole('button', { name: 'Collapse selection panel' }));
    expect(hud()).toBeInTheDocument();

    fireEvent.keyDown(window, { key: 'Escape' });

    expect(hud()).not.toBeInTheDocument();
  });

  it('the toggle is reachable via Tab and activatable via Enter/Space', async () => {
    await loadReadyWorkspace();
    const user = userEvent.setup();
    await user.click(screen.getByRole('button', { name: 'Add circle' }));

    const toggle = within(hud()!).getByRole('button', { name: 'Collapse selection panel' });
    toggle.focus();
    expect(toggle).toHaveFocus();
    await user.keyboard('{Enter}');

    expect(within(hud()!).queryByRole('button', { name: 'Visible' })).not.toBeInTheDocument();

    const reopenToggle = within(hud()!).getByRole('button', { name: 'Expand selection panel' });
    reopenToggle.focus();
    await user.keyboard(' ');

    expect(within(hud()!).getByRole('button', { name: 'Visible' })).toBeInTheDocument();
  });
});
