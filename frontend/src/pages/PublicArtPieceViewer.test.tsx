import { render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { describe, expect, it, vi } from 'vitest';

import type { ArtPiece } from '../api/artPieces';
import PublicArtPieceViewer from './PublicArtPieceViewer';

vi.mock('./PieceStageControls', () => ({
  default: () => <div data-testid="piece-stage-controls" />,
}));

const basePiece: ArtPiece = {
  public_id: 'piece-1',
  public_slug: 'responsive-study',
  title: 'Responsive study',
  description: 'A test piece',
  engine: 'canvas2d',
  status: 'published',
  current_version: {
    id: 1,
    sequence: 1,
    source: '<canvas width="320" height="180"></canvas>',
    capabilities: {},
    thumbnail_url: '',
    thumbnail_is_fallback: false,
    created_at: '2026-09-18T00:00:00Z',
  },
  created_at: '2026-09-18T00:00:00Z',
  updated_at: '2026-09-18T00:00:00Z',
};

function renderViewer(piece: ArtPiece = basePiece) {
  return render(
    <MemoryRouter initialEntries={['/art-pieces/p/piece-1']}>
      <Routes>
        <Route path="/art-pieces/p/:id" element={<PublicArtPieceViewer initialPiece={piece} />} />
      </Routes>
    </MemoryRouter>,
  );
}

describe('PublicArtPieceViewer stage sizing (#703)', () => {
  it('reserves a responsive 16:9 stage before the preview is ready and uses the theme background', () => {
    renderViewer();

    const stage = screen.getByRole('region', { name: 'Art piece stage' });
    const iframe = screen.getByTitle('Art piece preview');
    expect(stage).toHaveClass('art-piece-stage', 'public-art-piece-stage');
    expect(stage).toHaveStyle({
      '--art-piece-aspect-ratio': '16 / 9',
      background: 'color-mix(in srgb, var(--code-bg, #f4f3ec) 94%, var(--text, #111827))',
    });
    expect(iframe).toHaveStyle({
      height: '100%',
      background: 'color-mix(in srgb, var(--code-bg, #f4f3ec) 94%, var(--text, #111827))',
    });
    expect(iframe).toHaveAttribute('srcdoc', expect.stringContaining('background: transparent'));
    expect(iframe).not.toHaveAttribute('style', expect.stringContaining('480'));
  });

  it('preserves a declared piece ratio when the current version exposes one', () => {
    renderViewer({
      ...basePiece,
      current_version: {
        ...basePiece.current_version!,
        generation_metadata: { aspect_ratio: '4:3' },
      },
    });

    expect(screen.getByRole('region', { name: 'Art piece stage' })).toHaveStyle({
      '--art-piece-aspect-ratio': '4 / 3',
    });
  });

  it('derives the ratio from declared dimensions when no ratio field is present', () => {
    renderViewer({
      ...basePiece,
      current_version: {
        ...basePiece.current_version!,
        generation_metadata: { width: 1200, height: 800 },
      },
    });

    expect(screen.getByRole('region', { name: 'Art piece stage' })).toHaveStyle({
      '--art-piece-aspect-ratio': '1200 / 800',
    });
  });
});
