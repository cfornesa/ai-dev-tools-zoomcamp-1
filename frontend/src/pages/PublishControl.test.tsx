import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useState } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { ApiError } from '../api/client';
import * as projectsApi from '../api/projects';
import type { Project } from '../api/projects';
import type { PersistDetailsResult } from './EditorDetailsPanel';
import PublishControl from './PublishControl';

/**
 * Task 94 (issue #94): coverage ported from the deleted
 * `ProjectMetadataForm.test.tsx`'s "publishing (Task 49)" describe block —
 * same behavior, now driven by the editor header's `PublishControl`
 * instead of the standalone settings page.
 */

vi.mock('../api/projects');

const mockedPublishProject = vi.mocked(projectsApi.publishProject);
const mockedUnpublishProject = vi.mocked(projectsApi.unpublishProject);

function baseProject(overrides: Partial<Project> = {}): Project {
  return {
    id: 'p1',
    owner: 'alice',
    title: 'My scene',
    description: 'A real description.',
    tags: [],
    visibility: 'private',
    allow_public_remix: false,
    export_attribution: false,
    thumbnail_url: null,
    current_version: 1,
    created_at: '2026-01-01T00:00:00Z',
    updated_at: '2026-01-01T00:00:00Z',
    ...overrides,
  };
}

/**
 * Issue #128: `PublishControl` now takes a `persistPendingDetails` prop
 * (owned by `EditorWorkspace.tsx` in production, backed by
 * `EditorDetailsPanel`'s imperative handle) that it calls before validating
 * for publish. This harness defaults to a resolved `{ status: 'skipped' }`
 * — "nothing pending in the Details panel" — so every pre-existing test
 * below, which never touched the Details panel, keeps exercising exactly
 * the same validate-then-confirm behavior it always has. Tests that care
 * about the auto-persist step itself pass their own `persistPendingDetails`
 * override.
 */
