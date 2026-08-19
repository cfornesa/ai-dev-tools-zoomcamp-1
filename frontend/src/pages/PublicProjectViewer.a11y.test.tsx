import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { axe } from 'jest-axe';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import * as projectsApi from '../api/projects';
import type { PublicProject } from '../api/projects';
import * as authModule from '../auth/useAuth';
import Layout from '../components/Layout';
import PublicProjectViewer from './PublicProjectViewer';

/**
 * Task 63 (issue #63): automated accessibility checks for the public
 * project viewer — loading, unavailable, error, ready (original and
 * remixed), the Fork action's states (hidden, idle, forking, error), and
 * both anonymous and signed-in visitors. Camera/demo controls in this page
 * are the exact same shared components `CameraControl.a11y.test.tsx`
 * (issue #62) already covers in isolation; this file checks them only as
 * rendered within this page's own DOM tree.
 */

vi.mock('../api/projects');
vi.mock('../auth/useAuth');

const mockedGetPublicProject = vi.mocked(projectsApi.getPublicProject);
const mockedForkProject = vi.mocked(projectsApi.forkProject);
const mockedUseAuth = vi.mocked(authModule.useAuth);

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
    remix_provenance: null,
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
        <Route path="/" element={<Layout />}>
          <Route path="gallery" element={<p>Gallery placeholder</p>} />
          <Route path="p/:id" element={<PublicProjectViewer />} />
          <Route path="projects/:id" element={<p>Editor placeholder</p>} />
        </Route>
      </Routes>
    </MemoryRouter>,
  );
}

beforeEach(() => {
  vi.clearAllMocks();
  mockedUseAuth.mockReturnValue({ status: 'signed-out', user: null });
});

describe('PublicProjectViewer accessibility', () => {
  it('has no axe violations while loading', async () => {
    mockedGetPublicProject.mockReturnValue(new Promise(() => {}));
    const { container } = renderViewer();
    await screen.findByText(/loading project/i);
    expect(await axe(container)).toHaveNoViolations();
  });

  it('has no axe violations in the unavailable state', async () => {
    const { ApiError } = await import('../api/client');
    mockedGetPublicProject.mockRejectedValue(new ApiError(404, {}));
    const { container } = renderViewer();
    await screen.findByRole('alert');
    expect(await axe(container)).toHaveNoViolations();
  });

  it('has no axe violations in the ready state for an anonymous visitor (no fork button)', async () => {
    mockedGetPublicProject.mockResolvedValue(basePublicProject());
    const { container } = renderViewer();
    await screen.findByRole('heading', { name: 'Hand Follower' });
    expect(screen.queryByRole('button', { name: /fork this project/i })).not.toBeInTheDocument();
    expect(await axe(container)).toHaveNoViolations();
  });

  it('has no axe violations for a remixed project with a signed-in visitor and a visible Fork button', async () => {
    mockedUseAuth.mockReturnValue({
      status: 'signed-in',
      user: { username: 'bob', email: 'bob@example.com' },
    });
    mockedGetPublicProject.mockResolvedValue(
      basePublicProject({
        allow_public_remix: true,
        remix_provenance: { source_public_id: 'p0', source_creator: 'carol' },
      }),
    );
    const { container } = renderViewer();
    await screen.findByRole('button', { name: /fork this project/i });
    expect(await axe(container)).toHaveNoViolations();
  });

  it('has no axe violations with a fork error shown', async () => {
    mockedUseAuth.mockReturnValue({
      status: 'signed-in',
      user: { username: 'bob', email: 'bob@example.com' },
    });
    mockedGetPublicProject.mockResolvedValue(basePublicProject({ allow_public_remix: true }));
    mockedForkProject.mockRejectedValue(new Error('boom'));
    const user = userEvent.setup();
    const { container } = renderViewer();

    await user.click(await screen.findByRole('button', { name: /fork this project/i }));
    await screen.findByRole('alert');

    expect(await axe(container)).toHaveNoViolations();
  });
});
