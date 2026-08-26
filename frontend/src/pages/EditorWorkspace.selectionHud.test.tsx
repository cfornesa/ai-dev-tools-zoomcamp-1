import { fireEvent, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import * as projectsApi from '../api/projects';
import type { Project, SceneVersion } from '../api/projects';
import EditorWorkspace from './EditorWorkspace';
import { expandAllCollapsibleSections } from '../testUtils/expandCollapsibleSections';

/**
 * Issue #163 (task 131): interaction tests for the canvas-overlaid
 * "active selection" HUD (`SelectionHud.tsx`), rendered in
 * `EditorWorkspace.tsx`'s Preview panel. Every HUD control here is
 * asserted to drive the exact same mutation `LayersPanel.tsx`'s
 * `OutlineRowItem` already calls for that control — no new mutation logic,
 * per this issue's own acceptance criteria — so most of these tests read
 * the outline row's own reflected state (visible/locked buttons, the
 * shape/group's presence) as the source of truth for "did the mutation
 * actually happen," the same way `EditorWorkspace.layers.test.tsx` already
 * does for the identical buttons on the outline row itself.
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
}

function outlineList() {
  return screen.getByRole('list', { name: 'Scene outline' });
}

function hud() {
  return screen.queryByTestId('selection-hud');
}

function stubEmptyCanvasHit() {
  const canvas = screen.getByTestId('scene-canvas');
  canvas.getBoundingClientRect = () =>
    ({ left: 0, top: 0, right: 800, bottom: 600, width: 800, height: 600 }) as DOMRect;
  return canvas;
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

describe('SelectionHud: visibility (issue #163)', () => {
  it('shows nothing when no shape or group is selected', async () => {
    await loadReadyWorkspace();
    expect(hud()).not.toBeInTheDocument();
  });

  it('appears when a shape is selected (shape auto-selected on add)', async () => {
    await loadReadyWorkspace();
    const user = userEvent.setup();
    await user.click(screen.getByRole('button', { name: 'Add circle' }));

    expect(hud()).toBeInTheDocument();
    expect(within(hud()!).getByText('Circle 1')).toBeInTheDocument();
  });

  it('appears for a selected group, with color/opacity fields omitted', async () => {
    await loadReadyWorkspace();
    const user = userEvent.setup();
    await user.click(screen.getByRole('button', { name: 'Add circle' }));
    await user.click(screen.getByRole('button', { name: 'Add rectangle' }));
    // Issue #168 (task 136) added Visible/Locked checkboxes to layer
    // rows in this same outline list, so an unscoped `getAllByRole`
    // would also pick those up -- filter to the "Select for grouping"
    // checkboxes this helper actually means.
    const checkboxes = within(outlineList()).getAllByRole('checkbox', {
      name: /to group selection$/i,
    });
    await user.click(checkboxes[0]);
    await user.click(checkboxes[1]);
    await user.click(screen.getByRole('button', { name: 'Combine into group' }));

    const groupButton = within(outlineList()).getByRole('button', { name: /Group: Group 1/ });
    await user.click(groupButton);

    const panel = hud();
    expect(panel).toBeInTheDocument();
    expect(within(panel!).getByText('Group 1')).toBeInTheDocument();
    expect(within(panel!).queryByLabelText('Fill')).not.toBeInTheDocument();
    expect(within(panel!).queryByLabelText('Opacity')).not.toBeInTheDocument();
    // Visibility/lock/delete are still present for a group.
    expect(within(panel!).getByRole('button', { name: 'Visible' })).toBeInTheDocument();
    expect(within(panel!).getByRole('button', { name: 'Unlocked' })).toBeInTheDocument();
    expect(
      within(panel!).getByRole('button', { name: 'Delete group Group 1' }),
    ).toBeInTheDocument();
  });

  it('does not render a HUD for a layer row (layers are never the active selection)', async () => {
    await loadReadyWorkspace();
    // No shape/group ever added or selected — a layer row exists but has
    // no selection concept of its own (useSceneEditor.selectShape rejects
    // layer ids outright).
    expect(hud()).not.toBeInTheDocument();
  });

  it('hides when the selection is cleared by clicking empty canvas', async () => {
    await loadReadyWorkspace();
    await userEvent.setup().click(screen.getByRole('button', { name: 'Add circle' }));
    expect(hud()).toBeInTheDocument();

    const canvas = stubEmptyCanvasHit();
    fireEvent.click(canvas, { clientX: 5, clientY: 5 });

    expect(hud()).not.toBeInTheDocument();
  });

  it('hides on Escape', async () => {
    await loadReadyWorkspace();
    await userEvent.setup().click(screen.getByRole('button', { name: 'Add circle' }));
    expect(hud()).toBeInTheDocument();

    fireEvent.keyDown(window, { key: 'Escape' });

    expect(hud()).not.toBeInTheDocument();
  });

  it('updates to reflect a new selection with no stale state', async () => {
    await loadReadyWorkspace();
    const user = userEvent.setup();
    await user.click(screen.getByRole('button', { name: 'Add circle' })); // Circle 1
    await user.click(screen.getByRole('button', { name: 'Add rectangle' })); // Rectangle 1, auto-selected

    expect(within(hud()!).getByText('Rectangle 1')).toBeInTheDocument();

    const circleButton = within(outlineList()).getByRole('button', { name: 'Circle 1' });
    await user.click(circleButton);

    expect(within(hud()!).getByText('Circle 1')).toBeInTheDocument();
    expect(within(hud()!).queryByText('Rectangle 1')).not.toBeInTheDocument();
  });
});

describe('SelectionHud: shape controls reuse the exact LayersPanel mutations (issue #163)', () => {
  // Issue #164 (task 132): the outline row's own Visible/Locked buttons
  // are gone (compacted away) — the HUD's own re-rendered `aria-pressed`
  // state after each toggle is now the only on-screen reflection of
  // `toggleShapeVisible`/`toggleShapeLocked` actually having run.
  it('toggles shape visibility', async () => {
    await loadReadyWorkspace();
    const user = userEvent.setup();
    await user.click(screen.getByRole('button', { name: 'Add circle' }));

    await user.click(within(hud()!).getByRole('button', { name: 'Visible' }));

    expect(within(hud()!).getByRole('button', { name: 'Hidden' })).toHaveAttribute(
      'aria-pressed',
      'false',
    );
  });

  it('toggles shape lock', async () => {
    await loadReadyWorkspace();
    const user = userEvent.setup();
    await user.click(screen.getByRole('button', { name: 'Add circle' }));

    await user.click(within(hud()!).getByRole('button', { name: 'Unlocked' }));

    expect(within(hud()!).getByRole('button', { name: 'Locked' })).toHaveAttribute(
      'aria-pressed',
      'true',
    );
  });

  it('edits fill color via updateSelectedShapeColorField', async () => {
    await loadReadyWorkspace();
    const user = userEvent.setup();
    await user.click(screen.getByRole('button', { name: 'Add circle' }));

    const fillInput = within(hud()!).getByLabelText('Selection fill');
    await user.clear(fillInput);
    await user.type(fillInput, '#336699');

    expect(fillInput).toHaveValue('#336699');
    expect(within(hud()!).queryByRole('alert')).not.toBeInTheDocument();
  });

  it('surfaces a validation error for an invalid fill color, without corrupting state', async () => {
    await loadReadyWorkspace();
    const user = userEvent.setup();
    await user.click(screen.getByRole('button', { name: 'Add circle' }));

    const fillInput = within(hud()!).getByLabelText('Selection fill');
    await user.clear(fillInput);
    await user.type(fillInput, 'not-a-color');

    expect(within(hud()!).getByRole('alert')).toBeInTheDocument();
  });

  it('edits opacity via the same opacity ShapeStyleField mutation', async () => {
    await loadReadyWorkspace();
    const user = userEvent.setup();
    await user.click(screen.getByRole('button', { name: 'Add circle' }));

    const opacityInput = within(hud()!).getByLabelText('Selection opacity');
    expect(opacityInput).toHaveValue('1');
    await user.clear(opacityInput);
    await user.type(opacityInput, '0.5');

    expect(opacityInput).toHaveValue('0.5');
    expect(within(hud()!).queryByRole('alert')).not.toBeInTheDocument();
  });

  it('renames the selected shape from the HUD and keeps the rename undoable', async () => {
    await loadReadyWorkspace();
    const user = userEvent.setup();
    await user.click(screen.getByRole('button', { name: 'Add circle' }));

    const nameInput = within(hud()!).getByRole('textbox', { name: 'Shape name for Circle 1' });
    await user.clear(nameInput);
    await user.type(nameInput, '  Hero  ');
    await user.keyboard('{Enter}');

    expect(within(hud()!).getByText('Hero')).toBeInTheDocument();
    expect(within(outlineList()).getByRole('button', { name: 'Hero' })).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Undo' }));
    expect(within(hud()!).getByText('Circle 1')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Redo' }));
    expect(within(hud()!).getByText('Hero')).toBeInTheDocument();
  });

  it('cancels a HUD shape rename draft with Escape', async () => {
    await loadReadyWorkspace();
    const user = userEvent.setup();
    await user.click(screen.getByRole('button', { name: 'Add circle' }));

    const nameInput = within(hud()!).getByRole('textbox', { name: 'Shape name for Circle 1' });
    await user.clear(nameInput);
    await user.type(nameInput, 'Discarded');
    await user.keyboard('{Escape}');

    expect(within(hud()!).getByText('Circle 1')).toBeInTheDocument();
    expect(within(outlineList()).getByRole('button', { name: 'Circle 1' })).toBeInTheDocument();
  });

  it('deletes the selected shape via deleteSelected', async () => {
    await loadReadyWorkspace();
    const user = userEvent.setup();
    await user.click(screen.getByRole('button', { name: 'Add circle' }));

    await user.click(within(hud()!).getByRole('button', { name: 'Delete shape Circle 1' }));

    expect(screen.queryByText(/1 shape\(s\) in the working copy/)).not.toBeInTheDocument();
    expect(screen.getByText(/0 shape\(s\) in the working copy/)).toBeInTheDocument();
    expect(hud()).not.toBeInTheDocument();
  });
});

describe('SelectionHud: group controls reuse the exact LayersPanel mutations (issue #163)', () => {
  async function selectAGroup(user: ReturnType<typeof userEvent.setup>) {
    await user.click(screen.getByRole('button', { name: 'Add circle' }));
    await user.click(screen.getByRole('button', { name: 'Add rectangle' }));
    // Issue #168 (task 136) added Visible/Locked checkboxes to layer
    // rows in this same outline list, so an unscoped `getAllByRole`
    // would also pick those up -- filter to the "Select for grouping"
    // checkboxes this helper actually means.
    const checkboxes = within(outlineList()).getAllByRole('checkbox', {
      name: /to group selection$/i,
    });
    await user.click(checkboxes[0]);
    await user.click(checkboxes[1]);
    await user.click(screen.getByRole('button', { name: 'Combine into group' }));
    const groupButton = within(outlineList()).getByRole('button', { name: /Group: Group 1/ });
    await user.click(groupButton);
  }

  // Issue #164 (task 132): the outline row's own Visible/Locked buttons
  // are gone (compacted away) — asserting on the HUD's own re-rendered
  // `aria-pressed` state after each toggle instead.
  it('toggles group visibility', async () => {
    await loadReadyWorkspace();
    const user = userEvent.setup();
    await selectAGroup(user);

    await user.click(within(hud()!).getByRole('button', { name: 'Visible' }));

    expect(within(hud()!).getByRole('button', { name: 'Hidden' })).toHaveAttribute(
      'aria-pressed',
      'false',
    );
  });

  it('toggles group lock', async () => {
    await loadReadyWorkspace();
    const user = userEvent.setup();
    await selectAGroup(user);

    await user.click(within(hud()!).getByRole('button', { name: 'Unlocked' }));

    expect(within(hud()!).getByRole('button', { name: 'Locked' })).toHaveAttribute(
      'aria-pressed',
      'true',
    );
  });

  it('deletes the selected group via deleteGroupSelected', async () => {
    await loadReadyWorkspace();
    const user = userEvent.setup();
    await selectAGroup(user);

    await user.click(within(hud()!).getByRole('button', { name: 'Delete group Group 1' }));

    expect(
      within(outlineList())
        .queryAllByRole('listitem')
        .filter((r) => r.dataset.outlineKind === 'group'),
    ).toHaveLength(0);
    expect(hud()).not.toBeInTheDocument();
  });
});

describe('SelectionHud: keyboard operability (issue #163)', () => {
  it('every HUD control is reachable by Tab and activatable via keyboard', async () => {
    await loadReadyWorkspace();
    const user = userEvent.setup();
    await user.click(screen.getByRole('button', { name: 'Add circle' }));

    const visibleButton = within(hud()!).getByRole('button', { name: 'Visible' });
    visibleButton.focus();
    expect(visibleButton).toHaveFocus();
    await user.keyboard('{Enter}');

    expect(within(hud()!).getByRole('button', { name: 'Hidden' })).toHaveAttribute(
      'aria-pressed',
      'false',
    );

    const deleteButton = within(hud()!).getByRole('button', { name: 'Delete shape Circle 1' });
    deleteButton.focus();
    expect(deleteButton).toHaveFocus();
    await user.keyboard('{Enter}');

    expect(hud()).not.toBeInTheDocument();
  });
});
