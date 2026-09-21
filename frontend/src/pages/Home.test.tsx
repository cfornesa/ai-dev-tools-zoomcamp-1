import { render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { AuthContext } from '../auth/context';
import Home from './Home';
import * as publicPagesApi from '../api/publicPages';
import * as projectsApi from '../api/projects';
import * as siteThemeApi from '../api/siteTheme';

vi.mock('../api/publicPages', () => ({ fetchPublicPage: vi.fn() }));
vi.mock('../api/siteTheme', () => ({ fetchSiteTheme: vi.fn() }));
vi.mock('../api/projects', async () => {
  const actual = await vi.importActual<typeof projectsApi>('../api/projects');
  return { ...actual, fetchPublicGallery: vi.fn() };
});

beforeEach(() => {
  vi.mocked(siteThemeApi.fetchSiteTheme).mockResolvedValue({
    site_title: 'Owner title',
    site_description: 'Owner tagline',
  });
  vi.mocked(publicPagesApi.fetchPublicPage).mockResolvedValue({
    id: 1,
    title: 'Home',
    slug: 'home',
    nav_label: 'From the studio',
    description: 'Home page copy.',
    sort_order: 0,
    seo_config: {
      title: '',
      description: '',
      canonical_policy: 'none',
      indexing: 'index',
      og_title: '',
      og_description: '',
      og_image_url: '',
      twitter_card: 'summary',
      answer_summary: '',
      structured_data: {},
    },
  });
  vi.mocked(projectsApi.fetchPublicGallery).mockResolvedValue({
    results: [],
    next_cursor: null,
    has_more: false,
    engine_catalog: [],
  });
});

function Destination() {
  return <output data-testid="destination">{useLocation().pathname}</output>;
}

describe('Home compatibility routing', () => {
  it('renders the configured hero, CMS home content, and gallery CTA for signed-out visitors', async () => {
    render(
      <AuthContext.Provider value={{ status: 'signed-out', user: null }}>
        <MemoryRouter initialEntries={['/home']}>
          <Routes>
            <Route path="*" element={<Home />} />
          </Routes>
        </MemoryRouter>
      </AuthContext.Provider>,
    );
    expect(await screen.findByRole('heading', { name: 'Owner title' })).toBeInTheDocument();
    expect(screen.getByText('From the studio')).toBeInTheDocument();
    expect(screen.getByText('Home page copy.')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'See More' })).toHaveAttribute(
      'href',
      '#public-gallery',
    );
    await waitFor(() =>
      expect(screen.getByRole('heading', { name: 'Public gallery' })).toBeVisible(),
    );
  });

  it('routes signed-in visitors to Studio', () => {
    render(
      <AuthContext.Provider
        value={{
          status: 'signed-in',
          user: { username: 'alice', email: 'alice@example.com', is_application_admin: false },
        }}
      >
        <MemoryRouter initialEntries={['/']}>
          <Routes>
            <Route path="*" element={<Home />} />
            <Route path="/studio" element={<Destination />} />
          </Routes>
        </MemoryRouter>
      </AuthContext.Provider>,
    );
    expect(screen.getByTestId('destination')).toHaveTextContent('/studio');
  });
});
