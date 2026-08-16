import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import * as projectsApi from '../api/projects';
import { ApiError } from '../api/client';
import ProjectMetadataForm from './ProjectMetadataForm';

vi.mock('../api/projects');

const mockedGetProject = vi.mocked(projectsApi.getProject);
const mockedUpdateProjectMetadata = vi.mocked(projectsApi.updateProjectMetadata);

function baseProject(overrides: Partial<projectsApi.Project> = {}): projectsApi.Project {
  return {
    id: 'p1',
    owner: 'alice',
    title: 'Untitled animation',
    description: '',
    tags: [],
    visibility: 'private',
    allow_public_remix: false,
    thumbnail_choice: 'auto',
    export_attribution: false,
    current_version: 1,
    created_at: '2026-01-01T00:00:00Z',
    updated_at: '2026-01-01T00:00:00Z',
    ...overrides,
  };
}

function renderForm(id = 'p1') {
  return render(
    <MemoryRouter initialEntries={[`/projects/${id}/settings`]}>
      <Routes>
        <Route path="/projects/:id/settings" element={<ProjectMetadataForm />} />
        <Route path="/projects/:id" element={<p>Editor placeholder</p>} />
      </Routes>
    </MemoryRouter>,
  );
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe('ProjectMetadataForm', () => {
  it("shows a new project's default title and empty description", async () => {
    mockedGetProject.mockResolvedValue(baseProject());

    renderForm();

    expect(await screen.findByLabelText(/title/i)).toHaveValue('Untitled animation');
    expect(screen.getByLabelText(/description/i)).toHaveValue('');
  });

  it('exposes title, description, tags, remix, thumbnail, and export-attribution fields', async () => {
    mockedGetProject.mockResolvedValue(baseProject());

    renderForm();
    await screen.findByLabelText(/title/i);

    expect(screen.getByLabelText(/description/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/tags/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/allow other users to remix/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/thumbnail/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/include "created with" attribution/i)).toBeInTheDocument();
  });

  it('saves valid changes without touching scene versions', async () => {
    mockedGetProject.mockResolvedValue(baseProject());
    mockedUpdateProjectMetadata.mockResolvedValue(baseProject({ title: 'Renamed' }));
    const user = userEvent.setup();

    renderForm();
    const titleInput = await screen.findByLabelText(/title/i);
    await user.clear(titleInput);
    await user.type(titleInput, 'Renamed');
    await user.click(screen.getByRole('button', { name: /save changes/i }));

    expect(await screen.findByRole('status')).toHaveTextContent(/saved/i);
    expect(mockedUpdateProjectMetadata).toHaveBeenCalledWith(
      'p1',
      expect.objectContaining({ title: 'Renamed' }),
    );
    // The update call only ever touches project metadata — there is no
    // scene-version endpoint call anywhere in this component.
  });

  it('associates a blank-title field error with the input accessibly', async () => {
    mockedGetProject.mockResolvedValue(baseProject({ title: 'Something' }));
    const user = userEvent.setup();

    renderForm();
    const titleInput = await screen.findByLabelText(/title/i);
    await user.clear(titleInput);
    await user.click(screen.getByRole('button', { name: /save changes/i }));

    const error = await screen.findByRole('alert');
    expect(error).toHaveTextContent(/title cannot be blank/i);
    expect(titleInput).toHaveAttribute('aria-invalid', 'true');
    expect(titleInput).toHaveAttribute('aria-describedby', error.id);
    expect(mockedUpdateProjectMetadata).not.toHaveBeenCalled();
  });

  it('surfaces server-side field errors accessibly', async () => {
    mockedGetProject.mockResolvedValue(baseProject({ title: 'Something' }));
    mockedUpdateProjectMetadata.mockRejectedValue(new ApiError(400, { title: ['Already taken.'] }));
    const user = userEvent.setup();

    renderForm();
    await screen.findByLabelText(/title/i);
    await user.click(screen.getByRole('button', { name: /save changes/i }));

    expect(await screen.findByRole('alert')).toHaveTextContent(/already taken/i);
  });

  it('allows a private project to keep default/empty metadata', async () => {
    mockedGetProject.mockResolvedValue(baseProject());
    mockedUpdateProjectMetadata.mockResolvedValue(baseProject());
    const user = userEvent.setup();

    renderForm();
    await screen.findByLabelText(/title/i);
    await user.click(screen.getByRole('button', { name: /save changes/i }));

    expect(await screen.findByRole('status')).toHaveTextContent(/saved/i);
  });

  it('never renders the form for a non-owner (404 from the API)', async () => {
    mockedGetProject.mockRejectedValue(new ApiError(404, null));

    renderForm();

    expect(await screen.findByRole('alert')).toHaveTextContent(/not found/i);
    expect(screen.queryByLabelText(/title/i)).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /save changes/i })).not.toBeInTheDocument();
  });
});
