import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import * as projectsApi from '../api/projects';
import type { Project, SceneVersion } from '../api/projects';
import EditorWorkspace from './EditorWorkspace';
import { expandAllCollapsibleSections } from '../testUtils/expandCollapsibleSections';

/**
 * Issue #172 (task 140): "Add circle"/"Add rectangle"/"Add line"/
 * "Add polygon" moved from `LayersPanel.tsx`'s sidebar "Add shape" group
 * into `EditorWorkspace.tsx`'s always-visible top toolbar
 * (`role="toolbar" aria-label="Editor actions"`), rendered as icon buttons
 * via the toolbar's existing `ToolbarButton` glyph+tooltip+`aria-label`
 * convention (matching Undo/Redo/Duplicate/Delete). This explicitly
 * reverses task 112/#143's prior decision to keep these buttons in the
 * Layers panel. Issue #182 extends this same relocation pattern to the four
 * layer/group actions while preserving their existing scene mutations.
 *
 * These tests assert the NEW location (toolbar, not Layers panel) and
 * that the underlying `sceneEditor.addShape` mutation and keyboard
 * operability are unchanged.
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

afterEach(() => {
  vi.restoreAllMocks();
});

const SHAPE_LABELS = ['Add circle', 'Add rectangle', 'Add line', 'Add polygon'];

describe('Add-shape buttons relocated to the top toolbar (issue #172)', () => {
  it('renders all four Add-shape buttons inside the toolbar\'s "Add shape" group', async () => {
    await loadReadyWorkspace();

    const toolbar = screen.getByRole('toolbar', { name: 'Editor actions' });
    const addShapeGroup = within(toolbar).getByRole('group', { name: 'Add shape' });

    SHAPE_LABELS.forEach((label) => {
      const button = within(addShapeGroup).getByRole('button', { name: label });
      expect(button).toHaveAccessibleName(label);
      // Follows the existing ToolbarButton convention: an aria-hidden glyph
      // plus a visible-on-hover/focus CSS tooltip, matching Undo/Redo/
      // Duplicate/Delete.
      expect(within(button).getByRole('tooltip')).toHaveTextContent(label);
    });
  });

  it('no longer renders the Add-shape buttons inside the Layers panel', async () => {
    await loadReadyWorkspace();

    const layersRegion = screen.getByRole('region', { name: 'Layers' });
    SHAPE_LABELS.forEach((label) => {
      expect(within(layersRegion).queryByRole('button', { name: label })).not.toBeInTheDocument();
    });
  });

  it('moves the four layer/group actions into one toolbar group with no duplicates', async () => {
    await loadReadyWorkspace();

    const layersRegion = screen.getByRole('region', { name: 'Layers' });
    const toolbar = screen.getByRole('toolbar', { name: 'Editor actions' });
    const actionGroup = within(toolbar).getByRole('group', { name: 'Layer and group actions' });
    const labels = ['Add layer', 'Combine into group', 'Ungroup selected', 'Delete selected group'];

    labels.forEach((label) => {
      expect(within(actionGroup).getByRole('button', { name: label })).toHaveAccessibleName(label);
      expect(within(actionGroup).getByRole('button', { name: label })).toContainElement(
        within(actionGroup).getByRole('tooltip', { name: label }),
      );
      expect(within(layersRegion).queryByRole('button', { name: label })).not.toBeInTheDocument();
    });
    expect(
      within(layersRegion).queryByRole('button', { name: 'Clear group selection' }),
    ).not.toBeInTheDocument();
  });

  it('keeps group actions disabled until their existing selection predicates are met', async () => {
    await loadReadyWorkspace();

    const toolbar = screen.getByRole('toolbar', { name: 'Editor actions' });
    expect(within(toolbar).getByRole('button', { name: 'Combine into group' })).toBeDisabled();
    expect(within(toolbar).getByRole('button', { name: 'Ungroup selected' })).toBeDisabled();
    expect(within(toolbar).getByRole('button', { name: 'Delete selected group' })).toBeDisabled();
  });

  it('activates Add layer from the toolbar with Enter and Space and preserves one-step undo', async () => {
    await loadReadyWorkspace();
    const user = userEvent.setup();
    const addLayer = screen.getByRole('button', { name: 'Add layer' });

    addLayer.focus();
    await user.keyboard('{Enter}');
    expect(
      within(screen.getByRole('list', { name: 'Scene outline' })).getAllByRole('listitem'),
    ).toHaveLength(2);
    expect(screen.getByRole('button', { name: 'Undo' })).toBeEnabled();

    addLayer.focus();
    await user.keyboard(' ');
    expect(
      within(screen.getByRole('list', { name: 'Scene outline' })).getAllByRole('listitem'),
    ).toHaveLength(3);
  });

  it('clicking a toolbar Add-shape button still calls the same addShape mutation', async () => {
    await loadReadyWorkspace();
    const user = userEvent.setup();

    await user.click(screen.getByRole('button', { name: 'Add circle' }));
    await user.click(screen.getByRole('button', { name: 'Add rectangle' }));

    expect(screen.getByText(/2 shape\(s\) in the working copy/)).toBeInTheDocument();
    const outlineList = screen.getByRole('list', { name: 'Scene outline' });
    expect(within(outlineList).getByRole('button', { name: 'Circle 1' })).toBeInTheDocument();
    expect(within(outlineList).getByRole('button', { name: 'Rectangle 1' })).toBeInTheDocument();
  });

  it('is reachable via Tab and activatable via Enter/Space, like the rest of the toolbar', async () => {
    await loadReadyWorkspace();
    const user = userEvent.setup();

    const addCircleButton = screen.getByRole('button', { name: 'Add circle' });
    addCircleButton.focus();
    expect(addCircleButton).toHaveFocus();
    await user.keyboard('{Enter}');

    const addRectButton = screen.getByRole('button', { name: 'Add rectangle' });
    addRectButton.focus();
    expect(addRectButton).toHaveFocus();
    await user.keyboard(' ');

    expect(screen.getByText(/2 shape\(s\) in the working copy/)).toBeInTheDocument();
  });
});
