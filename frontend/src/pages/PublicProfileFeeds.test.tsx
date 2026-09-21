import { fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import * as profileApi from '../api/profile';
import PublicProfileFeeds from './PublicProfileFeeds';

vi.mock('../api/profile', async () => {
  const actual = await vi.importActual<typeof import('../api/profile')>('../api/profile');
  return { ...actual, fetchPublicProfile: vi.fn() };
});

const mockedFetch = vi.mocked(profileApi.fetchPublicProfile);

const SAMPLE: profileApi.PublicProfilePage = {
  profile: {
    handle: 'artist',
    display_name: 'The Artist',
    bio: '',
    website_url: '',
    social_links: {},
    profile_image_url: '',
    is_public: true,
    revision: 1,
    theme_config: {},
  },
  collections: [],
  pieces: Array.from({ length: 6 }, (_, index) => ({
    id: `piece-${index}`,
    slug: `piece-${index}`,
    title: `Piece ${index}`,
    description: `Description ${index}`,
    type: 'generated',
    engine: 'p5js',
    published_at: '2026-09-21T00:00:00Z',
    regular_url: `/users/@artist/pieces/piece-${index}`,
    thumbnail_url: `/thumbnail-${index}.png`,
  })),
};

function renderAt(path = '/users/@artist/feeds') {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <Routes>
        <Route path="/users/:handle/feeds" element={<PublicProfileFeeds />} />
        <Route path="*" element={<p>not found</p>} />
      </Routes>
    </MemoryRouter>,
  );
}

describe('PublicProfileFeeds', () => {
  beforeEach(() => {
    mockedFetch.mockReset();
    Object.defineProperty(navigator, 'clipboard', {
      configurable: true,
      value: { writeText: vi.fn().mockResolvedValue(undefined) },
    });
  });

  it('renders subscribe rows with absolute feed URLs and latest five preview cards', async () => {
    mockedFetch.mockResolvedValue(SAMPLE);

    renderAt();

    expect(
      await screen.findByRole('heading', { name: 'Subscribe to The Artist' }),
    ).toBeInTheDocument();
    expect(screen.getAllByRole('button', { name: 'Copy' })).toHaveLength(3);
    expect(screen.getAllByRole('link', { name: 'Open' })).toHaveLength(3);
    expect(screen.getByText('http://localhost:3000/users/@artist/feed.xml')).toBeInTheDocument();
    expect(screen.getAllByRole('article')).toHaveLength(5);
    expect(screen.queryByText('Piece 5')).not.toBeInTheDocument();
  });

  it('confirms a copied feed URL in a live region', async () => {
    mockedFetch.mockResolvedValue(SAMPLE);

    renderAt();
    await screen.findByRole('heading', { name: 'Subscribe to The Artist' });
    fireEvent.click(screen.getAllByRole('button', { name: 'Copy' })[1]);

    expect(await screen.findByText('RSS feed URL copied.')).toBeInTheDocument();
    expect(navigator.clipboard.writeText).toHaveBeenCalledWith(
      'http://localhost:3000/users/@artist/feed.rss',
    );
  });

  it('uses the standard not-found state for an unavailable profile', async () => {
    mockedFetch.mockRejectedValue(new Error('missing'));

    renderAt();

    expect(await screen.findByRole('heading', { name: 'Page not found' })).toBeInTheDocument();
  });
});
