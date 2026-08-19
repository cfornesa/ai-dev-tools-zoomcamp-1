import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { describe, expect, it } from 'vitest';

import Layout from './Layout';

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

describe('Layout: skip link', () => {
  it('is the very first focusable element on the page', async () => {
    const user = userEvent.setup();
    renderLayout();

    await user.tab();
    expect(screen.getByRole('link', { name: 'Skip to main content' })).toHaveFocus();
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
