import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, describe, expect, it } from 'vitest';

import { AuthContext } from '../auth/context';
import Home from './Home';

/**
 * Task 128 (issue #160): the signed-out panel this component renders below
 * the app shell's own header had no test coverage for narrow-viewport
 * layout at all before this — every existing `Home`-adjacent assertion
 * (`Layout.test.tsx`) only exercises the header/nav, not this panel's own
 * content.
 *
 * jsdom performs no real CSS layout (no box model, no `@media` evaluation),
 * so a genuine "does this overflow at 375px" check is only possible in a
 * real browser — see `frontend/e2e/responsiveShell.spec.ts`'s
 * `expectNoHorizontalOverflow`, which does that against a live render. This
 * test instead asserts the *structural* contract the CSS in
 * `frontend/src/index.css` actually depends on for the signed-out panel to
 * lay out correctly at narrow widths: the classes that hook into
 * `.content-panel`'s narrow-width margin tightening
 * (`@media (max-width: 600px)`) and `.centered-state`'s flex-centered,
 * `box-sizing: border-box` treatment are actually present on the rendered
 * elements, and every piece of content (heading text, sign-in call to
 * action) that a narrow viewport must fit is present with no fixed-pixel
 * inline width that could force horizontal overflow regardless of any CSS
 * rule. It does not, and cannot in jsdom, prove pixels never overflow —
 * that guarantee is `responsiveShell.spec.ts`'s job.
 */
describe('Home (signed-out panel, narrow viewport)', () => {
  const ORIGINAL_INNER_WIDTH = window.innerWidth;

  afterEach(() => {
    window.innerWidth = ORIGINAL_INNER_WIDTH;
  });

  it('renders the signed-out call to action with the narrow-width-aware panel classes and no fixed-width content', () => {
    window.innerWidth = 375;

    render(
      <AuthContext.Provider value={{ status: 'signed-out', user: null }}>
        <MemoryRouter>
          <Home />
        </MemoryRouter>
      </AuthContext.Provider>,
    );

    // `.content-panel` picks up `@media (max-width: 600px)` margin
    // tightening; `.home-panel`/`.centered-state` are what keep this
    // panel's content flex-centered and shrink-safe (`box-sizing:
    // border-box`) rather than a fixed-width block that could overflow a
    // 375px viewport.
    const panel = document.querySelector('.content-panel.home-panel');
    expect(panel).not.toBeNull();
    expect(panel?.querySelector('.centered-state')).not.toBeNull();

    expect(screen.getByText('Sign in to see your projects.')).toBeInTheDocument();
    const signInLink = screen.getByRole('link', { name: 'Sign in with Google' });
    expect(signInLink).toBeInTheDocument();
    expect(signInLink).toHaveClass('shell-action');

    // Nothing in this panel should carry an inline fixed pixel width --
    // that would force horizontal overflow at 375px regardless of any
    // `index.css` rule, and is the one class of bug jsdom's lack of real
    // layout can still catch deterministically.
    for (const element of [panel, ...Array.from(panel?.querySelectorAll('*') ?? [])]) {
      const style = (element as HTMLElement | null)?.getAttribute('style');
      expect(style ?? '').not.toMatch(/width\s*:\s*\d+px/);
    }
  });
});
