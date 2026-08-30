import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import * as projects3dApi from '../api/projects3d';
import type { Project3D } from '../api/projects3d';
import Project3DCard from './Project3DCard';

vi.mock('../api/projects3d', async () => {
  const actual = await vi.importActual<typeof import('../api/projects3d')>('../api/projects3d');
  return { ...actual, deleteProject3D: vi.fn() };
});

const mockedDeleteProject3D = vi.mocked(projects3dApi.deleteProject3D);

function baseProject3D(overrides: Partial<Project3D> = {}): Project3D {
  return {
    id: 'p3d-1',
    owner: 'alice',
    title: 'Untitled 3D scene',
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

describe('Project3DCard', () => {
  it('always shows the no-preview-available fallback (Project3D has no thumbnail yet)', () => {
    renderCard(baseProject3D());

    expect(
      screen.getByRole('img', { name: 'No preview available for Untitled 3D scene' }),
    ).toBeInTheDocument();
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
