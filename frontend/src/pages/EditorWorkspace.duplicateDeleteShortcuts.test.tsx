import { fireEvent, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import * as projectsApi from '../api/projects';
import type { Project, SceneVersion } from '../api/projects';
import EditorWorkspace from './EditorWorkspace';
import { expandAllCollapsibleSections } from '../testUtils/expandCollapsibleSections';
import {
  shapeOutlineRows,
  shapeOutlineSelectButtons,
  shapeSelectButton,
} from '../testUtils/shapeOutline';

/**
 * Task 114 (issue #149): keyboard-only entry points for
 * `sceneEditor.duplicateSelected()`/`deleteSelected()` — the same
 * global-listener/`isTypingTarget` pattern the existing Undo/Redo
 * `keydown` listener already establishes in `EditorWorkspace.tsx` (~lines
 * 864-885), added alongside (not replacing) vertex-edit mode's own
 * Delete/Backspace listener (~lines 914-933).
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

async function loadReadyWorkspace(sceneOverride?: SceneVersion) {
  mockedGetProject.mockResolvedValue(baseProject());
  mockedGetSceneVersion.mockResolvedValue(sceneOverride ?? baseVersion());
  renderWorkspace();
  await screen.findByRole('region', { name: 'Tools' });
  expandAllCollapsibleSections();
  await userEvent.setup().click(screen.getByRole('button', { name: 'Open piece controls menu' }));
  await userEvent.setup().click(screen.getByRole('button', { name: 'Edit scene' }));
}

function mockCanvasRect() {
  const canvas = screen.getByTestId('scene-canvas');
  canvas.getBoundingClientRect = () =>
    ({ left: 0, top: 0, right: 800, bottom: 600, width: 800, height: 600 }) as DOMRect;
  return canvas;
}

function addAndSelectCircle() {
  fireEvent.click(screen.getByRole('button', { name: 'Add circle' }));
  // createShape centers a circle on the 800x600 canvas: (400,300), r=50.
}

function addAndSelectPath() {
  fireEvent.click(screen.getByRole('button', { name: 'Add polygon' }));
}

function editPointsToggle() {
  return screen.getByRole('button', { name: /edit points/i });
}

// Task 111 (issue #142): every shape gets its own fresh layer now, so this
// locks only the (single) shape's own layer, matching this file's
// single-shape scenarios.
function toggleLayerLock() {
  const outline = screen.getByRole('list', { name: 'Scene outline' });
  const rows = within(outline).getAllByRole('listitem') as HTMLElement[];
  const layerRow = [...rows].reverse().find((row) => row.dataset.outlineKind === 'layer')!;
  // Issue #168 (task 136): the layer row's Locked toggle is now a
  // checkbox with a static accessible name, regardless of checked state.
  const checkbox = within(layerRow).getByRole('checkbox', { name: /locked$/i });
  fireEvent.click(checkbox);
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

describe('Task 114 (issue #149): Ctrl/Cmd+D duplicates the selected shape', () => {
  it('duplicates the selected shape, same as the toolbar button, and selects the duplicate', async () => {
    await loadReadyWorkspace();
    addAndSelectCircle();
    expect(shapeOutlineRows()).toHaveLength(1);

    fireEvent.keyDown(window, { key: 'd', ctrlKey: true });

    expect(shapeOutlineRows()).toHaveLength(2);
    // The new shape is selected — exactly one row's select button is
    // pressed, and it's the last (newly-appended) row.
    const selectButtons = shapeOutlineSelectButtons();
    const pressedButtons = selectButtons.filter(
      (btn) => btn.getAttribute('aria-pressed') === 'true',
    );
    expect(pressedButtons).toHaveLength(1);
    expect(pressedButtons[0]).toBe(selectButtons[selectButtons.length - 1]);
  });

  it('is undoable via Ctrl/Cmd+Z', async () => {
    await loadReadyWorkspace();
    addAndSelectCircle();

    fireEvent.keyDown(window, { key: 'd', metaKey: true });
    expect(shapeOutlineRows()).toHaveLength(2);
    expect(screen.getByRole('button', { name: 'Undo' })).toBeEnabled();

    fireEvent.click(screen.getByRole('button', { name: 'Undo' }));
    expect(shapeOutlineRows()).toHaveLength(1);
  });

  it('is a no-op, with preventDefault never called, when nothing is selected', async () => {
    await loadReadyWorkspace();
    // Nothing added/selected yet.
    expect(shapeOutlineRows()).toHaveLength(0);

    const event = new KeyboardEvent('keydown', { key: 'd', ctrlKey: true, cancelable: true });
    window.dispatchEvent(event);

    expect(shapeOutlineRows()).toHaveLength(0);
    expect(event.defaultPrevented).toBe(false);
  });

  it('is ignored while a text field has focus', async () => {
    await loadReadyWorkspace();
    addAndSelectCircle();
    expect(shapeOutlineRows()).toHaveLength(1);

    fireEvent.click(screen.getByRole('button', { name: 'Edit title' }));
    const titleInput = screen.getByLabelText('Title');
    titleInput.focus();

    fireEvent.keyDown(titleInput, { key: 'd', ctrlKey: true });

    expect(shapeOutlineRows()).toHaveLength(1);
  });

  it('surfaces lockError instead of duplicating when the shape is on a locked layer', async () => {
    await loadReadyWorkspace();
    addAndSelectCircle();
    toggleLayerLock();
    fireEvent.click(shapeSelectButton(shapeOutlineRows()[0]));

    fireEvent.keyDown(window, { key: 'd', ctrlKey: true });

    expect(shapeOutlineRows()).toHaveLength(1);
    expect(screen.getByRole('alert')).toHaveTextContent(/locked/i);
  });
});

describe('Task 114 (issue #149): Delete/Backspace deletes the selected shape', () => {
  it('deletes the selected shape on Delete, same as the toolbar button, and clears selection', async () => {
    await loadReadyWorkspace();
    addAndSelectCircle();
    expect(shapeOutlineRows()).toHaveLength(1);

    fireEvent.keyDown(window, { key: 'Delete' });

    expect(shapeOutlineRows()).toHaveLength(0);
  });

  it('deletes the selected shape on Backspace', async () => {
    await loadReadyWorkspace();
    addAndSelectCircle();

    fireEvent.keyDown(window, { key: 'Backspace' });

    expect(shapeOutlineRows()).toHaveLength(0);
  });

  it('is undoable via Ctrl/Cmd+Z', async () => {
    await loadReadyWorkspace();
    addAndSelectCircle();

    fireEvent.keyDown(window, { key: 'Delete' });
    expect(shapeOutlineRows()).toHaveLength(0);
    expect(screen.getByRole('button', { name: 'Undo' })).toBeEnabled();

    fireEvent.click(screen.getByRole('button', { name: 'Undo' }));
    expect(shapeOutlineRows()).toHaveLength(1);
  });

  it('is a no-op, with preventDefault never called, when nothing is selected', async () => {
    await loadReadyWorkspace();
    expect(shapeOutlineRows()).toHaveLength(0);

    const event = new KeyboardEvent('keydown', { key: 'Delete', cancelable: true });
    window.dispatchEvent(event);

    expect(shapeOutlineRows()).toHaveLength(0);
    expect(event.defaultPrevented).toBe(false);
  });

  it('is ignored while a text field has focus', async () => {
    await loadReadyWorkspace();
    addAndSelectCircle();
    expect(shapeOutlineRows()).toHaveLength(1);

    fireEvent.click(screen.getByRole('button', { name: 'Edit title' }));
    const titleInput = screen.getByLabelText('Title');
    titleInput.focus();

    fireEvent.keyDown(titleInput, { key: 'Delete' });

    expect(shapeOutlineRows()).toHaveLength(1);
  });

  it('surfaces lockError instead of deleting when the shape is on a locked layer', async () => {
    await loadReadyWorkspace();
    addAndSelectCircle();
    toggleLayerLock();
    fireEvent.click(shapeSelectButton(shapeOutlineRows()[0]));

    fireEvent.keyDown(window, { key: 'Delete' });

    expect(shapeOutlineRows()).toHaveLength(1);
    expect(screen.getByRole('alert')).toHaveTextContent(/locked/i);
  });

  it('does not fire the whole-shape delete during vertex edit mode — only the selected vertex is removed', async () => {
    await loadReadyWorkspace();
    addAndSelectPath();
    mockCanvasRect();
    fireEvent.click(editPointsToggle());
    expect(screen.getByTestId('path-vertex-handle-0')).toBeInTheDocument();

    fireEvent.pointerDown(screen.getByTestId('path-vertex-handle-1'), {
      clientX: 450,
      clientY: 300,
    });
    fireEvent.pointerUp(window, { clientX: 450, clientY: 300 });

    fireEvent.keyDown(window, { key: 'Delete' });

    // The vertex was removed (now 3 points)...
    expect(screen.queryByTestId('path-vertex-handle-3')).not.toBeInTheDocument();
    // ...but the whole shape is still present in the outline — the
    // shape-delete shortcut must not have also fired.
    expect(shapeOutlineRows()).toHaveLength(1);
  });
});
