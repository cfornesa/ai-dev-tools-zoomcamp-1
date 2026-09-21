import { render, screen } from '@testing-library/react';
import type { ComponentProps } from 'react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { afterEach, describe, expect, it, vi } from 'vitest';

import * as siteThemeApi from '../api/siteTheme';
import * as publicPagesApi from '../api/publicPages';
import { AuthContext } from '../auth/context';
import Layout from './Layout';
import { MOBILE_HEADER_BREAKPOINT_PX } from './useIsMobileHeader';

vi.mock('../api/siteTheme', () => ({
  fetchSiteTheme: vi.fn().mockRejectedValue(new Error('no theme in this test')),
}));

vi.mock('../api/publicPages', () => ({
  fetchPublicPageNavigation: vi.fn().mockRejectedValue(new Error('no pages in this test')),
}));

/**
 * Task 64 (issue #64): the app-shell skip link — a real gap this task's
 * keyboard-accessibility audit found (`_docs/plan.md`'s "Keyboard access"
 * list requires one; none existed anywhere in the app before this).
 */
function renderLayout() {
  return render(
    <MemoryRouter initialEntries={['/']}>
      <Routes>
        <Route path="/" element={<Layout />}>
          <Route index element={<button type="button">First focusable in main</button>} />
        </Route>
      </Routes>
    </MemoryRouter>,
  );
}

function renderWithAuth(
  auth: ComponentProps<typeof AuthContext.Provider>['value'],
  initialEntries = ['/'],
) {
  return render(
    <AuthContext.Provider value={auth}>
      <MemoryRouter initialEntries={initialEntries}>
        <Routes>
          <Route path="*" element={<Layout />}>
            <Route index element={<button type="button">Main action</button>} />
          </Route>
        </Routes>
      </MemoryRouter>
    </AuthContext.Provider>,
  );
}

describe('Layout: skip link', () => {
  it('is the very first focusable element on the page', async () => {
    const user = userEvent.setup();
    renderLayout();

    await user.tab();
    expect(screen.getByRole('link', { name: 'Skip to main content' })).toHaveFocus();
    expect(screen.getByRole('link', { name: 'Public gallery' })).toHaveClass('shell-action');
  });

  it('activating it moves focus to <main>, past the repeated header controls', async () => {
    renderLayout();

    const skipLink = screen.getByRole('link', { name: 'Skip to main content' });
    expect(skipLink).toHaveAttribute('href', '#main-content');

    const main = document.getElementById('main-content');
    expect(main).not.toBeNull();
    expect(main).toHaveAttribute('tabindex', '-1');
  });
});

describe('Layout: authentication control and attribution', () => {
  it('shows Login for anonymous visitors and the current year footer', () => {
    renderWithAuth({ status: 'signed-out', user: null });

    expect(screen.getByRole('link', { name: 'Login' })).toHaveAttribute('href', '/accounts/login/');
    expect(
      screen.getByText(`Christopher Fornesa © ${new Date().getFullYear()}`),
    ).toBeInTheDocument();
  });

  it('logs out through the provided session action', async () => {
    const logout = vi.fn().mockResolvedValue(undefined);
    const user = userEvent.setup();
    renderWithAuth({
      status: 'signed-in',
      user: { username: 'alice', email: 'alice@example.com', is_application_admin: false },
      logout,
    });

    await user.click(screen.getByRole('button', { name: 'Logout' }));
    expect(logout).toHaveBeenCalledOnce();
  });
});

describe('Layout: public navigation (#645)', () => {
  it('renders Home, Gallery, and published CMS navigation pages', async () => {
    vi.mocked(publicPagesApi.fetchPublicPageNavigation).mockResolvedValueOnce([
      { id: 1, title: 'About the studio', slug: 'about', nav_label: 'About', sort_order: 1 },
    ]);

    renderWithAuth({ status: 'signed-out', user: null });

    expect(screen.getByRole('link', { name: 'Home' })).toHaveAttribute('href', '/');
    expect(screen.getByRole('link', { name: 'Public gallery' })).toHaveAttribute(
      'href',
      '/gallery',
    );
    expect(await screen.findByRole('link', { name: 'About' })).toHaveAttribute(
      'href',
      '/pages/about',
    );
  });
});

