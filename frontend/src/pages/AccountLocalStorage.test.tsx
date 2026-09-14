import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { AuthContext } from '../auth/context';
import * as localDatabaseArchive from '../storage/localDatabaseArchive';
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
    openLocalProjectDatabase: vi.fn(),
    listProjectsForOwner: vi.fn(),
    listScenesForProject: vi.fn(),
    getProjectUsage: vi.fn(),
    deleteProject: vi.fn(),
  };
});

vi.mock('../storage/localDatabaseArchive', async () => {
  const actual = await vi.importActual<typeof import('../storage/localDatabaseArchive')>(
    '../storage/localDatabaseArchive',
  );
  return {
    ...actual,
    exportDatabaseArchive: vi.fn(),
    inspectDatabaseArchive: vi.fn(),
    restoreDatabaseArchive: vi.fn(),
  };
});

const mockedOpenDb = vi.mocked(localProjectRepository.openLocalProjectDatabase);
const mockedListProjects = vi.mocked(localProjectRepository.listProjectsForOwner);
const mockedDeleteProject = vi.mocked(localProjectRepository.deleteProject);
const mockedListScenesForProject = vi.mocked(localProjectRepository.listScenesForProject);
const mockedGetProjectUsage = vi.mocked(localProjectRepository.getProjectUsage);
const mockedExportArchive = vi.mocked(localDatabaseArchive.exportDatabaseArchive);
const mockedRestoreArchive = vi.mocked(localDatabaseArchive.restoreDatabaseArchive);
const mockedInspectArchive = vi.mocked(localDatabaseArchive.inspectDatabaseArchive);

const FAKE_DB = { close: vi.fn() } as unknown as IDBDatabase;

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
  mockedOpenDb.mockResolvedValue(FAKE_DB);
  mockedListProjects.mockResolvedValue([]);
  mockedListScenesForProject.mockResolvedValue([]);
  mockedGetProjectUsage.mockResolvedValue({ bytesUsed: 0, fileCount: 0 });
  mockedInspectArchive.mockResolvedValue({
    formatVersion: 1,
    projectCount: 2,
    sceneCount: 3,
    mediaFileCount: 1,
    byteTotal: 100,
    projects: [
      {
        index: 0,
        title: 'Imported A',
        sceneCount: 2,
        mediaFileCount: 1,
        byteTotal: 100,
        checksums: ['abc'],
      },
      {
        index: 1,
        title: 'Imported B',
        sceneCount: 1,
        mediaFileCount: 0,
        byteTotal: 0,
        checksums: [],
      },
    ],
  });
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
    expect(screen.getByText(/Estimated remaining origin capacity: 1023.0 KB/i)).toBeVisible();
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

function fakeProject(overrides: Partial<localProjectRepository.LocalProjectRecord> = {}) {
  return {
    id: 'p1',
    ownerId: 'alice',
    title: 'My Project',
    sceneOrder: [],
    activeSceneId: null,
    createdAt: '2026-01-01T00:00:00Z',
    updatedAt: '2026-01-01T00:00:00Z',
    ...overrides,
  };
}

