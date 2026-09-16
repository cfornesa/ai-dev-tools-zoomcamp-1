import { render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom';
import { describe, expect, it, vi } from 'vitest';

import { fetchCanonicalPublicPiece } from '../api/profile';
import CanonicalPublicPiece from './CanonicalPublicPiece';

vi.mock('../api/profile', () => ({
  fetchCanonicalPublicPiece: vi.fn(),
}));

function Destination() {
  return <output data-testid="destination">{useLocation().pathname}</output>;
}

describe('CanonicalPublicPiece (#578)', () => {
  it('redirects to the resolved viewer_url on success', async () => {
    vi.mocked(fetchCanonicalPublicPiece).mockResolvedValue({
      canonical_url: '/users/@artist/pieces/sunset-study',
      viewer_url: '/art-pieces/p/abc123',
      type: 'generated',
      piece: {},
    } as never);

    render(
      <MemoryRouter initialEntries={['/users/@artist/pieces/sunset-study']}>
        <Routes>
          <Route path="/users/:handle/pieces/:pieceSlug" element={<CanonicalPublicPiece />} />
          <Route path="/art-pieces/p/:id" element={<Destination />} />
        </Routes>
      </MemoryRouter>,
    );

    await waitFor(() =>
      expect(screen.getByTestId('destination')).toHaveTextContent('/art-pieces/p/abc123'),
    );
    expect(fetchCanonicalPublicPiece).toHaveBeenCalledWith('artist', 'sunset-study');
  });

  it('redirects to the public gallery for a missing or private piece', async () => {
    vi.mocked(fetchCanonicalPublicPiece).mockRejectedValue(new Error('not found'));

    render(
      <MemoryRouter initialEntries={['/users/@artist/pieces/unknown-piece']}>
        <Routes>
          <Route path="/users/:handle/pieces/:pieceSlug" element={<CanonicalPublicPiece />} />
          <Route path="/gallery" element={<Destination />} />
        </Routes>
      </MemoryRouter>,
    );

    await waitFor(() => expect(screen.getByTestId('destination')).toHaveTextContent('/gallery'));
  });
});
