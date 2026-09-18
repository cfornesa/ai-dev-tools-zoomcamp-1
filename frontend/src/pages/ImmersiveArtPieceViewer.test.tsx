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

  it('closes the route on Escape when native fullscreen is not active', () => {
    renderViewer();

    fireEvent.keyDown(document, { key: 'Escape' });
    expect(screen.getByTestId('destination')).toHaveTextContent(
      '/users/@artist/pieces/sunset-study',
    );
  });
});
