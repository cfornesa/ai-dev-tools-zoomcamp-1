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
  return { ...actual, publishProject: vi.fn(), getProject: vi.fn(), getSceneVersion: vi.fn() };
});

const mockedOpen = vi.mocked(repository.openLocalProjectDatabase);
const mockedGetProject = vi.mocked(repository.getProject);
const mockedListScenes = vi.mocked(repository.listScenesForProject);
const mockedListAssets = vi.mocked(repository.listMediaAssetsForProject);
const mockedUpdateScene = vi.mocked(repository.updateScene);
const mockedUpdateProject = vi.mocked(repository.updateProject);
const mockedListMutationOutbox = vi.spyOn(mutationOutbox, 'listMutationOutbox');
const mockedListMediaTransfers = vi.spyOn(mediaTransferRepository, 'listMediaTransfersForProject');
const mockedBuildPackage = vi.mocked(localPiecePackage.buildLocal2dPiecePackage);
const mockedIntake = vi.mocked(pieceIntake.intakePiecePackage);
const mockedPublish = vi.mocked(projectsApi.publishProject);
const mockedGetRemoteProject = vi.mocked(projectsApi.getProject);
const mockedGetSceneVersion = vi.mocked(projectsApi.getSceneVersion);
const mockedEstimate = vi.mocked(storageUsageApi.fetchStorageEstimate);
const db = { close: vi.fn() } as unknown as IDBDatabase;

