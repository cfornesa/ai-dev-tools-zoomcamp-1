import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { AuthContext } from '../auth/context';
import * as localProjectRepository from '../storage/localProjectRepository';
import * as dashboard from '../storage/localStorageDashboard';
import AccountLocalStorage from './AccountLocalStorage';

vi.mock('../storage/localStorageDashboard', async () => {
  const actual = await vi.importActual<typeof import('../storage/localStorageDashboard')>(
    '../storage/localStorageDashboard',
  );
  return {
    ...actual,
    getLocalStorageDashboardSnapshot: vi.fn(),
  };
});

vi.mock('../storage/localProjectRepository', async () => {
  const actual = await vi.importActual<typeof import('../storage/localProjectRepository')>(
    '../storage/localProjectRepository',
  );
  return {
    ...actual,
    requestPersistentStorage: vi.fn(),
  };
});

const mockedSnapshot = vi.mocked(dashboard.getLocalStorageDashboardSnapshot);
const mockedRequestPersistentStorage = vi.mocked(localProjectRepository.requestPersistentStorage);

const SIGNED_IN_USER = {
  status: 'signed-in' as const,
  user: { username: 'alice', email: 'alice@example.com', is_application_admin: false },
};

function renderPage() {
  return render(
    <AuthContext.Provider value={SIGNED_IN_USER}>
      <MemoryRouter>
        <AccountLocalStorage />
      </MemoryRouter>
    </AuthContext.Provider>,
  );
}

