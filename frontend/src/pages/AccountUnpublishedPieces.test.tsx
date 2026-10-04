import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { describe, expect, it, vi } from 'vitest';

import * as unpublishedPiecesApi from '../api/unpublishedPieces';
import { AuthContext } from '../auth/context';
import AccountUnpublishedPieces from './AccountUnpublishedPieces';

vi.mock('../api/unpublishedPieces', () => ({ fetchMyUnpublishedPieces: vi.fn() }));

const mockedFetch = vi.mocked(unpublishedPiecesApi.fetchMyUnpublishedPieces);

const SIGNED_IN_USER = {
  status: 'signed-in' as const,
  user: { username: 'alice', email: 'alice@example.com', is_application_admin: false },
};

function renderPage() {
  return render(
    <AuthContext.Provider value={SIGNED_IN_USER}>
      <MemoryRouter>
        <AccountUnpublishedPieces />
      </MemoryRouter>
    </AuthContext.Provider>,
  );
}

describe('AccountUnpublishedPieces (#944)', () => {
  it('lists retained pieces across kinds with their purge-eligible date', async () => {
    mockedFetch.mockResolvedValue({
      unpublished_grace_days: 30,
      pieces: [
        {
          kind: 'project',
          public_id: 'p1',
          title: 'My animation',
          unpublished_at: '2026-01-01T00:00:00Z',
          purge_eligible_at: '2026-01-31T00:00:00Z',
          editor_url: '/users/@alice/edit/my-animation',
        },
        {
          kind: 'art_piece',
          public_id: 'p2',
          title: 'My generated piece',
          unpublished_at: '2026-01-05T00:00:00Z',
          purge_eligible_at: '2026-02-04T00:00:00Z',
          editor_url: null,
        },
      ],
    });

    renderPage();

    expect(await screen.findByRole('link', { name: 'My animation' })).toHaveAttribute(
      'href',
      '/users/@alice/edit/my-animation',
    );
    expect(screen.getByText('My generated piece')).toBeVisible();
    expect(screen.getByText(/2D animation/)).toBeVisible();
    expect(screen.getByText(/Generated piece/)).toBeVisible();
  });

  it('shows an empty state when nothing is retained', async () => {
    mockedFetch.mockResolvedValue({ unpublished_grace_days: 30, pieces: [] });
    renderPage();

    expect(await screen.findByText('You have no unpublished pieces awaiting purge.')).toBeVisible();
  });

  it('shows an error message if the list fails to load', async () => {
    mockedFetch.mockRejectedValue(new Error('network error'));
    renderPage();

    expect(
      await screen.findByText('Could not load your retained unpublished pieces.'),
    ).toBeVisible();
  });
});
