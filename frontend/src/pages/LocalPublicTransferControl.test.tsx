import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { AuthContext } from '../auth/context';
import { ApiError } from '../api/client';
import * as artPiecesApi from '../api/artPieces';
import * as pieceIntake from '../api/pieceIntake';
import * as projects3dApi from '../api/projects3d';
import * as storageUsageApi from '../api/storageUsage';
import * as localPackage from '../storage/localPiecePackage';
import * as repository from '../storage/localProjectRepository';
import type { LocalProjectRecord } from '../storage/localProjectRepository';
import LocalPublicTransferControl from './LocalPublicTransferControl';

vi.mock('../storage/localProjectRepository', async () => {
  const actual = await vi.importActual<typeof import('../storage/localProjectRepository')>(
    '../storage/localProjectRepository',
  );
  return {
    ...actual,
    getProject: vi.fn(),
    listPieceVersions: vi.fn(),
    updateProject: vi.fn(),
    openLocalProjectDatabase: vi.fn(),
  };
});
vi.mock('../storage/localPiecePackage', async () => {
  const actual = await vi.importActual<typeof import('../storage/localPiecePackage')>(
    '../storage/localPiecePackage',
  );
  return { ...actual, buildLocalPiecePackage: vi.fn() };
});
vi.mock('../api/pieceIntake', () => ({ intakePiecePackage: vi.fn() }));
vi.mock('../api/storageUsage', () => ({ fetchStorageEstimate: vi.fn() }));
vi.mock('../api/artPieces', async () => {
  const actual = await vi.importActual<typeof import('../api/artPieces')>('../api/artPieces');
  return { ...actual, updateArtPiece: vi.fn() };
});
vi.mock('../api/projects3d', async () => {
  const actual = await vi.importActual<typeof import('../api/projects3d')>('../api/projects3d');
  return { ...actual, publishProject3D: vi.fn() };
});

const mockedGetProject = vi.mocked(repository.getProject);
const mockedVersions = vi.mocked(repository.listPieceVersions);
const mockedUpdateProject = vi.mocked(repository.updateProject);
const mockedOpen = vi.mocked(repository.openLocalProjectDatabase);
const mockedBuild = vi.mocked(localPackage.buildLocalPiecePackage);
const mockedIntake = vi.mocked(pieceIntake.intakePiecePackage);
const mockedEstimate = vi.mocked(storageUsageApi.fetchStorageEstimate);
const mockedPublish3d = vi.mocked(projects3dApi.publishProject3D);
const mockedUpdateArtPiece = vi.mocked(artPiecesApi.updateArtPiece);
const db = { close: vi.fn() } as unknown as IDBDatabase;

const baseProject = {
  id: 'local-1',
  ownerId: 'alice',
  title: 'Local piece',
  sceneOrder: [],
  activeSceneId: null,
  createdAt: '2026-01-01T00:00:00Z',
  updatedAt: '2026-01-01T00:00:00Z',
  kind: '3d' as const,
  versionOrder: ['v1'],
  currentVersionId: 'v1',
};

function renderControl(project: LocalProjectRecord = baseProject) {
  const onProjectUpdated = vi.fn();
  render(
    <AuthContext.Provider
      value={{
        status: 'signed-in',
        user: { username: 'alice', email: 'alice@example.com', is_application_admin: false },
      }}
    >
      <MemoryRouter initialEntries={['/local-projects-3d/local-1']}>
        <Routes>
          <Route
            path="/local-projects-3d/:id"
            element={
              <LocalPublicTransferControl project={project} onProjectUpdated={onProjectUpdated} />
            }
          />
          <Route path="/users/:handle/edit/:slug" element={<p>Server editor</p>} />
        </Routes>
      </MemoryRouter>
    </AuthContext.Provider>,
  );
  return onProjectUpdated;
}

