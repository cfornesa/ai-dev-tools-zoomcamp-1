import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import * as projectsApi from '../api/projects';
import { ApiError } from '../api/client';
import ProjectMetadataForm from './ProjectMetadataForm';

vi.mock('../api/projects');

const mockedGetProject = vi.mocked(projectsApi.getProject);
const mockedUpdateProjectMetadata = vi.mocked(projectsApi.updateProjectMetadata);
const mockedPublishProject = vi.mocked(projectsApi.publishProject);
const mockedUnpublishProject = vi.mocked(projectsApi.unpublishProject);

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

  it('toggles the remix setting and saves it via the plain metadata PATCH, never a version save', async () => {
    // Task 51: `allow_public_remix` is metadata, exactly like title/tags —
    // the owner can flip it any time without going through the version-
    // save or publish endpoints.
    mockedGetProject.mockResolvedValue(baseProject({ allow_public_remix: true }));
    mockedUpdateProjectMetadata.mockResolvedValue(baseProject({ allow_public_remix: false }));
    const user = userEvent.setup();

    renderForm();
    const remixCheckbox = await screen.findByLabelText(/allow other users to remix/i);
    expect(remixCheckbox).toBeChecked();

    await user.click(remixCheckbox);
    expect(remixCheckbox).not.toBeChecked();

    await user.click(screen.getByRole('button', { name: /save changes/i }));

    expect(await screen.findByRole('status')).toHaveTextContent(/saved/i);
    expect(mockedUpdateProjectMetadata).toHaveBeenCalledWith(
      'p1',
      expect.objectContaining({ allow_public_remix: false }),
    );
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

describe('ProjectMetadataForm publishing (Task 49)', () => {
  it('shows a confirmation naming title, creator attribution, animation, and preview before the first private-to-public switch', async () => {
    mockedGetProject.mockResolvedValue(
      baseProject({ title: 'My scene', description: 'A real description.', owner: 'alice' }),
    );
    const user = userEvent.setup();

    renderForm();
    await screen.findByLabelText(/title/i);
    await user.click(screen.getByRole('button', { name: /^publish$/i }));

    const dialog = await screen.findByRole('alertdialog');
    expect(dialog).toHaveTextContent('My scene');
    expect(dialog).toHaveTextContent('alice');
    expect(dialog).toHaveTextContent(/animation/i);
    expect(dialog).toHaveTextContent(/preview/i);
    expect(mockedPublishProject).not.toHaveBeenCalled();
  });

  it('blocks publishing with field-level errors when title/description are not meaningful', async () => {
    mockedGetProject.mockResolvedValue(
      baseProject({ title: 'Untitled animation', description: '' }),
    );
    const user = userEvent.setup();

    renderForm();
    await screen.findByLabelText(/title/i);
    await user.click(screen.getByRole('button', { name: /^publish$/i }));

    expect(await screen.findByTestId('publish-title-error')).toHaveTextContent(/meaningful title/i);
    expect(screen.getByTestId('publish-description-error')).toHaveTextContent(/description/i);
    expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument();
    expect(mockedPublishProject).not.toHaveBeenCalled();
  });

  it('publishes after confirmation and updates the visibility status', async () => {
    mockedGetProject.mockResolvedValue(
      baseProject({ title: 'My scene', description: 'A real description.' }),
    );
    mockedPublishProject.mockResolvedValue(
      baseProject({ title: 'My scene', description: 'A real description.', visibility: 'public' }),
    );
    const user = userEvent.setup();

    renderForm();
    await screen.findByLabelText(/title/i);
    await user.click(screen.getByRole('button', { name: /^publish$/i }));
    const dialog = await screen.findByRole('alertdialog');
    await user.click(within(dialog).getByRole('button', { name: /^publish$/i }));

    expect(mockedPublishProject).toHaveBeenCalledWith('p1');
    expect(await screen.findByTestId('visibility-status')).toHaveTextContent(/public/i);
    expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument();
  });

  it('cancelling the confirmation dialog does not publish', async () => {
    mockedGetProject.mockResolvedValue(
      baseProject({ title: 'My scene', description: 'A real description.' }),
    );
    const user = userEvent.setup();

    renderForm();
    await screen.findByLabelText(/title/i);
    await user.click(screen.getByRole('button', { name: /^publish$/i }));
    await screen.findByRole('alertdialog');
    await user.click(screen.getByRole('button', { name: /cancel/i }));

    expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument();
    expect(mockedPublishProject).not.toHaveBeenCalled();
  });

  // Task 63 (issue #63): the publish-confirmation `alertdialog` never moved
  // focus into itself, never closed on Escape, and never restored focus to
  // its trigger — the one `alertdialog` in the app missing
  // `useAlertDialogFocus`'s behavior, unlike every other one (see that
  // hook's own doc comment and issue #64's precedent).
  it('moves focus into the confirmation dialog on open and restores it to the Publish trigger on Cancel', async () => {
    mockedGetProject.mockResolvedValue(
      baseProject({ title: 'My scene', description: 'A real description.' }),
    );
    const user = userEvent.setup();

    renderForm();
    await screen.findByLabelText(/title/i);
    const trigger = screen.getByRole('button', { name: /^publish$/i });
    trigger.focus();
    await user.click(trigger);

    const dialog = await screen.findByRole('alertdialog');
    expect(dialog).toHaveFocus();

    await user.click(within(dialog).getByRole('button', { name: /cancel/i }));
    expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument();
    expect(trigger).toHaveFocus();
  });

  it('dismisses the confirmation dialog on Escape without publishing, and restores focus', async () => {
    mockedGetProject.mockResolvedValue(
      baseProject({ title: 'My scene', description: 'A real description.' }),
    );
    const user = userEvent.setup();

    renderForm();
    await screen.findByLabelText(/title/i);
    const trigger = screen.getByRole('button', { name: /^publish$/i });
    await user.click(trigger);
    await screen.findByRole('alertdialog');

    await user.keyboard('{Escape}');

    expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument();
    expect(trigger).toHaveFocus();
    expect(mockedPublishProject).not.toHaveBeenCalled();
  });

  it('surfaces server-side publish validation errors without corrupting visibility state', async () => {
    mockedGetProject.mockResolvedValue(
      baseProject({ title: 'My scene', description: 'A real description.' }),
    );
    mockedPublishProject.mockRejectedValue(
      new ApiError(400, { errors: { title: ['Choose a meaningful title before publishing.'] } }),
    );
    const user = userEvent.setup();

    renderForm();
    await screen.findByLabelText(/title/i);
    await user.click(screen.getByRole('button', { name: /^publish$/i }));
    const dialog = await screen.findByRole('alertdialog');
    await user.click(within(dialog).getByRole('button', { name: /^publish$/i }));

    expect(await screen.findByTestId('publish-title-error')).toHaveTextContent(/meaningful title/i);
    expect(screen.getByTestId('visibility-status')).toHaveTextContent(/private/i);
  });

  it('offers a separate, immediate unpublish action for a public project, without a confirmation dialog', async () => {
    mockedGetProject.mockResolvedValue(
      baseProject({ title: 'My scene', description: 'A real description.', visibility: 'public' }),
    );
    mockedUnpublishProject.mockResolvedValue(
      baseProject({ title: 'My scene', description: 'A real description.', visibility: 'private' }),
    );
    const user = userEvent.setup();

    renderForm();
    await screen.findByTestId('visibility-status');
    await user.click(screen.getByRole('button', { name: /unpublish/i }));

    expect(mockedUnpublishProject).toHaveBeenCalledWith('p1');
    expect(await screen.findByTestId('visibility-status')).toHaveTextContent(/private/i);
    expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument();
  });

  it('non-owner/error responses on unpublish leave visibility state unchanged in the UI', async () => {
    mockedGetProject.mockResolvedValue(
      baseProject({ title: 'My scene', description: 'A real description.', visibility: 'public' }),
    );
    mockedUnpublishProject.mockRejectedValue(new ApiError(404, null));
    const user = userEvent.setup();

    renderForm();
    await screen.findByTestId('visibility-status');
    await user.click(screen.getByRole('button', { name: /unpublish/i }));

    expect(await screen.findByTestId('publish-form-error')).toHaveTextContent(
      /could not unpublish/i,
    );
    expect(screen.getByTestId('visibility-status')).toHaveTextContent(/public/i);
  });
});
