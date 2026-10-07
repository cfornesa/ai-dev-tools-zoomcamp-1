import { render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { axe } from 'jest-axe';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import * as projectsApi from '../api/projects';
import * as projects3dApi from '../api/projects3d';
import * as artPiecesApi from '../api/artPieces';
import * as profileApi from '../api/profile';
import * as repository from '../storage/localProjectRepository';
import * as localThumbnail from '../storage/localThumbnail';
import * as authModule from '../auth/useAuth';
import Layout from '../components/Layout';
import Gallery from './Gallery';

/**
 * Task 63 (issue #63): automated accessibility checks (jest-axe, wired
 * globally by Task 62/issue #64 in `setupTests.ts` — not re-added here) for
 * the signed-in gallery's loading, error, empty, and populated states.
 */

vi.mock('../api/projects');
vi.mock('../api/projects3d');
vi.mock('../api/artPieces');
vi.mock('../api/profile');
vi.mock('../storage/localProjectRepository');
vi.mock('../storage/localThumbnail');
vi.mock('../auth/useAuth');

const mockedListProjects = vi.mocked(projectsApi.listProjects);
const mockedListProjects3D = vi.mocked(projects3dApi.listProjects3D);
const mockedListArtPieces = vi.mocked(artPiecesApi.listArtPieces);
const mockedUseAuth = vi.mocked(authModule.useAuth);
const mockedFetchProfile = vi.mocked(profileApi.fetchProfile);
const mockedOpenLocal = vi.mocked(repository.openLocalProjectDatabase);
const mockedListLocal = vi.mocked(repository.listProjectsForOwnerWithFallback);
const mockedEnsureLocalThumbnail = vi.mocked(localThumbnail.ensureLocalThumbnail);
const localDb = { close: vi.fn() } as unknown as IDBDatabase;

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
    thumbnail_url: null,
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
    user: { username: 'alice', email: 'alice@example.com', is_application_admin: false },
  });
  mockedListProjects3D.mockResolvedValue([]);
  mockedListArtPieces.mockResolvedValue([]);
  mockedFetchProfile.mockResolvedValue({ handle: 'alice' } as never);
  mockedOpenLocal.mockResolvedValue(localDb);
  mockedListLocal.mockResolvedValue([]);
  mockedEnsureLocalThumbnail.mockResolvedValue(null);
});

describe('Gallery accessibility', () => {
  it('has no axe violations while loading', async () => {
    mockedListProjects.mockReturnValue(new Promise(() => {}));
    const { container } = renderGallery();
    await screen.findByText(/loading the remaining piece lists/i);
    expect(await axe(container)).toHaveNoViolations();
  });

  it('has no axe violations on load error', async () => {
    mockedListProjects.mockRejectedValue(new Error('network down'));
    const { container } = renderGallery();
    await screen.findByText(/couldn't load your 2d projects/i);
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
