import { render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import * as collectionsApi from '../api/collections';
import PublicCollection from './PublicCollection';

vi.mock('../api/collections', async () => {
  const actual = await vi.importActual<typeof import('../api/collections')>('../api/collections');
  return { ...actual, fetchPublicCollection: vi.fn() };
});

const mockedFetch = vi.mocked(collectionsApi.fetchPublicCollection);

const SAMPLE: collectionsApi.Collection = {
  id: 'collection-1',
  title: 'Spring studies',
  description: 'Small experiments',
  slug: 'spring-studies',
  handle: 'alice',
  owner: 'alice',
  visibility: 'public',
  published_at: '2026-01-01T00:00:00Z',
  created_at: '2026-01-01T00:00:00Z',
  updated_at: '2026-01-01T00:00:00Z',
  items: [
    {
      kind: 'art_piece',
      id: 'piece-1',
      position: 0,
      title: 'No thumbnail piece',
      viewer_url: '/art-pieces/p/piece-1',
      thumbnail_url: null,
      label: 'Generated art piece',
    },
  ],
};

function renderPage() {
  return render(
    <MemoryRouter initialEntries={['/users/@alice/spring-studies']}>
      <Routes>
        <Route path="/users/:handle/:collectionSlug" element={<PublicCollection />} />
      </Routes>
    </MemoryRouter>,
  );
}

beforeEach(() => {
  vi.clearAllMocks();
  mockedFetch.mockResolvedValue(SAMPLE);
});

describe('PublicCollection', () => {
  it('renders ordered public cards with thumbnail fallback and canonical links', async () => {
    renderPage();
    expect(await screen.findByRole('heading', { name: 'Spring studies' })).toBeInTheDocument();
    expect(
      screen.getByRole('img', { name: 'No preview available for No thumbnail piece' }),
    ).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /No thumbnail piece/ })).toHaveAttribute(
      'href',
      '/art-pieces/p/piece-1',
    );
  });

  it('renders a safe not-found state', async () => {
    mockedFetch.mockRejectedValue(new Error('API request failed with status 404'));
    renderPage();
    expect(
      await screen.findByRole('heading', { name: 'Collection not found' }),
    ).toBeInTheDocument();
    expect(screen.getByText(/private, unavailable, or no longer exists/i)).toBeInTheDocument();
  });
});
