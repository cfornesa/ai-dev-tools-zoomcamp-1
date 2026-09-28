import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import * as collectionsApi from '../api/collections';
import Layout from '../components/Layout';
import PublicCollections from './PublicCollections';

vi.mock('../api/collections');

const mockedFetchPublicCollections = vi.mocked(collectionsApi.fetchPublicCollections);

function collection(overrides: Partial<collectionsApi.PublicCollectionIndexItem> = {}) {
  return {
    id: 'collection-1',
    title: 'Motion studies',
    owner_handle: 'alice',
    cover_url: null,
    item_count: 3,
    published_at: '2026-09-28T12:00:00Z',
    viewer_url: '/users/@alice/collections/motion-studies',
    ...overrides,
  };
}

function renderPage() {
  return render(
    <MemoryRouter initialEntries={['/collections']}>
      <Routes>
        <Route path="/" element={<Layout />}>
          <Route path="collections" element={<PublicCollections />} />
        </Route>
      </Routes>
    </MemoryRouter>,
  );
}

beforeEach(() => vi.clearAllMocks());

describe('PublicCollections', () => {
  it('renders public collection cards from the #1028 endpoint', async () => {
    mockedFetchPublicCollections.mockResolvedValue({
      results: [collection()],
      next_cursor: null,
      has_more: false,
    });

    renderPage();

    expect(await screen.findByRole('heading', { name: 'Motion studies' })).toBeInTheDocument();
    expect(screen.getByRole('article', { name: 'Motion studies by @alice' })).toBeInTheDocument();
    expect(mockedFetchPublicCollections).toHaveBeenCalledWith();
  });

  it('uses the response cursor when loading the next page', async () => {
    mockedFetchPublicCollections
      .mockResolvedValueOnce({
        results: [collection()],
        next_cursor: 'next-page',
        has_more: true,
      })
      .mockResolvedValueOnce({
        results: [collection({ id: 'collection-2', title: 'Color experiments' })],
        next_cursor: null,
        has_more: false,
      });

    renderPage();
    await screen.findByRole('heading', { name: 'Motion studies' });
    await userEvent.setup().click(screen.getByRole('button', { name: 'Load more collections' }));

    expect(await screen.findByRole('heading', { name: 'Color experiments' })).toBeInTheDocument();
    expect(mockedFetchPublicCollections).toHaveBeenNthCalledWith(2, 'next-page');
  });

  it('renders a clear empty state when no public collections exist', async () => {
    mockedFetchPublicCollections.mockResolvedValue({
      results: [],
      next_cursor: null,
      has_more: false,
    });

    renderPage();

    expect(
      await screen.findByText('No public collections yet. Check back soon.'),
    ).toBeInTheDocument();
  });
});
