import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import * as projectsApi from '../api/projects';
import * as projects3dApi from '../api/projects3d';
import CreateChooser from './CreateChooser';

vi.mock('../api/projects');
vi.mock('../api/projects3d');

const mockedCreateBlankProject = vi.mocked(projectsApi.createBlankProject);
const mockedCreateProject3D = vi.mocked(projects3dApi.createProject3D);

function renderChooser() {
  return render(
    <MemoryRouter initialEntries={['/create']}>
      <Routes>
        <Route path="/create" element={<CreateChooser />} />
        <Route path="/projects/:id" element={<p>Editor placeholder</p>} />
        <Route path="/ai-projects/:id" element={<p>AI editor placeholder</p>} />
        <Route path="/projects3d/:id" element={<p>3D editor placeholder</p>} />
        <Route path="/ai-projects3d/:id" element={<p>3D AI editor placeholder</p>} />
        <Route path="/templates" element={<p>Templates placeholder</p>} />
      </Routes>
    </MemoryRouter>,
  );
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe('CreateChooser (issue #268)', () => {
  it('shows all 5 actions as cards', () => {
    renderChooser();

    expect(screen.getByRole('heading', { name: /^create a new animation$/i })).toBeInTheDocument();
    expect(
      screen.getByRole('heading', { name: /^create an ai-assisted animation$/i }),
    ).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: /^create a new 3d project$/i })).toBeInTheDocument();
    expect(
      screen.getByRole('heading', { name: /^create an ai-assisted 3d project$/i }),
    ).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: /^browse templates$/i })).toBeInTheDocument();
  });

  it('creates a blank 2D project with the default renderer and navigates to the manual editor', async () => {
    mockedCreateBlankProject.mockResolvedValue({
      id: 'new-id',
      owner: 'alice',
      title: 'Untitled animation',
      description: '',
      tags: [],
      visibility: 'private',
      allow_public_remix: false,
      export_attribution: false,
      thumbnail_url: null,
      current_version: 1,
      created_at: '2026-01-01T00:00:00Z',
      updated_at: '2026-01-01T00:00:00Z',
    });
    const user = userEvent.setup();

    renderChooser();
    await user.click(screen.getAllByRole('button', { name: /^create a new animation$/i })[0]);

    await waitFor(() => expect(screen.getByText('Editor placeholder')).toBeInTheDocument());
    expect(mockedCreateBlankProject).toHaveBeenCalledWith(expect.any(String), 'p5');
  });

  it('creates a 3D project and navigates to the AI-assisted 3D editor', async () => {
    mockedCreateProject3D.mockResolvedValue({
      id: 'new-3d-ai-id',
      owner: 'alice',
      title: 'Untitled 3D scene',
      thumbnail_url: null,
      current_version: null,
      created_at: '2026-01-01T00:00:00Z',
      updated_at: '2026-01-01T00:00:00Z',
    });
    const user = userEvent.setup();

    renderChooser();
    await user.click(
      screen.getAllByRole('button', { name: /^create an ai-assisted 3d project$/i })[0],
    );

    await waitFor(() => expect(screen.getByText('3D AI editor placeholder')).toBeInTheDocument());
    expect(mockedCreateProject3D).toHaveBeenCalled();
  });

  it('navigates to /templates from the "Browse templates" card', async () => {
    const user = userEvent.setup();

    renderChooser();
    await user.click(screen.getByRole('link', { name: /^browse templates$/i }));

    await waitFor(() => expect(screen.getByText('Templates placeholder')).toBeInTheDocument());
  });

  it('shows an accessible error and re-enables the cards on failure', async () => {
    mockedCreateBlankProject.mockRejectedValue(new Error('boom'));
    const user = userEvent.setup();

    renderChooser();
    await user.click(screen.getAllByRole('button', { name: /^create a new animation$/i })[0]);

    expect(await screen.findByRole('alert')).toHaveTextContent(/could not create/i);
    expect(screen.getAllByRole('button', { name: /^create a new animation$/i })[0]).toBeEnabled();
  });
});
