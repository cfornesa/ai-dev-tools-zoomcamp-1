import { render, screen } from '@testing-library/react';
import type { ComponentProps } from 'react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { AuthContext } from '../auth/context';
import Layout from './Layout';
import { MOBILE_HEADER_BREAKPOINT_PX } from './useIsMobileHeader';

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

function renderWithAuth(auth: ComponentProps<typeof AuthContext.Provider>['value']) {
  return render(
    <AuthContext.Provider value={auth}>
      <MemoryRouter initialEntries={['/']}>
        <Routes>
          <Route path="/" element={<Layout />}>
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
      user: { username: 'alice', email: 'alice@example.com' },
      logout,
    });

    await user.click(screen.getByRole('button', { name: 'Logout' }));
    expect(logout).toHaveBeenCalledOnce();
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
    expect(screen.getByRole('link', { name: 'Home' })).toBeVisible();
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
    expect(screen.getByRole('link', { name: 'Home' })).toBeVisible();
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
      user: { username: 'alice', email: 'alice@example.com' },
      logout: vi.fn(),
    });

    await user.click(screen.getByRole('button', { name: 'Open menu' }));

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
