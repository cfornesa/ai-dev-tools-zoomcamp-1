import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

import { isKnownClientRoute, routeMatchersFromAppSource } from './viteClientRouteMatcher';

const appSource = readFileSync(resolve(dirname(fileURLToPath(import.meta.url)), 'App.tsx'), 'utf8');
const appRouteMatchers = routeMatchersFromAppSource(appSource);

describe('production SPA route matching derived from App.tsx', () => {
  it.each([
    '/gallery',
    '/users/@alice/pieces/ocean-study',
    '/embed/p/123',
    '/projects/123/settings',
    '/users/@alice/immersive/ocean-study',
  ])('recognizes the client route %s', (pathname) => {
    expect(isKnownClientRoute(pathname, appRouteMatchers)).toBe(true);
  });

  it('does not let the App.tsx catch-all make every path look known', () => {
    expect(isKnownClientRoute('/definitely-not-a-route', appRouteMatchers)).toBe(false);
  });
});
