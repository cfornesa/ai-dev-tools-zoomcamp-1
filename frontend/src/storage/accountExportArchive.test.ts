import { beforeEach, describe, expect, it, vi } from 'vitest';

const api = vi.hoisted(() => ({
  fetchAccountExport: vi.fn(),
  listProjects: vi.fn(),
  listProjects3D: vi.fn(),
  listArtPieces: vi.fn(),
  listSceneVersions3D: vi.fn(),
  listArtPieceVersions: vi.fn(),
  openLocalProjectDatabase: vi.fn(),
  listProjectsForOwner: vi.fn(),
  buildLocalPiecePackage: vi.fn(),
  buildServer2dPiecePackage: vi.fn(),
  buildServer3dPiecePackage: vi.fn(),
  buildServerGeneratedPiecePackage: vi.fn(),
}));

vi.mock('../api/accountExport', () => ({ fetchAccountExport: api.fetchAccountExport }));
vi.mock('../api/projects', () => ({ listProjects: api.listProjects }));
vi.mock('../api/projects3d', () => ({
  listProjects3D: api.listProjects3D,
  listSceneVersions3D: api.listSceneVersions3D,
}));
vi.mock('../api/artPieces', () => ({
  listArtPieces: api.listArtPieces,
  listArtPieceVersions: api.listArtPieceVersions,
}));
vi.mock('./localProjectRepository', () => ({
  openLocalProjectDatabase: api.openLocalProjectDatabase,
  listProjectsForOwner: api.listProjectsForOwner,
}));
vi.mock('./localPiecePackage', () => ({ buildLocalPiecePackage: api.buildLocalPiecePackage }));
vi.mock('./server2dPiecePackage', () => ({
  buildServer2dPiecePackage: api.buildServer2dPiecePackage,
}));
vi.mock('./server3dPiecePackage', () => ({
  buildServer3dPiecePackage: api.buildServer3dPiecePackage,
}));
vi.mock('./serverGeneratedPiecePackage', () => ({
  buildServerGeneratedPiecePackage: api.buildServerGeneratedPiecePackage,
}));

import { buildAccountExportArchive } from './accountExportArchive';

const account = {
  schema_version: 1,
  profile: { username: 'alice', email: 'alice@example.com' },
  identities: [],
  entitlement: { plan_key: 'free', features: [], reset_at: '2026-01-01T00:00:00Z' },
  subscription: null,
  ai_credentials: { mistral_configured: false, provider_credentials: [] },
  projects: [],
  projects_3d: [],
  art_pieces: [],
};

describe('account-wide export archive', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    api.fetchAccountExport.mockResolvedValue(account);
    api.listProjects.mockResolvedValue([]);
    api.listProjects3D.mockResolvedValue([]);
    api.listArtPieces.mockResolvedValue([]);
    api.openLocalProjectDatabase.mockResolvedValue({ close: vi.fn() });
    api.listProjectsForOwner.mockResolvedValue([
      { id: 'local-1', ownerId: 'alice', title: 'Local one', kind: '2d' },
      { id: 'local-2', ownerId: 'alice', title: 'Local two', kind: '2d' },
    ]);
    api.buildLocalPiecePackage
      .mockResolvedValueOnce({ bytes: new Uint8Array([1, 2, 3]) })
      .mockRejectedValueOnce(new Error('missing local blob'));
  });

  it('retains successful packages and records per-piece failures in a partial export', async () => {
    const progress: string[] = [];
    const result = await buildAccountExportArchive('alice', ({ label }) => progress.push(label));

    expect(result.packageCount).toBe(1);
    expect(result.failures).toEqual([{ label: 'Local: Local two', reason: 'missing local blob' }]);
    expect(result.byteSize).toBeGreaterThan(0);
    expect(progress.at(-1)).toBe('Finalizing ZIP');
    expect(api.openLocalProjectDatabase.mock.results[0]?.value).toBeDefined();
  });
});
