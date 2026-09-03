import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

import PieceStageToolbar from './PieceStageToolbar';
import { THREE_D_STAGE_CAPABILITIES, TWO_D_STAGE_CAPABILITIES } from './pieceStageCapabilities';

describe('PieceStageToolbar', () => {
  it('keeps the shared action order and routes both download variants', async () => {
    const user = userEvent.setup();
    const onDownload = vi.fn();

    render(
      <PieceStageToolbar
        onScreenshot={vi.fn()}
        onDownload={onDownload}
        capabilities={THREE_D_STAGE_CAPABILITIES}
        immersiveHref="/immersive"
        soundControl={<button type="button">Sound</button>}
        controlsControl={<button type="button">Piece controls</button>}
        gestureGuide={<button type="button">Hand guide</button>}
        onToggleFullscreen={vi.fn()}
      />,
    );

    expect(screen.getByRole('toolbar', { name: 'Piece actions' })).toBeInTheDocument();
    const trigger = screen.getByRole('button', { name: 'Open piece controls menu' });
    await user.click(trigger);
    const menu = screen.getByRole('dialog', { name: 'Piece actions' });
    expect(within(menu).getByRole('group', { name: 'Piece actions' })).toHaveClass(
      'piece-stage-toolbar-group',
    );
    expect(within(menu).getByRole('link', { name: 'View immersive piece' })).toBeInTheDocument();
    expect(within(menu).getByRole('button', { name: 'Take screenshot' })).toBeInTheDocument();
    expect(
      within(menu).getByRole('button', { name: 'Expand piece to fullscreen' }),
    ).toBeInTheDocument();
    expect(
      within(menu).getByText('Screenshot', { selector: '.piece-stage-action-label' }),
    ).toBeVisible();
    expect(
      within(menu).getByText('Download', { selector: '.piece-stage-action-label' }),
    ).toBeVisible();
    expect(
      within(menu).getByText('Immersive', { selector: '.piece-stage-action-label' }),
    ).toBeVisible();
    expect(
      within(menu).getByText('Fullscreen', { selector: '.piece-stage-action-label' }),
    ).toBeVisible();
    expect(
      within(menu).getByRole('button', { name: 'Take screenshot' }).querySelector('svg'),
    ).toHaveClass('piece-stage-icon');
    expect(within(menu).getByRole('tooltip', { name: 'Take screenshot' })).toBeInTheDocument();
    expect(within(menu).getByRole('tooltip', { name: 'Open download menu' })).toBeInTheDocument();
    expect(within(menu).getByRole('tooltip', { name: 'View immersive piece' })).toBeInTheDocument();
    expect(
      within(menu).getByRole('tooltip', { name: 'Expand piece to fullscreen' }),
    ).toBeInTheDocument();

    const menuRows = menu.querySelectorAll(
      '.piece-stage-command-card > [role="group"] > .piece-stage-icon-button, .piece-stage-command-card > [role="group"] > .piece-stage-download > .piece-stage-icon-button, .piece-stage-command-card > [role="group"] > .piece-stage-controls > .piece-stage-icon-button',
    );
    expect(menuRows.length).toBeGreaterThan(0);
    for (const row of menuRows) {
      expect(row).toHaveClass('piece-stage-icon-button');
      expect(row.querySelector('.piece-stage-action-label')).toBeVisible();
    }

    await user.click(within(menu).getByRole('button', { name: 'Open download menu' }));
    await user.click(within(menu).getByRole('menuitem', { name: 'Download Full' }));
    expect(onDownload).toHaveBeenCalledWith('full');
    expect(within(menu).queryByRole('menuitem', { name: 'Download Full' })).not.toBeInTheDocument();

    await user.click(within(menu).getByRole('button', { name: 'Open download menu' }));
    await user.click(within(menu).getByRole('menuitem', { name: 'Download Non-Camera' }));
    expect(onDownload).toHaveBeenCalledWith('non-camera');
  });

  it('uses ZIP labels for bundled surfaces', async () => {
    const user = userEvent.setup();
    render(<PieceStageToolbar onDownload={vi.fn()} downloadFormat="zip" />);
    await user.click(screen.getByRole('button', { name: 'Open piece controls menu' }));
    const menu = screen.getByRole('dialog', { name: 'Piece actions' });
    await user.click(within(menu).getByRole('button', { name: 'Open download menu' }));
    expect(within(menu).getByRole('menuitem', { name: 'Download Full ZIP' })).toBeInTheDocument();
  });

  it('closes the download menu when another stage or page control receives a pointer event', async () => {
    const user = userEvent.setup();
    render(
      <>
        <PieceStageToolbar onDownload={vi.fn()} />
        <button type="button">Other control</button>
      </>,
    );

    await user.click(screen.getByRole('button', { name: 'Open piece controls menu' }));
    const menu = screen.getByRole('dialog', { name: 'Piece actions' });
    await user.click(within(menu).getByRole('button', { name: 'Open download menu' }));
    expect(within(menu).getByRole('menuitem', { name: 'Download Full' })).toBeVisible();
    await user.click(screen.getByRole('button', { name: 'Other control' }));
    expect(screen.queryByRole('menuitem', { name: 'Download Full' })).not.toBeInTheDocument();
  });

  it('does not render controls that the capability contract disables', async () => {
    const user = userEvent.setup();
    render(
      <PieceStageToolbar
        capabilities={{ ...TWO_D_STAGE_CAPABILITIES, screenshot: false, download: false }}
        onScreenshot={vi.fn()}
        onDownload={vi.fn()}
        immersiveHref="/immersive"
        soundControl={<button type="button">Sound</button>}
        onToggleFullscreen={vi.fn()}
      />,
    );

    await user.click(screen.getByRole('button', { name: 'Open piece controls menu' }));
    const menu = screen.getByRole('dialog', { name: 'Piece actions' });
    expect(within(menu).queryByRole('button', { name: 'Take screenshot' })).not.toBeInTheDocument();
    expect(
      within(menu).queryByRole('button', { name: 'Open download menu' }),
    ).not.toBeInTheDocument();
    expect(
      within(menu).queryByRole('link', { name: 'View immersive piece' }),
    ).not.toBeInTheDocument();
    expect(within(menu).queryByRole('button', { name: 'Sound' })).not.toBeInTheDocument();
    expect(
      within(menu).getByRole('button', { name: 'Expand piece to fullscreen' }),
    ).toBeInTheDocument();
  });

  it('opens a translucent command dialog, closes with X or Escape, and restores focus', async () => {
    const user = userEvent.setup();
    render(<PieceStageToolbar onScreenshot={vi.fn()} />);
    const trigger = screen.getByRole('button', { name: 'Open piece controls menu' });
    await user.click(trigger);
    const menu = screen.getByRole('dialog', { name: 'Piece actions' });
    expect(menu).toBeVisible();
    expect(within(menu).getByRole('button', { name: 'Close piece controls menu' })).toHaveFocus();
    await user.keyboard('{Escape}');
    expect(screen.getByRole('button', { name: 'Open piece controls menu' })).toHaveFocus();
    await user.click(trigger);
    await user.click(
      within(screen.getByRole('dialog', { name: 'Piece actions' })).getByRole('button', {
        name: 'Close piece controls menu',
      }),
    );
    expect(screen.getByRole('button', { name: 'Open piece controls menu' })).toHaveFocus();
  });
});
