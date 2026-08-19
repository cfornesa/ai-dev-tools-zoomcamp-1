import { render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { axe } from 'jest-axe';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import * as projectsApi from '../api/projects';
import Layout from '../components/Layout';
import PublicGallery from './PublicGallery';

/**
 * Task 63 (issue #63): automated accessibility checks for the anonymous-
 * reachable public gallery — loading, error, empty, populated (including a
 * remixed card), and the "reached the end" state.
 */

vi.mock('../api/projects');

const mockedListPublicGallery = vi.mocked(projectsApi.listPublicGallery);

function baseProject(
  overrides: Partial<projectsApi.PublicGalleryProject> = {},
): projectsApi.PublicGalleryProject {
  return {
    id: 'p1',
    title: 'Hand Follower',
    owner: 'alice',
    thumbnail_url: '/api/public/projects/p1/thumbnail.png',
    remix_provenance: null,
    published_at: '2026-08-01T00:00:00Z',
    ...overrides,
  };
}

function renderPublicGallery() {
  return render(
    <MemoryRouter initialEntries={['/gallery']}>
      <Routes>
        <Route path="/" element={<Layout />}>
          <Route path="gallery" element={<PublicGallery />} />
        </Route>
      </Routes>
    </MemoryRouter>,
  );
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe('PublicGallery accessibility', () => {
  it('has no axe violations while loading', async () => {
    mockedListPublicGallery.mockReturnValue(new Promise(() => {}));
    const { container } = renderPublicGallery();
    await screen.findByText(/loading the public gallery/i);
    expect(await axe(container)).toHaveNoViolations();
  });

  it('has no axe violations on load error', async () => {
    mockedListPublicGallery.mockRejectedValueOnce(new Error('network down'));
    const { container } = renderPublicGallery();
    await screen.findByRole('alert');
    expect(await axe(container)).toHaveNoViolations();
  });

  it('has no axe violations in the empty state', async () => {
    mockedListPublicGallery.mockResolvedValue({ results: [], next_cursor: null, has_more: false });
    const { container } = renderPublicGallery();
    await screen.findByText(/no public projects yet/i);
    expect(await axe(container)).toHaveNoViolations();
  });

  it('has no axe violations with a populated grid including a remixed card, at the pagination end', async () => {
    mockedListPublicGallery.mockResolvedValue({
      results: [
        baseProject({ id: 'p1', title: 'Original piece' }),
        baseProject({
          id: 'p2',
          title: 'Remixed piece',
          remix_provenance: {
            source_public_id: 'p1',
            source_creator: 'alice',
          },
        }),
      ],
      next_cursor: null,
      has_more: false,
    });
    const { container } = renderPublicGallery();
    await screen.findByRole('heading', { name: 'Original piece' });
    expect(await axe(container)).toHaveNoViolations();
  });
});
