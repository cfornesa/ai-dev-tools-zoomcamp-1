import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { describe, expect, it } from 'vitest';

import type { Project3D } from '../api/projects3d';
import Project3DCard from './Project3DCard';

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

function renderCard(project: Project3D) {
  return render(
    <MemoryRouter>
      <Project3DCard project={project} />
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
});
