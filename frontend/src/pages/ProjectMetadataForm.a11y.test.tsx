import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { axe } from 'jest-axe';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import * as projectsApi from '../api/projects';
import Layout from '../components/Layout';
import ProjectMetadataForm from './ProjectMetadataForm';

/**
 * Task 63 (issue #63): automated accessibility checks for the project
 * metadata form, including the publish/unpublish controls (Task 49) and the
 * publish-confirmation alertdialog. See this file's sibling
 * `ProjectMetadataForm.test.tsx` for behavioral coverage (dialog focus
 * management is asserted there via `useAlertDialogFocus`, matching the
 * pattern established for `VersionDeleteConfirm` et al. in issue #64).
 */

vi.mock('../api/projects');

const mockedGetProject = vi.mocked(projectsApi.getProject);

function baseProject(overrides: Partial<projectsApi.Project> = {}): projectsApi.Project {
  return {
    id: 'p1',
    owner: 'alice',
    title: 'My scene',
    description: 'A real description of the animation.',
    tags: ['hands'],
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
        <Route path="/" element={<Layout />}>
          <Route path="projects/:id/settings" element={<ProjectMetadataForm />} />
          <Route path="projects/:id" element={<p>Editor placeholder</p>} />
        </Route>
      </Routes>
    </MemoryRouter>,
  );
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe('ProjectMetadataForm accessibility', () => {
  it('has no axe violations in the ready state (private project)', async () => {
    mockedGetProject.mockResolvedValue(baseProject());
    const { container } = renderForm();
    await screen.findByLabelText(/title/i);
    expect(await axe(container)).toHaveNoViolations();
  });

  it('has no axe violations for a public project (Unpublish control)', async () => {
    mockedGetProject.mockResolvedValue(baseProject({ visibility: 'public' }));
    const { container } = renderForm();
    await screen.findByRole('button', { name: /unpublish/i });
    expect(await axe(container)).toHaveNoViolations();
  });

  it('has no axe violations with the publish confirmation dialog open', async () => {
    mockedGetProject.mockResolvedValue(baseProject());
    const user = userEvent.setup();
    const { container } = renderForm();
    await screen.findByLabelText(/title/i);

    await user.click(screen.getByRole('button', { name: /^publish$/i }));
    await screen.findByRole('alertdialog');

    expect(await axe(container)).toHaveNoViolations();
  });

  it('has no axe violations with field-level publish-blocking errors shown', async () => {
    mockedGetProject.mockResolvedValue(
      baseProject({ title: 'Untitled animation', description: '' }),
    );
    const user = userEvent.setup();
    const { container } = renderForm();
    await screen.findByLabelText(/title/i);

    await user.click(screen.getByRole('button', { name: /^publish$/i }));
    await screen.findByTestId('publish-title-error');

    expect(await axe(container)).toHaveNoViolations();
  });
});
