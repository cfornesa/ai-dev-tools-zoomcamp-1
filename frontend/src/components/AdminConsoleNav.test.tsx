import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { describe, expect, it } from 'vitest';

import AdminConsoleNav from './AdminConsoleNav';

describe('AdminConsoleNav (#584)', () => {
  it('renders "Admin console" as a heading, not an inline label', () => {
    render(
      <MemoryRouter>
        <AdminConsoleNav current="pages" />
      </MemoryRouter>,
    );
    expect(screen.getByRole('heading', { name: 'Admin console' })).toBeInTheDocument();
  });

  it('marks the active destination and lists every navigation destination', async () => {
    const user = userEvent.setup();
    render(
      <MemoryRouter initialEntries={['/admin/content']}>
        <AdminConsoleNav current="content" />
      </MemoryRouter>,
    );
    // Desktop CSS shows the menu unconditionally (the toggle button itself
    // is display:none there); open it here so jsdom's accessibility tree,
    // which has no CSS cascade, matches what a desktop visitor actually sees.
    await user.click(screen.getByRole('button', { name: 'Open menu' }));

    expect(screen.getByRole('link', { name: 'Content' })).toHaveAttribute('aria-current', 'page');
    expect(screen.getByRole('link', { name: 'Content' })).toHaveClass(
      'admin-console-nav-button',
      'is-active',
    );
    expect(screen.getByRole('link', { name: 'Pages' })).not.toHaveAttribute('aria-current');
    expect(screen.getByRole('link', { name: 'Settings and plans' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Return to public site' })).toBeInTheDocument();
    expect(screen.getAllByRole('link')).toHaveLength(4);
    for (const link of screen.getAllByRole('link')) {
      expect(link).toHaveClass('admin-console-nav-button', 'admin-action-secondary');
    }
  });

  it('the menu toggle starts collapsed and expands/collapses with correct aria-expanded', async () => {
    const user = userEvent.setup();
    render(
      <MemoryRouter>
        <AdminConsoleNav current="pages" />
      </MemoryRouter>,
    );

    const toggle = screen.getByRole('button', { name: 'Open menu' });
    expect(toggle).toHaveAttribute('aria-expanded', 'false');
    // The collapsed menu's links must be genuinely absent from the
    // accessibility tree (not merely visually hidden) -- `hidden` removes
    // them from `getByRole` entirely, unlike #584's original CSS bug where
    // `display: flex` silently overrode `hidden` at narrow widths.
    expect(screen.queryByRole('link', { name: 'Content' })).not.toBeInTheDocument();

    await user.click(toggle);
    expect(screen.getByRole('button', { name: 'Close menu' })).toHaveAttribute(
      'aria-expanded',
      'true',
    );
    expect(screen.getByRole('link', { name: 'Content' })).toBeVisible();
  });

  it('closes the open menu on selecting a destination', async () => {
    const user = userEvent.setup();
    render(
      <MemoryRouter>
        <AdminConsoleNav current="pages" />
      </MemoryRouter>,
    );

    await user.click(screen.getByRole('button', { name: 'Open menu' }));
    await user.click(screen.getByRole('link', { name: 'Content' }));

    expect(screen.getByRole('button', { name: 'Open menu' })).toHaveAttribute(
      'aria-expanded',
      'false',
    );
  });

  it('closes the open menu on Escape', async () => {
    const user = userEvent.setup();
    render(
      <MemoryRouter>
        <AdminConsoleNav current="pages" />
      </MemoryRouter>,
    );

    await user.click(screen.getByRole('button', { name: 'Open menu' }));
    expect(screen.getByRole('button', { name: 'Close menu' })).toBeInTheDocument();

    await user.keyboard('{Escape}');
    expect(screen.getByRole('button', { name: 'Open menu' })).toHaveAttribute(
      'aria-expanded',
      'false',
    );
  });
});
