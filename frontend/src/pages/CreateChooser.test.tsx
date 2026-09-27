import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import * as projects3dApi from '../api/projects3d';
import * as profileApi from '../api/profile';
import * as repository from '../storage/localProjectRepository';
import CreateChooser from './CreateChooser';

vi.mock('../api/projects3d');
vi.mock('../api/profile');
vi.mock('../storage/localProjectRepository');

const mockedCreateProject3D = vi.mocked(projects3dApi.createProject3D);
const mockedFetchProfile = vi.mocked(profileApi.fetchProfile);
const mockedOpen = vi.mocked(repository.openLocalProjectDatabase);
const mockedCreateProject = vi.mocked(repository.createProject);
const mockedCreateScene = vi.mocked(repository.createScene);
const db = { close: vi.fn() } as unknown as IDBDatabase;

function renderChooser() {
  return render(
    <MemoryRouter initialEntries={['/create']}>
      <Routes>
        <Route path="/create" element={<CreateChooser />} />
        <Route path="/local-projects/:id" element={<p>Local editor placeholder</p>} />
        <Route path="/users/@alice/edit/:slug" element={<p>Editor placeholder</p>} />
        <Route path="/templates" element={<p>Templates placeholder</p>} />
      </Routes>
    </MemoryRouter>,
  );
}

beforeEach(() => {
  vi.clearAllMocks();
  mockedFetchProfile.mockResolvedValue({ handle: 'alice' } as never);
  mockedOpen.mockResolvedValue(db);
  mockedCreateProject.mockResolvedValue({
    id: 'local-id',
    ownerId: 'alice',
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
      ownerId: 'alice',
      title: 'Untitled animation',
      kind: '2d',
    });
    expect(mockedCreateScene).toHaveBeenCalledWith(
      db,
      'alice',
      expect.objectContaining({
        projectId: 'local-id',
        name: 'Scene 1',
      }),
    );
  });

  it('creates a 3D project and navigates to the unified editor', async () => {
    mockedCreateProject3D.mockResolvedValue({
      id: 'new-3d-id',
      owner: 'alice',
      visibility: 'private',
      title: 'Untitled 3D scene',
      thumbnail_url: null,
      current_version: null,
      editor_url: '/users/@alice/edit/untitled-3d-scene',
      created_at: '2026-01-01T00:00:00Z',
      updated_at: '2026-01-01T00:00:00Z',
    });
    const user = userEvent.setup();

    renderChooser();
    await user.click(screen.getAllByRole('button', { name: /^create a new 3d project$/i })[0]);

    await waitFor(() => expect(screen.getByText('Editor placeholder')).toBeInTheDocument());
    expect(mockedCreateProject3D).toHaveBeenCalled();
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
