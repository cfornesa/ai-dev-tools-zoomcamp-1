import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { AuthContext } from '../auth/context';
import * as repository from '../storage/localProjectRepository';
import * as mutationOutbox from '../storage/mutationOutbox';
import * as mediaTransferRepository from '../storage/mediaTransferRepository';
import * as localPiecePackage from '../storage/localPiecePackage';
import * as pieceIntake from '../api/pieceIntake';
import * as projectsApi from '../api/projects';
import * as storageUsageApi from '../api/storageUsage';
import LocalEditorWorkspace from './LocalEditorWorkspace';

vi.mock('../storage/localProjectRepository', async () => {
  const actual = await vi.importActual<typeof import('../storage/localProjectRepository')>(
    '../storage/localProjectRepository',
  );
  return {
    ...actual,
    openLocalProjectDatabase: vi.fn(),
    getProject: vi.fn(),
    listScenesForProject: vi.fn(),
    listMediaAssetsForProject: vi.fn(),
    updateScene: vi.fn(),
    updateProject: vi.fn(),
    getProjectStorageUsage: vi.fn(),
  };
});
vi.mock('../storage/localPiecePackage', async () => {
  const actual = await vi.importActual<typeof import('../storage/localPiecePackage')>(
    '../storage/localPiecePackage',
  );
  return { ...actual, buildLocal2dPiecePackage: vi.fn() };
});
vi.mock('../api/pieceIntake', () => ({ intakePiecePackage: vi.fn() }));
vi.mock('../api/storageUsage', () => ({ fetchStorageEstimate: vi.fn() }));
vi.mock('../api/projects', async () => {
  const actual = await vi.importActual<typeof import('../api/projects')>('../api/projects');
  return { ...actual, publishProject: vi.fn() };
});

const mockedOpen = vi.mocked(repository.openLocalProjectDatabase);
const mockedGetProject = vi.mocked(repository.getProject);
const mockedListScenes = vi.mocked(repository.listScenesForProject);
const mockedListAssets = vi.mocked(repository.listMediaAssetsForProject);
const mockedUpdateScene = vi.mocked(repository.updateScene);
const mockedUpdateProject = vi.mocked(repository.updateProject);
const mockedGetUsage = vi.mocked(repository.getProjectStorageUsage);
const mockedListMutationOutbox = vi.spyOn(mutationOutbox, 'listMutationOutbox');
const mockedListMediaTransfers = vi.spyOn(mediaTransferRepository, 'listMediaTransfersForProject');
const mockedBuildPackage = vi.mocked(localPiecePackage.buildLocal2dPiecePackage);
const mockedIntake = vi.mocked(pieceIntake.intakePiecePackage);
const mockedPublish = vi.mocked(projectsApi.publishProject);
const mockedEstimate = vi.mocked(storageUsageApi.fetchStorageEstimate);
const db = { close: vi.fn() } as unknown as IDBDatabase;

const project = {
  id: 'p1',
  ownerId: 'alice',
  title: 'Local project',
  sceneOrder: ['s1'],
  activeSceneId: 's1',
  createdAt: '2026-01-01T00:00:00Z',
  updatedAt: '2026-01-01T00:00:00Z',
};
const scene = {
  id: 's1',
  projectId: 'p1',
  name: 'Opening scene',
  position: 0,
  sceneJson: { shapes: [] },
  updatedAt: '2026-01-01T00:00:00Z',
};
const asset = {
  id: 'a1',
  projectId: 'p1',
  mimeType: 'image/png',
  byteSize: 8,
  checksum: 'abc123',
  filename: 'evidence.png',
  altText: 'evidence',
  createdAt: '2026-01-01T00:00:00Z',
  refCount: 1,
};

function renderPage() {
  return render(
    <AuthContext.Provider
      value={{
        status: 'signed-in',
        user: { username: 'alice', email: 'alice@example.com', is_application_admin: false },
      }}
    >
      <MemoryRouter initialEntries={['/local-projects/p1']}>
        <Routes>
          <Route path="/local-projects/:id" element={<LocalEditorWorkspace />} />
          <Route path="/users/:handle/edit/:slug" element={<div>Server-backed editor</div>} />
        </Routes>
      </MemoryRouter>
    </AuthContext.Provider>,
  );
}

beforeEach(() => {
  vi.clearAllMocks();
  mockedOpen.mockResolvedValue(db);
  mockedGetProject.mockResolvedValue(project);
  mockedListScenes.mockResolvedValue([scene]);
  mockedListAssets.mockResolvedValue([asset]);
  mockedUpdateScene.mockResolvedValue({ ...scene, name: 'Renamed scene' });
  mockedListMutationOutbox.mockResolvedValue([]);
  mockedListMediaTransfers.mockResolvedValue([]);
  mockedUpdateProject.mockImplementation((_db, _ownerId, _id, patch) =>
    Promise.resolve({ ...project, ...patch }),
  );
  mockedGetUsage.mockResolvedValue({
    versionBytesUsed: 100,
    bytesUsed: 200,
    fileCount: 1,
  });
  mockedBuildPackage.mockResolvedValue({
    bytes: new Uint8Array([1, 2, 3]),
    missingAssets: [],
  });
  mockedEstimate.mockResolvedValue({
    remaining_after: { private: { bytes: 1000, files: 10 }, public: { bytes: 1000, files: 10 } },
    fits: { private: true, public: true },
  });
  mockedIntake.mockResolvedValue({
    kind: '2d',
    public_id: 'server-p1',
    version: 1,
    visibility: 'private',
    media_count: 0,
  });
  mockedPublish.mockResolvedValue({
    ...project,
    id: 'server-p1',
    editor_url: '/users/@alice/edit/local-project',
  } as unknown as Awaited<ReturnType<typeof projectsApi.publishProject>>);
});

