import { beforeEach, describe, expect, it, vi } from 'vitest';

import type { LocalProjectRecord } from './localProjectRepository';

const repository = vi.hoisted(() => ({
  getProject: vi.fn(),
  listPieceVersions: vi.fn(),
  listScenesForProject: vi.fn(),
  openLocalProjectDatabase: vi.fn(),
  updateProject: vi.fn(),
}));
const capture = vi.hoisted(() => ({ captureSocialThumbnail: vi.fn() }));

vi.mock('./localProjectRepository', () => repository);
vi.mock('../export/captureSocialThumbnail', () => capture);
vi.mock('../generative/artPieceThumbnailCapture', () => ({
  captureSandboxScreenshot: vi.fn(),
}));
vi.mock('../generative/artPieceSandbox', () => ({
  buildArtPieceSandboxDocument: vi.fn(() => '<!doctype html>'),
}));

import { ensureLocalThumbnail } from './localThumbnail';

function project(overrides: Partial<LocalProjectRecord> = {}): LocalProjectRecord {
  return {
    id: 'project-1',
    ownerId: 'owner-1',
    title: 'Local project',
    sceneOrder: ['scene-1'],
    activeSceneId: 'scene-1',
    createdAt: '2026-09-30T00:00:00.000Z',
    updatedAt: '2026-09-30T00:00:01.000Z',
    kind: '2d',
    versionOrder: [],
    currentVersionId: null,
    ...overrides,
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  repository.openLocalProjectDatabase.mockResolvedValue({ close: vi.fn() });
  repository.getProject.mockImplementation(async (_db, _owner, id) => project({ id }));
  repository.listScenesForProject.mockResolvedValue([
    { id: 'scene-1', projectId: 'project-1', sceneJson: {}, position: 0 },
  ]);
  repository.updateProject.mockImplementation(async (_db, _owner, _id, patch) => project(patch));
  capture.captureSocialThumbnail.mockResolvedValue(new Blob(['source'], { type: 'image/png' }));
  vi.stubGlobal(
    'Image',
    class MockImage {
      width = 1200;
      height = 630;
      set src(_value: string) {
        queueMicrotask(() => this.onload?.());
      }
      onload?: () => void;
      onerror?: () => void;
    },
  );
  vi.spyOn(URL, 'createObjectURL').mockReturnValue('blob:local-thumbnail');
  vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => undefined);
  vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue({
    drawImage: vi.fn(),
  } as unknown as CanvasRenderingContext2D);
  vi.spyOn(HTMLCanvasElement.prototype, 'toBlob').mockImplementation((callback) => {
    callback(new Blob(['thumbnail'], { type: 'image/png' }));
  });
});

describe('ensureLocalThumbnail', () => {
  it('does nothing for an existing thumbnail', async () => {
    const existing = project({ thumbnail: new Blob(['thumbnail']) });
    expect(await ensureLocalThumbnail(existing)).toBe(existing);
    expect(repository.openLocalProjectDatabase).not.toHaveBeenCalled();
  });

  it('captures and persists a missing 2D thumbnail without blocking callers', async () => {
    const result = await ensureLocalThumbnail(project());
    expect(capture.captureSocialThumbnail).toHaveBeenCalledOnce();
    expect(repository.updateProject).toHaveBeenCalledWith(
      expect.anything(),
      'owner-1',
      'project-1',
      expect.objectContaining({ thumbnailUpdatedAt: expect.any(String) }),
    );
    expect(result?.thumbnail).toBeDefined();
    expect(result?.thumbnail?.size).toBeLessThanOrEqual(60 * 1024);
  });

  it('records 3D as unsupported capture without mutating the project', async () => {
    expect(await ensureLocalThumbnail(project({ kind: '3d' }))).toBeNull();
    expect(repository.openLocalProjectDatabase).not.toHaveBeenCalled();
  });
});
