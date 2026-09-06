import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import * as accountSessionsApi from '../api/accountSessions';
import { AuthContext } from '../auth/context';
import AccountSessions from './AccountSessions';

vi.mock('../api/accountSessions', async () => {
  const actual =
    await vi.importActual<typeof import('../api/accountSessions')>('../api/accountSessions');
  return {
    ...actual,
    fetchAccountSessions: vi.fn(),
    revokeAccountSession: vi.fn(),
  };
});

const mockedFetch = vi.mocked(accountSessionsApi.fetchAccountSessions);
const mockedRevoke = vi.mocked(accountSessionsApi.revokeAccountSession);

const SIGNED_IN_USER = {
  status: 'signed-in' as const,
  user: { username: 'alice', email: 'alice@example.com', is_application_admin: false },
};

function renderPage() {
  return render(
    <AuthContext.Provider value={SIGNED_IN_USER}>
      <MemoryRouter>
        <AccountSessions />
      </MemoryRouter>
    </AuthContext.Provider>,
  );
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe('AccountSessions', () => {
  it('lists sessions and marks the current one', async () => {
    mockedFetch.mockResolvedValue([
      {
        public_id: 'abc',
        is_current: true,
        user_agent: 'Chrome on macOS',
        created_at: '2026-01-01T00:00:00Z',
        expires_at: '2026-02-01T00:00:00Z',
      },
      {
        public_id: 'def',
        is_current: false,
        user_agent: 'Firefox on Linux',
        created_at: '2026-01-02T00:00:00Z',
        expires_at: '2026-02-02T00:00:00Z',
      },
    ]);
    renderPage();

    expect(await screen.findByText('Chrome on macOS')).toBeInTheDocument();
    expect(screen.getByText('(this device)')).toBeInTheDocument();
    expect(screen.getByText('Firefox on Linux')).toBeInTheDocument();
  });

  it('requires confirmation before revoking a non-current session', async () => {
    mockedFetch.mockResolvedValue([
      {
        public_id: 'def',
        is_current: false,
        user_agent: 'Firefox on Linux',
        created_at: '2026-01-02T00:00:00Z',
        expires_at: '2026-02-02T00:00:00Z',
      },
    ]);
    mockedRevoke.mockResolvedValue({ revoked: true, was_current: false });
    renderPage();

    await userEvent.click(await screen.findByRole('button', { name: 'Revoke' }));
    expect(screen.getByText('Revoke this session?')).toBeInTheDocument();
    expect(mockedRevoke).not.toHaveBeenCalled();

    await userEvent.click(screen.getByRole('button', { name: 'Confirm' }));
    expect(mockedRevoke).toHaveBeenCalledWith('def');
    expect(screen.queryByText('Firefox on Linux')).not.toBeInTheDocument();
  });

  it('cancel leaves the session untouched', async () => {
    mockedFetch.mockResolvedValue([
      {
        public_id: 'def',
        is_current: false,
        user_agent: 'Firefox on Linux',
        created_at: '2026-01-02T00:00:00Z',
        expires_at: '2026-02-02T00:00:00Z',
      },
    ]);
    renderPage();

    await userEvent.click(await screen.findByRole('button', { name: 'Revoke' }));
    await userEvent.click(screen.getByRole('button', { name: 'Cancel' }));

    expect(screen.queryByText('Revoke this session?')).not.toBeInTheDocument();
    expect(screen.getByText('Firefox on Linux')).toBeInTheDocument();
    expect(mockedRevoke).not.toHaveBeenCalled();
  });

  it('shows an actionable error when revoke fails', async () => {
    mockedFetch.mockResolvedValue([
      {
        public_id: 'def',
        is_current: false,
        user_agent: 'Firefox on Linux',
        created_at: '2026-01-02T00:00:00Z',
        expires_at: '2026-02-02T00:00:00Z',
      },
    ]);
    mockedRevoke.mockRejectedValue(new Error('boom'));
    renderPage();

    await userEvent.click(await screen.findByRole('button', { name: 'Revoke' }));
    await userEvent.click(screen.getByRole('button', { name: 'Confirm' }));

    expect(
      await screen.findByText('Could not revoke this session. Please try again.'),
    ).toBeInTheDocument();
    // The session is still listed since the revoke failed.
    expect(screen.getByText('Firefox on Linux')).toBeInTheDocument();
  });
});
