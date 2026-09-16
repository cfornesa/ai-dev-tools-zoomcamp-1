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
    bio: 'A public bio.',
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
    expect(section.style.getPropertyValue('--profile-background')).toBe('#f4efe6');
    expect(section.style.getPropertyValue('--profile-accent')).toBe('#dc2626');
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
