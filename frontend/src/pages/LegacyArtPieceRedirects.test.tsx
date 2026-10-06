import { render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import * as artPiecesApi from '../api/artPieces';
import * as profileApi from '../api/profile';
import LegacyArtPieceEditorRedirect from './LegacyArtPieceEditorRedirect';
import LegacyArtPieceManagementRedirect from './LegacyArtPieceManagementRedirect';

vi.mock('../api/artPieces');
vi.mock('../api/profile');

const mockedGetArtPiece = vi.mocked(artPiecesApi.getArtPiece);
const mockedFetchProfile = vi.mocked(profileApi.fetchProfile);

function LocationText() {
  const location = useLocation();
  return <output>{`${location.pathname}${location.search}`}</output>;
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe('legacy generated-piece routes', () => {
  it('redirects the old management URL to the generated-only Studio view', async () => {
    render(
      <MemoryRouter initialEntries={['/art-pieces/manage']}>
        <Routes>
          <Route path="/art-pieces/manage" element={<LegacyArtPieceManagementRedirect />} />
          <Route path="/studio" element={<LocationText />} />
        </Routes>
      </MemoryRouter>,
    );

    expect(await screen.findByText('/studio?kind=generated')).toBeInTheDocument();
  });

  it('resolves an old ID editor URL to the owner canonical slug URL', async () => {
    mockedGetArtPiece.mockResolvedValue({
      public_id: 'piece-id',
      public_slug: 'sunset-study',
      title: 'Sunset study',
    } as artPiecesApi.ArtPiece);
    mockedFetchProfile.mockResolvedValue({ handle: 'alice-public' } as never);

    render(
      <MemoryRouter initialEntries={['/art-pieces/piece-id/edit']}>
        <Routes>
          <Route path="/art-pieces/:id/edit" element={<LegacyArtPieceEditorRedirect />} />
          <Route path="/users/:handle/edit/:slug" element={<LocationText />} />
        </Routes>
      </MemoryRouter>,
    );

    expect(await screen.findByText('/users/@alice-public/edit/sunset-study')).toBeInTheDocument();
    expect(mockedGetArtPiece).toHaveBeenCalledWith('piece-id');
    expect(mockedFetchProfile).toHaveBeenCalledOnce();
  });

  it('keeps unavailable or non-owner legacy IDs out of the editor', async () => {
    mockedGetArtPiece.mockRejectedValue(new Error('Not found'));

    render(
      <MemoryRouter initialEntries={['/art-pieces/unknown/edit']}>
        <Routes>
          <Route path="/art-pieces/:id/edit" element={<LegacyArtPieceEditorRedirect />} />
          <Route path="/studio" element={<LocationText />} />
        </Routes>
      </MemoryRouter>,
    );

    expect(await screen.findByRole('alert')).toHaveTextContent('This art piece isn’t available.');
    expect(screen.getByRole('link', { name: 'Back to your generated pieces' })).toHaveAttribute(
      'href',
      '/studio?kind=generated',
    );
  });
});
