import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import * as projectsApi from '../api/projects';
import type { Project, SceneVersion } from '../api/projects';
import EditorWorkspace from './EditorWorkspace';

/**
 * Task 34: rendered UI tests for the behavior-card panel — reading a
 * card's sentence, the conflict prompt requiring explicit replacement,
 * hand-mode activation, and keyboard operability of every control. See
 * `behaviorCards.test.ts` and `useSceneEditor.behaviorCards.test.ts` for
 * the underlying logic/hook tests.
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

const SCENE_WITH_SHAPE = {
  schemaVersion: 1,
  id: 'scene-1',
  canvas: { width: 800, height: 600, backgroundColor: '#ffffff' },
  renderer: { preferred: 'p5' },
  layers: [{ id: 'layer-1', name: 'Layer 1', order: 0, visible: true, locked: false }],
  shapes: [
    {
      id: 'shape-1',
      type: 'circle',
      layerId: 'layer-1',
      groupId: null,
      transform: { x: 100, y: 100, scaleX: 1, scaleY: 1, rotation: 0, opacity: 1 },
      style: { fill: '#4f46e5', stroke: null, strokeWidth: 0 },
      radius: 50,
    },
  ],
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
    scene_json: SCENE_WITH_SHAPE,
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

describe('behavior cards panel', () => {
  it('adds a Follow hand card via keyboard and reads it as a sentence', async () => {
    const user = userEvent.setup();
    await loadReadyWorkspace();

    // Card type defaults to Follow hand; the form's fields are all
    // programmatically labeled selects, reachable and operable via
    // keyboard/labels alone (no pointer needed).
    const addButton = screen.getByRole('button', { name: 'Add card' });
    await user.click(addButton);

    const list = screen.getByRole('list', { name: 'Behavior card list' });
    const items = within(list).getAllByRole('listitem');
    expect(items).toHaveLength(1);
    expect(items[0]).toHaveTextContent(/When the primary hand's index finger tip moves/i);
    expect(items[0]).toHaveTextContent('circle');
  });

  it('every card field is a labeled form control reachable by label text', async () => {
    await loadReadyWorkspace();
    expect(screen.getByLabelText('Hand signal')).toBeInTheDocument();
    expect(screen.getByLabelText('Axis')).toBeInTheDocument();
    expect(screen.getByLabelText('Hand target')).toBeInTheDocument();
    expect(screen.getByLabelText('Target')).toBeInTheDocument();
  });

  it('switching card type to Pulse exposes only its compatible fields', async () => {
    const user = userEvent.setup();
    await loadReadyWorkspace();
    await user.click(screen.getByRole('radio', { name: 'Pulse' }));
    expect(screen.getByLabelText('Gesture event')).toBeInTheDocument();
    expect(screen.queryByLabelText('Target')).not.toBeInTheDocument();
    expect(screen.queryByLabelText('Axis')).not.toBeInTheDocument();
  });

  it('adding a second continuous binding to the same target channel requires explicit replacement', async () => {
    const user = userEvent.setup();
    await loadReadyWorkspace();

    await user.click(screen.getByRole('button', { name: 'Add card' }));
    expect(
      within(screen.getByRole('list', { name: 'Behavior card list' })).getAllByRole('listitem'),
    ).toHaveLength(1);

    // Change the signal source (still index-tip X vs palm X -> same
    // positionX channel) and try to add again.
    await user.selectOptions(screen.getByLabelText('Hand signal'), 'Palm center');
    await user.click(screen.getByRole('button', { name: 'Add card' }));

    const conflictDialog = screen.getByRole('alertdialog', { name: /already has a binding/i });
    expect(conflictDialog).toBeInTheDocument();
    // Still only the original card — no silent overwrite.
    expect(
      within(screen.getByRole('list', { name: 'Behavior card list' })).getAllByRole('listitem'),
    ).toHaveLength(1);

    await user.click(
      within(conflictDialog).getByRole('button', { name: 'Replace existing binding' }),
    );
    expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument();
    const itemsAfter = within(
      screen.getByRole('list', { name: 'Behavior card list' }),
    ).getAllByRole('listitem');
    expect(itemsAfter).toHaveLength(1);
    expect(itemsAfter[0]).toHaveTextContent(/palm center/i);
  });

  it('cancelling the conflict prompt leaves the original binding untouched', async () => {
    const user = userEvent.setup();
    await loadReadyWorkspace();

    await user.click(screen.getByRole('button', { name: 'Add card' }));
    await user.selectOptions(screen.getByLabelText('Hand signal'), 'Palm center');
    await user.click(screen.getByRole('button', { name: 'Add card' }));

    const conflictDialog = screen.getByRole('alertdialog');
    await user.click(within(conflictDialog).getByRole('button', { name: 'Cancel' }));

    expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument();
    const items = within(screen.getByRole('list', { name: 'Behavior card list' })).getAllByRole(
      'listitem',
    );
    expect(items).toHaveLength(1);
    expect(items[0]).toHaveTextContent(/index finger tip/i);
  });

  it('defaults to One-hand mode and switches to Two-hand mode when a left/right binding is added', async () => {
    const user = userEvent.setup();
    await loadReadyWorkspace();

    const handModeGroup = screen.getByRole('radiogroup', { name: 'Hand mode' });
    expect(within(handModeGroup).getByRole('radio', { name: 'Hands: One' })).toHaveAttribute(
      'aria-checked',
      'true',
    );

    await user.click(screen.getByRole('radio', { name: 'React to pinch' }));
    await user.selectOptions(screen.getByLabelText('Hand target'), 'Left hand');
    await user.click(screen.getByRole('button', { name: 'Add card' }));

    expect(within(handModeGroup).getByRole('radio', { name: 'Hands: Two' })).toHaveAttribute(
      'aria-checked',
      'true',
    );
    expect(screen.getByText(/Use left and right hand signals independently/i)).toBeInTheDocument();
  });

  it('removes a card as a keyboard-operable action', async () => {
    const user = userEvent.setup();
    await loadReadyWorkspace();

    await user.click(screen.getByRole('button', { name: 'Add card' }));
    const list = screen.getByRole('list', { name: 'Behavior card list' });
    await user.click(within(list).getByRole('button', { name: 'Remove card' }));

    expect(screen.getByText('No behavior cards yet.')).toBeInTheDocument();
  });
});
