import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';

import HandGestureGuideDialog from './HandGestureGuideDialog';

/**
 * Issue #295: "Show hand gesture guide" opens an accessible modal dialog
 * documenting the reference's five named steps, including immersive Move.
 */

describe('HandGestureGuideDialog', () => {
  it('is closed by default and opens an accessible dialog on click', async () => {
    const user = userEvent.setup();
    render(<HandGestureGuideDialog />);

    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Show hand gesture guide' }));

    const dialog = await screen.findByRole('dialog', { name: 'Hand gesture guide' });
    expect(dialog).toBeInTheDocument();
    expect(dialog).toHaveFocus();
  });

  it('uses the compact stage icon treatment for the guide trigger', () => {
    render(<HandGestureGuideDialog />);

    const trigger = screen.getByRole('button', { name: 'Show hand gesture guide' });
    expect(trigger).toHaveClass('piece-stage-icon-button');
    expect(trigger).toHaveAttribute('title', 'Show hand gesture guide');
    expect(trigger.querySelector('svg')).toHaveClass('piece-stage-icon');
  });

  it('shows the first named slide and navigates through all five steps', async () => {
    const user = userEvent.setup();
    render(<HandGestureGuideDialog />);
    await user.click(screen.getByRole('button', { name: 'Show hand gesture guide' }));

    const dialog = screen.getByRole('dialog');
    expect(dialog).toHaveTextContent(/step 1 of 5/i);
    expect(within(dialog).getByRole('heading', { name: 'Look' })).toBeInTheDocument();

    await user.click(within(dialog).getByRole('button', { name: 'Next' }));
    expect(within(dialog).getByRole('heading', { name: 'Move' })).toBeInTheDocument();
    expect(dialog).toHaveTextContent(/pinch and hold/i);

    await user.keyboard('{ArrowRight}{ArrowRight}{ArrowRight}');
    expect(within(dialog).getByRole('heading', { name: 'Stop safely' })).toBeInTheDocument();
    expect(within(dialog).getByRole('button', { name: 'Next' })).toBeDisabled();
    expect(within(dialog).getByRole('button', { name: 'Previous' })).not.toBeDisabled();
  });

  it('closes on Escape and returns focus to the trigger button', async () => {
    const user = userEvent.setup();
    render(<HandGestureGuideDialog />);
    const trigger = screen.getByRole('button', { name: 'Show hand gesture guide' });

    await user.click(trigger);
    expect(screen.getByRole('dialog')).toBeInTheDocument();

    await user.keyboard('{Escape}');
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(trigger).toHaveFocus();
  });

  it('closes via the Close button', async () => {
    const user = userEvent.setup();
    render(<HandGestureGuideDialog />);

    await user.click(screen.getByRole('button', { name: 'Show hand gesture guide' }));
    await user.click(screen.getByRole('button', { name: 'Close' }));

    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });
});
