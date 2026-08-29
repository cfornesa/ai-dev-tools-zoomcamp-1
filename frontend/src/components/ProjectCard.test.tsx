import { fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { describe, expect, it } from 'vitest';

import type { Project } from '../api/projects';
import ProjectCard from './ProjectCard';

/** Issue #135: "Your projects" cards had no thumbnail at all, unlike the
 * public gallery's `PublicProjectCard`, despite `Project` already carrying
 * `thumbnail_url`. */
function baseProject(overrides: Partial<Project> = {}): Project {
  return {
    id: 'p1',
    owner: 'alice',
    title: 'My animation',
    description: '',
    tags: [],
    visibility: 'private',
    allow_public_remix: false,
    export_attribution: false,
    thumbnail_url: null,
    current_version: 1,
    created_at: '2026-01-01T00:00:00Z',
    updated_at: '2026-01-02T00:00:00Z',
    ...overrides,
  };
}

function renderCard(project: Project) {
  return render(
    <MemoryRouter>
      <ProjectCard project={project} />
    </MemoryRouter>,
  );
}

describe('ProjectCard: thumbnail (issue #135)', () => {
  it('renders the thumbnail image when thumbnail_url is present', () => {
    renderCard(baseProject({ thumbnail_url: '/api/projects/p1/thumbnail.png' }));

    const image = screen.getByRole('img', { name: 'Preview of My animation' });
    expect(image).toHaveAttribute('src', '/api/projects/p1/thumbnail.png');
  });

  it('shows a fallback tile when thumbnail_url is null', () => {
    renderCard(baseProject({ thumbnail_url: null }));

    expect(screen.queryByRole('img', { name: /Preview of/i })).not.toBeInTheDocument();
    expect(
      screen.getByRole('img', { name: 'No preview available for My animation' }),
    ).toBeInTheDocument();
  });

  it('falls back to the placeholder if the thumbnail image itself fails to load', () => {
    renderCard(baseProject({ thumbnail_url: '/api/projects/p1/thumbnail.png' }));

    const image = screen.getByRole('img', { name: 'Preview of My animation' });
    fireEvent.error(image);

    expect(
      screen.getByRole('img', { name: 'No preview available for My animation' }),
    ).toBeInTheDocument();
  });
});

describe('ProjectCard: "Manual"/"AI" origin badge', () => {
  it('shows "AI" next to the visibility badge when the current version was AI-produced', () => {
    renderCard(baseProject({ current_version_origin: 'ai_create' }));

    expect(screen.getByText('Private')).toBeInTheDocument();
    expect(screen.getByText('AI')).toBeInTheDocument();
  });

  it('shows "Manual" when the current version was a manual save', () => {
    renderCard(baseProject({ current_version_origin: 'manual' }));

    expect(screen.getByText('Manual')).toBeInTheDocument();
  });

  it('shows no origin badge when there is no current version yet', () => {
    renderCard(baseProject({ current_version_origin: null }));

    expect(screen.queryByText('AI')).not.toBeInTheDocument();
    expect(screen.queryByText('Manual')).not.toBeInTheDocument();
  });
});
