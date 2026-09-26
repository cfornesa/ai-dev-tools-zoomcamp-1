import { fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom';
import { describe, expect, it, vi } from 'vitest';

import type { ArtPiece } from '../api/artPieces';
import ImmersiveArtPieceViewer from './ImmersiveArtPieceViewer';

vi.mock('./PieceStageControls', () => ({
  default: () => <div data-testid="piece-stage-controls" />,
}));

function FixtureDestination() {
  return <output data-testid="destination">{useLocation().pathname}</output>;
}

const piece: ArtPiece = {
  public_id: 'piece-1',
  public_slug: 'sunset-study',
  title: 'Sunset study',
  description: 'A test piece',
  engine: 'threejs',
  status: 'published',
  current_version: {
    id: 1,
    sequence: 1,
    source: 'const scene = new THREE.Scene();',
    capabilities: { fullscreen: true, immersive: true },
    thumbnail_url: '',
    thumbnail_is_fallback: false,
    created_at: '2026-09-18T00:00:00Z',
  },
  created_at: '2026-09-18T00:00:00Z',
  updated_at: '2026-09-18T00:00:00Z',
};

function renderViewer() {
  return render(
    <MemoryRouter initialEntries={['/users/@artist/immersive/sunset-study']}>
      <Routes>
        <Route
          path="/users/:handle/immersive/:pieceSlug"
          element={
            <ImmersiveArtPieceViewer
              initialPiece={piece}
              canonicalHref="/users/@artist/immersive/sunset-study"
              regularHref="/users/@artist/pieces/sunset-study"
            />
          }
        />
        <Route path="/users/@artist/pieces/sunset-study" element={<FixtureDestination />} />
      </Routes>
    </MemoryRouter>,
  );
}

function renderGalleryViewer() {
  const galleryPiece = { ...piece, engine: 'c2js' as const };
  return render(
    <MemoryRouter initialEntries={['/users/@artist/immersive/sunset-study']}>
      <Routes>
        <Route
          path="/users/:handle/immersive/:pieceSlug"
          element={<ImmersiveArtPieceViewer initialPiece={galleryPiece} />}
        />
      </Routes>
    </MemoryRouter>,
  );
}

describe('ImmersiveArtPieceViewer (#606)', () => {
  it('owns the viewport and exposes a close control that returns to the canonical regular view', () => {
    renderViewer();

    expect(screen.getByTestId('piece-stage-controls')).toBeInTheDocument();
    expect(screen.getByRole('region', { name: 'Immersive stage' })).toHaveClass(
      'immersive-art-piece-stage',
    );
    fireEvent.click(screen.getByRole('button', { name: 'Close immersive view' }));
    expect(screen.getByTestId('destination')).toHaveTextContent(
      '/users/@artist/pieces/sunset-study',
    );
  });

  it('places identity above the stage and embed actions below it', () => {
    renderViewer();

    const viewer = screen.getByRole('region', { name: 'Immersive stage' }).closest('section');
    expect(viewer).not.toBeNull();
    expect(viewer?.querySelector('#immersive-art-piece-heading')).not.toBeNull();
    expect(viewer?.querySelector('.immersive-art-piece-description')).toHaveTextContent(
      'A test piece',
    );
    expect(
      viewer
        ?.querySelector('#immersive-art-piece-heading')
        ?.compareDocumentPosition(screen.getByRole('region', { name: 'Immersive stage' })),
    ).toBe(Node.DOCUMENT_POSITION_FOLLOWING);
    expect(
      screen
        .getByRole('region', { name: 'Immersive stage' })
        .compareDocumentPosition(viewer?.querySelector('.immersive-art-piece-actions') as Node),
    ).toBe(Node.DOCUMENT_POSITION_FOLLOWING);
    expect(screen.getByRole('link', { name: 'Back to regular viewer' })).toHaveClass(
      'immersive-art-piece-back-link',
    );
    expect(screen.getByTestId('immersive-directional-controls')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Move forward' })).toBeInTheDocument();
  });

  it('closes the route on Escape when native fullscreen is not active', () => {
    renderViewer();

    fireEvent.keyDown(document, { key: 'Escape' });
    expect(screen.getByTestId('destination')).toHaveTextContent(
      '/users/@artist/pieces/sunset-study',
    );
  });

  it('presents non-spatial pieces inside a responsive 2D gallery shell without spatial navigation', () => {
    renderGalleryViewer();

    expect(screen.getByTestId('immersive-gallery')).toHaveAttribute('aria-label', '2D gallery');
    expect(screen.getByText('2D gallery')).toBeInTheDocument();
    expect(screen.getByRole('region', { name: 'Gallery artwork' })).toBeInTheDocument();
    expect(screen.getByTestId('navigation-unsupported')).toHaveTextContent(
      "Walkable navigation isn't available for this piece type.",
    );
    expect(screen.queryByTestId('immersive-directional-controls')).not.toBeInTheDocument();
  });
});