describe('AccountLocalStorage: manage local projects', () => {
  it('lists local projects with export and delete controls', async () => {
    mockedSnapshot.mockResolvedValue(baseSnapshot());
    mockedListProjects.mockResolvedValue([fakeProject()]);
    renderPage();

    expect(await screen.findByRole('listitem', { name: 'My Project' })).toBeVisible();
  });

  it('shows no local projects yet when the database is empty', async () => {
    mockedSnapshot.mockResolvedValue(baseSnapshot());
    mockedListProjects.mockResolvedValue([]);
    renderPage();

    expect(await screen.findByText('No local projects yet.')).toBeVisible();
    expect(screen.getByRole('button', { name: /export entire database/i })).toBeDisabled();
  });

  it('exports one project via a button click', async () => {
    mockedSnapshot.mockResolvedValue(baseSnapshot());
    mockedListProjects.mockResolvedValue([fakeProject()]);
    mockedExportArchive.mockResolvedValue({
      blob: new Blob(['zip'], { type: 'application/zip' }),
      projectCount: 1,
      sceneCount: 1,
      mediaFileCount: 0,
      byteTotal: 0,
    });
    const user = userEvent.setup();
    renderPage();

    await user.click(await screen.findByRole('button', { name: 'Export' }));

    expect(mockedExportArchive).toHaveBeenCalledWith(FAKE_DB, 'alice', { projectIds: ['p1'] });
    expect(await screen.findByText(/exported "my project"/i)).toBeVisible();
  });

  it('exports the whole database via its own button', async () => {
    mockedSnapshot.mockResolvedValue(baseSnapshot());
    mockedListProjects.mockResolvedValue([fakeProject()]);
    mockedExportArchive.mockResolvedValue({
      blob: new Blob(['zip'], { type: 'application/zip' }),
      projectCount: 1,
      sceneCount: 2,
      mediaFileCount: 3,
      byteTotal: 100,
    });
    const user = userEvent.setup();
    renderPage();

    await user.click(await screen.findByRole('button', { name: /export entire database/i }));

    expect(mockedExportArchive).toHaveBeenCalledWith(FAKE_DB, 'alice');
    expect(
      await screen.findByText(/exported 1 project\(s\), 2 scene\(s\), 3 media file\(s\)/i),
    ).toBeVisible();
  });

  it('names exact scope and shows real scene/media/byte counts before deleting (issue #527)', async () => {
    mockedSnapshot.mockResolvedValue(baseSnapshot());
    mockedListProjects.mockResolvedValue([fakeProject()]);
    mockedListScenesForProject.mockResolvedValue([
      { id: 's1', projectId: 'p1', name: 'Scene 1', position: 0, sceneJson: {}, updatedAt: '' },
      { id: 's2', projectId: 'p1', name: 'Scene 2', position: 1, sceneJson: {}, updatedAt: '' },
    ]);
    mockedGetProjectUsage.mockResolvedValue({ bytesUsed: 2048, fileCount: 3 });
    const user = userEvent.setup();
    renderPage();

    await user.click(await screen.findByRole('button', { name: 'Delete' }));

    const confirmText = screen.getByRole('alert');
    expect(confirmText).toHaveTextContent('2 scene(s)');
    expect(confirmText).toHaveTextContent('3 media file(s)');
    expect(confirmText).toHaveTextContent('2.0 KB');
    expect(confirmText).toHaveTextContent(/not synced to the cloud/i);
  });

  it('explains that external browser-data clearing bypasses the app and cannot be detected', async () => {
    mockedSnapshot.mockResolvedValue(baseSnapshot());
    renderPage();

    expect(await screen.findByText(/no website can reliably detect or prevent it/i)).toBeVisible();
  });

  it('requires an explicit confirmation before deleting a project, and cancel changes nothing', async () => {
    mockedSnapshot.mockResolvedValue(baseSnapshot());
    mockedListProjects.mockResolvedValue([fakeProject()]);
    const user = userEvent.setup();
    renderPage();

    await user.click(await screen.findByRole('button', { name: 'Delete' }));
    expect(screen.getByText(/delete "my project" permanently\?/i)).toBeVisible();

    await user.click(screen.getByRole('button', { name: 'Cancel' }));
    expect(mockedDeleteProject).not.toHaveBeenCalled();
    expect(screen.queryByText(/delete "my project" permanently\?/i)).not.toBeInTheDocument();
  });

  it('deletes a project only after confirming', async () => {
    mockedSnapshot.mockResolvedValue(baseSnapshot());
    mockedListProjects.mockResolvedValue([fakeProject()]);
    mockedDeleteProject.mockResolvedValue(undefined);
    const user = userEvent.setup();
    renderPage();

    await user.click(await screen.findByRole('button', { name: 'Delete' }));
    await user.click(screen.getByRole('button', { name: 'Confirm delete' }));

    expect(mockedDeleteProject).toHaveBeenCalledWith(FAKE_DB, 'alice', 'p1');
    expect(await screen.findByText(/deleted "my project"/i)).toBeVisible();
  });

  it('previews and restores selected projects into a named workspace', async () => {
    mockedSnapshot.mockResolvedValue(baseSnapshot());
    mockedListProjects.mockResolvedValue([]);
    mockedRestoreArchive.mockResolvedValue({
      projects: [],
      projectCount: 1,
      sceneCount: 2,
      mediaFileCount: 0,
    });
    const user = userEvent.setup();
    renderPage();

    const file = new File(['zip-bytes'], 'archive.zip', { type: 'application/zip' });
    const input = await screen.findByLabelText(/restore from a zip archive/i);
    await user.upload(input, file);

    expect(await screen.findByRole('heading', { name: 'Archive preview' })).toBeVisible();
    await user.type(screen.getByLabelText('New workspace name'), 'Imported workspace');
    await user.click(screen.getByRole('button', { name: /restore selected projects/i }));

    expect(await screen.findByText(/restored 1 project\(s\), 2 scene\(s\)/i)).toBeVisible();
    expect(mockedRestoreArchive).toHaveBeenCalledWith(FAKE_DB, 'alice', expect.any(Uint8Array), {
      projectIndices: [0, 1],
    });
  });

  it('reports a restore failure without changing local data', async () => {
    mockedSnapshot.mockResolvedValue(baseSnapshot());
    mockedListProjects.mockResolvedValue([]);
    mockedInspectArchive.mockRejectedValue(new Error('corrupt'));
    const user = userEvent.setup();
    renderPage();

    const file = new File(['not-a-zip'], 'bad.zip', { type: 'application/zip' });
    const input = await screen.findByLabelText(/restore from a zip archive/i);
    await user.upload(input, file);

    expect(await screen.findByText(/could not inspect that archive/i)).toBeVisible();
  });
});
