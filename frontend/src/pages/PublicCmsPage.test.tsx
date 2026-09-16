import { render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { apiFetch } from '../api/client';
import PublicCmsPage from './PublicCmsPage';

vi.mock('../api/client', () => ({
  apiFetch: vi.fn(),
}));

const EMPTY_SEO_CONFIG = {
  title: '',
  description: '',
  canonical_policy: 'none' as const,
  indexing: 'index' as const,
  og_title: '',
  og_description: '',
  og_image_url: '',
  twitter_card: 'summary' as const,
  answer_summary: '',
  structured_data: {},
};

function renderAt(slug: string) {
  render(
    <MemoryRouter initialEntries={[`/pages/${slug}`]}>
      <Routes>
        <Route path="/pages/:slug" element={<PublicCmsPage />} />
        <Route path="/gallery" element={<p>Gallery</p>} />
      </Routes>
    </MemoryRouter>,
  );
}

afterEach(() => {
  document.head.querySelectorAll('[data-cms-metadata]').forEach((node) => node.remove());
  document.head.querySelectorAll('[data-cms-canonical]').forEach((node) => node.remove());
  document.head.querySelectorAll('[data-cms-structured-data]').forEach((node) => node.remove());
});

describe('PublicCmsPage SEO/AEO rendering (#579)', () => {
  it('emits title, meta, canonical, and JSON-LD from a configured seo_config', async () => {
    vi.mocked(apiFetch).mockResolvedValue({
      title: 'About the studio',
      slug: 'about',
      description: 'A public page.',
      seo_config: {
        ...EMPTY_SEO_CONFIG,
        title: 'About — AugmentrART',
        description: 'Learn about the studio.',
        canonical_policy: 'self',
        indexing: 'noindex',
        og_title: 'About',
        og_image_url: 'https://example.com/og.png',
        structured_data: { '@type': 'WebPage' },
      },
    });

    renderAt('about');

    await waitFor(() => expect(document.title).toBe('About — AugmentrART'));
    expect(document.querySelector('meta[name="description"]')?.getAttribute('content')).toBe(
      'Learn about the studio.',
    );
    expect(document.querySelector('meta[name="robots"]')?.getAttribute('content')).toBe('noindex');
    expect(document.querySelector('meta[property="og:title"]')?.getAttribute('content')).toBe(
      'About',
    );
    expect(document.querySelector('meta[property="og:image"]')?.getAttribute('content')).toBe(
      'https://example.com/og.png',
    );
    expect(document.querySelector('link[rel="canonical"]')).not.toBeNull();
    const ld = document.querySelector('script[type="application/ld+json"]');
    expect(ld).not.toBeNull();
    expect(JSON.parse(ld!.textContent ?? '{}')).toEqual({ '@type': 'WebPage' });
  });

  it('falls back to the page title/description without a canonical link or JSON-LD when seo_config is empty', async () => {
    vi.mocked(apiFetch).mockResolvedValue({
      title: 'Fallback Page',
      slug: 'fallback',
      description: 'Fallback description.',
      seo_config: EMPTY_SEO_CONFIG,
    });

    renderAt('fallback');

    await waitFor(() => expect(document.title).toBe('Fallback Page'));
    expect(document.querySelector('meta[name="description"]')?.getAttribute('content')).toBe(
      'Fallback description.',
    );
    expect(document.querySelector('link[rel="canonical"]')).toBeNull();
    expect(document.querySelector('script[type="application/ld+json"]')).toBeNull();
  });

  it('redirects to the public gallery for a missing/unpublished page without rendering metadata', async () => {
    vi.mocked(apiFetch).mockRejectedValue(new Error('not found'));

    renderAt('missing');

    await waitFor(() => expect(screen.getByText('Gallery')).toBeInTheDocument());
    expect(document.querySelector('script[type="application/ld+json"]')).toBeNull();
  });
});
