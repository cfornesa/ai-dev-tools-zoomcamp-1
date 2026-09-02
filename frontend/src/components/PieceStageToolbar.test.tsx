import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

import PieceStageToolbar from './PieceStageToolbar';

describe('PieceStageToolbar', () => {
  it('keeps the shared action order and routes both download variants', async () => {
    const user = userEvent.setup();
    const onDownload = vi.fn();

    render(
      <PieceStageToolbar
        onScreenshot={vi.fn()}
        onDownload={onDownload}
        immersiveHref="/immersive"
        soundControl={<button type="button">Sound</button>}
        controlsControl={<button type="button">Piece controls</button>}
        gestureGuide={<button type="button">Hand guide</button>}
        onToggleFullscreen={vi.fn()}
      />,
    );

    expect(screen.getByRole('toolbar', { name: 'Piece actions' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'View immersive piece' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Take screenshot' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Expand piece to fullscreen' })).toBeInTheDocument();

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
});
