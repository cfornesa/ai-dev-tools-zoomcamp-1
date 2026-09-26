import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import { InkPreviewModeToggle } from './GeneratedInkPanel';

describe('InkPreviewModeToggle', () => {
  it('exposes explicit preview and draw modes with a direct draw entry point', () => {
    const onModeChange = vi.fn();
    const onRequestDraw = vi.fn();
    render(
      <InkPreviewModeToggle
        mode="preview"
        drawDisabled={false}
        onRequestDraw={onRequestDraw}
        onModeChange={onModeChange}
      />,
    );

    expect(screen.getByRole('button', { name: 'Preview animation' })).toHaveAttribute(
      'aria-pressed',
      'true',
    );
    const draw = screen.getByRole('button', { name: 'Draw ink' });
    expect(draw).toBeEnabled();

    fireEvent.click(draw);
    expect(onRequestDraw).toHaveBeenCalledTimes(1);
  });

  it('marks draw mode active once an ink session exists', () => {
    const onModeChange = vi.fn();
    render(<InkPreviewModeToggle mode="draw" drawDisabled={false} onModeChange={onModeChange} />);

    expect(screen.getByRole('button', { name: 'Draw ink' })).toHaveAttribute(
      'aria-pressed',
      'true',
    );
    fireEvent.click(screen.getByRole('button', { name: 'Preview animation' }));
    expect(onModeChange).toHaveBeenCalledWith('preview');
  });

  it('returns to an existing draw session without requesting a new snapshot', () => {
    const onModeChange = vi.fn();
    const onRequestDraw = vi.fn();
    render(
      <InkPreviewModeToggle
        mode="preview"
        drawDisabled={false}
        hasSession
        onRequestDraw={onRequestDraw}
        onModeChange={onModeChange}
      />,
    );

    fireEvent.click(screen.getByRole('button', { name: 'Draw ink' }));
    expect(onModeChange).toHaveBeenCalledWith('draw');
    expect(onRequestDraw).not.toHaveBeenCalled();
  });
});
