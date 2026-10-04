import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import * as accountExportApi from '../api/accountExport';
import { AuthContext } from '../auth/context';
import AccountDataExport from './AccountDataExport';

const archive = vi.hoisted(() => ({ buildAccountExportArchive: vi.fn() }));
vi.mock('../storage/accountExportArchive', () => archive);

vi.mock('../api/accountExport', async () => {
  const actual =
    await vi.importActual<typeof import('../api/accountExport')>('../api/accountExport');
  return {
    ...actual,
    fetchAccountExport: vi.fn(),
  };
});

const mockedFetch = vi.mocked(accountExportApi.fetchAccountExport);
const mockedArchive = vi.mocked(archive.buildAccountExportArchive);

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
  mockedArchive.mockReset();
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

  it('prepares a complete ZIP, shows its size, and downloads it after review', async () => {
    mockedFetch.mockResolvedValue(SAMPLE_EXPORT);
    mockedArchive.mockImplementation(async (_owner, onProgress) => {
      onProgress?.({ completed: 1, total: 1, label: 'Finalizing ZIP' });
      return {
        blob: new Blob(['zip']),
        byteSize: 1234,
        account: SAMPLE_EXPORT,
        packageCount: 1,
        failures: [],
      };
    });
    renderPage();

    await userEvent.setup().click(screen.getByRole('button', { name: 'Prepare complete ZIP' }));
    expect(await screen.findByText(/1,234 bytes, 1 piece packages/)).toBeInTheDocument();
    expect(mockedArchive).toHaveBeenCalledWith('alice', expect.any(Function));
    await userEvent
      .setup()
      .click(screen.getByRole('button', { name: 'Download everything (ZIP)' }));
    expect(URL.createObjectURL).toHaveBeenCalledTimes(1);
  });
});
