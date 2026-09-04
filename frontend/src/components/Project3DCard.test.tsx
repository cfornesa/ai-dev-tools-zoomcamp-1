import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import * as projects3dApi from '../api/projects3d';
import type { Project3D } from '../api/projects3d';
import Project3DCard from './Project3DCard';

vi.mock('../api/projects3d', async () => {
  const actual = await vi.importActual<typeof import('../api/projects3d')>('../api/projects3d');
  return { ...actual, deleteProject3D: vi.fn(), getProject3D: vi.fn() };
});

const mockedDeleteProject3D = vi.mocked(projects3dApi.deleteProject3D);
const mockedGetProject3D = vi.mocked(projects3dApi.getProject3D);

function baseProject3D(overrides: Partial<Project3D> = {}): Project3D {
  return {
    id: 'p3d-1',
    owner: 'alice',
    visibility: 'private',
    title: 'Untitled 3D scene',
    thumbnail_url: null,
    current_version: null,
    created_at: '2026-01-01T00:00:00Z',
    updated_at: '2026-01-02T00:00:00Z',
    ...overrides,
  };
}

function renderCard(project: Project3D, onDeleted: (id: string) => void = vi.fn()) {
  return render(
    <MemoryRouter>
      <Project3DCard project={project} onDeleted={onDeleted} />
    </MemoryRouter>,
  );
}

describe('Project3DCard: thumbnail (issue #243)', () => {
  it('renders the thumbnail image when thumbnail_url is present', () => {
    renderCard(baseProject3D({ thumbnail_url: '/api/projects3d/p3d-1/thumbnail/' }));

    const image = screen.getByRole('img', { name: 'Preview of Untitled 3D scene' });
    expect(image).toHaveAttribute('src', '/api/projects3d/p3d-1/thumbnail/');
  });

  it('shows the no-preview-available fallback when thumbnail_url is null', () => {
    renderCard(baseProject3D({ thumbnail_url: null }));

    expect(screen.queryByRole('img', { name: /Preview of/i })).not.toBeInTheDocument();
    expect(
      screen.getByRole('img', { name: 'No preview available for Untitled 3D scene' }),
    ).toBeInTheDocument();
  });

  it('falls back to the placeholder if the thumbnail image itself fails to load', () => {
    renderCard(baseProject3D({ thumbnail_url: '/api/projects3d/p3d-1/thumbnail/' }));

    const image = screen.getByRole('img', { name: 'Preview of Untitled 3D scene' });
    fireEvent.error(image);

    expect(
      screen.getByRole('img', { name: 'No preview available for Untitled 3D scene' }),
    ).toBeInTheDocument();
  });

  it('offers a retry action for a stored fallback and shows the recovered thumbnail', async () => {
    const user = userEvent.setup();
    mockedGetProject3D.mockResolvedValue(
      baseProject3D({
        thumbnail_url: '/api/projects3d/p3d-1/thumbnail/',
        thumbnail_is_fallback: false,
      }),
    );
    renderCard(
      baseProject3D({
        thumbnail_url: '/api/projects3d/p3d-1/thumbnail/',
        thumbnail_is_fallback: true,
      }),
    );

    expect(screen.getByRole('img', { name: /no preview available/i })).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Retry thumbnail' }));

    expect(
      await screen.findByRole('img', { name: /preview of untitled 3d scene/i }),
    ).toHaveAttribute('src', '/api/projects3d/p3d-1/thumbnail/');
    expect(mockedGetProject3D).toHaveBeenCalledWith('p3d-1');
  });

  it('keeps the safe fallback and reports a retry failure', async () => {
    const user = userEvent.setup();
    mockedGetProject3D.mockRejectedValueOnce(new Error('network down'));
    renderCard(
      baseProject3D({
        thumbnail_url: '/api/projects3d/p3d-1/thumbnail/',
        thumbnail_is_fallback: true,
      }),
    );

    await user.click(screen.getByRole('button', { name: 'Retry thumbnail' }));

    expect(await screen.findByRole('alert')).toHaveTextContent(/could not regenerate/i);
    expect(screen.getByRole('img', { name: /no preview available/i })).toBeInTheDocument();
  });
});

describe('Project3DCard', () => {
  it('shows the current private/public visibility state', () => {
    renderCard(baseProject3D({ visibility: 'private' }));
    expect(screen.getByText('Private')).toHaveClass('visibility-badge');

    renderCard(baseProject3D({ id: 'public-3d', visibility: 'public' }));
    expect(screen.getByText('Public')).toHaveClass('visibility-badge');
  });

  it('links Edit to the 3D manual editor route', () => {
    renderCard(baseProject3D({ id: 'abc-123' }));

    expect(screen.getByRole('link', { name: /^edit$/i })).toHaveAttribute(
      'href',
      '/projects3d/abc-123',
    );
  });

  it('shows "AI" when the current version was AI-produced', () => {
    renderCard(
      baseProject3D({
        current_version: {
          id: 1,
          sequence: 1,
          origin: 'ai_create',
          scene_json: {},
          created_by: 'alice',
          created_at: '2026-01-01T00:00:00Z',
        },
      }),
    );

    expect(screen.getByText('AI')).toBeInTheDocument();
  });

  it('shows no origin badge when there is no current version yet', () => {
    renderCard(baseProject3D({ current_version: null }));

    expect(screen.queryByText('AI')).not.toBeInTheDocument();
    expect(screen.queryByText('Manual')).not.toBeInTheDocument();
  });

  describe('delete', () => {
    beforeEach(() => {
      mockedDeleteProject3D.mockReset();
    });

    it('confirms, deletes, and notifies the parent on success', async () => {
      const user = userEvent.setup();
      vi.spyOn(window, 'confirm').mockReturnValue(true);
      mockedDeleteProject3D.mockResolvedValue(undefined);
      const onDeleted = vi.fn();
      renderCard(baseProject3D({ id: 'abc-123' }), onDeleted);

      await user.click(screen.getByRole('button', { name: 'Delete' }));

      expect(window.confirm).toHaveBeenCalled();
      await waitFor(() => expect(mockedDeleteProject3D).toHaveBeenCalledWith('abc-123'));
      await waitFor(() => expect(onDeleted).toHaveBeenCalledWith('abc-123'));
    });

    it('does nothing when the confirmation is declined', async () => {
      const user = userEvent.setup();
      vi.spyOn(window, 'confirm').mockReturnValue(false);
      const onDeleted = vi.fn();
      renderCard(baseProject3D(), onDeleted);

      await user.click(screen.getByRole('button', { name: 'Delete' }));

      expect(mockedDeleteProject3D).not.toHaveBeenCalled();
      expect(onDeleted).not.toHaveBeenCalled();
    });

    it('shows an error and re-enables the button when the request fails', async () => {
      const user = userEvent.setup();
      vi.spyOn(window, 'confirm').mockReturnValue(true);
      mockedDeleteProject3D.mockRejectedValue(new Error('boom'));
      const onDeleted = vi.fn();
      renderCard(baseProject3D(), onDeleted);

      await user.click(screen.getByRole('button', { name: 'Delete' }));

      expect(await screen.findByRole('alert')).toHaveTextContent(
        'Could not delete this project. Please try again.',
      );
      expect(onDeleted).not.toHaveBeenCalled();
      expect(screen.getByRole('button', { name: 'Delete' })).toBeEnabled();
    });
  });
});
