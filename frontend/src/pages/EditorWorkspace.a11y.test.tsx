import { fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { axe } from 'jest-axe';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import * as projectsApi from '../api/projects';
import type { Project, SceneVersion } from '../api/projects';
import Layout from '../components/Layout';
import EditorWorkspace from './EditorWorkspace';

/**
 * Task 64 (issue #64): automated accessibility checks (axe-core, via
 * `jest-axe`) for the scoped core-editor-creation-flow surfaces — workspace
 * navigation, tools, canvas alternatives (the outline), inspector, outline,
 * shapes, behavior cards, and save/history controls. Graph, camera/input,
 * gallery, sharing, and export surfaces are explicitly out of scope for this
 * task (Task 63/64, issues #62/#63) and are deliberately left uncovered
 * here — the "Show logic" advanced graph section stays collapsed (its
 * default state) in every scenario below so `GraphView`/`GraphListView`
 * never enter the accessibility tree these assertions inspect, and camera
 * controls are audited only insofar as `axe` sees whatever DOM they render
 * by default (no camera-specific interaction is exercised).
 *
 * `jest-axe` is a new devDependency added specifically for this task (see
 * `frontend/package.json`) — no automated accessibility tool existed in
 * this codebase before. It wraps `axe-core` with a Jest/Vitest-compatible
 * `toHaveNoViolations` matcher, registered once in `setupTests.ts` so every
 * test file can use it. This matches the precedent set by Task 42's
 * `fake-indexeddb`: a devDependency added for testing infrastructure,
 * documented here rather than requiring separate sign-off.
 *
 * ## What automated checks can and cannot catch (acceptance criterion 5:
 * "documented reasons for checks that require manual verification")
 *
 * `axe-core` reliably catches missing/duplicate accessible names, invalid
 * ARIA usage, missing form labels, invalid roles, and structural issues
 * (e.g. list children outside `<ul>`/`<ol>`). It CANNOT catch, and so this
 * suite does not rely on it for:
 * - Logical focus order matching visual/reading order — asserted instead by
 *   manual DOM-order review (see `_docs/team/software-engineer.md`-style
 *   audit notes in the issue #64 tracking comment) plus this file's own
 *   `document.activeElement` assertions after simulated Tab-order actions.
 * - Focus visibility (`:focus-visible` CSS actually painting a visible
 *   outline) — jsdom doesn't run layout/paint, so this is verified by
 *   static review of `src/index.css`'s `:focus-visible` rules instead (no
 *   `outline: none` overrides exist anywhere in the frontend — confirmed by
 *   `grep -rn "outline: *none" frontend/src`).
 * - Whether a dialog actually moves focus into itself, closes on Escape,
 *   and restores focus to its trigger on close — jest-axe checks static
 *   ARIA structure only, not this interaction sequence, so this file
 *   exercises that behavior directly (see the "alert dialogs" describe
 *   block below) rather than relying on axe for it.
 * - Real assistive-technology behavior (actual screen reader output,
 *   real focus-visible rendering) — inherently requires manual AT testing,
 *   which is out of scope for an automated CI suite; documented here as a
 *   known gap rather than silently assumed covered.
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

// A scene with a shape already present, for tests where the behavior-card
// form's Target select needs a valid option from first mount — see the
// behavior-card conflict dialog test below. `BehaviorCardsPanel`'s target
// selection is `useState`-initialized once from whatever targets exist at
// mount (`targetOptions[0]?.id ?? ''`) and never resynced afterward, so a
// target added to an empty scene via the UI after mount is never
// auto-selected (matches `EditorWorkspace.behaviorCards.test.tsx`'s own
// `SCENE_WITH_SHAPE` fixture and its comment there).
const SCENE_WITH_SHAPE = {
  ...BLANK_SCENE,
  id: 'scene-with-shape',
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

function setViewportWidth(width: number) {
  Object.defineProperty(window, 'innerWidth', { writable: true, configurable: true, value: width });
  window.dispatchEvent(new Event('resize'));
}

// Renders `EditorWorkspace` nested inside the real `Layout` shell (the same
// `<Route path="/" element={<Layout />}>` nesting `App.tsx` uses) rather
// than mounting it standalone. This matters for the axe checks below: axe's
// "region" rule requires all page content be contained within a landmark,
// and `Layout`'s `<main>` is what satisfies that for `EditorWorkspace`'s own
// `<header>` (which, nested inside `<main>`, has no implicit "banner"
// landmark role of its own — see the HTML5 sectioning-content rule).
// Mounting `EditorWorkspace` without `Layout` would report a landmark
// violation that does not actually occur in the real app.
function renderWorkspace() {
  return render(
    <MemoryRouter initialEntries={['/projects/p1']}>
      <Routes>
        <Route path="/" element={<Layout />}>
          <Route index element={<p>Gallery placeholder</p>} />
          <Route path="projects/:id" element={<EditorWorkspace />} />
          <Route path="projects/:id/settings" element={<p>Settings placeholder</p>} />
        </Route>
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
  setViewportWidth(1024); // wide layout by default — matches EditorWorkspace.test.tsx's convention
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

describe('EditorWorkspace: automated accessibility (axe)', () => {
  it('has no axe violations in the empty-scene ready state', async () => {
    await loadReadyWorkspace();
    const results = await axe(document.body);
    expect(results).toHaveNoViolations();
  });

  it('has no axe violations with a shape created and selected (Tools + Preview + Inspector all populated)', async () => {
    await loadReadyWorkspace();
    fireEvent.click(screen.getByRole('button', { name: 'Add circle' }));
    const results = await axe(document.body);
    expect(results).toHaveNoViolations();
  });

  it('has no axe violations with a layer added and a group created in the outline', async () => {
    await loadReadyWorkspace();
    fireEvent.click(screen.getByRole('button', { name: 'Add circle' }));
    fireEvent.click(screen.getByRole('button', { name: 'Add rectangle' }));
    const checkboxes = screen.getAllByRole('checkbox', { name: /Add .* to group selection/ });
    fireEvent.click(checkboxes[0]);
    fireEvent.click(checkboxes[1]);
    fireEvent.click(screen.getByRole('button', { name: 'Combine into group' }));
    const results = await axe(document.body);
    expect(results).toHaveNoViolations();
  });

  it('has no axe violations with a behavior card added', async () => {
    await loadReadyWorkspace();
    fireEvent.click(screen.getByRole('button', { name: 'Add circle' }));
    fireEvent.click(screen.getByRole('button', { name: 'Add card' }));
    const results = await axe(document.body);
    expect(results).toHaveNoViolations();
  });

  it('has no axe violations with the exit-without-saving confirmation dialog open', async () => {
    await loadReadyWorkspace();
    fireEvent.click(screen.getByRole('button', { name: 'Exit without saving' }));
    await screen.findByRole('alertdialog', { name: 'Exit without saving?' });
    const results = await axe(document.body);
    expect(results).toHaveNoViolations();
  });

  it('has no axe violations with the behavior-card conflict dialog open', async () => {
    const user = userEvent.setup();
    mockedGetProject.mockResolvedValue(baseProject());
    mockedGetSceneVersion.mockResolvedValue(baseVersion({ scene_json: SCENE_WITH_SHAPE }));
    renderWorkspace();
    await screen.findByRole('region', { name: 'Tools' });
    await user.click(screen.getByRole('button', { name: 'Add card' }));
    // Same target, a different signal source but the same positionX
    // channel (see behaviorCards.ts's `signal`/`targetProperty` mapping) —
    // adding again should surface the conflict dialog rather than silently
    // overwriting the existing binding.
    await user.selectOptions(screen.getByLabelText('Hand signal'), 'Palm center');
    await user.click(screen.getByRole('button', { name: 'Add card' }));
    await screen.findByRole('alertdialog', { name: /already has a binding/i });
    const results = await axe(document.body);
    expect(results).toHaveNoViolations();
  });

  it('has no axe violations with the version-delete confirmation dialog open', async () => {
    // A second, non-current version so its Delete button isn't disabled
    // (the current version's Delete button is always disabled — nothing
    // to open a confirmation dialog for).
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
      {
        id: 2,
        sequence: 2,
        origin: 'manual',
        change_label: 'v2',
        created_by: 'alice',
        parent: 1,
        fork_source_version: null,
        created_at: '2026-01-02T00:00:00Z',
      },
    ]);
    await loadReadyWorkspace();
    await screen.findByText('Version 2');
    const deleteButtons = screen.getAllByRole('button', { name: 'Delete' });
    fireEvent.click(deleteButtons[1]);
    await screen.findByRole('alertdialog', { name: /Delete version 2/ });
    const results = await axe(document.body);
    expect(results).toHaveNoViolations();
  });

  it('has no axe violations with the narrow-viewport panel switcher rendered', async () => {
    setViewportWidth(320);
    mockedGetProject.mockResolvedValue(baseProject());
    mockedGetSceneVersion.mockResolvedValue(baseVersion());
    renderWorkspace();
    await screen.findByRole('tablist', { name: 'Editor panels' });
    const results = await axe(document.body);
    expect(results).toHaveNoViolations();
  });
});
