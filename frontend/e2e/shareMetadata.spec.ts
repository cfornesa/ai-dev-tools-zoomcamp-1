import { expect, test } from '@playwright/test';

import { apiGet, apiPatch, apiPost, apiPostMultipart } from './support/api.js';
import { loginViaUI } from './support/auth.js';
import { requireE2EFixtures } from './support/prerequisites.js';

test.describe('Server-rendered public share metadata (#653)', () => {
  const fixture = requireE2EFixtures();

  test('emits escaped metadata and a 1200x630 share image without running the SPA', async ({
    browser,
  }) => {
    const context = await browser.newContext();
    const page = await context.newPage();
    await loginViaUI(page, fixture.owner.email, fixture.password);
    const created = await apiPost(context, '/api/art-pieces/', {
      title: 'Quote " <script>alert(1)</script>',
      description: 'Share description',
      prompt: 'blue rectangle',
      engine: 'canvas2d',
      capabilities: {},
      source: '<canvas id="art-piece-canvas" width="320" height="240"></canvas>',
    });
    expect(created.status()).toBe(201);
    const piece = (await created.json()) as {
      public_id: string;
      current_version: { id: number };
    };
    const fallback = await apiGet(context, `/api/art-pieces/${piece.public_id}/thumbnail.png`);
    expect(fallback.status()).toBe(200);
    const uploaded = await apiPostMultipart(
      context,
      `/api/art-pieces/${piece.public_id}/versions/${piece.current_version.id}/thumbnail/`,
      {
        image: {
          name: 'share.png',
          mimeType: 'image/png',
          buffer: await fallback.body(),
        },
      },
    );
    expect(uploaded.status()).toBe(200);
    const published = await apiPatch(context, `/api/art-pieces/${piece.public_id}/`, {
      status: 'published',
    });
    expect(published.status()).toBe(200);

    const html = await context.request.get(`/art-pieces/p/${piece.public_id}`);
    expect(html.status()).toBe(200);
    const body = await html.text();
    expect(body).toContain(
      'property="og:title" content="Quote &quot; &lt;script&gt;alert(1)&lt;/script&gt;"',
    );
    expect(body).not.toContain('<script>alert(1)</script>');
    expect(body).toContain(
      'property="og:image" content="http://localhost:5000/api/public/share-image/generated/',
    );
    expect(body).toContain('property="og:image:width" content="1200"');
    expect(body).toContain('name="twitter:card" content="summary_large_image"');

    const image = await context.request.get(
      `/api/public/share-image/generated/${piece.public_id}.png`,
    );
    expect(image.status()).toBe(200);
    expect(image.headers()['content-type']).toContain('image/png');
    const imageBytes = Buffer.from(await image.body());
    expect(imageBytes.readUInt32BE(16)).toBe(1200);
    expect(imageBytes.readUInt32BE(20)).toBe(630);

    await context.close();
  });

  test('injects generic home, profile, and collection metadata without leaking missing records', async ({
    request,
  }) => {
    for (const path of [
      '/',
      '/users/@missing-profile',
      '/users/@missing-profile/collections/missing',
    ]) {
      const response = await request.get(path);
      expect(response.status()).toBe(200);
      const body = await response.text();
      expect(body).toContain('property="og:title"');
      expect(body).toContain('property="og:description"');
      expect(body).toContain('property="og:url"');
      expect(body).toContain('rel="canonical"');
      expect(body).not.toContain('missing-profile bio');
    }
  });
});