beforeEach(() => {
  vi.clearAllMocks();
  mockedOpen.mockResolvedValue(db);
  mockedGetProject.mockResolvedValue(baseProject);
  mockedVersions.mockResolvedValue([
    {
      id: 'v1',
      projectId: 'local-1',
      sequence: 1,
      payload: { objects: [] },
      byteSize: 20,
      createdAt: '2026-01-01T00:00:00Z',
    },
  ]);
  mockedBuild.mockResolvedValue({
    bytes: new Uint8Array([1, 2]),
    pieceBytes: 13,
    mediaBytes: 9,
    mediaFiles: 2,
    missingAssets: [],
  });
  mockedEstimate.mockResolvedValue({
    remaining_after: { private: { bytes: 100, files: 10 }, public: { bytes: 100, files: 10 } },
    fits: { private: true, public: true },
  });
  mockedIntake.mockResolvedValue({
    kind: '3d',
    public_id: 'remote-1',
    version: 1,
    visibility: 'private',
    media_count: 0,
  });
  mockedUpdateProject.mockResolvedValue({
    ...baseProject,
    cloudSyncState: 'synced',
    remotePublicId: 'remote-1',
    remoteVersion: 1,
  });
  mockedPublish3d.mockResolvedValue({ editor_url: '/users/alice/edit/remote-1' } as never);
  mockedUpdateArtPiece.mockResolvedValue({ public_id: 'remote-1' } as never);
});

describe('LocalPublicTransferControl', () => {
  it.each(['3d', 'generated'] as const)(
    'validates and transfers a local %s piece',
    async (kind) => {
      const user = userEvent.setup();
      const project = { ...baseProject, kind } as LocalProjectRecord;
      mockedGetProject.mockResolvedValue(project);
      renderControl(project);

      await user.click(screen.getByRole('button', { name: 'Make public' }));
      expect(screen.getByRole('button', { name: 'Publish' })).toBeDisabled();
      await user.type(screen.getByLabelText('Description'), 'A public piece.');
      await user.click(screen.getByRole('button', { name: 'Publish' }));

      expect(mockedBuild).toHaveBeenCalledWith(db, 'alice', 'local-1', {
        title: 'Local piece',
        description: 'A public piece.',
      });
      expect(mockedEstimate).toHaveBeenCalledWith({
        pieceBytes: 13,
        mediaBytes: 9,
        pieceFiles: 1,
        mediaFiles: 2,
      });
      if (kind === '3d') {
        expect(mockedPublish3d).toHaveBeenCalledWith('remote-1');
      } else {
        expect(mockedUpdateArtPiece).toHaveBeenCalledWith('remote-1', {
          title: 'Local piece',
          description: 'A public piece.',
          status: 'published',
        });
      }
      expect(mockedUpdateProject).toHaveBeenCalledWith(
        db,
        'alice',
        'local-1',
        expect.objectContaining({ cloudSyncState: 'synced', remotePublicId: 'remote-1' }),
      );
      if (kind === '3d') expect(await screen.findByText('Server editor')).toBeVisible();
    },
  );

  it('keeps the local piece synced when publish fails after intake', async () => {
    const user = userEvent.setup();
    mockedPublish3d.mockRejectedValue(new Error('server unavailable'));
    renderControl();

    await user.click(screen.getByRole('button', { name: 'Make public' }));
    await user.type(screen.getByLabelText('Description'), 'A public piece.');
    await user.click(screen.getByRole('button', { name: 'Publish' }));

    expect(await screen.findByRole('alert')).toHaveTextContent('server unavailable');
    expect(mockedUpdateProject).toHaveBeenCalledWith(
      db,
      'alice',
      'local-1',
      expect.objectContaining({ cloudSyncState: 'synced', remotePublicId: 'remote-1' }),
    );
  });

  it('shows a specific package-intake validation response and keeps Make public available', async () => {
    const user = userEvent.setup();
    mockedIntake.mockRejectedValue(
      new ApiError(400, { detail: 'Generated source does not match its declared engine.' }),
    );
    mockedUpdateProject.mockResolvedValue(baseProject);
    renderControl({ ...baseProject, kind: 'generated' });

    await user.click(screen.getByRole('button', { name: 'Make public' }));
    await user.type(screen.getByLabelText('Description'), 'A public piece.');
    await user.click(screen.getByRole('button', { name: 'Publish' }));

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Could not publish: Generated source does not match its declared engine.',
    );
    expect(screen.getByRole('button', { name: 'Make public' })).toBeVisible();
    expect(mockedUpdateProject).not.toHaveBeenCalled();
    expect(mockedPublish3d).not.toHaveBeenCalled();
    expect(mockedUpdateArtPiece).not.toHaveBeenCalled();
  });
});
