import { beforeEach, describe, expect, it, vi } from 'vitest';

import * as artPiecesApi from '../api/artPieces';
import * as pieceIntake from '../api/pieceIntake';
import * as projects3dApi from '../api/projects3d';
import * as storageUsageApi from '../api/storageUsage';
import * as localPiecePackage from './localPiecePackage';
import * as repository from './localProjectRepository';
import { LocalPublicTransferError, publishLocalPiece } from './localPublicTransfer';

vi.mock('./localProjectRepository', async () => {
  const actual = await vi.importActual<typeof import('./localProjectRepository')>(
    './localProjectRepository',
  );
  return {
    ...actual,
    getProject: vi.fn(),
    listPieceVersions: vi.fn(),
    updateProject: vi.fn(),
  };
});
vi.mock('./localPiecePackage', async () => {
  const actual = await vi.importActual<typeof import('./localPiecePackage')>('./localPiecePackage');
  return { ...actual, buildLocalPiecePackage: vi.fn() };
});
vi.mock('../api/pieceIntake', () => ({ intakePiecePackage: vi.fn() }));
vi.mock('../api/storageUsage', () => ({ fetchStorageEstimate: vi.fn() }));
vi.mock('../api/projects3d', () => ({ publishProject3D: vi.fn() }));
vi.mock('../api/artPieces', () => ({ updateArtPiece: vi.fn() }));

const mockedGetProject = vi.mocked(repository.getProject);
const mockedVersions = vi.mocked(repository.listPieceVersions);
const mockedUpdateProject = vi.mocked(repository.updateProject);
const mockedBuild = vi.mocked(localPiecePackage.buildLocalPiecePackage);
const mockedIntake = vi.mocked(pieceIntake.intakePiecePackage);
const mockedEstimate = vi.mocked(storageUsageApi.fetchStorageEstimate);
const mockedPublish3d = vi.mocked(projects3dApi.publishProject3D);
const mockedUpdateArtPiece = vi.mocked(artPiecesApi.updateArtPiece);

const project = {
  id: 'local-1',
  ownerId: 'alice',
  title: 'Local piece',
  description: 'Stored description',
  sceneOrder: [],
  activeSceneId: null,
  createdAt: '2026-01-01T00:00:00Z',
  updatedAt: '2026-01-01T00:00:00Z',
  kind: '3d' as const,
  versionOrder: ['v1'],
  currentVersionId: 'v1',
};

describe('local public transfer quota accounting', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockedGetProject.mockResolvedValue(project);
    mockedVersions.mockResolvedValue([
      {
        id: 'v1',
        projectId: project.id,
        sequence: 1,
        payload: { label: '雪' },
        byteSize: 13,
        createdAt: project.updatedAt,
      },
    ]);
    mockedBuild.mockResolvedValue({
      // Deliberately unlike expanded content, to catch archive-length accounting.
      bytes: new Uint8Array(200),
      pieceBytes: new TextEncoder().encode('{"label":"雪"}').byteLength,
      mediaBytes: 9,
      mediaFiles: 2,
      missingAssets: [],
    });
    mockedEstimate.mockResolvedValue({
      remaining_after: { private: { bytes: 10, files: 10 }, public: { bytes: 10, files: 10 } },
      fits: { private: true, public: true },
    });
    mockedIntake.mockResolvedValue({
      kind: '3d',
      public_id: 'remote-1',
      version: 1,
      visibility: 'private',
      media_count: 2,
    });
    mockedUpdateProject.mockResolvedValue({ ...project, cloudSyncState: 'synced' });
    mockedPublish3d.mockResolvedValue({ editor_url: '/users/alice/edit/remote-1' } as never);
    mockedUpdateArtPiece.mockResolvedValue({ public_id: 'remote-1' } as never);
  });

  it('allows a fitting media-bearing transfer and submits expanded bytes and actual file counts', async () => {
    await publishLocalPiece({} as IDBDatabase, 'alice', project.id, project.title, 'Public copy');

    expect(mockedEstimate).toHaveBeenCalledWith({
      pieceBytes: new TextEncoder().encode('{"label":"雪"}').byteLength,
      mediaBytes: 9,
      pieceFiles: 1,
      mediaFiles: 2,
    });
    expect(mockedIntake).toHaveBeenCalledWith(new Uint8Array(200), expect.any(String));
    expect(mockedPublish3d).toHaveBeenCalledWith('remote-1');
  });

  it('blocks a transfer whose expanded content does not fit before upload', async () => {
    mockedEstimate.mockResolvedValue({
      remaining_after: { private: { bytes: 0, files: 0 }, public: { bytes: 0, files: 0 } },
      fits: { private: false, public: false },
    });

    await expect(
      publishLocalPiece({} as IDBDatabase, 'alice', project.id, project.title, 'Public copy'),
    ).rejects.toMatchObject({ kind: 'over-quota' } satisfies Partial<LocalPublicTransferError>);
    expect(mockedIntake).not.toHaveBeenCalled();
    expect(mockedPublish3d).not.toHaveBeenCalled();
  });
});
