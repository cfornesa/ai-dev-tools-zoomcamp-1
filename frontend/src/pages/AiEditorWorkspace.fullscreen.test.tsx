import { act, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import * as projectsApi from '../api/projects';
import type { Project, SceneVersion } from '../api/projects';
import AiEditorWorkspace from './AiEditorWorkspace';

/** Issue #287: "Expand piece to fullscreen" in the 2D AI-assisted editor. */

vi.mock('../api/projects');

const mockedGetProject = vi.mocked(projectsApi.getProject);
const mockedGetSceneVersion = vi.mocked(projectsApi.getSceneVersion);

function baseProject(overrides: Partial<Project> = {}): Project {
  return {
    id: 'p1',
    owner: 'alice',
    title: 'My AI animation',
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
    <MemoryRouter initialEntries={['/ai-projects/p1']}>
      <Routes>
        <Route path="/ai-projects/:id" element={<AiEditorWorkspace />} />
      </Routes>
    </MemoryRouter>,
  );
}

function mockFullscreenApi() {
  let current: Element | null = null;
  Object.defineProperty(document, 'fullscreenElement', {
    configurable: true,
    get: () => current,
  });
  const requestFullscreen = vi.fn(function (this: Element) {
    current = this;
    document.dispatchEvent(new Event('fullscreenchange'));
    return Promise.resolve();
  });
  const exitFullscreen = vi.fn(() => {
    current = null;
    document.dispatchEvent(new Event('fullscreenchange'));
    return Promise.resolve();
  });
  Element.prototype.requestFullscreen =
    requestFullscreen as unknown as typeof Element.prototype.requestFullscreen;
  document.exitFullscreen = exitFullscreen as unknown as typeof document.exitFullscreen;
  return { requestFullscreen, exitFullscreen };
}

beforeEach(() => {
  vi.clearAllMocks();
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe('"Expand piece to fullscreen" (2D AI-assisted editor, issue #287)', () => {
  it('enters real fullscreen on click and reflects it via aria-pressed/label', async () => {
    const mocks = mockFullscreenApi();
    mockedGetProject.mockResolvedValue(baseProject());
    mockedGetSceneVersion.mockResolvedValue(baseVersion());
    renderWorkspace();
    await screen.findByRole('region', { name: 'Preview' });
    const user = userEvent.setup();

    const button = screen.getByRole('button', { name: 'Expand piece to fullscreen' });
    expect(button).toHaveAttribute('aria-pressed', 'false');

    await user.click(button);

    expect(mocks.requestFullscreen).toHaveBeenCalledTimes(1);
    expect(screen.getByRole('button', { name: 'Exit fullscreen' })).toHaveAttribute(
      'aria-pressed',
      'true',
    );
  });

  it('stays in sync when fullscreen is exited via Escape/browser chrome', async () => {
    mockFullscreenApi();
    mockedGetProject.mockResolvedValue(baseProject());
    mockedGetSceneVersion.mockResolvedValue(baseVersion());
    renderWorkspace();
    await screen.findByRole('region', { name: 'Preview' });
    const user = userEvent.setup();

    await user.click(screen.getByRole('button', { name: 'Expand piece to fullscreen' }));
    expect(screen.getByRole('button', { name: 'Exit fullscreen' })).toBeInTheDocument();

    act(() => {
      Object.defineProperty(document, 'fullscreenElement', {
        configurable: true,
        get: () => null,
      });
      document.dispatchEvent(new Event('fullscreenchange'));
    });

    expect(screen.getByRole('button', { name: 'Expand piece to fullscreen' })).toHaveAttribute(
      'aria-pressed',
      'false',
    );
  });
});
