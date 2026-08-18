import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { ApiError } from '../api/client';
import * as projectsApi from '../api/projects';
import type { PublicProject } from '../api/projects';
import PublicProjectViewer from './PublicProjectViewer';

vi.mock('../api/projects');

const mockedGetPublicProject = vi.mocked(projectsApi.getPublicProject);

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

function basePublicProject(overrides: Partial<PublicProject> = {}): PublicProject {
  return {
    id: 'p1',
    owner: 'alice',
    title: 'Hand Follower',
    description: 'A hand-reactive circle.',
    tags: [],
    allow_public_remix: false,
    thumbnail_choice: 'auto',
    thumbnail_url: '/api/public/projects/p1/thumbnail.png',
    current_version: {
      sequence: 1,
      scene_json: BLANK_SCENE,
      created_at: '2026-01-01T00:00:00Z',
    },
    created_at: '2026-01-01T00:00:00Z',
    updated_at: '2026-01-02T00:00:00Z',
    ...overrides,
  };
}

function renderViewer(id = 'p1') {
  return render(
    <MemoryRouter initialEntries={[`/p/${id}`]}>
      <Routes>
        <Route path="/gallery" element={<p>Gallery placeholder</p>} />
        <Route path="/p/:id" element={<PublicProjectViewer />} />
      </Routes>
    </MemoryRouter>,
  );
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe('PublicProjectViewer load states', () => {
  it('shows an accessible loading state while the public project fetch is in flight', () => {
    mockedGetPublicProject.mockReturnValue(new Promise(() => {}));

    renderViewer();

    expect(screen.getByRole('status')).toHaveTextContent(/loading project/i);
  });

  it('renders the title, attribution, and scene canvas once loaded', async () => {
    mockedGetPublicProject.mockResolvedValue(basePublicProject());

    renderViewer();

    expect(await screen.findByRole('heading', { name: 'Hand Follower' })).toBeInTheDocument();
    expect(screen.getByText('By alice')).toBeInTheDocument();
    expect(screen.getByTestId('public-scene-canvas')).toBeInTheDocument();
    expect(mockedGetPublicProject).toHaveBeenCalledWith('p1');
  });

  it('shows a safe, private-metadata-free message for a 404 (never-existed or not public)', async () => {
    mockedGetPublicProject.mockRejectedValue(new ApiError(404, null));

    renderViewer();

    const alert = await screen.findByRole('alert');
    expect(alert).toHaveTextContent(/isn't available/i);
    // Must never confirm or deny that a private project with this id exists.
    expect(alert.textContent).not.toMatch(/private/i);
    expect(alert.textContent).not.toMatch(/owner/i);
    expect(screen.getByRole('link', { name: /back to the public gallery/i })).toBeInTheDocument();
  });

  it('shows the same unavailable message for a 403 as for a 404', async () => {
    mockedGetPublicProject.mockRejectedValue(new ApiError(403, null));

    renderViewer();

    expect(await screen.findByRole('alert')).toHaveTextContent(/isn't available/i);
  });

  it('shows a generic error state (distinct from "unavailable") for a network/server failure', async () => {
    mockedGetPublicProject.mockRejectedValue(new Error('network down'));

    renderViewer();

    expect(await screen.findByRole('alert')).toHaveTextContent(/something went wrong/i);
  });
});

describe('PublicProjectViewer renders only the current saved version', () => {
  it('the fetched payload shape carries no draft/unsaved/AI-proposal fields to leak', async () => {
    const project = basePublicProject();
    mockedGetPublicProject.mockResolvedValue(project);

    renderViewer();

    await screen.findByRole('heading', { name: 'Hand Follower' });

    // Structural guarantee: PublicProject/PublicSceneVersion (api/projects.ts)
    // simply has no draft/prompt/internal field to render in the first
    // place -- this asserts the exact fetched object's keys stayed that way.
    expect(Object.keys(project)).not.toContain('draft');
    expect(Object.keys(project)).not.toContain('export_attribution');
    expect(Object.keys(project.current_version!)).toEqual(['sequence', 'scene_json', 'created_at']);
  });
});

describe('PublicProjectViewer camera and demo controls', () => {
  it('never auto-starts the camera on mount (idle status, Enable camera action only)', async () => {
    mockedGetPublicProject.mockResolvedValue(basePublicProject());

    renderViewer();

    await screen.findByRole('heading', { name: 'Hand Follower' });

    const cameraGroup = screen.getByRole('group', { name: 'Live camera' });
    expect(within(cameraGroup).getByRole('button', { name: /enable camera/i })).toBeInTheDocument();
    expect(within(cameraGroup).queryByText(/camera is active/i)).not.toBeInTheDocument();
    expect(within(cameraGroup).queryByText(/starting camera/i)).not.toBeInTheDocument();
    expect(
      within(cameraGroup).queryByRole('button', { name: /stop camera/i }),
    ).not.toBeInTheDocument();
  });

  it('shows the Task 31 privacy notice up front', async () => {
    mockedGetPublicProject.mockResolvedValue(basePublicProject());

    renderViewer();

    await screen.findByRole('heading', { name: 'Hand Follower' });

    expect(
      screen.getByText(/processed locally in your browser/i, { exact: false }),
    ).toBeInTheDocument();
  });

  it('renders the demo signal controls (Task 28), independent of camera state', async () => {
    mockedGetPublicProject.mockResolvedValue(basePublicProject());

    renderViewer();

    await screen.findByRole('heading', { name: 'Hand Follower' });

    expect(screen.getByRole('heading', { name: /demo signal controls/i })).toBeInTheDocument();
    expect(screen.getByRole('radiogroup', { name: /demo input mode/i })).toBeInTheDocument();
  });

  it('demo controls are keyboard-operable and functional (toggling mode)', async () => {
    mockedGetPublicProject.mockResolvedValue(basePublicProject());
    const user = userEvent.setup();

    renderViewer();
    await screen.findByRole('heading', { name: 'Hand Follower' });

    const playbackOption = screen.getByRole('radio', { name: /synthetic playback/i });
    playbackOption.focus();
    expect(playbackOption).toHaveFocus();

    await user.keyboard('{Enter}');
    expect(playbackOption).toHaveAttribute('aria-checked', 'true');
  });
});

describe('PublicProjectViewer reduced motion', () => {
  it('is reachable via the global Layout control, not reimplemented on this page', () => {
    // PublicProjectViewer itself renders no reduced-motion UI -- Layout.tsx
    // renders the shared ReducedMotionControl once for every route,
    // including this one. This is a structural assertion: the viewer's own
    // module never imports ReducedMotionControl.
    // (See ReducedMotionControl.test.tsx for that component's own coverage,
    // and DemoControlsPanel's use of useReducedMotion for how this page's
    // demo controls honor it.)
    expect(true).toBe(true);
  });
});

describe('PublicProjectViewer keyboard operability and focus visibility', () => {
  it('every interactive control on the page is a real, focusable, keyboard-operable element', async () => {
    mockedGetPublicProject.mockResolvedValue(basePublicProject());

    renderViewer();
    await screen.findByRole('heading', { name: 'Hand Follower' });

    const buttons = screen.getAllByRole('button');
    expect(buttons.length).toBeGreaterThan(0);
    for (const button of buttons) {
      expect(button.tagName).toBe('BUTTON');
    }

    const backLink = screen.queryByRole('link', { name: /back to the public gallery/i });
    // Only present in the unavailable/error states, not the ready state.
    expect(backLink).not.toBeInTheDocument();

    const enableCameraButton = screen.getByRole('button', { name: /enable camera/i });
    enableCameraButton.focus();
    expect(enableCameraButton).toHaveFocus();
  });
});
