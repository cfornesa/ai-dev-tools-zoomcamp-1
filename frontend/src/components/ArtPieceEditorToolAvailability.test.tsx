import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import ArtPieceEditorToolAvailability from './ArtPieceEditorToolAvailability';
import { getArtPieceEditorCapabilities } from './artPieceEditorCapabilities';

const FLAT_ENGINES = ['canvas2d', 'svg', 'p5js', 'c2js', 'c2js-interactive'] as const;
const SPATIAL_ENGINES = ['threejs', 'aframe'] as const;

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

  it.each(FLAT_ENGINES)('%s exposes the shared flat-source editing tools', (engine) => {
    const capabilities = getArtPieceEditorCapabilities(engine);
    for (const key of [
      'add-shape',
      'add-ellipse',
      'add-line',
      'freehand-draw',
      'erase',
      'ai-edit',
    ] as const) {
      expect(capabilities[key]).toMatchObject({ enabled: true });
    }
    expect(capabilities.transform.enabled).toBe(false);
  });

  it.each(SPATIAL_ENGINES)('%s exposes spatial object and transform editing', (engine) => {
    const capabilities = getArtPieceEditorCapabilities(engine);
    expect(capabilities['add-shape']).toMatchObject({ enabled: true });
    expect(capabilities.transform).toMatchObject({ enabled: true });
    expect(capabilities['ai-edit']).toMatchObject({ enabled: true });
    for (const key of ['add-ellipse', 'add-line', 'freehand-draw', 'erase'] as const) {
      expect(capabilities[key].enabled).toBe(false);
    }
  });
});
