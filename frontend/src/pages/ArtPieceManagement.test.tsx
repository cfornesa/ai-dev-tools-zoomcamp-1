import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import * as artPiecesApi from '../api/artPieces';
import * as profileApi from '../api/profile';
import * as authModule from '../auth/useAuth';
import * as thumbnailCapture from '../generative/artPieceThumbnailCapture';
import ArtPieceManagement from './ArtPieceManagement';

vi.mock('../api/artPieces');
vi.mock('../api/profile');
vi.mock('../auth/useAuth');
vi.mock('../generative/artPieceThumbnailCapture');

const piece = {
  public_id: 'piece-1',
  public_slug: 'sunset-study',
  title: 'Sunset study',
  description: '',
  engine: 'canvas2d' as const,
  status: 'published' as const,
  current_version: {
    id: 1,
    sequence: 1,
    source: '<canvas />',
    capabilities: {},
    thumbnail_url: '/media/sunset.png',
    thumbnail_is_fallback: false,
    created_at: '2026-09-18T00:00:00Z',
  },
  created_at: '2026-09-18T00:00:00Z',
  updated_at: '2026-09-18T00:00:00Z',
};

describe('ArtPieceManagement (#716)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(authModule.useAuth).mockReturnValue({
      status: 'signed-in',
      user: { username: 'artist', email: 'artist@example.com', is_application_admin: false },
    });
    vi.mocked(artPiecesApi.listArtPieces).mockResolvedValue([piece]);
    vi.mocked(profileApi.fetchProfile).mockResolvedValue({ handle: 'artist' } as never);
  });

  it('uses the canonical editor as the card destination and keeps a separate public link', async () => {
    render(
      <MemoryRouter>
        <ArtPieceManagement />
      </MemoryRouter>,
    );

    expect(await screen.findByRole('link', { name: /sunset study/i })).toHaveAttribute(
      'href',
      '/users/@artist/edit/sunset-study',
    );
    expect(screen.getByRole('link', { name: 'View public page' })).toHaveAttribute(
      'href',
      '/users/@artist/pieces/sunset-study',
    );
  });

  it('refreshes only current fallback thumbnails through the opaque-sandbox helper', async () => {
    const fallbackPiece = {
      ...piece,
      public_id: 'piece-fallback',
      title: 'Fallback study',
      current_version: {
        ...piece.current_version!,
        id: 2,
        source: '<svg />',
        thumbnail_is_fallback: true,
      },
    };
    const currentPiece = {
      ...piece,
      public_id: 'piece-current',
      title: 'Already rendered',
    };
    vi.mocked(artPiecesApi.listArtPieces)
      .mockResolvedValueOnce([fallbackPiece, currentPiece])
      .mockResolvedValueOnce([fallbackPiece, currentPiece]);
    vi.mocked(thumbnailCapture.captureArtPieceThumbnailFromSource).mockResolvedValue(true);

    render(
      <MemoryRouter>
        <ArtPieceManagement />
      </MemoryRouter>,
    );

    const refreshButton = await screen.findByRole('button', { name: 'Refresh thumbnails' });
    expect(refreshButton).toBeEnabled();
    await refreshButton.click();

    expect(thumbnailCapture.captureArtPieceThumbnailFromSource).toHaveBeenCalledWith(
      'piece-fallback',
      2,
      '<svg />',
      'canvas2d',
    );
    expect(thumbnailCapture.captureArtPieceThumbnailFromSource).not.toHaveBeenCalledWith(
      'piece-current',
      expect.anything(),
      expect.anything(),
      expect.anything(),
    );
    expect(await screen.findByRole('status')).toHaveTextContent(
      '1 thumbnail refreshed successfully.',
    );
  });

  it('prevents concurrent refreshes and reports failed captures', async () => {
    const deferred = Promise.resolve(false);
    vi.mocked(artPiecesApi.listArtPieces).mockResolvedValue([
      {
        ...piece,
        current_version: { ...piece.current_version!, thumbnail_is_fallback: true },
      },
    ]);
    vi.mocked(thumbnailCapture.captureArtPieceThumbnailFromSource).mockReturnValue(deferred);

    render(
      <MemoryRouter>
        <ArtPieceManagement />
      </MemoryRouter>,
    );

    const refreshButton = await screen.findByRole('button', { name: 'Refresh thumbnails' });
    await refreshButton.click();
    expect(refreshButton).toBeDisabled();
    await screen.findByRole('alert');
    expect(screen.getByRole('alert')).toHaveTextContent('could not be refreshed');
    expect(thumbnailCapture.captureArtPieceThumbnailFromSource).toHaveBeenCalledTimes(1);
  });
});
