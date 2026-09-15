import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { AuthContext } from '../auth/context';
import * as repository from '../storage/localProjectRepository';
import * as mutationOutbox from '../storage/mutationOutbox';
import * as mediaTransferRepository from '../storage/mediaTransferRepository';
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
  };
});

const mockedOpen = vi.mocked(repository.openLocalProjectDatabase);
const mockedGetProject = vi.mocked(repository.getProject);
const mockedListScenes = vi.mocked(repository.listScenesForProject);
const mockedListAssets = vi.mocked(repository.listMediaAssetsForProject);
const mockedUpdateScene = vi.mocked(repository.updateScene);
const mockedListMutationOutbox = vi.spyOn(mutationOutbox, 'listMutationOutbox');
const mockedListMediaTransfers = vi.spyOn(mediaTransferRepository, 'listMediaTransfersForProject');
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
});
