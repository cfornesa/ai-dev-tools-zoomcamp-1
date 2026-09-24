import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import ArtPieceEditorToolAvailability from './ArtPieceEditorToolAvailability';

describe('ArtPieceEditorToolAvailability', () => {
  it('keeps unsupported tools visible with accessible reasons', () => {
    render(<ArtPieceEditorToolAvailability engine="p5js" />);

    const transform = screen.getByTestId('art-piece-editor-tool-transform');
    expect(transform).toBeDisabled();
    expect(transform).toHaveAttribute('aria-describedby', 'art-piece-editor-tool-transform-reason');
    expect(
      screen.getByText(/transform editing is planned/i, {
        selector: '#art-piece-editor-tool-transform-reason',
      }),
    ).toBeVisible();
  });

  it('enables the ink drawing tools for every 2D engine (#776)', () => {
    render(<ArtPieceEditorToolAvailability engine="p5js" />);

    for (const tool of ['add-shape', 'add-ellipse', 'add-line', 'freehand-draw', 'erase']) {
      expect(screen.getByTestId(`art-piece-editor-tool-${tool}`)).toBeEnabled();
    }
  });

  it('keeps the supported AI edit action enabled', () => {
    render(<ArtPieceEditorToolAvailability engine="threejs" />);

    expect(screen.getByTestId('art-piece-editor-tool-ai-edit')).toBeEnabled();
  });
});