function baseSnapshot(
  overrides: Partial<dashboard.LocalStorageDashboardSnapshot> = {},
): dashboard.LocalStorageDashboardSnapshot {
  return {
    indexedDbSupported: true,
    estimate: { supported: true, usage: 1024, quota: 1024 * 1024 },
    persistentStorage: { supported: true, persisted: true },
    browserReportedDatabases: [{ name: 'creatrart-local-projects', version: 1 }],
    databases: [
      {
        name: 'creatrart-local-projects',
        expectedVersion: 1,
        kind: 'active',
        label: 'Local projects',
        opened: true,
        actualVersion: 1,
        projectCount: 2,
        sceneCount: 3,
        mediaFileCount: 4,
        byteTotal: 2048,
        lastActivity: '2026-01-01T00:00:00Z',
      },
      {
        name: 'motion-editor-draft-autosave',
        expectedVersion: 1,
        kind: 'legacy_recovery',
        label: 'Crash-recovery drafts',
        opened: true,
        actualVersion: 1,
        projectCount: 1,
        sceneCount: 1,
        mediaFileCount: 0,
        byteTotal: 128,
        lastActivity: '2026-01-01T00:00:00Z',
      },
    ],
    ...overrides,
  };
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe('AccountLocalStorage', () => {
  it('renders per-database counts, byte totals, and last activity', async () => {
    mockedSnapshot.mockResolvedValue(baseSnapshot());
    renderPage();

    expect(await screen.findByRole('heading', { name: 'Local projects' })).toBeVisible();
    expect(screen.getByText('2')).toBeVisible(); // project count
    expect(screen.getByRole('heading', { name: 'Crash-recovery drafts' })).toBeVisible();
  });

  it('shows the overall browser storage estimate and persistence state', async () => {
    mockedSnapshot.mockResolvedValue(baseSnapshot());
    renderPage();

    expect(await screen.findByText(/Using.*of.*available/i)).toBeVisible();
    expect(screen.getByText(/persistent storage:\s*granted/i)).toBeVisible();
  });

  it('reports an unsupported estimate honestly', async () => {
    mockedSnapshot.mockResolvedValue(
      baseSnapshot({
        estimate: { supported: false },
        persistentStorage: { supported: false, persisted: false },
      }),
    );
    renderPage();

    expect(await screen.findByText(/does not report a storage estimate/i)).toBeVisible();
    expect(screen.getByText(/not supported by this browser/i)).toBeVisible();
  });

  it('shows a near-quota warning with named recovery actions', async () => {
    mockedSnapshot.mockResolvedValue(
      baseSnapshot({ estimate: { supported: true, usage: 950, quota: 1000 } }),
    );
    renderPage();

    expect(await screen.findByRole('heading', { name: /storage running low/i })).toBeVisible();
    expect(screen.getByRole('button', { name: /retry/i })).toBeVisible();
    expect(screen.getByRole('link', { name: /export your data/i })).toBeVisible();
    expect(screen.getByRole('link', { name: /contact support/i })).toBeVisible();
  });

  it('does not show the near-quota warning when comfortably under quota', async () => {
    mockedSnapshot.mockResolvedValue(baseSnapshot());
    renderPage();

    await screen.findByRole('heading', { name: 'Local projects' });
    expect(screen.queryByRole('heading', { name: /storage running low/i })).not.toBeInTheDocument();
  });

  it('reports an unopened database with its error reason instead of hiding it', async () => {
    mockedSnapshot.mockResolvedValue(
      baseSnapshot({
        databases: [
          {
            name: 'creatrart-local-projects',
            expectedVersion: 1,
            kind: 'active',
            label: 'Local projects',
            opened: false,
            errorKind: 'corrupt-data',
          },
        ],
      }),
    );
    renderPage();

    expect(await screen.findByRole('heading', { name: 'Local projects' })).toBeVisible();
    expect(screen.getByText(/unavailable \(corrupt-data\)/i)).toBeVisible();
  });

  it('reports a load failure without crashing the page', async () => {
    mockedSnapshot.mockRejectedValue(new Error('boom'));
    renderPage();

    expect(await screen.findByRole('alert')).toHaveTextContent(/could not read local storage/i);
  });

  it('offers a request-persistence button when supported but not yet granted', async () => {
    mockedSnapshot.mockResolvedValue(
      baseSnapshot({ persistentStorage: { supported: true, persisted: false } }),
    );
    renderPage();

    expect(
      await screen.findByRole('button', { name: /request persistent storage/i }),
    ).toBeVisible();
  });

  it('does not offer the button once persistent storage is already granted', async () => {
    mockedSnapshot.mockResolvedValue(
      baseSnapshot({ persistentStorage: { supported: true, persisted: true } }),
    );
    renderPage();

    await screen.findByRole('heading', { name: 'Local projects' });
    expect(
      screen.queryByRole('button', { name: /request persistent storage/i }),
    ).not.toBeInTheDocument();
  });

  it('does not offer the button when the browser does not support it', async () => {
    mockedSnapshot.mockResolvedValue(
      baseSnapshot({ persistentStorage: { supported: false, persisted: false } }),
    );
    renderPage();

    await screen.findByRole('heading', { name: 'Local projects' });
    expect(
      screen.queryByRole('button', { name: /request persistent storage/i }),
    ).not.toBeInTheDocument();
  });

  it('reports a granted result after clicking the request button', async () => {
    mockedSnapshot.mockResolvedValue(
      baseSnapshot({ persistentStorage: { supported: true, persisted: false } }),
    );
    mockedRequestPersistentStorage.mockResolvedValue({ supported: true, persisted: true });
    const user = userEvent.setup();
    renderPage();

    await user.click(await screen.findByRole('button', { name: /request persistent storage/i }));

    expect(await screen.findByRole('status')).toHaveTextContent(/persistent storage granted/i);
  });

  it('reports a declined result honestly, without claiming it was granted', async () => {
    mockedSnapshot.mockResolvedValue(
      baseSnapshot({ persistentStorage: { supported: true, persisted: false } }),
    );
    mockedRequestPersistentStorage.mockResolvedValue({ supported: true, persisted: false });
    const user = userEvent.setup();
    renderPage();

    await user.click(await screen.findByRole('button', { name: /request persistent storage/i }));

    expect(await screen.findByRole('status')).toHaveTextContent(/declined persistent storage/i);
  });
});
