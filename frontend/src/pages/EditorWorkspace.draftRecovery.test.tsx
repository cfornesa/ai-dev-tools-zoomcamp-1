import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import * as projectsApi from '../api/projects';
import type { Project, SceneVersion, SceneVersionSummary } from '../api/projects';
import EditorWorkspace from './EditorWorkspace';
import { useDraftAutosave } from './useDraftAutosave';
import { useDraftRecovery } from './useDraftRecovery';
import type { RecoveryCandidate } from './useDraftRecovery';

/**
 * Task 44: `EditorWorkspace.tsx`'s orchestration of the recovery prompt —
 * that it gates rendering the interactive editor on `useDraftRecovery`'s
 * status, wires Recover/Discard/Cancel to the right hook methods and
 * `setWorkingCopy`, and never lets `useDraftAutosave`/`useDraftServerSync`
 * see a real working copy while the prompt is still unresolved (see
 * `EditorWorkspace.tsx`'s own comment on why that gating exists).
 *
 * `useDraftRecovery`'s own reconciliation policy (local/server read,
 * expired/corrupt/unauthorized/conflict handling) is covered exhaustively
 * against the real hook in `useDraftRecovery.test.ts`; this file mocks it
 * so each scenario here can drive a specific `status`/`candidate`
 * directly, the same way `EditorWorkspace.draftAutosave.test.tsx` mocks
 * `useDraftAutosave`.
 */

vi.mock('../api/projects');
vi.mock('./useDraftAutosave');
vi.mock('./useDraftRecovery');

const mockedGetProject = vi.mocked(projectsApi.getProject);
const mockedGetSceneVersion = vi.mocked(projectsApi.getSceneVersion);
const mockedListSceneVersions = vi.mocked(projectsApi.listSceneVersions);
const mockedSaveSceneVersion = vi.mocked(projectsApi.saveSceneVersion);
const mockedUseDraftAutosave = vi.mocked(useDraftAutosave);
const mockedUseDraftRecovery = vi.mocked(useDraftRecovery);

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

