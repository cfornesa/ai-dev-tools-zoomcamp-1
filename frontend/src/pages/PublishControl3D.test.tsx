import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useState } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { ApiError } from '../api/client';
import * as projects3dApi from '../api/projects3d';
import type { Project3D } from '../api/projects3d';
import PublishControl3D from './PublishControl3D';

/**
 * Issue #296: the Project3D counterpart of `PublishControl.test.tsx`,
 * scoped down for this control's simpler design (no persistPendingDetails/
 * client-side field validation -- see PublishControl3D.tsx's own doc
 * comment for why).
 */

vi.mock('../api/projects3d');

const mockedPublishProject3D = vi.mocked(projects3dApi.publishProject3D);
const mockedUnpublishProject3D = vi.mocked(projects3dApi.unpublishProject3D);

function baseProject(overrides: Partial<Project3D> = {}): Project3D {
  return {
    id: 'p1',
    owner: 'alice',
    title: 'My 3D scene',
    visibility: 'private',
    thumbnail_url: null,
    current_version: {
      id: 1,
      sequence: 1,
      origin: 'manual',
      created_by: 'alice',
      created_at: '2026-01-01T00:00:00Z',
      scene_json: {},
    },
    created_at: '2026-01-01T00:00:00Z',
    updated_at: '2026-01-01T00:00:00Z',
    ...overrides,
  };
}

function Harness({
  initialProject,
  compact = false,
}: {
  initialProject: Project3D;
  compact?: boolean;
}) {
  const [project, setProject] = useState<Project3D | null>(initialProject);
  return <PublishControl3D id="p1" project={project} setProject={setProject} compact={compact} />;
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe('PublishControl3D', () => {
  it('shows the publication state in the compact stage control', () => {
    render(<Harness initialProject={baseProject()} compact />);

    const statusControl = screen.getByRole('button', { name: 'Publication status: Draft' });
    expect(statusControl.querySelector('.piece-stage-action-label')).toHaveTextContent(
      'Publication status: Draft',
    );
    expect(statusControl).toBeVisible();
  });

  it('exposes Draft/Published as visible, keyboard-actionable publication status controls', () => {
    render(<Harness initialProject={baseProject()} />);

    const status = screen.getByRole('group', { name: 'Publication status' });
    const draft = within(status).getByRole('button', { name: 'Draft' });
    const published = within(status).getByRole('button', { name: 'Published' });
    expect(draft).toHaveAttribute('aria-pressed', 'true');
    expect(published).toHaveAttribute('aria-pressed', 'false');
    expect(draft).toHaveProperty('tabIndex', 0);
    expect(published).toHaveProperty('tabIndex', 0);
  });

  it('shows a confirmation naming the title and creator before the first private-to-public switch', async () => {
    const user = userEvent.setup();
    render(<Harness initialProject={baseProject()} />);

    await user.click(screen.getByRole('button', { name: 'Publish' }));

    expect(screen.getByRole('alertdialog')).toHaveTextContent('Publish "My 3D scene"?');
    expect(screen.getByRole('alertdialog')).toHaveTextContent('alice');
    expect(mockedPublishProject3D).not.toHaveBeenCalled();
  });

  it('publishes after confirmation and updates the visibility status', async () => {
    mockedPublishProject3D.mockResolvedValue(baseProject({ visibility: 'public' }));
    const user = userEvent.setup();
    render(<Harness initialProject={baseProject()} />);

    await user.click(screen.getByRole('button', { name: 'Publish' }));
    const dialog = await screen.findByRole('alertdialog');
    await user.click(within(dialog).getByRole('button', { name: 'Publish' }));

    expect(mockedPublishProject3D).toHaveBeenCalledWith('p1');
    expect(await screen.findByTestId('visibility-status-3d')).toHaveTextContent(
      'Public — visible to anyone.',
    );
    expect(screen.getByRole('button', { name: 'Unpublish' })).toBeInTheDocument();
  });

  it('cancelling the confirmation dialog does not publish', async () => {
    const user = userEvent.setup();
    render(<Harness initialProject={baseProject()} />);

    await user.click(screen.getByRole('button', { name: 'Publish' }));
    await user.click(screen.getByRole('button', { name: 'Cancel' }));

    expect(mockedPublishProject3D).not.toHaveBeenCalled();
    expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument();
    expect(screen.getByTestId('visibility-status-3d')).toHaveTextContent(
      'Private — only visible to you.',
    );
  });

  it('surfaces a server-side validation failure (e.g. no saved version) without corrupting visibility state', async () => {
    mockedPublishProject3D.mockRejectedValue(
      new ApiError(400, { errors: { current_version: ['Save at least one version.'] } }),
    );
    const user = userEvent.setup();
    render(<Harness initialProject={baseProject()} />);

    await user.click(screen.getByRole('button', { name: 'Publish' }));
    const dialog = await screen.findByRole('alertdialog');
    await user.click(within(dialog).getByRole('button', { name: 'Publish' }));

    expect(await screen.findByTestId('publish-3d-error')).toHaveTextContent(
      /save at least one version/i,
    );
    expect(screen.getByTestId('visibility-status-3d')).toHaveTextContent(
      'Private — only visible to you.',
    );
  });

  it('offers a separate, immediate unpublish action for a public project, without a confirmation dialog', async () => {
    mockedUnpublishProject3D.mockResolvedValue(baseProject({ visibility: 'private' }));
    const user = userEvent.setup();
    render(<Harness initialProject={baseProject({ visibility: 'public' })} />);

    await user.click(screen.getByRole('button', { name: 'Unpublish' }));

    expect(mockedUnpublishProject3D).toHaveBeenCalledWith('p1');
    expect(await screen.findByTestId('visibility-status-3d')).toHaveTextContent(
      'Private — only visible to you.',
    );
  });

  it('non-owner/error responses on unpublish leave visibility state unchanged in the UI', async () => {
    mockedUnpublishProject3D.mockRejectedValue(new ApiError(404, null));
    const user = userEvent.setup();
    render(<Harness initialProject={baseProject({ visibility: 'public' })} />);

    await user.click(screen.getByRole('button', { name: 'Unpublish' }));

    expect(await screen.findByTestId('publish-3d-error')).toBeInTheDocument();
    expect(screen.getByTestId('visibility-status-3d')).toHaveTextContent(
      'Public — visible to anyone.',
    );
  });
});
