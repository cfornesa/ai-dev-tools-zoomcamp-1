import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import * as accountIdentitiesApi from '../api/accountIdentities';
import { ApiError } from '../api/client';
import { AuthContext } from '../auth/context';
import AccountIdentities from './AccountIdentities';

vi.mock('../api/accountIdentities', async () => {
  const actual = await vi.importActual<typeof import('../api/accountIdentities')>(
    '../api/accountIdentities',
  );
  return {
    ...actual,
    fetchAccountIdentities: vi.fn(),
    unlinkAccountIdentity: vi.fn(),
  };
});

const mockedFetch = vi.mocked(accountIdentitiesApi.fetchAccountIdentities);
const mockedUnlink = vi.mocked(accountIdentitiesApi.unlinkAccountIdentity);

const SIGNED_IN_USER = {
  status: 'signed-in' as const,
  user: { username: 'alice', email: 'alice@example.com', is_application_admin: false },
};

function renderPage() {
  return render(
    <AuthContext.Provider value={SIGNED_IN_USER}>
      <MemoryRouter>
        <AccountIdentities />
      </MemoryRouter>
    </AuthContext.Provider>,
  );
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe('AccountIdentities', () => {
  it('lists linked providers and offers to connect an unlinked one', async () => {
    mockedFetch.mockResolvedValue([
      { provider: 'google', enabled: true, connected_at: '2026-01-01T00:00:00Z' },
    ]);
    renderPage();

    expect(await screen.findByText('Google')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Connect GitHub' })).toBeInTheDocument();
  });

  it('flags a currently disabled provider without hiding it', async () => {
    mockedFetch.mockResolvedValue([
      { provider: 'github', enabled: false, connected_at: '2026-01-01T00:00:00Z' },
    ]);
    renderPage();

    expect(await screen.findByText('GitHub')).toBeInTheDocument();
    expect(screen.getByText(/currently disabled site-wide/)).toBeInTheDocument();
  });

  it('disconnects a provider on confirmation and shows a success message', async () => {
    mockedFetch.mockResolvedValue([
      { provider: 'google', enabled: true, connected_at: '2026-01-01T00:00:00Z' },
      { provider: 'github', enabled: true, connected_at: '2026-01-01T00:00:00Z' },
    ]);
    mockedUnlink.mockResolvedValue([
      { provider: 'google', enabled: true, connected_at: '2026-01-01T00:00:00Z' },
    ]);
    renderPage();

    const disconnectButtons = await screen.findAllByRole('button', { name: 'Disconnect' });
    await userEvent.click(disconnectButtons[1]);

    expect(await screen.findByText('GitHub disconnected.')).toBeInTheDocument();
    expect(mockedUnlink).toHaveBeenCalledWith('github');
  });

  it('shows an actionable error when unlinking the only usable method is rejected', async () => {
    mockedFetch.mockResolvedValue([
      { provider: 'google', enabled: true, connected_at: '2026-01-01T00:00:00Z' },
    ]);
    mockedUnlink.mockRejectedValue(new ApiError(409, { error: 'cannot_unlink' }));
    renderPage();

    const disconnectButton = await screen.findByRole('button', { name: 'Disconnect' });
    await userEvent.click(disconnectButton);

    expect(
      await screen.findByText('You cannot remove your only usable sign-in method.'),
    ).toBeInTheDocument();
  });

  it('surfaces a load failure without crashing', async () => {
    mockedFetch.mockRejectedValue(new Error('network down'));
    renderPage();

    expect(
      await screen.findByText('Could not load your linked sign-in methods.'),
    ).toBeInTheDocument();
  });
});
