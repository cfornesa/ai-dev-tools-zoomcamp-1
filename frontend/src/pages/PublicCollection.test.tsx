import { render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import * as collectionsApi from '../api/collections';
import * as profileApi from '../api/profile';
import PublicCollection from './PublicCollection';

vi.mock('../api/collections', async () => {
  const actual = await vi.importActual<typeof import('../api/collections')>('../api/collections');
  return { ...actual, fetchPublicCollection: vi.fn() };
});
vi.mock('../api/profile', async () => {
  const actual = await vi.importActual<typeof import('../api/profile')>('../api/profile');
  return { ...actual, fetchPublicProfile: vi.fn() };
});

const mockedFetch = vi.mocked(collectionsApi.fetchPublicCollection);
const mockedFetchProfile = vi.mocked(profileApi.fetchPublicProfile);

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
  canonical_url: '/users/@alice/collections/spring-studies',
  immersive_url: '/users/@alice/collections/spring-studies/immersive',
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

function renderPage(path = '/users/@alice/collections/spring-studies') {
  function LocationProbe() {
    return <output data-testid="location-path">{useLocation().pathname}</output>;
  }
  return render(
    <MemoryRouter initialEntries={[path]}>
      <Routes>
        <Route
          path="/users/@alice/collections/spring-studies"
          element={
            <>
              <PublicCollection />
              <LocationProbe />
            </>
          }
        />
        <Route path="/users/:handle/:collectionSlug" element={<PublicCollection />} />
        <Route path="/users/@alice/collections/spring-studies/target" element={<p>Target</p>} />
      </Routes>
    </MemoryRouter>,
  );
}

beforeEach(() => {
  vi.clearAllMocks();
  mockedFetch.mockResolvedValue(SAMPLE);
  mockedFetchProfile.mockRejectedValue(new Error('no profile in this test'));
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

  it('replaces the legacy collection route with the canonical route', async () => {
    renderPage('/users/@alice/spring-studies');
    expect(await screen.findByRole('heading', { name: 'Spring studies' })).toBeInTheDocument();
    expect(screen.getByTestId('location-path')).toHaveTextContent(
      '/users/@alice/collections/spring-studies',
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

  it("applies the owning profile's selected theme as CSS custom properties (#577)", async () => {
    mockedFetchProfile.mockResolvedValue({
      profile: {
        handle: 'alice',
        style_key: 'bauhaus',
        presentation: {
          font_family: 'mono',
          density: 'compact',
          radius: 'pill',
          border_style: 'solid',
        },
        display_name: 'Alice',
        bio: '',
        website_url: '',
        social_links: {},
        profile_image_url: '',
        is_public: true,
        revision: 1,
        theme_config: {
          background: '#f4efe6',
          surface: '#fffaf0',
          text: '#1f2937',
          muted: '#6b7280',
          accent: '#dc2626',
        },
      },
      collections: [],
      pieces: [],
    });

    renderPage();

    const heading = await screen.findByRole('heading', { name: 'Spring studies' });
    const section = heading.closest('.public-collection') as HTMLElement;
    expect(section).not.toBeNull();
    await vi.waitFor(() =>
      expect(section.style.getPropertyValue('--profile-background-dark')).toBe('#f4efe6'),
    );
    expect(section.style.getPropertyValue('--profile-accent-dark')).toBe('#dc2626');
    expect(section.style.getPropertyValue('--profile-radius')).toBe('999px');
  });
});
