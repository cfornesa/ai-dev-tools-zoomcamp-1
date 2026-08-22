import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import * as projectsApi from '../api/projects';
import type { Project, SceneVersion } from '../api/projects';
import EditorWorkspace from './EditorWorkspace';
import { expandAllCollapsibleSections } from '../testUtils/expandCollapsibleSections';

/**
 * Task 24: interaction and keyboard-operability tests for the scene
 * outline (layers, groups, reordering, visibility/lock, grouping and
 * ungrouping) layered on top of the Task 21/23 workspace shell. See
 * `sceneOutline.test.ts` and `useSceneEditor.outline.test.ts` for the
 * underlying logic tests.
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
});

describe('EditorWorkspace scene outline: layers', () => {
  it('shows the initial layer in the outline', async () => {
    await loadReadyWorkspace();
    expect(within(outlineList()).getByLabelText('Layer name for Layer 1')).toBeInTheDocument();
  });

  it('adds a new layer via pointer click', async () => {
    await loadReadyWorkspace();
    const user = userEvent.setup();

    await user.click(screen.getByRole('button', { name: 'Add layer' }));

    const rows = within(outlineList()).getAllByRole('listitem');
    expect(rows.filter((r) => r.dataset.outlineKind === 'layer')).toHaveLength(2);
  });

  it('adds a layer via keyboard-only interaction', async () => {
    await loadReadyWorkspace();
    const user = userEvent.setup();

    const addLayerButton = screen.getByRole('button', { name: 'Add layer' });
    addLayerButton.focus();
    expect(addLayerButton).toHaveFocus();
    await user.keyboard('{Enter}');

    const rows = within(outlineList()).getAllByRole('listitem');
    expect(rows.filter((r) => r.dataset.outlineKind === 'layer')).toHaveLength(2);
  });

  it('renames a layer by typing into its name field and blurring', async () => {
    await loadReadyWorkspace();
    const user = userEvent.setup();

    const nameField = within(outlineList()).getByLabelText('Layer name for Layer 1');
    await user.clear(nameField);
    await user.type(nameField, 'Background{Tab}');

    expect(within(outlineList()).getByLabelText('Layer name for Background')).toBeInTheDocument();
  });

  it('shows a textual explanation instead of deleting the only layer', async () => {
    await loadReadyWorkspace();
    const user = userEvent.setup();

    await user.click(screen.getByRole('button', { name: 'Delete layer Layer 1' }));

    expect(screen.getByRole('alert')).toHaveTextContent(/at least one layer/i);
    expect(within(outlineList()).getByLabelText('Layer name for Layer 1')).toBeInTheDocument();
  });

  it('reorders two layers with the move buttons, reflected in outline order', async () => {
    await loadReadyWorkspace();
    const user = userEvent.setup();
    await user.click(screen.getByRole('button', { name: 'Add layer' }));

    // Second layer is "Layer 2"; move it above "Layer 1".
    await user.click(screen.getByRole('button', { name: 'Move layer Layer 2 up' }));

    const layerNames = within(outlineList())
      .getAllByRole('listitem')
      .filter((r) => r.dataset.outlineKind === 'layer')
      .map((r) => within(r).getByRole('textbox').getAttribute('value') ?? '');
    expect(layerNames[0]).toBe('Layer 2');
  });

  it('toggles layer visibility and lock state', async () => {
    await loadReadyWorkspace();
    const user = userEvent.setup();

    const visibleButton = screen.getByRole('button', { name: 'Visible' });
    await user.click(visibleButton);
    expect(screen.getByRole('button', { name: 'Hidden' })).toHaveAttribute('aria-pressed', 'false');

    const unlockedButton = screen.getByRole('button', { name: 'Unlocked' });
    await user.click(unlockedButton);
    expect(screen.getByRole('button', { name: 'Locked' })).toHaveAttribute('aria-pressed', 'true');
  });
});

describe('EditorWorkspace scene outline: selection sync', () => {
  it('selecting a shape from the outline also marks it selected on the shape list', async () => {
    await loadReadyWorkspace();
    const user = userEvent.setup();
    await user.click(screen.getByRole('button', { name: 'Add circle' }));

    const outlineShapeButton = within(outlineList()).getByRole('button', { name: 'Circle shape' });
    await user.click(outlineShapeButton);

    expect(outlineShapeButton).toHaveAttribute('aria-pressed', 'true');
    const shapeListButton = within(screen.getByRole('list', { name: 'Shape list' })).getByRole(
      'button',
    );
    expect(shapeListButton).toHaveAttribute('aria-pressed', 'true');
  });
});

describe('EditorWorkspace scene outline: grouping', () => {
  it('combines two multi-selected shapes into a group via keyboard', async () => {
    await loadReadyWorkspace();
    const user = userEvent.setup();
    await user.click(screen.getByRole('button', { name: 'Add circle' }));
    await user.click(screen.getByRole('button', { name: 'Add rectangle' }));

    const checkboxes = within(outlineList()).getAllByRole('checkbox');
    expect(checkboxes).toHaveLength(2);
    checkboxes[0].focus();
    await user.keyboard(' ');
    checkboxes[1].focus();
    await user.keyboard(' ');

    const combineButton = screen.getByRole('button', { name: 'Combine into group' });
    expect(combineButton).toBeEnabled();
    await user.click(combineButton);

    const groupRows = within(outlineList())
      .getAllByRole('listitem')
      .filter((r) => r.dataset.outlineKind === 'group');
    expect(groupRows).toHaveLength(1);
    expect(within(groupRows[0]).getByText(/Group: Group 1 \(2 item\(s\)\)/)).toBeInTheDocument();
  });

  it('is disabled with fewer than two items selected for grouping', async () => {
    await loadReadyWorkspace();
    expect(screen.getByRole('button', { name: 'Combine into group' })).toBeDisabled();
  });

  it('ungroups a selected group back into top-level shapes', async () => {
    await loadReadyWorkspace();
    const user = userEvent.setup();
    await user.click(screen.getByRole('button', { name: 'Add circle' }));
    await user.click(screen.getByRole('button', { name: 'Add rectangle' }));
    const checkboxes = within(outlineList()).getAllByRole('checkbox');
    await user.click(checkboxes[0]);
    await user.click(checkboxes[1]);
    await user.click(screen.getByRole('button', { name: 'Combine into group' }));

    const groupButton = within(outlineList()).getByRole('button', { name: /Group: Group 1/ });
    await user.click(groupButton); // select the group as the active selection

    const ungroupButton = screen.getByRole('button', { name: 'Ungroup selected' });
    expect(ungroupButton).toBeEnabled();
    await user.click(ungroupButton);

    const rows = within(outlineList()).getAllByRole('listitem');
    expect(rows.filter((r) => r.dataset.outlineKind === 'group')).toHaveLength(0);
    expect(rows.filter((r) => r.dataset.outlineKind === 'shape')).toHaveLength(2);
  });

  it('deletes a selected group and its shapes', async () => {
    await loadReadyWorkspace();
    const user = userEvent.setup();
    await user.click(screen.getByRole('button', { name: 'Add circle' }));
    await user.click(screen.getByRole('button', { name: 'Add rectangle' }));
    const checkboxes = within(outlineList()).getAllByRole('checkbox');
    await user.click(checkboxes[0]);
    await user.click(checkboxes[1]);
    await user.click(screen.getByRole('button', { name: 'Combine into group' }));

    const groupButton = within(outlineList()).getByRole('button', { name: /Group: Group 1/ });
    await user.click(groupButton);

    await user.click(screen.getByRole('button', { name: 'Delete selected group' }));

    const rows = within(outlineList()).getAllByRole('listitem');
    expect(rows.filter((r) => r.dataset.outlineKind === 'group')).toHaveLength(0);
    expect(rows.filter((r) => r.dataset.outlineKind === 'shape')).toHaveLength(0);
    expect(screen.getByText('No shapes yet.')).toBeInTheDocument();
  });
});

describe('EditorWorkspace scene outline: reorder', () => {
  it('reorders shapes within the outline with move up/down buttons', async () => {
    await loadReadyWorkspace();
    const user = userEvent.setup();
    await user.click(screen.getByRole('button', { name: 'Add circle' }));
    await user.click(screen.getByRole('button', { name: 'Add rectangle' }));

    const shapeRowsBefore = within(outlineList())
      .getAllByRole('listitem')
      .filter((r) => r.dataset.outlineKind === 'shape');
    expect(shapeRowsBefore.map((r) => r.dataset.outlineId)).toHaveLength(2);
    const [firstId, secondId] = shapeRowsBefore.map((r) => r.dataset.outlineId);

    await user.click(within(shapeRowsBefore[1]).getByRole('button', { name: /Move .* up/ }));

    const shapeRowsAfter = within(outlineList())
      .getAllByRole('listitem')
      .filter((r) => r.dataset.outlineKind === 'shape');
    expect(shapeRowsAfter.map((r) => r.dataset.outlineId)).toEqual([secondId, firstId]);
  });
});

describe('EditorWorkspace scene outline: reparenting (Task 76)', () => {
  it('moves a shape to a different layer via pointer click', async () => {
    await loadReadyWorkspace();
    const user = userEvent.setup();
    await user.click(screen.getByRole('button', { name: 'Add layer' })); // Layer 2
    await user.click(screen.getByRole('button', { name: 'Add circle' }));

    const shapeRow = within(outlineList())
      .getAllByRole('listitem')
      .find((r) => r.dataset.outlineKind === 'shape')!;
    const layerSelect = within(shapeRow).getByRole('combobox', { name: /Target layer for/ });
    await user.selectOptions(layerSelect, 'Layer 2');
    await user.click(within(shapeRow).getByRole('button', { name: /Move .* to layer/ }));

    const rowsAfter = within(outlineList()).getAllByRole('listitem');
    // The shape row should now be nested under Layer 2, i.e. appear after
    // the "Layer 2" row rather than immediately after "Layer 1".
    const layer2Index = rowsAfter.findIndex(
      (r) => r.dataset.outlineKind === 'layer' && within(r).queryByDisplayValue('Layer 2'),
    );
    const shapeIndex = rowsAfter.findIndex((r) => r.dataset.outlineKind === 'shape');
    expect(shapeIndex).toBeGreaterThan(layer2Index);
  });

  it('moves a shape to a different layer via keyboard-only interaction', async () => {
    await loadReadyWorkspace();
    const user = userEvent.setup();
    await user.click(screen.getByRole('button', { name: 'Add layer' })); // Layer 2
    await user.click(screen.getByRole('button', { name: 'Add circle' }));

    const shapeRow = within(outlineList())
      .getAllByRole('listitem')
      .find((r) => r.dataset.outlineKind === 'shape')!;
    const layerSelect = within(shapeRow).getByRole('combobox', {
      name: /Target layer for/,
    }) as HTMLSelectElement;
    layerSelect.focus();
    expect(layerSelect).toHaveFocus();
    await user.selectOptions(layerSelect, 'Layer 2');

    const moveButton = within(shapeRow).getByRole('button', { name: /Move .* to layer/ });
    moveButton.focus();
    expect(moveButton).toHaveFocus();
    await user.keyboard('{Enter}');

    const rowsAfter = within(outlineList()).getAllByRole('listitem');
    const layer2Index = rowsAfter.findIndex(
      (r) => r.dataset.outlineKind === 'layer' && within(r).queryByDisplayValue('Layer 2'),
    );
    const shapeIndex = rowsAfter.findIndex((r) => r.dataset.outlineKind === 'shape');
    expect(shapeIndex).toBeGreaterThan(layer2Index);
  });

  it('moves a shape into a different group via pointer click', async () => {
    await loadReadyWorkspace();
    const user = userEvent.setup();
    await user.click(screen.getByRole('button', { name: 'Add circle' }));
    await user.click(screen.getByRole('button', { name: 'Add rectangle' }));
    const checkboxes = within(outlineList()).getAllByRole('checkbox');
    await user.click(checkboxes[0]);
    await user.click(checkboxes[1]);
    await user.click(screen.getByRole('button', { name: 'Combine into group' }));

    await user.click(screen.getByRole('button', { name: 'Add circle' }));
    const shapeRows = within(outlineList())
      .getAllByRole('listitem')
      .filter((r) => r.dataset.outlineKind === 'shape');
    const looseShapeRow = shapeRows[shapeRows.length - 1];

    const groupSelect = within(looseShapeRow).getByRole('combobox', { name: /Target group for/ });
    await user.selectOptions(groupSelect, 'Group 1');
    await user.click(within(looseShapeRow).getByRole('button', { name: /Move .* to group/ }));

    const groupRow = within(outlineList())
      .getAllByRole('listitem')
      .find((r) => r.dataset.outlineKind === 'group')!;
    expect(within(groupRow).getByText(/Group: Group 1 \(3 item\(s\)\)/)).toBeInTheDocument();
  });

  it('promotes a grouped shape back to top level via keyboard-only interaction', async () => {
    await loadReadyWorkspace();
    const user = userEvent.setup();
    await user.click(screen.getByRole('button', { name: 'Add circle' }));
    await user.click(screen.getByRole('button', { name: 'Add rectangle' }));
    const checkboxes = within(outlineList()).getAllByRole('checkbox');
    await user.click(checkboxes[0]);
    await user.click(checkboxes[1]);
    await user.click(screen.getByRole('button', { name: 'Combine into group' }));

    const groupedShapeRow = within(outlineList())
      .getAllByRole('listitem')
      .find((r) => r.dataset.outlineKind === 'shape')!;
    const groupSelect = within(groupedShapeRow).getByRole('combobox', {
      name: /Target group for/,
    }) as HTMLSelectElement;
    groupSelect.focus();
    expect(groupSelect).toHaveFocus();
    await user.selectOptions(groupSelect, 'Top level');

    const moveButton = within(groupedShapeRow).getByRole('button', { name: /Move .* to group/ });
    moveButton.focus();
    await user.keyboard('{Enter}');

    // The group keeps its one remaining child rather than being pruned.
    const rows = within(outlineList()).getAllByRole('listitem');
    expect(rows.filter((r) => r.dataset.outlineKind === 'group')).toHaveLength(1);
    expect(
      within(rows.find((r) => r.dataset.outlineKind === 'group')!).getByText(/\(1 item\(s\)\)/),
    ).toBeInTheDocument();
    expect(rows.filter((r) => r.dataset.outlineKind === 'shape')).toHaveLength(2);
  });

  it('shows a textual explanation instead of moving a group into its own descendant', async () => {
    await loadReadyWorkspace();
    const user = userEvent.setup();
    await user.click(screen.getByRole('button', { name: 'Add circle' }));
    await user.click(screen.getByRole('button', { name: 'Add rectangle' }));
    const checkboxes = within(outlineList()).getAllByRole('checkbox');
    await user.click(checkboxes[0]);
    await user.click(checkboxes[1]);
    await user.click(screen.getByRole('button', { name: 'Combine into group' })); // -> Group 1

    await user.click(screen.getByRole('button', { name: 'Add circle' }));
    const rowsBefore = within(outlineList()).getAllByRole('listitem');
    const looseShapeCheckbox = within(
      rowsBefore.filter((r) => r.dataset.outlineKind === 'shape').slice(-1)[0],
    ).getByRole('checkbox');
    const innerGroupCheckbox = within(
      rowsBefore.find((r) => r.dataset.outlineKind === 'group')!,
    ).getByRole('checkbox');
    await user.click(looseShapeCheckbox);
    await user.click(innerGroupCheckbox);
    await user.click(screen.getByRole('button', { name: 'Combine into group' })); // -> Group 2 (outer)

    const groupRows = within(outlineList())
      .getAllByRole('listitem')
      .filter((r) => r.dataset.outlineKind === 'group');
    const outerGroupRow = groupRows.find((r) => within(r).queryByText(/Group: Group 2/))!;
    const groupSelect = within(outerGroupRow).getByRole('combobox', { name: /Target group for/ });
    await user.selectOptions(groupSelect, 'Group 1');
    await user.click(within(outerGroupRow).getByRole('button', { name: /Move .* to group/ }));

    expect(screen.getByRole('alert')).toHaveTextContent(/descendant/i);
  });

  it('undoes a shape-to-layer move in a single step', async () => {
    await loadReadyWorkspace();
    const user = userEvent.setup();
    await user.click(screen.getByRole('button', { name: 'Add layer' }));
    await user.click(screen.getByRole('button', { name: 'Add circle' }));

    const shapeRow = within(outlineList())
      .getAllByRole('listitem')
      .find((r) => r.dataset.outlineKind === 'shape')!;
    const layerSelect = within(shapeRow).getByRole('combobox', { name: /Target layer for/ });
    await user.selectOptions(layerSelect, 'Layer 2');
    await user.click(within(shapeRow).getByRole('button', { name: /Move .* to layer/ }));

    const rowsAfterMove = within(outlineList()).getAllByRole('listitem');
    const layer2IndexAfterMove = rowsAfterMove.findIndex(
      (r) => r.dataset.outlineKind === 'layer' && within(r).queryByDisplayValue('Layer 2'),
    );
    const shapeIndexAfterMove = rowsAfterMove.findIndex((r) => r.dataset.outlineKind === 'shape');
    expect(shapeIndexAfterMove).toBeGreaterThan(layer2IndexAfterMove);

    await user.click(screen.getByRole('button', { name: 'Undo' }));

    const rowsAfterUndo = within(outlineList()).getAllByRole('listitem');
    const layer1IndexAfterUndo = rowsAfterUndo.findIndex(
      (r) => r.dataset.outlineKind === 'layer' && within(r).queryByDisplayValue('Layer 1'),
    );
    const shapeIndexAfterUndo = rowsAfterUndo.findIndex((r) => r.dataset.outlineKind === 'shape');
    expect(shapeIndexAfterUndo).toBeGreaterThan(layer1IndexAfterUndo);
  });
});

describe('EditorWorkspace scene outline: undo integration', () => {
  it('undoes a grouping action in a single step', async () => {
    await loadReadyWorkspace();
    const user = userEvent.setup();
    await user.click(screen.getByRole('button', { name: 'Add circle' }));
    await user.click(screen.getByRole('button', { name: 'Add rectangle' }));
    const checkboxes = within(outlineList()).getAllByRole('checkbox');
    await user.click(checkboxes[0]);
    await user.click(checkboxes[1]);
    await user.click(screen.getByRole('button', { name: 'Combine into group' }));
    expect(
      within(outlineList())
        .getAllByRole('listitem')
        .filter((r) => r.dataset.outlineKind === 'group'),
    ).toHaveLength(1);

    await user.click(screen.getByRole('button', { name: 'Undo' }));

    expect(
      within(outlineList())
        .getAllByRole('listitem')
        .filter((r) => r.dataset.outlineKind === 'group'),
    ).toHaveLength(0);
  });
});