describe('Layout: active nav indicator (issue #136)', () => {
  it('marks Public gallery as current for an anonymous visitor on the gallery route', () => {
    renderWithAuth({ status: 'signed-out', user: null }, ['/gallery']);

    expect(screen.getByRole('link', { name: 'Public gallery' })).toHaveAttribute(
      'aria-current',
      'page',
    );
  });

  it('marks Public gallery active on the gallery route', () => {
    render(
      <MemoryRouter initialEntries={['/gallery']}>
        <Routes>
          <Route path="/" element={<Layout />}>
            <Route path="gallery" element={<button type="button">Gallery content</button>} />
          </Route>
        </Routes>
      </MemoryRouter>,
    );

    expect(screen.getByRole('link', { name: 'Public gallery' })).toHaveAttribute(
      'aria-current',
      'page',
    );
  });

  it('marks the editor route with the compact studio shell class', () => {
    render(
      <MemoryRouter initialEntries={['/projects/p1']}>
        <Routes>
          <Route path="/" element={<Layout />}>
            <Route path="projects/:id" element={<p>Editor</p>} />
          </Route>
        </Routes>
      </MemoryRouter>,
    );

    expect(document.querySelector('.app-shell')).toHaveClass('app-shell-editor');
  });
});

describe('Layout: admin navigation discoverability (#558)', () => {
  it('shows the Admin link only for application administrators', () => {
    renderWithAuth(
      {
        status: 'signed-in',
        user: { username: 'admin', email: 'admin@example.com', is_application_admin: true },
        logout: vi.fn(),
        logoutError: null,
        signOutLocally: vi.fn(),
      },
      ['/admin/content'],
    );
    expect(screen.getByRole('link', { name: 'Admin' })).toHaveAttribute('href', '/admin/content');
    expect(screen.getByRole('link', { name: 'Admin' })).toHaveAttribute('aria-current', 'page');
  });

  it('does not expose the Admin link to ordinary users', () => {
    renderWithAuth({
      status: 'signed-in',
      user: { username: 'user', email: 'user@example.com', is_application_admin: false },
      logout: vi.fn(),
    });
    expect(screen.queryByRole('link', { name: 'Admin' })).not.toBeInTheDocument();
  });
});

