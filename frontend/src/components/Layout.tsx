import { Link, Outlet } from 'react-router-dom';

import ReducedMotionControl from './ReducedMotionControl';
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

  return (
    <div className="app-shell">
      <a href="#main-content" className="skip-link">
        Skip to main content
      </a>
      <header className="app-shell-header">
        <h1>Creatrweb Animation Studio</h1>
        <nav className="app-shell-nav" aria-label="Primary navigation">
          <Link className="shell-action" to="/gallery">Public gallery</Link>
        </nav>
        <div className="app-shell-auth">
          {auth.status === 'signed-in' ? (
            <button className="shell-action" type="button" onClick={() => void auth.logout?.()}>
              Logout
            </button>
          ) : auth.status === 'loading' ? (
            <span role="status" aria-label="Checking account">Checking account…</span>
          ) : (
            <a className="shell-action" href="/accounts/login/">Login</a>
          )}
          {auth.logoutError && <p className="auth-error" role="alert">{auth.logoutError}</p>}
        </div>
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
