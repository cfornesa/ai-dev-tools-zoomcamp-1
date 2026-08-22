import { render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { axe } from 'jest-axe';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import * as projectsApi from '../api/projects';
import * as authModule from '../auth/useAuth';
import Layout from '../components/Layout';
import Gallery from './Gallery';

/**
 * Task 63 (issue #63): automated accessibility checks (jest-axe, wired
 * globally by Task 62/issue #64 in `setupTests.ts` — not re-added here) for
 * the signed-in gallery's loading, error, empty, and populated states.
 */

vi.mock('../api/projects');
vi.mock('../auth/useAuth');

const mockedListProjects = vi.mocked(projectsApi.listProjects);
const mockedUseAuth = vi.mocked(authModule.useAuth);

function baseProject(overrides: Partial<projectsApi.Project> = {}): projectsApi.Project {
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

function renderGallery() {
  return render(
    <MemoryRouter initialEntries={['/']}>
      <Routes>
        <Route path="/" element={<Layout />}>
          <Route index element={<Gallery />} />
          <Route path="projects/:id" element={<p>Editor placeholder</p>} />
        </Route>
      </Routes>
    </MemoryRouter>,
  );
}

beforeEach(() => {
  vi.clearAllMocks();
  mockedUseAuth.mockReturnValue({
    status: 'signed-in',
    user: { username: 'alice', email: 'alice@example.com' },
  });
});

describe('Gallery accessibility', () => {
  it('has no axe violations while loading', async () => {
    mockedListProjects.mockReturnValue(new Promise(() => {}));
    const { container } = renderGallery();
    await screen.findByText(/loading your projects/i);
    expect(await axe(container)).toHaveNoViolations();
  });

  it('has no axe violations on load error', async () => {
    mockedListProjects.mockRejectedValue(new Error('network down'));
    const { container } = renderGallery();
    await screen.findByRole('alert');
    expect(await axe(container)).toHaveNoViolations();
  });

  it('has no axe violations in the empty state', async () => {
    mockedListProjects.mockResolvedValue([]);
    const { container } = renderGallery();
    await screen.findByText('You have not created any projects.');
    expect(await axe(container)).toHaveNoViolations();
  });

  it('has no axe violations with a populated project grid', async () => {
    mockedListProjects.mockResolvedValue([
      baseProject({ id: 'p1', title: 'Hand Follower', visibility: 'public' }),
      baseProject({ id: 'p2', title: 'Pinch Burst', visibility: 'private' }),
    ]);
    const { container } = renderGallery();
    await screen.findByRole('heading', { name: 'Hand Follower' });
    expect(await axe(container)).toHaveNoViolations();
  });
});
