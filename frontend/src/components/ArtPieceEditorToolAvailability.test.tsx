import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import ArtPieceEditorToolAvailability from './ArtPieceEditorToolAvailability';

describe('ArtPieceEditorToolAvailability', () => {
  it('keeps unsupported tools visible with accessible reasons', () => {
    render(<ArtPieceEditorToolAvailability engine="p5js" />);

    const addShape = screen.getByTestId('art-piece-editor-tool-add-shape');
    expect(addShape).toBeDisabled();
    expect(addShape).toHaveAttribute('aria-describedby', 'art-piece-editor-tool-add-shape-reason');
    expect(
      screen.getByText(/manual source editing for this engine is not available/i, {
        selector: '#art-piece-editor-tool-add-shape-reason',
      }),
    ).toBeVisible();
  });

  it('keeps the supported AI edit action enabled', () => {
    render(<ArtPieceEditorToolAvailability engine="threejs" />);

    expect(screen.getByTestId('art-piece-editor-tool-ai-edit')).toBeEnabled();
  });
});
