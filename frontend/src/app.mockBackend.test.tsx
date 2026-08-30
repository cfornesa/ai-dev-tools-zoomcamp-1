import { render, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import App from './App';
import { installMockFetch } from './mocks/installMockFetch';

/** Task 214 (issue #246): the required "one smoke test confirms the app
 * renders against the mock with no network calls" acceptance criterion.
 *
 * This test installs the mock-fetch shim exactly the way `main.tsx` does
 * when `VITE_USE_MOCK_BACKEND=true` (see that file), but spies on the
 * *original* `fetch` first so we can assert it is never reached -- every
 * request the rendered app makes (`GET /api/whoami/`, then
 * `GET /api/projects/` and `GET /api/projects3d/` once Gallery mounts)
 * must be fully satisfied by `installMockFetch`'s in-memory routing to
 * `../services/mock`, never falling through to a real network call.
 *
 * Deliberately renders the real, unmocked `App` (no `vi.mock('../api/...')`
 * anywhere in this file) -- the whole point is exercising the same code
 * path a real `npm run dev` with the flag set would take. */
describe('App with the mock backend installed', () => {
  const originalFetch = globalThis.fetch;

  afterEach(() => {
    globalThis.fetch = originalFetch;
  });

  it('renders gallery content and makes zero real network requests', async () => {
    const realNetworkSpy = vi.fn(originalFetch);
    globalThis.fetch = realNetworkSpy as typeof fetch;

    installMockFetch();

    render(<App />);

    // Auth resolves (mock user), Home renders Gallery, Gallery lists the
    // fixture projects -- all satisfied entirely by the mock route table.
    await waitFor(() => {
      expect(screen.getByText('Bouncing Ball Study')).toBeInTheDocument();
    });
    expect(screen.getByText('Generative Flowers')).toBeInTheDocument();

    expect(realNetworkSpy).not.toHaveBeenCalled();
  });
});
