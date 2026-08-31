import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';

import HandGestureGuideDialog from './HandGestureGuideDialog';

/**
 * Issue #295: "Show hand gesture guide" opens an accessible modal dialog
 * documenting exactly the gesture set #294 shipped (orbit + zoom + stop),
 * with no separate pan/move step -- see the component's own doc comment.
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

  it('documents orbit, zoom, and stop -- no aspirational "move/pan" step', async () => {
    const user = userEvent.setup();
    render(<HandGestureGuideDialog />);
    await user.click(screen.getByRole('button', { name: 'Show hand gesture guide' }));

    const dialog = screen.getByRole('dialog');
    expect(dialog).toHaveTextContent(/look and orbit/i);
    expect(dialog).toHaveTextContent(/zoom/i);
    expect(dialog).toHaveTextContent(/stop safely/i);
    // No separate "move"/"pan" step -- #294 has no independent pan/move
    // gesture, only combined look/orbit and zoom (see the component's
    // own doc comment for why documenting one here would be aspirational).
    expect(screen.queryByRole('heading', { name: /^move$/i })).not.toBeInTheDocument();
    expect(screen.queryByRole('heading', { name: /pan/i })).not.toBeInTheDocument();
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