describe('LocalEditorWorkspace', () => {
  it('loads a local project, scene, and media reference for the current owner', async () => {
    renderPage();

    expect(await screen.findByRole('heading', { name: 'Local project' })).toBeVisible();
    expect(screen.getByLabelText('Scene name')).toHaveValue('Opening scene');
    expect(screen.getByText(/evidence\.png/)).toBeVisible();
    expect(mockedGetProject).toHaveBeenCalledWith(db, 'alice', 'p1');
  });

  it('requires saving or cancelling before switching local scene context', async () => {
    const user = userEvent.setup();
    renderPage();

    const input = await screen.findByLabelText('Scene name');
    await user.clear(input);
    await user.type(input, 'Unsaved scene');

    expect(screen.getByRole('button', { name: 'Save local changes' })).toBeEnabled();
    expect(screen.getByRole('button', { name: 'Cancel changes' })).toBeVisible();
    expect(screen.getByRole('button', { name: 'Save durable checkpoint' })).toBeDisabled();
    await user.click(screen.getByRole('button', { name: 'Save local changes' }));

    expect(mockedUpdateScene).toHaveBeenCalledWith(db, 's1', { name: 'Unsaved scene' });
    expect(await screen.findByRole('status')).toHaveTextContent(/saved local scene changes/i);
    expect(screen.getByRole('button', { name: 'Save durable checkpoint' })).toBeEnabled();
  });

  it('offers accessible save, recovery, export, and cancel choices for dirty edits', async () => {
    const user = userEvent.setup();
    renderPage();

    const input = await screen.findByLabelText('Scene name');
    await user.clear(input);
    await user.type(input, 'Unsaved choice');

    expect(screen.getByRole('region', { name: 'Unsaved local changes' })).toBeVisible();
    expect(screen.getByRole('button', { name: 'Save now' })).toBeVisible();
    expect(screen.getByRole('button', { name: 'Recover draft' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Export ZIP' })).toBeVisible();
    expect(screen.getByRole('button', { name: 'Cancel edit' })).toBeVisible();

    await user.click(screen.getByRole('button', { name: 'Cancel edit' }));
    expect(mockedUpdateScene).toHaveBeenLastCalledWith(db, 's1', { name: 'Opening scene' });
    expect(screen.getByLabelText('Scene name')).toHaveValue('Opening scene');
    expect(screen.queryByRole('region', { name: 'Unsaved local changes' })).toBeNull();
  });

  it('does not expose a missing or foreign local project', async () => {
    mockedGetProject.mockResolvedValue(null);
    renderPage();

    expect(await screen.findByRole('heading', { name: 'Local project unavailable' })).toBeVisible();
    expect(
      screen.getByText(/missing from this browser or belongs to another local owner/i),
    ).toBeVisible();
  });

  describe('Make public (#942)', () => {
    it('blocks Publish until title and description are both present', async () => {
      const user = userEvent.setup();
      renderPage();

      await user.click(await screen.findByRole('button', { name: 'Make public' }));
      const publishButton = screen.getByRole('button', { name: 'Publish' });
      expect(publishButton).toBeDisabled();
      expect(screen.getByText(/add a description before publishing/i)).toBeVisible();

      await user.type(screen.getByLabelText('Description'), 'A short description.');
      expect(publishButton).toBeEnabled();

      await user.clear(screen.getByLabelText('Title'));
      expect(publishButton).toBeDisabled();
      expect(screen.getByText(/choose a meaningful title/i)).toBeVisible();
    });

    it('uploads and publishes a valid local-only piece, then navigates to the server-backed editor', async () => {
      const user = userEvent.setup();
      renderPage();

      await user.click(await screen.findByRole('button', { name: 'Make public' }));
      await user.type(screen.getByLabelText('Description'), 'A short description.');
      await user.click(screen.getByRole('button', { name: 'Publish' }));

      expect(await screen.findByText('Server-backed editor')).toBeVisible();
      expect(mockedBuildPackage).toHaveBeenCalledWith(
        db,
        'alice',
        'p1',
        undefined,
        'A short description.',
      );
      expect(mockedIntake).toHaveBeenCalledWith(new Uint8Array([1, 2, 3]), expect.any(String));
      expect(mockedPublish).toHaveBeenCalledWith('server-p1');
      expect(mockedUpdateProject).toHaveBeenCalledWith(db, 'alice', 'p1', {
        cloudSyncState: 'synced',
        remotePublicId: 'server-p1',
        remoteVersion: 1,
      });
    });

    it('refuses to upload over quota and leaves the local piece untouched', async () => {
      mockedEstimate.mockResolvedValue({
        remaining_after: { private: { bytes: 1000, files: 10 }, public: { bytes: 0, files: 0 } },
        fits: { private: true, public: false },
      });
      const user = userEvent.setup();
      renderPage();

      await user.click(await screen.findByRole('button', { name: 'Make public' }));
      await user.type(screen.getByLabelText('Description'), 'A short description.');
      await user.click(screen.getByRole('button', { name: 'Publish' }));

      expect(await screen.findByText(/over quota/i)).toBeVisible();
      expect(mockedIntake).not.toHaveBeenCalled();
      expect(mockedPublish).not.toHaveBeenCalled();
    });
  });
});
