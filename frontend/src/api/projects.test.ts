import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { fetchPublicGallery } from './projects';

const originalFetch = globalThis.fetch;

describe('fetchPublicGallery', () => {
  beforeEach(() => {
    globalThis.fetch = vi.fn();
  });

  afterEach(() => {
    globalThis.fetch = originalFetch;
  });

  function mockFetch(response: Response) {
    vi.mocked(globalThis.fetch).mockResolvedValue(response);
  }

  function lastFetchUrl(): string {
    const call = vi.mocked(globalThis.fetch).mock.calls.at(-1);
    if (!call) throw new Error('fetch was not called');
    const input = call[0];
    return typeof input === 'string' ? input : (input as Request).url;
  }

  it('calls GET /api/public/gallery/ with type=all by default', async () => {
    mockFetch(
      new Response(JSON.stringify({ results: [], next_cursor: null, has_more: false }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      }),
    );

    await fetchPublicGallery();

    expect(lastFetchUrl()).toBe('/api/public/gallery/?type=all');
  });

  it('calls GET /api/public/gallery/ with the requested type filter', async () => {
    mockFetch(
      new Response(JSON.stringify({ results: [], next_cursor: null, has_more: false }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      }),
    );

    await fetchPublicGallery('generated');

    expect(lastFetchUrl()).toBe('/api/public/gallery/?type=generated');
  });

  it('passes cursor and page_size when provided', async () => {
    mockFetch(
      new Response(
        JSON.stringify({
          results: [
            {
              id: 'p1',
              kind: '2d',
              title: 'Piece',
              owner: 'alice',
              published_at: '2026-09-08T10:00:00Z',
              thumbnail_url: null,
              viewer_url: '/p/p1',
            },
          ],
          next_cursor: null,
          has_more: false,
        }),
        { status: 200, headers: { 'Content-Type': 'application/json' } },
      ),
    );

    const page = await fetchPublicGallery('authored', { cursor: 'abc', pageSize: 12 });

    expect(lastFetchUrl()).toBe('/api/public/gallery/?type=authored&cursor=abc&page_size=12');
    expect(page.results[0]).toMatchObject({ id: 'p1', kind: '2d', viewer_url: '/p/p1' });
  });

  it('throws ApiError for a 400 response', async () => {
    mockFetch(
      new Response(
        JSON.stringify({ errors: { type: ['Must be one of: all, authored, generated.'] } }),
        {
          status: 400,
          headers: { 'Content-Type': 'application/json' },
        },
      ),
    );

    await expect(fetchPublicGallery('invalid' as never)).rejects.toMatchObject({
      status: 400,
      body: { errors: { type: ['Must be one of: all, authored, generated.'] } },
    });
  });
});
