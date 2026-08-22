import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useState } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { ApiError } from '../api/client';
import * as projectsApi from '../api/projects';
import type { Project } from '../api/projects';
import EditorDetailsPanel from './EditorDetailsPanel';

/**
 * Task 94 (issue #94): coverage ported from the deleted
 * `ProjectMetadataForm.test.tsx` for the fields this panel took over
 * (description, tags, allow-remix, export-attribution) — title and
 * publish/unpublish moved elsewhere (`EditableProjectTitle` in
 * `EditorWorkspace.tsx`, `PublishControl.tsx`) and are covered there
 * instead.
 */

vi.mock('../api/projects');

const mockedUpdateProjectMetadata = vi.mocked(projectsApi.updateProjectMetadata);

function baseProject(overrides: Partial<Project> = {}): Project {
  return {
    id: 'p1',
    owner: 'alice',
    title: 'Untitled animation',
    description: '',
    tags: [],
    visibility: 'private',
    allow_public_remix: false,
    export_attribution: false,
    current_version: 1,
    created_at: '2026-01-01T00:00:00Z',
    updated_at: '2026-01-01T00:00:00Z',
    ...overrides,
  };
}

// A minimal stand-in for `EditorWorkspace.tsx`'s own `project`/`setProject`
// state, so this panel is exercised the same way it's actually used.
function Harness({ initialProject }: { initialProject: Project }) {
  const [project, setProject] = useState<Project | null>(initialProject);
  return (
    <EditorDetailsPanel projectId={project?.id ?? 'p1'} project={project} setProject={setProject} />
  );
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe('EditorDetailsPanel', () => {
  it('exposes description, tags, remix, and export-attribution fields, seeded from the project', () => {
    render(
      <Harness
        initialProject={baseProject({ description: 'A cool scene', tags: ['fun', 'demo'] })}
      />,
    );

    expect(screen.getByLabelText(/description/i)).toHaveValue('A cool scene');
    expect(screen.getByLabelText(/tags/i)).toHaveValue('fun, demo');
    expect(screen.getByLabelText(/allow other users to remix/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/include "created with" attribution/i)).toBeInTheDocument();
    // thumbnail_choice is gone entirely (issue #94 point 5) — no such
    // control exists anymore.
    expect(screen.queryByLabelText(/thumbnail/i)).not.toBeInTheDocument();
  });

  it('saves valid changes without touching scene versions or title', async () => {
    mockedUpdateProjectMetadata.mockResolvedValue(baseProject({ description: 'Updated' }));
    const user = userEvent.setup();

    render(<Harness initialProject={baseProject()} />);
    const descriptionInput = screen.getByLabelText(/description/i);
    await user.clear(descriptionInput);
    await user.type(descriptionInput, 'Updated');
    await user.click(screen.getByRole('button', { name: /save changes/i }));

    expect(await screen.findByRole('status')).toHaveTextContent(/saved/i);
    expect(mockedUpdateProjectMetadata).toHaveBeenCalledWith(
      'p1',
      expect.objectContaining({ description: 'Updated' }),
    );
    const [, payload] = mockedUpdateProjectMetadata.mock.calls[0]!;
    expect(payload).not.toHaveProperty('title');
    expect(payload).not.toHaveProperty('thumbnail_choice');
  });

  it('toggles the remix setting and saves it via the plain metadata PATCH', async () => {
    mockedUpdateProjectMetadata.mockResolvedValue(baseProject({ allow_public_remix: false }));
    const user = userEvent.setup();

    render(<Harness initialProject={baseProject({ allow_public_remix: true })} />);
    const remixCheckbox = screen.getByLabelText(/allow other users to remix/i);
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

  it('surfaces a client-side tag-limit error without saving', async () => {
    const user = userEvent.setup();

    render(<Harness initialProject={baseProject()} />);
    const tagsInput = screen.getByLabelText(/tags/i);
    await user.type(tagsInput, Array.from({ length: 11 }, (_, i) => `tag${i}`).join(','));
    await user.click(screen.getByRole('button', { name: /save changes/i }));

    expect(await screen.findByRole('alert')).toHaveTextContent(/no more than 10 tags/i);
    expect(mockedUpdateProjectMetadata).not.toHaveBeenCalled();
  });

  it('surfaces server-side field errors accessibly', async () => {
    mockedUpdateProjectMetadata.mockRejectedValue(
      new ApiError(400, { description: ['Too long.'] }),
    );
    const user = userEvent.setup();

    render(<Harness initialProject={baseProject()} />);
    await user.click(screen.getByRole('button', { name: /save changes/i }));

    expect(await screen.findByRole('alert')).toHaveTextContent(/too long/i);
  });

  it('allows a private project to keep default/empty metadata', async () => {
    mockedUpdateProjectMetadata.mockResolvedValue(baseProject());
    const user = userEvent.setup();

    render(<Harness initialProject={baseProject()} />);
    await user.click(screen.getByRole('button', { name: /save changes/i }));

    expect(await screen.findByRole('status')).toHaveTextContent(/saved/i);
  });
});
