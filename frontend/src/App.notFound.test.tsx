import { render, screen, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { ApiError } from './api/client';
import * as projectsApi from './api/projects';
import App from './App';

/**
 * Issue #485: the catch-all `*` route inside `Layout` renders a visible,
 * accessible not-found page for unknown SPA URLs. These tests exercise the
 * real `App` (not a synthetic router harness) so the actual route
 * registration in `App.tsx` is what's under test, matching `App.test.tsx` and
 * `App.embedRoute.test.tsx` conventions -- navigation happens via
 * `window.history.pushState` before render, since `App` owns its own
 * `BrowserRouter` internally.
 */

vi.mock('./api/projects');
vi.mock('./api/auth', () => ({
  fetchCurrentUser: vi.fn().mockResolvedValue(null),
}));

const mockedGetPublicProject = vi.mocked(projectsApi.getPublicProject);

function navigateTo(path: string) {
  window.history.pushState({}, '', path);
}

beforeEach(() => {
  vi.clearAllMocks();
});

afterEach(() => {
  window.history.pushState({}, '', '/');
});

describe('unknown routes (issue #485)', () => {
  it('renders an accessible not-found view with recovery links inside the app shell', async () => {
    navigateTo('/definitely-not-a-real-route');

    render(<App />);

    expect(document.querySelector('.app-shell-header')).toBeInTheDocument();
    expect(
      await screen.findByRole('heading', { name: 'Page not found', level: 2 }),
    ).toBeInTheDocument();
    expect(screen.getByText(/that address does not exist or is unavailable/i)).toBeInTheDocument();

    const recoveryNav = screen.getByRole('navigation', { name: 'Recovery navigation' });
    const homeLink = within(recoveryNav).getByRole('link', { name: /return to the home page/i });
    expect(homeLink).toHaveAttribute('href', '/');
    expect(homeLink).toHaveClass('shell-action');

    const galleryLink = within(recoveryNav).getByRole('link', {
      name: /browse the public gallery/i,
    });
    expect(galleryLink).toHaveAttribute('href', '/gallery');
    expect(galleryLink).toHaveClass('shell-action');

    // QA (issue #485): the recovery links must carry distinct accessible
    // names -- bare "Home"/"Public gallery" duplicated the shell nav's
    // identically-named links and made the page ambiguous for assistive
    // tech (and tripped Playwright's strict mode in the real browser run).
    expect(screen.getAllByRole('link', { name: /^home$/i })).toHaveLength(1);
    expect(screen.getAllByRole('link', { name: /^public gallery$/i })).toHaveLength(1);
  });

  it('does not match known route patterns like /p/:id for genuinely unknown deep paths', async () => {
    // `/definitely-not-a-real-route` must hit the catch-all, not the public
    // project viewer, so the viewer's own "isn't available" message must not
    // appear.
    navigateTo('/definitely-not-a-real-route');

    render(<App />);

    expect(
      await screen.findByRole('heading', { name: 'Page not found', level: 2 }),
    ).toBeInTheDocument();
    expect(screen.queryByText(/this project isn't available/i)).not.toBeInTheDocument();
  });

  it('leaves the existing /p/:id unavailable behavior unchanged', async () => {
    mockedGetPublicProject.mockRejectedValue(new ApiError(404, null));
    navigateTo('/p/does-not-exist');

    render(<App />);

    expect(await screen.findByText(/this project isn't available/i)).toBeInTheDocument();
    expect(screen.queryByRole('heading', { name: 'Page not found' })).not.toBeInTheDocument();
  });
});

describe('known routes still resolve (issue #485 regression check)', () => {
  it('renders the home page at /', async () => {
    navigateTo('/');

    render(<App />);

    expect(await screen.findByRole('heading', { name: 'CreatrART', level: 1 })).toBeInTheDocument();
    expect(screen.getByText(/sign in to see your projects/i)).toBeInTheDocument();
  });
});

describe('chrome-less sibling routes remain chrome-less (issue #485 regression check)', () => {
  it('does not render Layout chrome at /embed/p/:id', async () => {
    mockedGetPublicProject.mockRejectedValue(new ApiError(404, null));
    navigateTo('/embed/p/does-not-exist');

    render(<App />);

    expect(await screen.findByText(/this project isn't available/i)).toBeInTheDocument();
    expect(document.querySelector('.app-shell-header')).not.toBeInTheDocument();
    expect(screen.queryByRole('link', { name: 'Public gallery' })).not.toBeInTheDocument();
  });
});
