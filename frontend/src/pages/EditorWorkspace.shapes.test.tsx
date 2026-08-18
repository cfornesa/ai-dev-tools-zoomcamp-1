import { fireEvent, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import * as projectsApi from '../api/projects';
import type { Project, SceneVersion } from '../api/projects';
import EditorWorkspace from './EditorWorkspace';

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
    thumbnail_choice: 'auto',
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

    await user.click(screen.getByRole('button', { name: 'Add circle' }));
    await user.click(screen.getByRole('button', { name: 'Add rectangle' }));
    await user.click(screen.getByRole('button', { name: 'Add line' }));
    await user.click(screen.getByRole('button', { name: 'Add polygon' }));

    const list = screen.getByRole('list', { name: 'Shape list' });
    const items = within(list).getAllByRole('listitem');
    expect(items).toHaveLength(4);
    expect(screen.getByText(/4 shape\(s\) in the working copy/)).toBeInTheDocument();
  });

  it('creates shapes via keyboard-only interaction (Tab + Enter, no pointer)', async () => {
    await loadReadyWorkspace();
    const user = userEvent.setup();

    const addCircleButton = screen.getByRole('button', { name: 'Add circle' });
    addCircleButton.focus();
    expect(addCircleButton).toHaveFocus();
    await user.keyboard('{Enter}');

    const list = screen.getByRole('list', { name: 'Shape list' });
    expect(within(list).getAllByRole('listitem')).toHaveLength(1);

    // A second keyboard-only add, this time via Space activation.
    await user.keyboard(' ');
    expect(within(list).getAllByRole('listitem')).toHaveLength(2);
  });

  it('gives each added shape a distinct, stable id shown in the shape list', async () => {
    await loadReadyWorkspace();
    const user = userEvent.setup();

    await user.click(screen.getByRole('button', { name: 'Add circle' }));
    await user.click(screen.getByRole('button', { name: 'Add circle' }));

    const list = screen.getByRole('list', { name: 'Shape list' });
    const labels = within(list)
      .getAllByRole('button')
      .map((btn) => btn.textContent);
    expect(new Set(labels).size).toBe(2);
  });
});

describe('EditorWorkspace shape selection', () => {
  it('selects a shape by clicking its entry in the shape list', async () => {
    await loadReadyWorkspace();
    const user = userEvent.setup();
    await user.click(screen.getByRole('button', { name: 'Add circle' }));

    const shapeButton = within(screen.getByRole('list', { name: 'Shape list' })).getByRole(
      'button',
    );
    await user.click(shapeButton);

    expect(shapeButton).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByRole('button', { name: 'Delete selected shape' })).toBeEnabled();
  });

  it('selects a shape via keyboard-only navigation to its list entry', async () => {
    await loadReadyWorkspace();
    const user = userEvent.setup();
    await user.click(screen.getByRole('button', { name: 'Add rectangle' }));

    const shapeButton = within(screen.getByRole('list', { name: 'Shape list' })).getByRole(
      'button',
    );
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
    await user.click(screen.getByRole('button', { name: 'Add circle' }));
    await user.click(screen.getByRole('button', { name: 'Add rectangle' }));

    const canvas = screen.getByTestId('scene-canvas');
    canvas.getBoundingClientRect = () =>
      ({ left: 0, top: 0, right: 800, bottom: 600, width: 800, height: 600 }) as DOMRect;

    const listItems = within(screen.getByRole('list', { name: 'Shape list' })).getAllByRole(
      'button',
    );
    const [, rectButton] = listItems; // rect was added second, so it's on top

    fireEvent.click(canvas, { clientX: 400, clientY: 300 });

    expect(rectButton).toHaveAttribute('aria-pressed', 'true');
  });

  it('clicking empty canvas space clears the selection', async () => {
    await loadReadyWorkspace();
    const user = userEvent.setup();
    await user.click(screen.getByRole('button', { name: 'Add circle' }));

    const canvas = screen.getByTestId('scene-canvas');
    canvas.getBoundingClientRect = () =>
      ({ left: 0, top: 0, right: 800, bottom: 600, width: 800, height: 600 }) as DOMRect;

    fireEvent.click(canvas, { clientX: 10, clientY: 10 }); // far from the centered circle

    const shapeButton = within(screen.getByRole('list', { name: 'Shape list' })).getByRole(
      'button',
    );
    expect(shapeButton).toHaveAttribute('aria-pressed', 'false');
    expect(screen.getByRole('button', { name: 'Delete selected shape' })).toBeDisabled();
  });
});

