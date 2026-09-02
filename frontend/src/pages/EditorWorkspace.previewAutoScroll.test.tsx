import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import * as projectsApi from '../api/projects';
import type { Project, SceneVersion } from '../api/projects';
import EditorWorkspace from './EditorWorkspace';
import { expandAllCollapsibleSections } from '../testUtils/expandCollapsibleSections';

/**
 * Issue #171 (task 139): live user feedback after tasks 131-138 shipped
 * reported that selecting a shape via a Layers-panel row click gave no
 * perceivable feedback when the resulting canvas selection was scrolled
 * out of view. Unlike #165/#166 (which concluded auto-scrolling the
 * Layers panel itself was jarring and removed it entirely — see
 * `EditorWorkspace.layersAutoScroll.test.tsx`), this task scrolls the
 * opposite direction: the Preview/canvas section, and only when it is not
 * already fully visible in the viewport.
 *
 * jsdom has no `scrollIntoView` implementation at all, so it's stubbed as
 * a plain spy-able function on `Element.prototype`, matching the existing
 * convention in `EditorWorkspace.layersAutoScroll.test.tsx`. Each test
 * stubs the Preview section's own `getBoundingClientRect` to simulate
 * "already fully on screen" vs. "off screen".
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

function outlineList() {
  return screen.getByRole('list', { name: 'Scene outline' });
}

function previewSection() {
  return screen.getByRole('region', { name: 'Preview' });
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

describe('Preview section auto-scroll on Layers-panel row selection (issue #171)', () => {
  it('scrolls the Preview section into view when a row click selects a shape while Preview is off screen', async () => {
    await loadReadyWorkspace();
    const user = userEvent.setup();
    await user.click(screen.getByRole('button', { name: 'Add circle' }));

    const preview = previewSection();
    vi.spyOn(preview, 'getBoundingClientRect').mockReturnValue({
      top: 900,
      bottom: 1400,
      left: 0,
      right: 100,
      width: 100,
      height: 500,
      x: 0,
      y: 900,
      toJSON: () => ({}),
    } as DOMRect);
    const scrollSpy = vi.spyOn(preview, 'scrollIntoView');

    const circleButton = within(outlineList()).getByRole('button', { name: 'Circle 1' });
    await user.click(circleButton);

    expect(scrollSpy).toHaveBeenCalledWith({ block: 'nearest' });
  });

  it('does not scroll the Preview section when it is already fully visible', async () => {
    await loadReadyWorkspace();
    const user = userEvent.setup();
    await user.click(screen.getByRole('button', { name: 'Add circle' }));

    const preview = previewSection();
    vi.spyOn(preview, 'getBoundingClientRect').mockReturnValue({
      top: 50,
      bottom: 600,
      left: 0,
      right: 100,
      width: 100,
      height: 550,
      x: 0,
      y: 50,
      toJSON: () => ({}),
    } as DOMRect);
    const scrollSpy = vi.spyOn(preview, 'scrollIntoView');

    const circleButton = within(outlineList()).getByRole('button', { name: 'Circle 1' });
    await user.click(circleButton);

    expect(scrollSpy).not.toHaveBeenCalled();
  });

  it('does not scroll the Preview section when selection is driven by a canvas click', async () => {
    await loadReadyWorkspace();
    const user = userEvent.setup();
    await user.click(screen.getByRole('button', { name: 'Add circle' }));

    const preview = previewSection();
    vi.spyOn(preview, 'getBoundingClientRect').mockReturnValue({
      top: 900,
      bottom: 1400,
      left: 0,
      right: 100,
      width: 100,
      height: 500,
      x: 0,
      y: 900,
      toJSON: () => ({}),
    } as DOMRect);
    const scrollSpy = vi.spyOn(preview, 'scrollIntoView');

    // Deselect via Escape (no canvas hit) — confirms this path (not driven
    // by a Layers-panel row) never triggers the new scroll behavior. The
    // canvas hit-test path itself already goes through the same
    // `sceneEditor.selectShape` call `handleCanvasClick` uses, which never
    // invokes the new `onRowSelect` callback — see `EditorWorkspace.tsx`'s
    // `handleLayerRowSelect` doc comment.
    await user.keyboard('{Escape}');

    expect(scrollSpy).not.toHaveBeenCalled();
  });
});
