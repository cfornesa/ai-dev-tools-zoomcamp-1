import { render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { axe } from 'jest-axe';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import * as projectsApi from '../api/projects';
import Layout from '../components/Layout';
import PublicGallery from './PublicGallery';

/**
 * Issue #491: automated accessibility checks for the anonymous-reachable
 * unified public gallery — loading, error, empty, populated with 2D/3D/
 * generated cards, and the "reached the end" state.
 */

vi.mock('../api/projects');

const mockedFetchPublicGallery = vi.mocked(projectsApi.fetchPublicGallery);

function baseItem(
  overrides: Partial<projectsApi.PublicGalleryItem> & {
    kind?: projectsApi.PublicGalleryItemKind;
  } = {},
): projectsApi.PublicGalleryItem {
  const kind = overrides.kind ?? '2d';
  const base = {
    id: 'p1',
    title: 'Hand Follower',
    owner: 'alice',
    thumbnail_url: '/api/public/projects/p1/thumbnail.png',
    published_at: '2026-08-01T00:00:00Z',
    viewer_url: '/p/p1',
    kind,
  };
  if (kind === 'generated') {
    return {
      ...base,
      kind: 'generated',
      engine: 'canvas2d',
      ...overrides,
    } as projectsApi.PublicGalleryGeneratedItem;
  }
  return { ...base, kind, ...overrides } as projectsApi.PublicGalleryItem;
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
    mockedFetchPublicGallery.mockReturnValue(new Promise(() => {}));
    const { container } = renderPublicGallery();
    await screen.findByText(/loading the public gallery/i);
    expect(await axe(container)).toHaveNoViolations();
  });

  it('has no axe violations on load error', async () => {
    mockedFetchPublicGallery.mockRejectedValueOnce(new Error('network down'));
    const { container } = renderPublicGallery();
    await screen.findByRole('alert');
    expect(await axe(container)).toHaveNoViolations();
  });

  it('has no axe violations in the empty state', async () => {
    mockedFetchPublicGallery.mockResolvedValue({ results: [], next_cursor: null, has_more: false });
    const { container } = renderPublicGallery();
    await screen.findByText(/no public pieces yet/i);
    expect(await axe(container)).toHaveNoViolations();
  });

  it('has no axe violations with a populated grid including 2D, 3D, and generated cards, at the pagination end', async () => {
    mockedFetchPublicGallery.mockResolvedValue({
      results: [
        baseItem({ id: 'p1', title: '2D piece' }),
        baseItem({ id: 'p2', title: '3D piece', kind: '3d', viewer_url: '/p3d/p2' }),
        baseItem({
          id: 'gen-1',
          title: 'Generated piece',
          kind: 'generated',
          engine: 'svg',
          viewer_url: '/art-pieces/p/gen-1',
        }),
      ],
      next_cursor: null,
      has_more: false,
    });
    const { container } = renderPublicGallery();
    await screen.findByRole('heading', { name: '2D piece' });
    expect(await axe(container)).toHaveNoViolations();
  });
});
