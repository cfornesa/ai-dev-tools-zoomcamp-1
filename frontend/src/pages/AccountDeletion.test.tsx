import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import * as accountDeletionApi from '../api/accountDeletion';
import { ApiError } from '../api/client';
import { AuthContext } from '../auth/context';
import AccountDeletion from './AccountDeletion';

vi.mock('../api/accountDeletion', async () => {
  const actual =
    await vi.importActual<typeof import('../api/accountDeletion')>('../api/accountDeletion');
  return {
    ...actual,
    deleteAccount: vi.fn(),
  };
});

const mockedDeleteAccount = vi.mocked(accountDeletionApi.deleteAccount);

const SIGNED_IN_USER = {
  status: 'signed-in' as const,
  user: { username: 'alice', email: 'alice@example.com', is_application_admin: false },
};

function renderPage() {
  return render(
    <AuthContext.Provider value={SIGNED_IN_USER}>
      <MemoryRouter>
        <AccountDeletion />
      </MemoryRouter>
    </AuthContext.Provider>,
  );
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe('AccountDeletion', () => {
  it('keeps the submit button disabled until the exact confirmation text is typed', async () => {
    renderPage();
    const submit = screen.getByTestId('account-deletion-submit');
    expect(submit).toBeDisabled();

    await userEvent.type(screen.getByLabelText(/type "delete" to confirm/i), 'not it');
    expect(submit).toBeDisabled();

    await userEvent.clear(screen.getByLabelText(/type "delete" to confirm/i));
    await userEvent.type(screen.getByLabelText(/type "delete" to confirm/i), 'DELETE');
    expect(submit).toBeEnabled();
  });

  it('never calls the server when Cancel is clicked', async () => {
    renderPage();
    await userEvent.type(screen.getByLabelText(/current password/i), 'hunter2');
    await userEvent.type(screen.getByLabelText(/type "delete" to confirm/i), 'DELETE');

    await userEvent.click(screen.getByTestId('account-deletion-cancel'));

    expect(mockedDeleteAccount).not.toHaveBeenCalled();
  });

  it('submits the password and confirmation and shows a reauthentication error', async () => {
    mockedDeleteAccount.mockRejectedValue(
      new ApiError(400, { error: 'reauthentication_required', detail: 'wrong password' }),
    );
    renderPage();

    await userEvent.type(screen.getByLabelText(/current password/i), 'wrong-password');
    await userEvent.type(screen.getByLabelText(/type "delete" to confirm/i), 'DELETE');
    await userEvent.click(screen.getByTestId('account-deletion-submit'));

    expect(mockedDeleteAccount).toHaveBeenCalledWith('DELETE', 'wrong-password');
    await screen.findByTestId('account-deletion-error');
    expect(screen.getByTestId('account-deletion-error')).toHaveTextContent(
      /current password is required/i,
    );
  });

  it('submits with no password for an OAuth-only account', async () => {
    mockedDeleteAccount.mockResolvedValue(undefined);
    renderPage();

    await userEvent.type(screen.getByLabelText(/type "delete" to confirm/i), 'DELETE');
    await userEvent.click(screen.getByTestId('account-deletion-submit'));

    expect(mockedDeleteAccount).toHaveBeenCalledWith('DELETE', undefined);
  });

  it('shows a confirmation-mismatch error distinctly from a reauthentication error', async () => {
    mockedDeleteAccount.mockRejectedValue(
      new ApiError(400, { error: 'confirmation_mismatch', detail: 'nope' }),
    );
    renderPage();

    await userEvent.type(screen.getByLabelText(/type "delete" to confirm/i), 'DELETE');
    await userEvent.click(screen.getByTestId('account-deletion-submit'));

    await screen.findByTestId('account-deletion-error');
    expect(screen.getByTestId('account-deletion-error')).toHaveTextContent(/type "delete"/i);
  });
});
