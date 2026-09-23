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
  it('renders the canonical generated-art information architecture and safe prompt summaries', () => {
    const longPrompt = 'A '.repeat(120);
    render(
      <MemoryRouter initialEntries={['/users/@artist/pieces/responsive-study']}>
        <Routes>
          <Route
            path="/users/:handle/pieces/:pieceSlug"
            element={
              <PublicArtPieceViewer
                initialPiece={{
                  ...basePiece,
                  engine_label: 'SVG',
                  prompt: longPrompt,
                  versions: [
                    {
                      sequence: 1,
                      engine: 'svg',
                      status: 'published',
                      prompt: longPrompt,
                      created_at: '2026-09-18T00:00:00Z',
                      model_label: 'Mistral Small',
                    },
                  ],
                }}
                canonicalHref="/users/@artist/pieces/responsive-study"
              />
            }
          />
        </Routes>
      </MemoryRouter>,
    );

    expect(screen.getByText('Generated art')).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Responsive study', level: 1 })).toBeInTheDocument();
    expect(screen.getByText('SVG · 1 version')).toBeInTheDocument();
    expect(screen.getByRole('region', { name: 'Art piece stage' })).toBeInTheDocument();
    expect(screen.getByRole('group', { name: 'Piece actions' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Current version context' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Versions' })).toBeInTheDocument();
    expect(screen.getByText('Mistral Small')).toBeInTheDocument();
    expect(screen.getByText('CURRENT')).toBeInTheDocument();
    const summary = document.querySelector('summary');
    expect(summary).not.toBeNull();
    expect(summary?.textContent).toHaveLength(180);
    expect(summary).toHaveAttribute('title', longPrompt);
    expect(document.querySelector('details p')).toHaveTextContent(longPrompt.trimEnd());
  });

  it('renders one themed page-level h1 outside the embed route', () => {
    renderViewer();

    const heading = screen.getByRole('heading', { name: 'Responsive study', level: 1 });
    expect(heading).toHaveClass('public-piece-page-heading');
    expect(screen.getByRole('region', { name: 'Art piece stage' })).toBeInTheDocument();
  });

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
