import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import * as accountExportApi from '../api/accountExport';
import { AuthContext } from '../auth/context';
import AccountDataExport from './AccountDataExport';

vi.mock('../api/accountExport', async () => {
  const actual =
    await vi.importActual<typeof import('../api/accountExport')>('../api/accountExport');
  return {
    ...actual,
    fetchAccountExport: vi.fn(),
  };
});

const mockedFetch = vi.mocked(accountExportApi.fetchAccountExport);

const SIGNED_IN_USER = {
  status: 'signed-in' as const,
  user: { username: 'alice', email: 'alice@example.com', is_application_admin: false },
};

const SAMPLE_EXPORT: accountExportApi.AccountExport = {
  schema_version: 1,
  profile: { username: 'alice', email: 'alice@example.com' },
  identities: [],
  entitlement: { plan_key: 'free', features: [], reset_at: '2026-01-02T00:00:00Z' },
  subscription: null,
  ai_credentials: { mistral_configured: false, provider_credentials: [] },
  projects: [],
  projects_3d: [],
  art_pieces: [],
};

function renderPage() {
  return render(
    <AuthContext.Provider value={SIGNED_IN_USER}>
      <MemoryRouter>
        <AccountDataExport />
      </MemoryRouter>
    </AuthContext.Provider>,
  );
}

beforeEach(() => {
  vi.clearAllMocks();
  URL.createObjectURL = vi.fn(() => 'blob:mock-url');
  URL.revokeObjectURL = vi.fn();
});

describe('AccountDataExport', () => {
  it('downloads the export and shows a success message', async () => {
    mockedFetch.mockResolvedValue(SAMPLE_EXPORT);
    renderPage();

    await userEvent.click(screen.getByTestId('account-export-download'));

    expect(await screen.findByText('Your export has downloaded.')).toBeInTheDocument();
    expect(mockedFetch).toHaveBeenCalledTimes(1);
    expect(URL.createObjectURL).toHaveBeenCalledTimes(1);
    expect(URL.revokeObjectURL).toHaveBeenCalledWith('blob:mock-url');
  });

  it('shows an actionable error when the export fails', async () => {
    mockedFetch.mockRejectedValue(new Error('boom'));
    renderPage();

    await userEvent.click(screen.getByTestId('account-export-download'));

    expect(
      await screen.findByText('Could not generate your data export. Please try again.'),
    ).toBeInTheDocument();
    expect(screen.queryByText('Your export has downloaded.')).not.toBeInTheDocument();
  });
});
