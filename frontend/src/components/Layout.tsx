import { Link, Outlet } from 'react-router-dom';

import ReducedMotionControl from './ReducedMotionControl';

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
  return (
    <div>
      <a href="#main-content" className="skip-link">
        Skip to main content
      </a>
      <header>
        <h1>Gesture-Reactive Web Animation Studio</h1>
        <nav>
          <Link to="/gallery">Public gallery</Link>
        </nav>
        <ReducedMotionControl />
      </header>
      <main id="main-content" tabIndex={-1}>
        <Outlet />
      </main>
    </div>
  );
}

export default Layout;
