import { render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { describe, expect, it, vi } from 'vitest';

import * as profileApi from '../api/profile';
import PublicProfile from './PublicProfile';

vi.mock('../api/profile', async () => {
  const actual = await vi.importActual<typeof import('../api/profile')>('../api/profile');
  return { ...actual, fetchPublicProfile: vi.fn() };
});

const mockedFetch = vi.mocked(profileApi.fetchPublicProfile);

const SAMPLE: profileApi.PublicProfilePage = {
  profile: {
    handle: 'artist',
    style_key: 'bauhaus',
    presentation: {
      font_family: 'serif',
      density: 'compact',
      radius: 'sharp',
      border_style: 'none',
    },
    display_name: 'The Artist',
    bio: 'A public bio.\nWith a second line.',
    website_url: 'https://example.com/a-very-long-profile-url',
    social_links: {
      Mastodon: 'https://social.example/@artist',
      GitHub: 'https://github.com/artist',
    },
    profile_image_url: 'https://example.com/avatar.png',
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
};

function renderAt(handle: string) {
  return render(
    <MemoryRouter initialEntries={[`/users/@${handle}`]}>
      <Routes>
        <Route path="/users/:handle" element={<PublicProfile />} />
      </Routes>
    </MemoryRouter>,
  );
}

describe('PublicProfile theme cascade (#577)', () => {
  it('applies the profile theme_config and presentation as CSS custom properties', async () => {
    mockedFetch.mockResolvedValue(SAMPLE);

    renderAt('artist');

    const heading = await screen.findByRole('heading', { name: 'The Artist' });
    const section = heading.closest('.public-profile') as HTMLElement;
    expect(section).not.toBeNull();
    expect(section.style.getPropertyValue('--profile-background-dark')).toBe('#f4efe6');
    expect(section.style.getPropertyValue('--profile-accent-dark')).toBe('#dc2626');
    expect(section.style.getPropertyValue('--profile-font')).toContain('Georgia');
    expect(section.style.getPropertyValue('--profile-radius')).toBe('2px');
    expect(section.style.getPropertyValue('--profile-density')).toBe('12px');
    expect(section.style.getPropertyValue('--profile-border-style')).toBe('none');
  });

  it('falls back to default presentation values when the profile has none configured', async () => {
    mockedFetch.mockResolvedValue({
      ...SAMPLE,
      profile: { ...SAMPLE.profile, presentation: undefined },
    });

    renderAt('artist');

    const heading = await screen.findByRole('heading', { name: 'The Artist' });
    const section = heading.closest('.public-profile') as HTMLElement;
    expect(section.style.getPropertyValue('--profile-font')).toContain('system-ui');
    expect(section.style.getPropertyValue('--profile-radius')).toBe('8px');
    expect(section.style.getPropertyValue('--profile-density')).toBe('20px');
  });

  it('renders the ordered public profile header details as plain text and safe external links', async () => {
    mockedFetch.mockResolvedValue(SAMPLE);

    renderAt('artist');

    const heading = await screen.findByRole('heading', { name: 'The Artist' });
    expect(screen.getByRole('img', { name: 'The Artist avatar' })).toHaveAttribute(
      'src',
      'https://example.com/avatar.png',
    );
    expect(screen.getByText('@artist')).toBeInTheDocument();
    expect(screen.getByText(/A public bio\./).textContent).toBe(
      'A public bio.\nWith a second line.',
    );
    expect(
      screen.getByRole('link', { name: 'https://example.com/a-very-long-profile-url' }),
    ).toHaveAttribute('rel', 'noopener noreferrer');
    expect(screen.getByRole('link', { name: 'Mastodon' })).toHaveAttribute(
      'rel',
      'noopener noreferrer',
    );
    expect(
      screen.getByRole('img', { name: 'The Artist avatar' }).compareDocumentPosition(heading),
    ).toBe(Node.DOCUMENT_POSITION_FOLLOWING);
  });

  it('omits empty optional header fields', async () => {
    mockedFetch.mockResolvedValue({
      ...SAMPLE,
      profile: {
        ...SAMPLE.profile,
        bio: '',
        website_url: '',
        social_links: {},
        profile_image_url: '',
      },
    });

    renderAt('artist');

    await screen.findByRole('heading', { name: 'The Artist' });
    expect(screen.queryByRole('img')).not.toBeInTheDocument();
    expect(screen.queryByText('A public bio.')).not.toBeInTheDocument();
    expect(screen.queryByRole('link', { name: /example\.com/ })).not.toBeInTheDocument();
    expect(screen.queryByRole('navigation', { name: 'Social links' })).not.toBeInTheDocument();
  });

  it('renders collections before pieces and shows public member counts', async () => {
    mockedFetch.mockResolvedValue({
      ...SAMPLE,
      collections: [
        {
          id: 'collection-1',
          title: 'Curated works',
          slug: 'curated-works',
          viewer_url: '/users/@artist/collections/curated-works',
          thumbnail_url: '/thumbnail.png',
          item_count: 3,
        },
      ],
      pieces: [
        {
          id: 'piece-1',
          title: 'A piece',
          type: '2d',
          thumbnail_url: '/piece.png',
        },
      ],
    });

    renderAt('artist');

    await screen.findByRole('heading', { name: 'The Artist' });
    const collections = screen.getByRole('heading', { name: 'Collections' });
    const pieces = screen.getByRole('heading', { name: 'Pieces' });
    expect(collections.compareDocumentPosition(pieces)).toBe(Node.DOCUMENT_POSITION_FOLLOWING);
    expect(screen.getByRole('heading', { name: 'Curated works' })).toBeInTheDocument();
    expect(screen.getByText('3 public pieces')).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'A piece' })).toBeInTheDocument();
  });

  it('shows one empty state when both public sections are empty', async () => {
    mockedFetch.mockResolvedValue(SAMPLE);

    renderAt('artist');

    await screen.findByRole('heading', { name: 'The Artist' });
    expect(screen.queryByRole('heading', { name: 'Collections' })).not.toBeInTheDocument();
    expect(screen.queryByRole('heading', { name: 'Pieces' })).not.toBeInTheDocument();
    expect(screen.getByRole('status')).toHaveTextContent('No public collections or pieces yet.');
  });

  it('redirects home for a missing or private profile without rendering any theme', async () => {
    mockedFetch.mockRejectedValue(new Error('not found'));

    render(
      <MemoryRouter initialEntries={['/users/@missing']}>
        <Routes>
          <Route path="/users/:handle" element={<PublicProfile />} />
          <Route path="/" element={<p>Home</p>} />
        </Routes>
      </MemoryRouter>,
    );

    await waitFor(() => expect(screen.getByText('Home')).toBeInTheDocument());
  });
});
