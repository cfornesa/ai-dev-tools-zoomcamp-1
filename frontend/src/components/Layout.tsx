import { useEffect, useState } from 'react';
import { NavLink, Outlet, useLocation } from 'react-router-dom';

import ReducedMotionControl from './ReducedMotionControl';
import { useIsMobileHeader } from './useIsMobileHeader';
import { useAuth } from '../auth/useAuth';

/**
 * Task 64 (issue #64): app-shell skip link, per `_docs/plan.md`'s
 * "Accessibility and alternate controls" → "Keyboard access" list ("Use
 * visible focus indicators, logical tab order, skip links, and no
 * keyboard traps") — a real gap this task's audit found: no skip mechanism
 * existed anywhere in the app before this. A keyboard user landing on any
 * page (the editor workspace included — it's rendered through this same
 * shell) can jump straight to `<main>`, past the repeated header title/nav
 * link/reduced-motion control, without tabbing through them first.
 *
 * A plain in-page anchor (`href="#main-content"`) rather than a click
 * handler: it works with no JS-event wiring, is reachable and activatable
 * with only Tab/Enter, and follows the same visible-on-focus convention
 * most production skip links use — see `src/index.css`'s
 * `.skip-link`/`.skip-link:focus` rules (off-screen until focused, then
 * rendered at the top of the viewport with the same `:focus-visible`
 * treatment every other control gets). `tabIndex={-1}` on `<main>` makes it
 * a valid programmatic focus target for browsers that don't otherwise
 * move focus to a fragment-navigation target.
 */
function Layout() {
  const auth = useAuth();
  const location = useLocation();
  const isMobileHeader = useIsMobileHeader();
  const [menuOpen, setMenuOpen] = useState(false);

  // Issue #90: collapsing back to desktop width while the mobile menu is
  // open would otherwise leave menuOpen stuck true, showing the (now
  // hidden-by-layout) menu markup with stale aria-expanded state next time
  // the viewport narrows again.
  useEffect(() => {
    if (!isMobileHeader) setMenuOpen(false);
  }, [isMobileHeader]);

  function closeMenuOnEscape(event: React.KeyboardEvent) {
    if (event.key === 'Escape') {
      setMenuOpen(false);
    }
  }

  const signInOrOutAction =
    auth.status === 'signed-in' ? (
      <>
        <NavLink className="shell-action" to="/account/settings">
          Account settings
        </NavLink>
        <button className="shell-action" type="button" onClick={() => void auth.logout?.()}>
          Logout
        </button>
      </>
    ) : auth.status === 'loading' ? (
      <span role="status" aria-label="Checking account">
        Checking account…
      </span>
    ) : (
      <a className="shell-action" href="/accounts/login/">
        Login
      </a>
    );

  return (
    <div
      className={`app-shell${location.pathname.startsWith('/projects/') ? ' app-shell-editor' : ''}`}
    >
      <a href="#main-content" className="skip-link">
        Skip to main content
      </a>
      <header className="app-shell-header" onKeyDown={closeMenuOnEscape}>
        {/* Issue #95, point 1: at mobile widths the heading stays
            left-aligned while the hamburger toggle sits right-aligned on
            the same row, rather than both centered above one another —
            see `.app-shell-header-row`'s `justify-content: space-between`
            below that breakpoint. */}
        <div className="app-shell-header-row">
          <h1>Creatrweb Animation Studio</h1>
          {isMobileHeader && (
            <button
              type="button"
              className="shell-action app-shell-hamburger"
              aria-expanded={menuOpen}
              aria-controls="app-shell-mobile-menu"
              aria-label={menuOpen ? 'Close menu' : 'Open menu'}
              onClick={() => setMenuOpen((open) => !open)}
            >
              <span aria-hidden="true">☰</span>
            </button>
          )}
        </div>
        {isMobileHeader ? (
          <>
            <nav
              id="app-shell-mobile-menu"
              className="app-shell-nav app-shell-mobile-menu"
              aria-label="Primary navigation"
              hidden={!menuOpen}
            >
              <NavLink className="shell-action" to="/" end>
                Home
              </NavLink>
              <NavLink className="shell-action" to="/gallery">
                Public gallery
              </NavLink>
              {signInOrOutAction}
              {auth.logoutError && (
                <p className="auth-error" role="alert">
                  {auth.logoutError}
                </p>
              )}
            </nav>
          </>
        ) : (
          <nav className="app-shell-nav" aria-label="Primary navigation">
            <NavLink className="shell-action" to="/" end>
              Home
            </NavLink>
            <NavLink className="shell-action" to="/gallery">
              Public gallery
            </NavLink>
            {signInOrOutAction}
            {auth.logoutError && (
              <p className="auth-error" role="alert">
                {auth.logoutError}
              </p>
            )}
          </nav>
        )}
        <div className="app-shell-motion">
          <ReducedMotionControl />
        </div>
      </header>
      <main id="main-content" tabIndex={-1}>
        <Outlet />
      </main>
      <footer className="app-shell-footer">Christopher Fornesa © {new Date().getFullYear()}</footer>
    </div>
  );
}

export default Layout;
