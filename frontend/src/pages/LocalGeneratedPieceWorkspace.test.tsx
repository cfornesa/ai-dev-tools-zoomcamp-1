import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { AuthContext } from '../auth/context';
import * as profileApi from '../api/profile';
import * as repository from '../storage/localProjectRepository';
import LocalGeneratedPieceWorkspace from './LocalGeneratedPieceWorkspace';

vi.mock('../storage/localProjectRepository', async () => {
  const actual = await vi.importActual<typeof import('../storage/localProjectRepository')>(
    '../storage/localProjectRepository',
  );
  return {
    ...actual,
    openLocalProjectDatabase: vi.fn(),
    getProjectWithOwnerFallback: vi.fn(),
    listPieceVersions: vi.fn(),
    updateProject: vi.fn(),
  };
});
vi.mock('../api/profile');

const mockedOpen = vi.mocked(repository.openLocalProjectDatabase);
const mockedGetProject = vi.mocked(repository.getProjectWithOwnerFallback);
const mockedListVersions = vi.mocked(repository.listPieceVersions);
const mockedUpdateProject = vi.mocked(repository.updateProject);
const mockedFetchProfile = vi.mocked(profileApi.fetchProfile);
const db = { close: vi.fn() } as unknown as IDBDatabase;
const project = {
  id: 'piece-1',
  ownerId: 'alice',
  title: 'Local generated SVG',
  description: '',
  kind: 'generated',
  currentVersionId: 'version-1',
};
const version = {
  id: 'version-1',
  projectId: 'piece-1',
  sequence: 1,
  payload: { source: '<svg />', engine: 'svg' },
};

function renderPage() {
  return render(
    <AuthContext.Provider
      value={{
        status: 'signed-in',
        user: { username: 'alice', email: 'alice@example.com', is_application_admin: false },
      }}
    >
      <MemoryRouter initialEntries={['/local-generated/piece-1']}>
        <Routes>
          <Route path="/local-generated/:id" element={<LocalGeneratedPieceWorkspace />} />
        </Routes>
      </MemoryRouter>
    </AuthContext.Provider>,
  );
}

beforeEach(() => {
  vi.clearAllMocks();
  mockedOpen.mockResolvedValue(db);
  mockedFetchProfile.mockResolvedValue({ handle: 'alice-public' } as never);
  mockedGetProject.mockResolvedValue(project as never);
  mockedListVersions.mockResolvedValue([version] as never);
  mockedUpdateProject.mockImplementation((_db, _ownerId, _id, patch) =>
    Promise.resolve({ ...project, ...patch } as never),
  );
});

describe('LocalGeneratedPieceWorkspace title editing', () => {
  it('saves the title to local storage and shows the updated heading', async () => {
    const user = userEvent.setup();
    renderPage();

    await user.click(await screen.findByRole('button', { name: 'Edit title' }));
    const title = screen.getByRole('textbox', { name: 'Title' });
    await user.clear(title);
    await user.type(title, 'DEPLOY-CHECK-2026-10-05-25');
    await user.click(screen.getByRole('button', { name: 'Save title' }));

    expect(mockedUpdateProject).toHaveBeenCalledWith(db, 'alice', 'piece-1', {
      title: 'DEPLOY-CHECK-2026-10-05-25',
    });
    expect(
      await screen.findByRole('heading', { name: 'DEPLOY-CHECK-2026-10-05-25' }),
    ).toBeVisible();
    expect(screen.getByRole('status')).toHaveTextContent(/saved locally/i);
  });

  it('rejects a blank title without updating local storage', async () => {
    const user = userEvent.setup();
    renderPage();

    await user.click(await screen.findByRole('button', { name: 'Edit title' }));
    await user.clear(screen.getByRole('textbox', { name: 'Title' }));
    await user.click(screen.getByRole('button', { name: 'Save title' }));

    expect(await screen.findByRole('alert')).toHaveTextContent(/title cannot be blank/i);
    expect(mockedUpdateProject).not.toHaveBeenCalled();
  });
});
