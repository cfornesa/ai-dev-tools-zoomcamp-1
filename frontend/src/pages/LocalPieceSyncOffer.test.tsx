import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { AuthContext } from '../auth/context';
import * as cloudSyncApi from '../api/cloudSyncPreference';
import * as pieceIntakeApi from '../api/pieceIntake';
import * as storageUsageApi from '../api/storageUsage';
import * as localPackage from '../storage/localPiecePackage';
import * as repository from '../storage/localProjectRepository';
import LocalPieceSyncOffer from './LocalPieceSyncOffer';

vi.mock('../api/cloudSyncPreference', () => ({ fetchCloudSyncPreference: vi.fn() }));
vi.mock('../api/pieceIntake', () => ({ intakePiecePackage: vi.fn() }));
vi.mock('../api/storageUsage', () => ({ fetchStorageEstimate: vi.fn() }));
vi.mock('../storage/localProjectRepository', async () => {
  const actual = await vi.importActual<typeof import('../storage/localProjectRepository')>(
    '../storage/localProjectRepository',
  );
  return {
    ...actual,
    listProjectsForOwner: vi.fn(),
    openLocalProjectDatabase: vi.fn(),
    updateProject: vi.fn(),
  };
});
vi.mock('../storage/localPiecePackage', async () => {
  const actual = await vi.importActual<typeof import('../storage/localPiecePackage')>(
    '../storage/localPiecePackage',
  );
  return {
    ...actual,
    buildLocalPiecePackage: vi.fn(),
    measureLocalPiecePackage: vi.fn(),
  };
});

const mockedPreference = vi.mocked(cloudSyncApi.fetchCloudSyncPreference);
const mockedIntake = vi.mocked(pieceIntakeApi.intakePiecePackage);
const mockedEstimate = vi.mocked(storageUsageApi.fetchStorageEstimate);
const mockedProjects = vi.mocked(repository.listProjectsForOwner);
const mockedOpen = vi.mocked(repository.openLocalProjectDatabase);
const mockedUpdate = vi.mocked(repository.updateProject);
const mockedBuild = vi.mocked(localPackage.buildLocalPiecePackage);
const mockedMeasure = vi.mocked(localPackage.measureLocalPiecePackage);
const db = { close: vi.fn() } as unknown as IDBDatabase;

const projects = [
  {
    id: 'p1',
    ownerId: 'alice',
    title: 'First piece',
    sceneOrder: ['s1'],
    activeSceneId: 's1',
    createdAt: '2026-01-01T00:00:00Z',
    updatedAt: '2026-01-01T00:00:00Z',
  },
  {
    id: 'p2',
    ownerId: 'alice',
    title: 'Second piece',
    sceneOrder: ['s2'],
    activeSceneId: 's2',
    createdAt: '2026-01-01T00:00:00Z',
    updatedAt: '2026-01-02T00:00:00Z',
  },
];
const measurements = {
  p1: { pieceBytes: 7, mediaBytes: 3, mediaFiles: 1, missingAssets: [] },
  p2: { pieceBytes: 11, mediaBytes: 5, mediaFiles: 2, missingAssets: [] },
};

function renderOffer() {
  return render(
    <AuthContext.Provider
      value={{
        status: 'signed-in',
        user: { username: 'alice', email: 'alice@example.com', is_application_admin: false },
      }}
    >
      <LocalPieceSyncOffer />
    </AuthContext.Provider>,
  );
}

beforeEach(() => {
  vi.clearAllMocks();
  mockedPreference.mockResolvedValue({
    eligible: true,
    reason: null,
    source: 'admin',
    enabled: true,
    signup_preselected: false,
    consent_version: 'v1',
    consent_text: 'Sync consent',
    existing_local_pieces_offered_by: 'account',
    retention_days_after_disable: 30,
  });
  mockedOpen.mockResolvedValue(db);
  mockedProjects.mockResolvedValue(projects as never);
  mockedMeasure.mockImplementation(
    async (_db, _ownerId, projectId) => measurements[projectId as keyof typeof measurements],
  );
  mockedBuild.mockImplementation(async (_db, _ownerId, projectId) => ({
    bytes: new Uint8Array([1, 2, 3]),
    ...measurements[projectId as keyof typeof measurements],
  }));
  mockedEstimate.mockResolvedValue({
    remaining_after: { private: { bytes: 100, files: 10 }, public: { bytes: 100, files: 10 } },
    fits: { private: true, public: true },
  });
  mockedIntake.mockResolvedValue({
    kind: '2d',
    public_id: 'remote-piece',
    version: 1,
    visibility: 'private',
    media_count: 1,
  });
  mockedUpdate.mockImplementation(async (_db, _ownerId, id, patch) => ({
    ...projects.find((project) => project.id === id)!,
    ...patch,
  }));
});

describe('LocalPieceSyncOffer quota accounting (#1099)', () => {
  it('sums expanded piece and media bytes in the preview and uses the same measurements per upload', async () => {
    const user = userEvent.setup();
    renderOffer();

    await screen.findByText(/First piece/);
    const checkboxes = screen.getAllByRole('checkbox');
    await user.click(checkboxes[1]);
    await user.click(checkboxes[2]);

    const aggregate = {
      pieceBytes: 18,
      mediaBytes: 8,
      pieceFiles: 2,
      mediaFiles: 3,
    };
    await waitFor(() => expect(mockedEstimate).toHaveBeenCalledWith(aggregate));
    expect(await screen.findByText(/Selected total: 26 B/)).toBeVisible();

    await user.click(screen.getByRole('button', { name: 'Upload selected pieces' }));
    expect((await screen.findAllByText(/Uploaded and verified/)).length).toBe(2);
    await waitFor(() => expect(mockedIntake).toHaveBeenCalledTimes(2));
    expect(mockedEstimate).toHaveBeenCalledWith({
      pieceBytes: 7,
      mediaBytes: 3,
      pieceFiles: 1,
      mediaFiles: 1,
    });
    expect(mockedEstimate).toHaveBeenCalledWith({
      pieceBytes: 11,
      mediaBytes: 5,
      pieceFiles: 1,
      mediaFiles: 2,
    });
  });

  it('blocks an over-quota row before upload', async () => {
    mockedEstimate.mockResolvedValue({
      remaining_after: { private: { bytes: 0, files: 0 }, public: { bytes: 0, files: 0 } },
      fits: { private: false, public: false },
    });
    const user = userEvent.setup();
    renderOffer();

    await screen.findByText(/First piece/);
    await user.click(screen.getAllByRole('checkbox')[1]);
    await user.click(screen.getByRole('button', { name: 'Upload selected pieces' }));

    expect(await screen.findByText(/Over quota; 0 B remains/i)).toBeVisible();
    expect(mockedIntake).not.toHaveBeenCalled();
    expect(mockedEstimate).toHaveBeenCalledWith({
      pieceBytes: 7,
      mediaBytes: 3,
      pieceFiles: 1,
      mediaFiles: 1,
    });
  });
});