describe('Layout: mobile hamburger menu', () => {
  const ORIGINAL_INNER_WIDTH = window.innerWidth;

  function setInnerWidth(width: number) {
    window.innerWidth = width;
    window.dispatchEvent(new Event('resize'));
  }

  afterEach(() => {
    setInnerWidth(ORIGINAL_INNER_WIDTH);
  });

  it('shows the inline nav/auth actions, not a hamburger, at desktop widths', () => {
    setInnerWidth(MOBILE_HEADER_BREAKPOINT_PX);
    renderWithAuth({ status: 'signed-out', user: null });

    expect(screen.queryByRole('button', { name: /menu/i })).not.toBeInTheDocument();
    expect(screen.getByRole('navigation', { name: 'Primary navigation' })).toBeVisible();
    expect(screen.getByRole('link', { name: 'Public gallery' })).toBeVisible();
    expect(screen.getByRole('link', { name: 'Login' })).toBeVisible();
  });

  it('shows a hamburger toggle instead of inline actions below the breakpoint', () => {
    setInnerWidth(MOBILE_HEADER_BREAKPOINT_PX - 1);
    renderWithAuth({ status: 'signed-out', user: null });

    const toggle = screen.getByRole('button', { name: 'Open menu' });
    expect(toggle).toHaveAttribute('aria-expanded', 'false');
    expect(toggle).toHaveAttribute('aria-controls', 'app-shell-mobile-menu');
    expect(document.getElementById('app-shell-mobile-menu')).not.toBeVisible();
  });

  it('opens the menu with the right items for a signed-out visitor, and toggles closed again', async () => {
    const user = userEvent.setup();
    setInnerWidth(MOBILE_HEADER_BREAKPOINT_PX - 1);
    renderWithAuth({ status: 'signed-out', user: null });

    const toggle = screen.getByRole('button', { name: 'Open menu' });
    await user.click(toggle);

    expect(toggle).toHaveAttribute('aria-expanded', 'true');
    const menu = screen.getByRole('navigation', { name: 'Primary navigation' });
    expect(menu).toBeVisible();
    expect(screen.getByRole('link', { name: 'Public gallery' })).toBeVisible();
    expect(screen.getByRole('link', { name: 'Login' })).toBeVisible();
    expect(screen.queryByRole('link', { name: 'Account settings' })).not.toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Close menu' }));
    expect(toggle).toHaveAttribute('aria-expanded', 'false');
    expect(document.getElementById('app-shell-mobile-menu')).not.toBeVisible();
  });

  it('lists Account settings and Logout for a signed-in user', async () => {
    const user = userEvent.setup();
    setInnerWidth(MOBILE_HEADER_BREAKPOINT_PX - 1);
    renderWithAuth({
      status: 'signed-in',
      user: { username: 'alice', email: 'alice@example.com', is_application_admin: false },
      logout: vi.fn(),
    });

    await user.click(screen.getByRole('button', { name: 'Open menu' }));

    expect(screen.getByRole('link', { name: 'Studio' })).toBeVisible();
    expect(screen.getByRole('link', { name: 'Public gallery' })).toBeVisible();
    expect(screen.getByRole('link', { name: 'Account settings' })).toBeVisible();
    expect(screen.getByRole('button', { name: 'Logout' })).toBeVisible();
    expect(screen.queryByRole('link', { name: 'Login' })).not.toBeInTheDocument();
  });

  it('closes on Escape', async () => {
    const user = userEvent.setup();
    setInnerWidth(MOBILE_HEADER_BREAKPOINT_PX - 1);
    renderWithAuth({ status: 'signed-out', user: null });

    const toggle = screen.getByRole('button', { name: 'Open menu' });
    await user.click(toggle);
    expect(toggle).toHaveAttribute('aria-expanded', 'true');

    await user.keyboard('{Escape}');
    expect(toggle).toHaveAttribute('aria-expanded', 'false');
  });
});

describe('Layout: global site theme cascade (#577)', () => {
  afterEach(() => {
    document.documentElement.style.cssText = '';
  });

  it('applies the fetched global theme tokens and presentation as document-root CSS variables', async () => {
    const theme = {
      background: '#101014',
      surface: '#1a1a20',
      text: '#f5f5f5',
      muted: '#999999',
      accent: '#22c55e',
      presentation: {
        font_family: 'script',
        density: 'compact',
        radius: 'pill',
        border_style: 'solid',
        shadow: 'offset',
        backdrop: 'cosmic',
      },
    } as unknown as siteThemeApi.ThemeTokens;
    vi.mocked(siteThemeApi.fetchSiteTheme).mockResolvedValueOnce(theme);

    renderLayout();

    const root = document.documentElement;
    await vi.waitFor(() => expect(root.style.getPropertyValue('--bg')).toBe('#101014'));
    expect(root.style.getPropertyValue('--accent')).toBe('#22c55e');
    expect(root.style.getPropertyValue('--site-font')).toContain('Pinyon Script');
    expect(root.style.getPropertyValue('--site-density')).toBe('12px');
    expect(root.style.getPropertyValue('--site-radius')).toBe('999px');
    expect(root.dataset.siteFont).toBe('script');
    expect(root.dataset.siteShadow).toBe('offset');
    expect(root.dataset.siteBackdrop).toBe('cosmic');
  });

  it('leaves document-root theme variables untouched when the fetch fails', async () => {
    vi.mocked(siteThemeApi.fetchSiteTheme).mockRejectedValueOnce(new Error('network error'));

    renderLayout();

    await screen.findByRole('button', { name: 'First focusable in main' });
    expect(document.documentElement.style.getPropertyValue('--bg')).toBe('');
  });
});