const project = {
  id: 'p1',
  ownerId: 'alice',
  title: 'Local project',
  description: 'Stored local description.',
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
  mockedBuildPackage.mockResolvedValue({
    bytes: new Uint8Array([1, 2, 3]),
    pieceBytes: 47,
    mediaBytes: 8,
    mediaFiles: 1,
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
  mockedGetRemoteProject.mockResolvedValue({
    ...project,
    id: 'server-p1',
    description: 'A short description.',
    current_version: 1,
  } as unknown as Awaited<ReturnType<typeof projectsApi.getProject>>);
  mockedGetSceneVersion.mockResolvedValue({
    id: 1,
    sequence: 1,
    origin: 'manual',
    change_label: null,
    created_by: 'alice',
    parent: null,
    fork_source_version: null,
    created_at: '2026-01-01T00:00:00Z',
    scene_json: { shapes: [{ id: 'shape-1', type: 'rect', mediaAssetId: 'a1' }] },
  });
});

describe('LocalEditorWorkspace', () => {
  it('edits and persists local title and description through the details control', async () => {
    const user = userEvent.setup();
    renderPage();

    await user.click(await screen.findByRole('button', { name: 'Edit project details' }));
    const title = screen.getByLabelText('Title');
    const description = screen.getByLabelText('Description');
    await user.clear(title);
    await user.type(title, 'Renamed local project');
    await user.clear(description);
    await user.type(description, 'A new local description.');
    await user.click(screen.getByRole('button', { name: 'Save project details' }));

    expect(mockedUpdateProject).toHaveBeenCalledWith(db, 'alice', 'p1', {
      title: 'Renamed local project',
      description: 'A new local description.',
    });
    expect(await screen.findByRole('heading', { name: 'Renamed local project' })).toBeVisible();
    expect(screen.getByRole('status')).toHaveTextContent(/saved local project details/i);
  });

  it('rejects the placeholder title with an accessible validation error', async () => {
    const user = userEvent.setup();
    renderPage();

    await user.click(await screen.findByRole('button', { name: 'Edit project details' }));
    const title = screen.getByLabelText('Title');
    await user.clear(title);
    await user.type(title, 'Untitled animation');
    await user.click(screen.getByRole('button', { name: 'Save project details' }));

    expect(await screen.findByRole('alert')).toHaveTextContent(/choose a title/i);
    expect(mockedUpdateProject).not.toHaveBeenCalledWith(
      db,
      'alice',
      'p1',
      expect.objectContaining({ title: 'Untitled animation' }),
    );
  });

  it('prefills the make-public description from local storage', async () => {
    const user = userEvent.setup();
    renderPage();

    await user.click(await screen.findByRole('button', { name: 'Make public' }));
    expect(screen.getByLabelText('Description')).toHaveValue('Stored local description.');
  });

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
      await user.clear(screen.getByLabelText('Description'));
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
      await user.clear(screen.getByLabelText('Description'));
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
      expect(mockedEstimate).toHaveBeenCalledWith({
        pieceBytes: 47,
        mediaBytes: 8,
        pieceFiles: 1,
        mediaFiles: 1,
      });
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
      expect(mockedEstimate).toHaveBeenCalledWith({
        pieceBytes: 47,
        mediaBytes: 8,
        pieceFiles: 1,
        mediaFiles: 1,
      });
      expect(mockedIntake).not.toHaveBeenCalled();
      expect(mockedPublish).not.toHaveBeenCalled();
    });
  });

  describe('Update public copy (#1051)', () => {
    const publishedProject = {
      ...project,
      cloudSyncState: 'synced' as const,
      remotePublicId: 'server-p1',
      remoteVersion: 1,
    };

    function prepareUpdateFixture() {
      mockedGetProject.mockResolvedValue(publishedProject);
      mockedListScenes.mockResolvedValue([
        {
          ...scene,
          sceneJson: {
            shapes: [{ id: 'shape-1', type: 'circle', mediaAssetId: 'a2' }],
          },
        },
      ]);
    }

    it('shows a deterministic scene/media diff before confirming', async () => {
      prepareUpdateFixture();
      const user = userEvent.setup();
      renderPage();

      await user.click(await screen.findByRole('button', { name: 'Update public copy' }));

      expect(
        await screen.findByText(/1 shape changed; 1 media asset added; 1 media asset removed/i),
      ).toBeVisible();
      expect(screen.getAllByRole('button', { name: 'Update public copy' }).at(-1)).toBeEnabled();
      expect(mockedIntake).not.toHaveBeenCalled();
    });

    it('uploads the current local state against the remote revision and advances remoteVersion', async () => {
      prepareUpdateFixture();
      mockedIntake.mockResolvedValue({
        kind: '2d',
        public_id: 'server-p1',
        version: 2,
        visibility: 'private',
        media_count: 1,
      });
      const user = userEvent.setup();
      renderPage();

      await user.click(await screen.findByRole('button', { name: 'Update public copy' }));
      const confirm = screen.getAllByRole('button', { name: 'Update public copy' }).at(-1)!;
      await user.click(confirm);

      expect(await screen.findByText(/updated the public copy to version 2/i)).toBeVisible();
      expect(mockedEstimate).toHaveBeenCalledWith({
        pieceBytes: 47,
        mediaBytes: 8,
        pieceFiles: 1,
        mediaFiles: 1,
      });
      expect(mockedIntake).toHaveBeenCalledWith(new Uint8Array([1, 2, 3]), expect.any(String), {
        pieceId: 'server-p1',
        expectedRevision: 1,
      });
      expect(mockedUpdateProject).toHaveBeenCalledWith(
        db,
        'alice',
        'p1',
        expect.objectContaining({ cloudSyncState: 'synced', remoteVersion: 2 }),
      );
    });

    it('leaves the prior local remoteVersion when the update upload fails', async () => {
      prepareUpdateFixture();
      mockedIntake.mockRejectedValue(new Error('upload failed'));
      const user = userEvent.setup();
      renderPage();

      await user.click(await screen.findByRole('button', { name: 'Update public copy' }));
      const confirm = screen.getAllByRole('button', { name: 'Update public copy' }).at(-1)!;
      await user.click(confirm);

      expect(await screen.findByRole('alert')).toHaveTextContent('upload failed');
      expect(mockedUpdateProject).not.toHaveBeenCalled();
    });
  });
});
