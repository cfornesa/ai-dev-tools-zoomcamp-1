import { afterEach, describe, expect, it, vi } from 'vitest';

import {
  actOnThemeGeneration,
  fetchContinuityMetrics,
  fetchThemeGenerationAttempts,
  generateThemeDraft,
} from './adminSettings';

afterEach(() => vi.unstubAllGlobals());

describe('continuity metrics API (#1143)', () => {
  it('loads aggregate cohorts through the admin endpoint', async () => {
    const payload = { cohorts: [] };
    const fetchMock = vi
      .fn()
      .mockResolvedValue(new Response(JSON.stringify(payload), { status: 200 }));
    vi.stubGlobal('fetch', fetchMock);

    await expect(fetchContinuityMetrics()).resolves.toEqual(payload);
    expect(fetchMock).toHaveBeenCalledWith(
      '/api/admin/continuity-metrics/',
      expect.objectContaining({ method: 'GET', credentials: 'include' }),
    );
  });
});

describe('theme generation API', () => {
  it('loads attempts and sends bounded generation fields', async () => {
    const fetchMock = vi
      .fn()
      .mockImplementation(() => Promise.resolve(new Response(JSON.stringify([]), { status: 200 })));
    vi.stubGlobal('fetch', fetchMock);

    await fetchThemeGenerationAttempts();
    await generateThemeDraft({
      prompt: 'A calm cosmic theme',
      operation: 'generate',
      attempt_number: 1,
    });

    expect(fetchMock).toHaveBeenNthCalledWith(
      1,
      '/api/admin/theme-generation/',
      expect.objectContaining({ method: 'GET', credentials: 'include' }),
    );
    expect(fetchMock).toHaveBeenNthCalledWith(
      2,
      '/api/admin/theme-generation/',
      expect.objectContaining({
        method: 'POST',
        body: JSON.stringify({
          prompt: 'A calm cosmic theme',
          operation: 'generate',
          attempt_number: 1,
        }),
      }),
    );
  });

  it('posts a revision-checked action', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValue(
        new Response(JSON.stringify({ id: 7, state: 'accepted' }), { status: 200 }),
      );
    vi.stubGlobal('fetch', fetchMock);

    await actOnThemeGeneration(7, 'accept', 2);

    expect(fetchMock).toHaveBeenCalledWith(
      '/api/admin/theme-generation/7/accept/',
      expect.objectContaining({ method: 'POST', body: JSON.stringify({ revision: 2 }) }),
    );
  });
});
