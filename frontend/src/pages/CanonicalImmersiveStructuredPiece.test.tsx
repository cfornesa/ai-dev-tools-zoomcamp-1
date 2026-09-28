import { render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { describe, expect, it, vi } from 'vitest';

import { fetchCanonicalPublicPiece, fetchPublicProfile } from '../api/profile';
import CanonicalImmersiveStructuredPiece from './CanonicalImmersiveStructuredPiece';

vi.mock('../api/profile', () => ({
  fetchCanonicalPublicPiece: vi.fn(),
  fetchPublicProfile: vi.fn().mockResolvedValue({ profile: null }),
}));

vi.mock('./PublicProjectViewer', () => ({
  default: ({ regularHref }: { regularHref?: string }) => (
    <div>
      <h1>2D scene</h1>
      {regularHref && <a href={regularHref}>Back to regular view</a>}
    </div>
  ),
}));

vi.mock('./ImmersiveProject3DViewer', () => ({ default: () => <div>3D scene</div> }));
vi.mock('./ImmersiveArtPieceViewer', () => ({ default: () => <div>Generated scene</div> }));

describe('CanonicalImmersiveStructuredPiece', () => {
  it('renders the structured 2D viewer on the canonical immersive route', async () => {
    vi.mocked(fetchCanonicalPublicPiece).mockResolvedValue({
      canonical_url: '/users/@artist/pieces/canvas-study',
      viewer_url: '/p/abc123',
      type: '2d',
      piece: { title: 'Canvas study', id: 'abc123' },
    } as never);

    render(
      <MemoryRouter initialEntries={['/users/@artist/immersive/canvas-study']}>
        <Routes>
          <Route
            path="/users/:handle/immersive/:pieceSlug"
            element={<CanonicalImmersiveStructuredPiece />}
          />
        </Routes>
      </MemoryRouter>,
    );

    await waitFor(() => expect(screen.getByRole('heading', { name: '2D scene' })).toBeVisible());
    expect(screen.getByRole('link', { name: 'Back to regular view' })).toHaveAttribute(
      'href',
      '/users/@artist/pieces/canvas-study',
    );
    expect(fetchPublicProfile).toHaveBeenCalledWith('artist');
  });
});