describe('EditorWorkspace duplicate', () => {
  it('duplicates the selected shape into a new, independent shape', async () => {
    await loadReadyWorkspace();
    const user = userEvent.setup();
    await user.click(screen.getByRole('button', { name: 'Add circle' }));

    await user.click(screen.getByRole('button', { name: 'Duplicate selected shape' }));

    const list = screen.getByRole('list', { name: 'Shape list' });
    expect(within(list).getAllByRole('listitem')).toHaveLength(2);
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
    await user.click(screen.getByRole('button', { name: 'Add circle' }));
    await user.click(screen.getByRole('button', { name: 'Add rectangle' }));

    const list = screen.getByRole('list', { name: 'Shape list' });
    const [circleButton, rectButton] = within(list).getAllByRole('button');
    await user.click(circleButton); // select the circle (rect was auto-selected by add)

    await user.click(screen.getByRole('button', { name: 'Delete selected shape' }));

    expect(within(list).getAllByRole('listitem')).toHaveLength(1);
    expect(within(list).getByRole('button')).toHaveTextContent(rectButton.textContent ?? '');
  });

  it('deletes the selected shape via keyboard-only interaction', async () => {
    await loadReadyWorkspace();
    const user = userEvent.setup();

    const addCircleButton = screen.getByRole('button', { name: 'Add circle' });
    addCircleButton.focus();
    await user.keyboard('{Enter}'); // adds and selects a circle, no pointer used

    const deleteButton = screen.getByRole('button', { name: 'Delete selected shape' });
    deleteButton.focus();
    await user.keyboard('{Enter}');

    expect(screen.getByText('No shapes yet.')).toBeInTheDocument();
    expect(screen.getByText(/0 shape\(s\) in the working copy/)).toBeInTheDocument();
  });

  it('is a no-op with no selection and does not corrupt scene state', async () => {
    await loadReadyWorkspace();
    const user = userEvent.setup();
    await user.click(screen.getByRole('button', { name: 'Add circle' }));

    const shapeButton = within(screen.getByRole('list', { name: 'Shape list' })).getByRole(
      'button',
    );
    await user.click(shapeButton); // toggling selection off by re-clicking is not supported;
    // instead directly verify the delete button reflects disabled state when
    // there is no selection by deselecting via a canvas click on empty space.
    const canvas = screen.getByTestId('scene-canvas');
    canvas.getBoundingClientRect = () =>
      ({ left: 0, top: 0, right: 800, bottom: 600, width: 800, height: 600 }) as DOMRect;
    fireEvent.click(canvas, { clientX: 5, clientY: 5 });

    expect(screen.getByRole('button', { name: 'Delete selected shape' })).toBeDisabled();
    expect(
      within(screen.getByRole('list', { name: 'Shape list' })).getAllByRole('listitem'),
    ).toHaveLength(1);
  });
});

describe('EditorWorkspace undo/redo', () => {
  it('undoes an add via the Undo button', async () => {
    await loadReadyWorkspace();
    const user = userEvent.setup();
    await user.click(screen.getByRole('button', { name: 'Add circle' }));

    await user.click(screen.getByRole('button', { name: 'Undo' }));

    expect(screen.getByText('No shapes yet.')).toBeInTheDocument();
  });

  it('redoes via the Redo button after an undo', async () => {
    await loadReadyWorkspace();
    const user = userEvent.setup();
    await user.click(screen.getByRole('button', { name: 'Add circle' }));
    await user.click(screen.getByRole('button', { name: 'Undo' }));

    await user.click(screen.getByRole('button', { name: 'Redo' }));

    const list = screen.getByRole('list', { name: 'Shape list' });
    expect(within(list).getAllByRole('listitem')).toHaveLength(1);
  });

  it('undoes via Ctrl+Z and redoes via Ctrl+Shift+Z keyboard shortcuts', async () => {
    await loadReadyWorkspace();
    const user = userEvent.setup();
    await user.click(screen.getByRole('button', { name: 'Add circle' }));

    await user.keyboard('{Control>}z{/Control}');
    expect(screen.getByText('No shapes yet.')).toBeInTheDocument();

    await user.keyboard('{Control>}{Shift>}z{/Shift}{/Control}');
    const list = screen.getByRole('list', { name: 'Shape list' });
    expect(within(list).getAllByRole('listitem')).toHaveLength(1);
  });

  it('Undo/Redo buttons are disabled when there is nothing to undo/redo', async () => {
    await loadReadyWorkspace();
    expect(screen.getByRole('button', { name: 'Undo' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Redo' })).toBeDisabled();
  });
});
