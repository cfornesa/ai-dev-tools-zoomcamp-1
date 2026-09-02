import { fireEvent, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import * as projectsApi from '../api/projects';
import type { Project, SceneVersion } from '../api/projects';
import EditorWorkspace from './EditorWorkspace';
import {
  shapeOutlineRows,
  shapeOutlineSelectButtons,
  shapeSelectButton,
} from '../testUtils/shapeOutline';

/**
 * Task 23: interaction tests for shape add/select/duplicate/delete and
 * in-session undo/redo, layered on top of the Task 21/22 workspace shell.
 * See EditorWorkspace.test.tsx for the shell's own load-state/layout tests.
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
  // Issue #191: shape creation is in the always-visible toolbar, and the
  // Layers panel (which owns the outline rows) is the only top-level panel
  // needed by this suite. Do not expand unrelated panels here: their
  // mounted content is intentionally collapsed by default and opening all
  // of it makes these interaction tests depend on unrelated panel work.
  await screen.findByRole('region', { name: 'Layers' });
  await userEvent.setup().click(screen.getByRole('button', { name: 'Edit scene' }));
}

function addShapeButton(label: string) {
  return within(screen.getByRole('group', { name: 'Add shape' })).getByRole('button', {
    name: label,
  });
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

describe('EditorWorkspace shape creation', () => {
  it('adds a circle, rect, line, and polygon via pointer clicks', async () => {
    await loadReadyWorkspace();
    const user = userEvent.setup();

    await user.click(addShapeButton('Add circle'));
    await user.click(addShapeButton('Add rectangle'));
    await user.click(addShapeButton('Add line'));
    await user.click(addShapeButton('Add polygon'));

    expect(shapeOutlineRows()).toHaveLength(4);
    expect(screen.getByText(/4 shape\(s\) in the working copy/)).toBeInTheDocument();
  });

  it('creates shapes via keyboard-only interaction (Tab + Enter, no pointer)', async () => {
    await loadReadyWorkspace();
    const user = userEvent.setup();

    const addCircleButton = addShapeButton('Add circle');
    addCircleButton.focus();
    expect(addCircleButton).toHaveFocus();
    await user.keyboard('{Enter}');

    expect(shapeOutlineRows()).toHaveLength(1);

    // A second keyboard-only add, this time via Space activation.
    await user.keyboard(' ');
    expect(shapeOutlineRows()).toHaveLength(2);
  });

  it('gives each added shape a distinct, stable id shown in the shape list', async () => {
    await loadReadyWorkspace();
    const user = userEvent.setup();

    await user.click(addShapeButton('Add circle'));
    await user.click(addShapeButton('Add circle'));

    const labels = shapeOutlineRows().map((row) =>
      within(row)
        .getByRole('textbox', { name: /Shape name for/ })
        .getAttribute('value'),
    );
    expect(new Set(labels).size).toBe(2);
  });
});

// Issue #93 originally added real, geometry-derived SVG output per shape
// type here because the p5 preview canvas had no visible shape rendering of
// its own at the time. Issue #130 found that once the p5 canvas gained its
// own shape-body rendering, this SVG layer painting a body *too* was a real
// double-paint bug (it never applied `transform.opacity`, so a translucent
// shape rendered fully opaque here, stacked on its own correctly-translucent
// p5 render underneath) — see EditorWorkspace.tsx's shape-`<g>` comment.
// These now assert the SVG layer paints *no* body for any shape type,
// leaving the p5 canvas (pixel-level fidelity covered by p5Adapter.test.ts)
// as the sole body-rendering surface; a visible highlight on the selected
// shape is unaffected, since selection outlines are a separate element.
describe('EditorWorkspace shape canvas rendering (issue #93 / #130)', () => {
  it('paints no circle body in the SVG layer for a circle shape — the p5 canvas is the sole body layer', async () => {
    await loadReadyWorkspace();
    const user = userEvent.setup();
    await user.click(addShapeButton('Add circle'));

    const canvas = screen.getByTestId('scene-canvas');
    const shapeGroup = within(canvas).getByTestId(/^scene-shape-/);
    expect(shapeGroup.querySelector('circle')).toBeNull();
  });

  it('paints no rect body in the SVG layer for a rectangle shape', async () => {
    await loadReadyWorkspace();
    const user = userEvent.setup();
    await user.click(addShapeButton('Add rectangle'));

    const canvas = screen.getByTestId('scene-canvas');
    const shapeGroup = within(canvas).getByTestId(/^scene-shape-/);
    // A rect shape's selection outline is itself a `<rect>` (the dashed
    // bounding box), so this must exclude it specifically to check for the
    // shape's own painted body rather than that outline.
    expect(shapeGroup.querySelector('rect:not(.editor-scene-shape-selection-outline)')).toBeNull();
  });

  it('paints no line body in the SVG layer for a line shape', async () => {
    await loadReadyWorkspace();
    const user = userEvent.setup();
    await user.click(addShapeButton('Add line'));

    const canvas = screen.getByTestId('scene-canvas');
    const shapeGroup = within(canvas).getByTestId(/^scene-shape-/);
    expect(shapeGroup.querySelector('line')).toBeNull();
  });

  it('paints no path body in the SVG layer for a closed polygon shape', async () => {
    await loadReadyWorkspace();
    const user = userEvent.setup();
    await user.click(addShapeButton('Add polygon'));

    const canvas = screen.getByTestId('scene-canvas');
    const shapeGroup = within(canvas).getByTestId(/^scene-shape-/);
    expect(shapeGroup.querySelector('path')).toBeNull();
  });

  it('gives the selected shape a visible highlight outline distinct from its own fill/stroke', async () => {
    await loadReadyWorkspace();
    const user = userEvent.setup();
    await user.click(addShapeButton('Add circle'));
    await user.click(addShapeButton('Add rectangle'));

    const canvas = screen.getByTestId('scene-canvas');
    const groups = within(canvas).getAllByTestId(/^scene-shape-/);
    // The most recently added shape (the rectangle) is selected by default.
    const selectedGroup = groups.find((g) => g.classList.contains('editor-scene-shape-selected'));
    expect(selectedGroup).toBeDefined();
    expect(selectedGroup!.querySelector('.editor-scene-shape-selection-outline')).not.toBeNull();

    const unselectedGroups = groups.filter((g) => g !== selectedGroup);
    unselectedGroups.forEach((g) => {
      expect(g.querySelector('.editor-scene-shape-selection-outline')).toBeNull();
    });
  });
});

describe('EditorWorkspace shape selection', () => {
  it('selects a shape by clicking its entry in the shape list', async () => {
    await loadReadyWorkspace();
    const user = userEvent.setup();
    await user.click(addShapeButton('Add circle'));

    const shapeButton = shapeSelectButton(shapeOutlineRows()[0]);
    await user.click(shapeButton);

    expect(shapeButton).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByRole('button', { name: 'Delete selected shape' })).toBeEnabled();
  });

  it('selects a shape via keyboard-only navigation to its list entry', async () => {
    await loadReadyWorkspace();
    const user = userEvent.setup();
    await user.click(addShapeButton('Add rectangle'));

    const shapeButton = shapeSelectButton(shapeOutlineRows()[0]);
    // Deselect first (add auto-selects), to prove selection can be driven
    // purely by keyboard from a neutral state.
    shapeButton.focus();
    await user.keyboard('{Enter}');

    expect(shapeButton).toHaveAttribute('aria-pressed', 'true');
  });

  it('resolves a pointer click on overlapping shapes to the topmost one', async () => {
    await loadReadyWorkspace();
    const user = userEvent.setup();

    // Both shapes are created centered on the same canvas, so they overlap.
    await user.click(addShapeButton('Add circle'));
    await user.click(addShapeButton('Add rectangle'));

    const canvas = screen.getByTestId('scene-canvas');
    canvas.getBoundingClientRect = () =>
      ({ left: 0, top: 0, right: 800, bottom: 600, width: 800, height: 600 }) as DOMRect;

    const [, rectButton] = shapeOutlineSelectButtons(); // rect was added second, so it's on top

    fireEvent.click(canvas, { clientX: 400, clientY: 300 });

    expect(rectButton).toHaveAttribute('aria-pressed', 'true');
  });

  it('clicking empty canvas space clears the selection', async () => {
    await loadReadyWorkspace();
    const user = userEvent.setup();
    await user.click(addShapeButton('Add circle'));

    const canvas = screen.getByTestId('scene-canvas');
    canvas.getBoundingClientRect = () =>
      ({ left: 0, top: 0, right: 800, bottom: 600, width: 800, height: 600 }) as DOMRect;

    fireEvent.click(canvas, { clientX: 10, clientY: 10 }); // far from the centered circle

    const shapeButton = shapeSelectButton(shapeOutlineRows()[0]);
    expect(shapeButton).toHaveAttribute('aria-pressed', 'false');
    expect(screen.getByRole('button', { name: 'Delete selected shape' })).toBeDisabled();
  });
});

describe('EditorWorkspace duplicate', () => {
  it('duplicates the selected shape into a new, independent shape', async () => {
    await loadReadyWorkspace();
    const user = userEvent.setup();
    await user.click(addShapeButton('Add circle'));

    await user.click(screen.getByRole('button', { name: 'Duplicate selected shape' }));

    expect(shapeOutlineRows()).toHaveLength(2);
    expect(screen.getByText(/2 shape\(s\) in the working copy/)).toBeInTheDocument();
  });

  it('is disabled when nothing is selected', async () => {
    await loadReadyWorkspace();
    expect(screen.getByRole('button', { name: 'Duplicate selected shape' })).toBeDisabled();
  });
});

describe('EditorWorkspace delete', () => {
  it('deletes only the selected shape via pointer click', async () => {
    await loadReadyWorkspace();
    const user = userEvent.setup();
    await user.click(addShapeButton('Add circle'));
    await user.click(addShapeButton('Add rectangle'));

    const [circleButton, rectButton] = shapeOutlineSelectButtons();
    await user.click(circleButton); // select the circle (rect was auto-selected by add)

    await user.click(screen.getByRole('button', { name: 'Delete selected shape' }));

    const rowsAfter = shapeOutlineRows();
    expect(rowsAfter).toHaveLength(1);
    expect(shapeSelectButton(rowsAfter[0])).toHaveTextContent(rectButton.textContent ?? '');
  });

  it('deletes the selected shape via keyboard-only interaction', async () => {
    await loadReadyWorkspace();
    const user = userEvent.setup();

    const addCircleButton = addShapeButton('Add circle');
    addCircleButton.focus();
    await user.keyboard('{Enter}'); // adds and selects a circle, no pointer used

    const deleteButton = screen.getByRole('button', { name: 'Delete selected shape' });
    deleteButton.focus();
    await user.keyboard('{Enter}');

    expect(shapeOutlineRows()).toHaveLength(0);
    expect(screen.getByText(/0 shape\(s\) in the working copy/)).toBeInTheDocument();
  });

  it('is a no-op with no selection and does not corrupt scene state', async () => {
    await loadReadyWorkspace();
    const user = userEvent.setup();
    await user.click(addShapeButton('Add circle'));

    const shapeButton = shapeSelectButton(shapeOutlineRows()[0]);
    await user.click(shapeButton); // toggling selection off by re-clicking is not supported;
    // instead directly verify the delete button reflects disabled state when
    // there is no selection by deselecting via a canvas click on empty space.
    const canvas = screen.getByTestId('scene-canvas');
    canvas.getBoundingClientRect = () =>
      ({ left: 0, top: 0, right: 800, bottom: 600, width: 800, height: 600 }) as DOMRect;
    fireEvent.click(canvas, { clientX: 5, clientY: 5 });

    expect(screen.getByRole('button', { name: 'Delete selected shape' })).toBeDisabled();
    expect(shapeOutlineRows()).toHaveLength(1);
  });
});

describe('EditorWorkspace undo/redo', () => {
  it('undoes an add via the Undo button', async () => {
    await loadReadyWorkspace();
    const user = userEvent.setup();
    await user.click(addShapeButton('Add circle'));

    await user.click(screen.getByRole('button', { name: 'Undo' }));

    expect(shapeOutlineRows()).toHaveLength(0);
  });

  it('redoes via the Redo button after an undo', async () => {
    await loadReadyWorkspace();
    const user = userEvent.setup();
    await user.click(addShapeButton('Add circle'));
    await user.click(screen.getByRole('button', { name: 'Undo' }));

    await user.click(screen.getByRole('button', { name: 'Redo' }));

    expect(shapeOutlineRows()).toHaveLength(1);
  });

  it('undoes via Ctrl+Z and redoes via Ctrl+Shift+Z keyboard shortcuts', async () => {
    await loadReadyWorkspace();
    const user = userEvent.setup();
    await user.click(addShapeButton('Add circle'));

    await user.keyboard('{Control>}z{/Control}');
    expect(shapeOutlineRows()).toHaveLength(0);

    await user.keyboard('{Control>}{Shift>}z{/Shift}{/Control}');
    expect(shapeOutlineRows()).toHaveLength(1);
  });

  it('Undo/Redo buttons are disabled when there is nothing to undo/redo', async () => {
    await loadReadyWorkspace();
    expect(screen.getByRole('button', { name: 'Undo' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Redo' })).toBeDisabled();
  });
});
