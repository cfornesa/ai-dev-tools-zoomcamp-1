import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { AuthContext } from '../auth/context';
import * as profileApi from '../api/profile';
import * as repository from '../storage/localProjectRepository';
import CreateChooser from './CreateChooser';

vi.mock('../api/profile');
vi.mock('../storage/localProjectRepository');

const mockedFetchProfile = vi.mocked(profileApi.fetchProfile);
const mockedOpen = vi.mocked(repository.openLocalProjectDatabase);
const mockedCreateProject = vi.mocked(repository.createProject);
const mockedCreateScene = vi.mocked(repository.createScene);
const mockedCreateLocal3D = vi.mocked(repository.createLocal3DProject);
const mockedCreateLocalGenerated = vi.mocked(repository.createLocalGeneratedProject);
const db = { close: vi.fn() } as unknown as IDBDatabase;

function renderChooser() {
  return render(
    <AuthContext.Provider
      value={{
        status: 'signed-in',
        user: {
          username: 'e2e_split',
          email: 'e2e-split@example.test',
          is_application_admin: false,
        },
      }}
    >
      <MemoryRouter initialEntries={['/create']}>
        <Routes>
          <Route path="/create" element={<CreateChooser />} />
          <Route path="/local-projects/:id" element={<p>Local editor placeholder</p>} />
          <Route path="/local-generated/:id" element={<p>Generated editor placeholder</p>} />
          <Route path="/users/@alice/edit/:slug" element={<p>Editor placeholder</p>} />
          <Route path="/templates" element={<p>Templates placeholder</p>} />
        </Routes>
      </MemoryRouter>
    </AuthContext.Provider>,
  );
}

beforeEach(() => {
  vi.clearAllMocks();
  mockedFetchProfile.mockResolvedValue({ handle: 'e2e_split_artist' } as never);
  mockedOpen.mockResolvedValue(db);
  mockedCreateProject.mockResolvedValue({
    id: 'local-id',
    ownerId: 'e2e_split',
    title: 'Untitled animation',
    sceneOrder: [],
    activeSceneId: null,
    createdAt: '2026-01-01',
    updatedAt: '2026-01-01',
    kind: '2d',
    versionOrder: [],
    currentVersionId: null,
  });
  mockedCreateScene.mockResolvedValue({} as never);
  mockedCreateLocal3D.mockResolvedValue({
    project: {
      id: 'new-3d-id',
      ownerId: 'e2e_split',
      title: 'Untitled 3D scene',
      sceneOrder: ['scene-3d'],
      activeSceneId: 'scene-3d',
      createdAt: '2026-01-01',
      updatedAt: '2026-01-01',
      kind: '3d',
      versionOrder: ['version-1'],
      currentVersionId: 'version-1',
    },
    scene: {} as never,
    version: {} as never,
  });
  mockedCreateLocalGenerated.mockResolvedValue({
    project: {
      id: 'new-generated-id',
      ownerId: 'e2e_split',
      title: 'Local generated SVG',
      sceneOrder: [],
      activeSceneId: null,
      createdAt: '2026-01-01',
      updatedAt: '2026-01-01',
      kind: 'generated',
      versionOrder: ['version-1'],
      currentVersionId: 'version-1',
    },
    scene: {} as never,
    version: {} as never,
  });
});

describe('CreateChooser (issue #268)', () => {
  it('shows one unified action for each editor family plus templates', () => {
    renderChooser();

    expect(screen.getByRole('heading', { name: /^create$/i })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: /^create a new 2d project$/i })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: /^create a new 3d project$/i })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: /^browse templates$/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /^create a new 2d project$/i })).toBeInTheDocument();
    expect(screen.getByText('Start a blank 2D scene in the manual editor.')).toBeInTheDocument();
    expect(screen.queryByText(/^create a new animation$/i)).not.toBeInTheDocument();
    expect(screen.getByRole('region', { name: 'Create' })).toHaveClass('page-shell');
  });

  it('creates a blank 2D project with the default renderer and navigates to the manual editor', async () => {
    const user = userEvent.setup();

    renderChooser();
    await user.click(screen.getAllByRole('button', { name: /^create a new 2d project$/i })[0]);

    await waitFor(() => expect(screen.getByText('Local editor placeholder')).toBeInTheDocument());
    expect(mockedCreateProject).toHaveBeenCalledWith(db, {
      ownerId: 'e2e_split',
      title: 'Untitled animation',
      kind: '2d',
    });
    expect(mockedCreateScene).toHaveBeenCalledWith(
      db,
      'e2e_split',
      expect.objectContaining({
        projectId: 'local-id',
        name: 'Scene 1',
      }),
    );
    expect(mockedFetchProfile).not.toHaveBeenCalled();
  });

  it('creates a 3D project under the username when the profile handle differs', async () => {
    const user = userEvent.setup();

    renderChooser();
    await user.click(screen.getAllByRole('button', { name: /^create a new 3d project$/i })[0]);

    await waitFor(() => expect(screen.getByText('Local editor placeholder')).toBeInTheDocument());
    expect(mockedCreateLocal3D).toHaveBeenCalledWith(
      db,
      expect.objectContaining({ ownerId: 'e2e_split' }),
    );
    expect(mockedFetchProfile).not.toHaveBeenCalled();
  });

  it('creates a generated piece under the username when the profile handle differs', async () => {
    const user = userEvent.setup();

    renderChooser();
    await user.click(screen.getByRole('button', { name: /^create a local generated piece$/i }));

    await waitFor(() =>
      expect(screen.getByText('Generated editor placeholder')).toBeInTheDocument(),
    );
    expect(mockedCreateLocalGenerated).toHaveBeenCalledWith(
      db,
      expect.objectContaining({ ownerId: 'e2e_split' }),
    );
    expect(mockedFetchProfile).not.toHaveBeenCalled();
  });

  it('navigates to /templates from the "Browse templates" card', async () => {
    const user = userEvent.setup();

    renderChooser();
    await user.click(screen.getByRole('link', { name: /^browse templates$/i }));

    await waitFor(() => expect(screen.getByText('Templates placeholder')).toBeInTheDocument());
  });

  it('shows an accessible error and re-enables the cards on failure', async () => {
    mockedOpen.mockRejectedValue(new Error('boom'));
    const user = userEvent.setup();

    renderChooser();
    await user.click(screen.getAllByRole('button', { name: /^create a new 2d project$/i })[0]);

    expect(await screen.findByRole('alert')).toHaveTextContent(/could not create/i);
    expect(screen.getAllByRole('button', { name: /^create a new 2d project$/i })[0]).toBeEnabled();
  });
});