function Harness({
  initialProject,
  persistPendingDetails = () => Promise.resolve({ status: 'skipped' as const }),
  compact = false,
}: {
  initialProject: Project;
  persistPendingDetails?: () => Promise<PersistDetailsResult>;
  compact?: boolean;
}) {
  const [project, setProject] = useState<Project | null>(initialProject);
  return (
    <PublishControl
      id="p1"
      project={project}
      setProject={setProject}
      persistPendingDetails={persistPendingDetails}
      compact={compact}
    />
  );
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe('PublishControl', () => {
  it('keeps the publication state and Draft/Published actions inside a compact stage disclosure', async () => {
    render(<Harness initialProject={baseProject()} compact />);

    expect(screen.getByTestId('visibility-status').closest('[role="group"]')).toHaveAttribute(
      'hidden',
    );
    const trigger = screen.getByRole('button', { name: 'Publication status: Draft' });
    await userEvent.setup().click(trigger);

    expect(screen.getByTestId('visibility-status')).toHaveTextContent(/draft/i);
    expect(screen.getByRole('button', { name: 'Draft' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Published' })).toBeEnabled();
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

  it('shows a confirmation naming title, creator attribution, animation, and preview before the first private-to-public switch', async () => {
    const user = userEvent.setup();

    render(<Harness initialProject={baseProject()} />);
    await user.click(screen.getByRole('button', { name: /^publish$/i }));

    const dialog = await screen.findByRole('alertdialog');
    expect(dialog).toHaveTextContent('My scene');
    expect(dialog).toHaveTextContent('alice');
    expect(dialog).toHaveTextContent(/animation/i);
    expect(dialog).toHaveTextContent(/preview/i);
    expect(mockedPublishProject).not.toHaveBeenCalled();
  });

  it('blocks publishing with field-level errors when title/description are not meaningful', async () => {
    const user = userEvent.setup();

    render(
      <Harness initialProject={baseProject({ title: 'Untitled animation', description: '' })} />,
    );
    await user.click(screen.getByRole('button', { name: /^publish$/i }));

    expect(await screen.findByTestId('publish-title-error')).toHaveTextContent(/meaningful title/i);
    expect(screen.getByTestId('publish-description-error')).toHaveTextContent(/description/i);
    expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument();
    expect(mockedPublishProject).not.toHaveBeenCalled();
  });

  it('publishes after confirmation and updates the visibility status', async () => {
    mockedPublishProject.mockResolvedValue(baseProject({ visibility: 'public' }));
    const user = userEvent.setup();

    render(<Harness initialProject={baseProject()} />);
    await user.click(screen.getByRole('button', { name: /^publish$/i }));
    const dialog = await screen.findByRole('alertdialog');
    await user.click(within(dialog).getByRole('button', { name: /^publish$/i }));

    expect(mockedPublishProject).toHaveBeenCalledWith('p1');
    expect(await screen.findByTestId('visibility-status')).toHaveTextContent(/public/i);
    expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument();
  });

  it('cancelling the confirmation dialog does not publish', async () => {
    const user = userEvent.setup();

    render(<Harness initialProject={baseProject()} />);
    await user.click(screen.getByRole('button', { name: /^publish$/i }));
    await screen.findByRole('alertdialog');
    await user.click(screen.getByRole('button', { name: /cancel/i }));

    expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument();
    expect(mockedPublishProject).not.toHaveBeenCalled();
  });

  it('moves focus into the confirmation dialog on open and restores it to the Publish trigger on Cancel', async () => {
    const user = userEvent.setup();

    render(<Harness initialProject={baseProject()} />);
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
    const user = userEvent.setup();

    render(<Harness initialProject={baseProject()} />);
    const trigger = screen.getByRole('button', { name: /^publish$/i });
    await user.click(trigger);
    await screen.findByRole('alertdialog');

    await user.keyboard('{Escape}');

    expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument();
    expect(trigger).toHaveFocus();
    expect(mockedPublishProject).not.toHaveBeenCalled();
  });

  it('surfaces server-side publish validation errors without corrupting visibility state', async () => {
    mockedPublishProject.mockRejectedValue(
      new ApiError(400, { errors: { title: ['Choose a meaningful title before publishing.'] } }),
    );
    const user = userEvent.setup();

    render(<Harness initialProject={baseProject()} />);
    await user.click(screen.getByRole('button', { name: /^publish$/i }));
    const dialog = await screen.findByRole('alertdialog');
    await user.click(within(dialog).getByRole('button', { name: /^publish$/i }));

    expect(await screen.findByTestId('publish-title-error')).toHaveTextContent(/meaningful title/i);
    expect(screen.getByTestId('visibility-status')).toHaveTextContent(/private/i);
  });

  describe('issue #128: auto-persist pending Details-panel metadata before publishing', () => {
    it('persists pending metadata, then validates against the freshly-saved values and opens the confirm dialog', async () => {
      const persisted = baseProject({ description: 'Just typed in the Details panel.' });
      const persistPendingDetails = vi
        .fn<() => Promise<PersistDetailsResult>>()
        .mockResolvedValue({ status: 'success', project: persisted });
      const user = userEvent.setup();

      render(
        <Harness
          initialProject={baseProject({ description: '' })}
          persistPendingDetails={persistPendingDetails}
        />,
      );
      await user.click(screen.getByRole('button', { name: /^publish$/i }));

      expect(persistPendingDetails).toHaveBeenCalledTimes(1);
      // Validation ran against the persisted result, not the stale initial
      // project (which had a blank description and would have blocked).
      const dialog = await screen.findByRole('alertdialog');
      expect(dialog).toBeInTheDocument();
      expect(screen.queryByTestId('publish-description-error')).not.toBeInTheDocument();
    });

    it('skips validation and the confirm dialog when the auto-persist fails with client-side field errors, and does not clear anything', async () => {
      const persistPendingDetails = vi
        .fn<() => Promise<PersistDetailsResult>>()
        .mockResolvedValue({ status: 'client-error' });
      const user = userEvent.setup();

      render(
        <Harness initialProject={baseProject()} persistPendingDetails={persistPendingDetails} />,
      );
      await user.click(screen.getByRole('button', { name: /^publish$/i }));

      expect(await screen.findByTestId('publish-form-error')).toHaveTextContent(
        /could not save your details/i,
      );
      expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument();
      expect(mockedPublishProject).not.toHaveBeenCalled();
    });

    it('skips validation and the confirm dialog when the auto-persist fails with a network/5xx error, and Publish is retryable', async () => {
      const persistPendingDetails = vi
        .fn<() => Promise<PersistDetailsResult>>()
        .mockResolvedValueOnce({ status: 'server-error' })
        .mockResolvedValueOnce({ status: 'skipped' });
      const user = userEvent.setup();

      render(
        <Harness initialProject={baseProject()} persistPendingDetails={persistPendingDetails} />,
      );
      const trigger = screen.getByRole('button', { name: /^publish$/i });
      await user.click(trigger);

      expect(await screen.findByTestId('publish-form-error')).toHaveTextContent(
        /could not save your details before publishing\. please try again\./i,
      );
      expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument();
      expect(trigger).toBeEnabled();

      // Retry, with no further edits: the underlying problem is now gone
      // (the mock's second resolution), and the flow succeeds.
      await user.click(trigger);
      expect(persistPendingDetails).toHaveBeenCalledTimes(2);
      expect(await screen.findByRole('alertdialog')).toBeInTheDocument();
    });

    it('skips the redundant PATCH (a no-op diff) and goes straight to validate+confirm', async () => {
      const persistPendingDetails = vi
        .fn<() => Promise<PersistDetailsResult>>()
        .mockResolvedValue({ status: 'skipped' });
      const user = userEvent.setup();

      render(
        <Harness initialProject={baseProject()} persistPendingDetails={persistPendingDetails} />,
      );
      await user.click(screen.getByRole('button', { name: /^publish$/i }));

      expect(persistPendingDetails).toHaveBeenCalledTimes(1);
      expect(await screen.findByRole('alertdialog')).toBeInTheDocument();
    });

    it('canceling the confirmation dialog after a successful auto-persist leaves the project private without re-running the persist step', async () => {
      const persisted = baseProject({ description: 'Saved via auto-persist.' });
      const persistPendingDetails = vi
        .fn<() => Promise<PersistDetailsResult>>()
        .mockResolvedValue({ status: 'success', project: persisted });
      const user = userEvent.setup();

      render(
        <Harness initialProject={baseProject()} persistPendingDetails={persistPendingDetails} />,
      );
      await user.click(screen.getByRole('button', { name: /^publish$/i }));
      const dialog = await screen.findByRole('alertdialog');
      await user.click(within(dialog).getByRole('button', { name: /cancel/i }));

      expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument();
      expect(screen.getByTestId('visibility-status')).toHaveTextContent(/private/i);
      expect(mockedPublishProject).not.toHaveBeenCalled();
      expect(persistPendingDetails).toHaveBeenCalledTimes(1);
    });
  });

  it('offers a separate, immediate unpublish action for a public project, without a confirmation dialog', async () => {
    mockedUnpublishProject.mockResolvedValue(baseProject({ visibility: 'private' }));
    const user = userEvent.setup();

    render(<Harness initialProject={baseProject({ visibility: 'public' })} />);
    await screen.findByTestId('visibility-status');
    await user.click(screen.getByRole('button', { name: /unpublish/i }));

    expect(mockedUnpublishProject).toHaveBeenCalledWith('p1');
    expect(await screen.findByTestId('visibility-status')).toHaveTextContent(/private/i);
    expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument();
  });

  it('non-owner/error responses on unpublish leave visibility state unchanged in the UI', async () => {
    mockedUnpublishProject.mockRejectedValue(new ApiError(404, null));
    const user = userEvent.setup();

    render(<Harness initialProject={baseProject({ visibility: 'public' })} />);
    await screen.findByTestId('visibility-status');
    await user.click(screen.getByRole('button', { name: /unpublish/i }));

    expect(await screen.findByTestId('publish-form-error')).toHaveTextContent(
      /could not unpublish/i,
    );
    expect(screen.getByTestId('visibility-status')).toHaveTextContent(/public/i);
  });
});
