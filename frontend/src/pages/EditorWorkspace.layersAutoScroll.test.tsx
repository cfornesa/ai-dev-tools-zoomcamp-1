import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import * as projectsApi from '../api/projects';
import type { Project, SceneVersion } from '../api/projects';
import EditorWorkspace from './EditorWorkspace';
import { expandAllCollapsibleSections } from '../testUtils/expandCollapsibleSections';

/**
 * Issue #165 (task 133) gated `LayersPanel.tsx`'s selection-driven
 * `scrollIntoView` effect on `isRowFullyVisible`, so it only fired when the
 * newly-selected row was genuinely off screen.
 *
 * Issue #166 (task 134): live user feedback after #165 shipped reported
 * that heuristic *still* reads as a jarring jump, so the effect was removed
 * entirely — this panel now never scrolls the page/panel on selection,
 * regardless of whether the row is on- or off-screen. These tests are
 * updated (not deleted, per this task's acceptance criteria) to assert
 * that NEW behavior: `scrollIntoView` is never called, in either the
 * already-visible or off-screen case.
 *
 * jsdom has no real layout engine and no `scrollIntoView` implementation
 * at all, so both are stubbed here: `Element.prototype.scrollIntoView` is
 * added as a plain spy (it doesn't exist on the prototype otherwise, so
 * `vi.spyOn` would fail without first defining it), and each row's own
 * `getBoundingClientRect` is stubbed per test to simulate "already fully
 * on screen" vs. "off screen" — the assertion is now identical in both
 * cases (no scroll), but both scenarios are kept to prove the removal
 * holds regardless of row position, not just the common case.
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
  // jsdom has no `scrollIntoView` at all; add it as a plain spy-able stub.
  if (!('scrollIntoView' in Element.prototype)) {
    (Element.prototype as unknown as { scrollIntoView: () => void }).scrollIntoView = () => {
      /* no-op stub — jsdom has no real implementation to call through to */
    };
  }
  Object.defineProperty(window, 'innerHeight', {
    writable: true,
    configurable: true,
    value: 800,
  });
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe('LayersPanel auto-scroll removal (issue #166)', () => {
  it('does not call scrollIntoView when the newly-selected row is already fully visible', async () => {
    await loadReadyWorkspace();
    const user = userEvent.setup();
    await user.click(screen.getByRole('button', { name: 'Add circle' }));
    await user.click(screen.getByRole('button', { name: 'Add rectangle' }));

    const circleButton = within(outlineList()).getByRole('button', { name: 'Circle 1' });
    const circleRow = circleButton.closest('li')!;
    vi.spyOn(circleRow, 'getBoundingClientRect').mockReturnValue({
      top: 100,
      bottom: 140,
      left: 0,
      right: 100,
      width: 100,
      height: 40,
      x: 0,
      y: 100,
      toJSON: () => ({}),
    } as DOMRect);
    const scrollSpy = vi.spyOn(circleRow, 'scrollIntoView');

    await user.click(circleButton);

    expect(scrollSpy).not.toHaveBeenCalled();
  });

  it('does not call scrollIntoView when the newly-selected row is out of view either', async () => {
    await loadReadyWorkspace();
    const user = userEvent.setup();
    await user.click(screen.getByRole('button', { name: 'Add circle' }));
    await user.click(screen.getByRole('button', { name: 'Add rectangle' }));

    const circleButton = within(outlineList()).getByRole('button', { name: 'Circle 1' });
    const circleRow = circleButton.closest('li')!;
    // Below the stubbed 800px viewport — under the old #165 behavior this
    // would have triggered a scroll; #166 removed that entirely, so it
    // must not happen here either.
    vi.spyOn(circleRow, 'getBoundingClientRect').mockReturnValue({
      top: 900,
      bottom: 940,
      left: 0,
      right: 100,
      width: 100,
      height: 40,
      x: 0,
      y: 900,
      toJSON: () => ({}),
    } as DOMRect);
    const scrollSpy = vi.spyOn(circleRow, 'scrollIntoView');

    await user.click(circleButton);

    expect(scrollSpy).not.toHaveBeenCalled();
  });
});
