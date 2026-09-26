import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import ArtPieceEditorToolAvailability from './ArtPieceEditorToolAvailability';

describe('ArtPieceEditorToolAvailability', () => {
  it('renders compact icon buttons with accessible hover/focus labels', () => {
    render(<ArtPieceEditorToolAvailability engine="p5js" />);

    const labels = [
      ['add-shape', 'Add shape'],
      ['add-ellipse', 'Add ellipse'],
      ['add-line', 'Add line'],
      ['freehand-draw', 'Freehand draw'],
      ['erase', 'Erase'],
      ['transform', 'Transform'],
      ['media', 'Media'],
      ['ai-edit', 'AI edit'],
    ] as const;

    for (const [tool, label] of labels) {
      const button = screen.getByTestId(`art-piece-editor-tool-${tool}`);
      expect(button).toHaveAccessibleName(label);
      expect(button.querySelector(`[data-editor-tool-icon="${tool}"]`)).toBeInTheDocument();
      const tooltip = button.querySelector('[role="tooltip"]');
      expect(tooltip).toHaveTextContent(label);
      expect(tooltip).toHaveClass('editor-tool-availability-tooltip');
    }
  });

  it('keeps unsupported tools visible with accessible reasons', () => {
    render(<ArtPieceEditorToolAvailability engine="p5js" />);

    const transform = screen.getByTestId('art-piece-editor-tool-transform');
    expect(transform).toBeDisabled();
    expect(transform).toHaveAttribute(
      'aria-describedby',
      'art-piece-editor-tool-transform-reason art-piece-editor-tool-transform-reason-tooltip',
    );
    expect(
      screen.getByText(/transform editing is planned/i, {
        selector: '#art-piece-editor-tool-transform-reason',
      }),
    ).toBeInTheDocument();
    expect(transform.querySelector('[role="tooltip"]')).toHaveTextContent(
      'Transform — Transform editing is planned for a later manual-tool slice.',
    );
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
