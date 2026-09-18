import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import * as artPiecesApi from '../api/artPieces';
import * as profileApi from '../api/profile';
import * as authModule from '../auth/useAuth';
import ArtPieceManagement from './ArtPieceManagement';

vi.mock('../api/artPieces');
vi.mock('../api/profile');
vi.mock('../auth/useAuth');

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

describe('ArtPieceManagement (#605)', () => {
  beforeEach(() => {
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
});