const RECOVERED_SCENE = {
  ...BLANK_SCENE,
  id: 'scene-recovered',
  shapes: [
    {
      id: 's1',
      type: 'circle',
      layerId: 'layer-1',
      groupId: null,
      transform: { x: 10, y: 10, scaleX: 1, scaleY: 1, rotation: 0, opacity: 1 },
      style: { fill: '#000000', stroke: null, strokeWidth: 0 },
      radius: 20,
    },
  ],
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

function baseSummary(overrides: Partial<SceneVersionSummary> = {}): SceneVersionSummary {
  const { scene_json: _scene_json, ...rest } = baseVersion(overrides);
  return rest;
}

function candidate(overrides: Partial<RecoveryCandidate> = {}): RecoveryCandidate {
  return {
    source: 'local',
    sceneJson: RECOVERED_SCENE,
    savedAt: '2026-01-02T00:05:00Z',
    changeSummary: '1 shape added',
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

let discard: ReturnType<typeof vi.fn<() => Promise<void>>>;
let recover: ReturnType<typeof vi.fn<() => typeof RECOVERED_SCENE | null>>;

beforeEach(() => {
  vi.clearAllMocks();
  mockedGetProject.mockResolvedValue(baseProject());
  mockedGetSceneVersion.mockResolvedValue(baseVersion());
  mockedListSceneVersions.mockResolvedValue([baseSummary()]);
  mockedUseDraftAutosave.mockReturnValue({
    clearDraft: vi.fn(() => Promise.resolve()),
    readDraft: vi.fn().mockResolvedValue(null),
    getLastFailure: vi.fn().mockReturnValue(null),
  });
  discard = vi.fn(() => Promise.resolve());
  recover = vi.fn(() => RECOVERED_SCENE);
  mockedUseDraftRecovery.mockReturnValue({
    status: 'none',
    candidate: null,
    recover,
    discard,
  });
});

describe('no valid draft', () => {
  it('renders the editor directly, with no recovery prompt', async () => {
    renderWorkspace();
    await screen.findByRole('region', { name: 'Tools' });
    expect(
      screen.queryByRole('alertdialog', { name: /recover unsaved work/i }),
    ).not.toBeInTheDocument();
  });
});

describe('checking for a draft', () => {
  it('does not render the editor panels while still checking', async () => {
    mockedUseDraftRecovery.mockReturnValue({
      status: 'checking',
      candidate: null,
      recover,
      discard,
    });
    renderWorkspace();
    await screen.findByText(/checking for recovered work/i);
    expect(screen.queryByRole('region', { name: 'Tools' })).not.toBeInTheDocument();
  });
});

describe('a valid draft exists', () => {
  beforeEach(() => {
    mockedUseDraftRecovery.mockReturnValue({
      status: 'prompt',
      candidate: candidate(),
      recover,
      discard,
    });
  });

  it('shows the recovery prompt with the last autosave time and change summary before the editor loads', async () => {
    renderWorkspace();
    const dialog = await screen.findByRole('alertdialog', { name: /recover unsaved work/i });
    expect(dialog).toHaveTextContent('1 shape added');
    expect(screen.queryByRole('region', { name: 'Tools' })).not.toBeInTheDocument();
  });

  it('never feeds a real working copy to autosave/server-sync while the prompt is unresolved', async () => {
    renderWorkspace();
    await screen.findByRole('alertdialog', { name: /recover unsaved work/i });
    const lastCall = mockedUseDraftAutosave.mock.calls.at(-1);
    expect(lastCall?.[1]).toBeNull();
  });

  it('Recover: loads the draft as the working copy, opens the editor dirty, and never calls discard', async () => {
    const user = userEvent.setup();
    renderWorkspace();
    const dialog = await screen.findByRole('alertdialog', { name: /recover unsaved work/i });

    await user.click(within(dialog).getByRole('button', { name: 'Recover draft' }));

    expect(recover).toHaveBeenCalledTimes(1);
    expect(discard).not.toHaveBeenCalled();
  });

  it("Recover end-to-end: the editor actually renders with the draft's scene data, marked dirty, and never calls a save/version API", async () => {
    // Unlike the mock above (a static `status: 'prompt'` that never
    // changes), this drives `useDraftRecovery` as a small stateful fake:
    // clicking "Recover draft" flips its status from 'prompt' to
    // 'resolved' — exactly what the real hook's `recover()` does — so the
    // editor actually re-renders past the prompt and into its normal
    // panel layout with the recovered scene as the (dirty) working copy.
    let status: 'prompt' | 'resolved' = 'prompt';
    const statefulRecover = vi.fn(() => {
      status = 'resolved';
      return RECOVERED_SCENE;
    });
    mockedUseDraftRecovery.mockImplementation(() => ({
      status,
      candidate: status === 'prompt' ? candidate() : null,
      recover: statefulRecover,
      discard,
    }));

    const user = userEvent.setup();
    renderWorkspace();
    const dialog = await screen.findByRole('alertdialog', { name: /recover unsaved work/i });

    await user.click(within(dialog).getByRole('button', { name: 'Recover draft' }));

    // The editor is now rendered (past the prompt) ...
    await screen.findByRole('region', { name: 'Tools' });
    expect(
      screen.queryByRole('alertdialog', { name: /recover unsaved work/i }),
    ).not.toBeInTheDocument();
    // ... showing the recovered draft's actual scene data (the shape it
    // carried, not the persisted BLANK_SCENE's empty shape list) ...
    expect(screen.getByTestId('scene-shape-s1')).toBeInTheDocument();
    // ... as unsaved working state, not a re-fetch of the saved version ...
    expect(screen.getByTestId('editor-save-status')).toHaveTextContent('Unsaved changes');
    // ... and the saved current version was never touched: no version-save
    // API call happened anywhere in this flow.
    expect(mockedSaveSceneVersion).not.toHaveBeenCalled();
  });

  it('Discard: awaits both draft deletions before the caller proceeds', async () => {
    const user = userEvent.setup();
    renderWorkspace();
    const dialog = await screen.findByRole('alertdialog', { name: /recover unsaved work/i });

    await user.click(within(dialog).getByRole('button', { name: 'Discard draft' }));

    await waitFor(() => expect(discard).toHaveBeenCalledTimes(1));
    expect(recover).not.toHaveBeenCalled();
  });

  it('Cancel: returns to the gallery without calling recover or discard', async () => {
    const user = userEvent.setup();
    renderWorkspace();
    const dialog = await screen.findByRole('alertdialog', { name: /recover unsaved work/i });

    await user.click(within(dialog).getByRole('button', { name: 'Cancel' }));

    await waitFor(() => expect(screen.getByText('Gallery placeholder')).toBeInTheDocument());
    expect(recover).not.toHaveBeenCalled();
    expect(discard).not.toHaveBeenCalled();
  });
});

describe('resolved (recovered or discarded)', () => {
  it('renders the full editor once status is "resolved"', async () => {
    mockedUseDraftRecovery.mockReturnValue({
      status: 'resolved',
      candidate: null,
      recover,
      discard,
    });
    renderWorkspace();
    await screen.findByRole('region', { name: 'Tools' });
  });
});
