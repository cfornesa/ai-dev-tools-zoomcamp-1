import { render, screen } from '@testing-library/react';
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
    expect(screen.getByRole('group', { name: 'Piece actions' })).toHaveClass(
      'piece-stage-toolbar-group',
    );
    expect(screen.getByRole('link', { name: 'View immersive piece' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Take screenshot' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Expand piece to fullscreen' })).toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: 'Take screenshot' }).querySelector('svg'),
    ).toHaveClass('piece-stage-icon');
    expect(screen.getByRole('tooltip', { name: 'Take screenshot' })).toBeInTheDocument();
    expect(screen.getByRole('tooltip', { name: 'Open download menu' })).toBeInTheDocument();
    expect(screen.getByRole('tooltip', { name: 'View immersive piece' })).toBeInTheDocument();
    expect(screen.getByRole('tooltip', { name: 'Expand piece to fullscreen' })).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Open download menu' }));
    await user.click(screen.getByRole('menuitem', { name: 'Download Full' }));
    expect(onDownload).toHaveBeenCalledWith('full');
    expect(screen.queryByRole('menuitem', { name: 'Download Full' })).not.toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Open download menu' }));
    await user.click(screen.getByRole('menuitem', { name: 'Download Non-Camera' }));
    expect(onDownload).toHaveBeenCalledWith('non-camera');
  });

  it('uses ZIP labels for bundled surfaces', async () => {
    const user = userEvent.setup();
    render(<PieceStageToolbar onDownload={vi.fn()} downloadFormat="zip" />);
    await user.click(screen.getByRole('button', { name: 'Open download menu' }));
    expect(screen.getByRole('menuitem', { name: 'Download Full ZIP' })).toBeInTheDocument();
  });

  it('closes the download menu when another stage or page control receives a pointer event', async () => {
    const user = userEvent.setup();
    render(
      <>
        <PieceStageToolbar onDownload={vi.fn()} />
        <button type="button">Other control</button>
      </>,
    );

    await user.click(screen.getByRole('button', { name: 'Open download menu' }));
    expect(screen.getByRole('menuitem', { name: 'Download Full' })).toBeVisible();
    await user.click(screen.getByRole('button', { name: 'Other control' }));
    expect(screen.queryByRole('menuitem', { name: 'Download Full' })).not.toBeInTheDocument();
  });

  it('does not render controls that the capability contract disables', () => {
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

    expect(screen.queryByRole('button', { name: 'Take screenshot' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Open download menu' })).not.toBeInTheDocument();
    expect(screen.queryByRole('link', { name: 'View immersive piece' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Sound' })).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Expand piece to fullscreen' })).toBeInTheDocument();
  });
});
