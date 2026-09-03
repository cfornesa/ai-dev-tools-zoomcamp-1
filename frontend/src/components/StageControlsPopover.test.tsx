import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';

import StageControlsPopover from './StageControlsPopover';

describe('StageControlsPopover', () => {
  it('keeps controls mounted but hides them until the stage button is activated', async () => {
    const user = userEvent.setup();

    render(
      <StageControlsPopover>
        <button type="button">Enable camera</button>
      </StageControlsPopover>,
    );

    expect(screen.getByRole('button', { name: 'Piece controls' })).toHaveAttribute(
      'aria-expanded',
      'false',
    );
    const controls = screen.getByRole('group', { hidden: true });
    expect(controls).toHaveAttribute('aria-label', 'Piece controls');
    expect(controls).toHaveAttribute('hidden');
    expect(
      within(controls).getByRole('button', { name: 'Enable camera', hidden: true }),
    ).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Piece controls' }));
    expect(screen.getByRole('group', { name: 'Piece controls' })).not.toHaveAttribute('hidden');

    await user.click(screen.getByRole('button', { name: 'Hide piece controls' }));
    expect(screen.getByRole('group', { hidden: true })).toHaveAttribute('hidden');
  });

  it('can keep a publication state label visible while the panel is closed', () => {
    render(
      <StageControlsPopover label="Publication status: Draft" showVisibleLabel>
        <button type="button">Publish</button>
      </StageControlsPopover>,
    );

    expect(
      screen
        .getByRole('button', { name: 'Publication status: Draft' })
        .querySelector('.piece-stage-action-label'),
    ).toHaveTextContent('Publication status: Draft');
    expect(screen.getByRole('tooltip', { name: 'Publication status: Draft' })).toBeInTheDocument();
  });
});
