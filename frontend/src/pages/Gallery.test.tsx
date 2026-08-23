import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Route, Routes } from 'react-router-dom';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import * as projectsApi from '../api/projects';
import * as authModule from '../auth/useAuth';
import Gallery from './Gallery';

vi.mock('../api/projects');
vi.mock('../auth/useAuth');

const mockedListProjects = vi.mocked(projectsApi.listProjects);
const mockedCreateBlankProject = vi.mocked(projectsApi.createBlankProject);
const mockedUseAuth = vi.mocked(authModule.useAuth);

function baseProject(overrides: Partial<projectsApi.Project> = {}): projectsApi.Project {
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

function renderGallery() {
  return render(
    <MemoryRouter initialEntries={['/']}>
      <Routes>
        <Route path="/" element={<Gallery />} />
        <Route path="/projects/:id" element={<p>Editor placeholder</p>} />
      </Routes>
    </MemoryRouter>,
  );
}

beforeEach(() => {
  vi.clearAllMocks();
  mockedUseAuth.mockReturnValue({
    status: 'signed-in',
    user: { username: 'alice', email: 'alice@example.com' },
  });
});

describe('Gallery loading/error/empty/populated states', () => {
  it('shows a loading status while projects are being fetched', () => {
    mockedListProjects.mockReturnValue(new Promise(() => {})); // never resolves

    renderGallery();

    expect(screen.getByRole('status')).toHaveTextContent(/loading your projects/i);
  });

  it('shows an alert when the projects request fails', async () => {
    mockedListProjects.mockRejectedValue(new Error('network down'));

    renderGallery();

    expect(await screen.findByRole('alert')).toHaveTextContent(/couldn't load your projects/i);
  });

  it('shows a clear empty state with a keyboard-accessible create action', async () => {
    mockedListProjects.mockResolvedValue([]);

    renderGallery();

    expect(await screen.findByText('You have not created any projects.')).toBeInTheDocument();
    expect(
      screen.getByText('You have not created any projects.').closest('.content-panel'),
    ).not.toBeNull();
    const createButton = screen.getByRole('button', { name: /create new animation/i });
    expect(createButton).toBeInTheDocument();
    expect(createButton.tagName).toBe('BUTTON'); // native focusable element, no tabindex hacks
  });

  it('renders each project as a card with title, visibility, and editor navigation', async () => {
    mockedListProjects.mockResolvedValue([
      baseProject({ id: 'p1', title: 'Hand Follower', visibility: 'public' }),
      baseProject({ id: 'p2', title: 'Pinch Burst', visibility: 'private' }),
    ]);

    renderGallery();

    expect(await screen.findByRole('heading', { name: 'Hand Follower' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Pinch Burst' })).toBeInTheDocument();
    expect(screen.getAllByText('Public')).toHaveLength(1);
    expect(screen.getAllByText('Private')).toHaveLength(1);
    expect(screen.getAllByRole('link', { name: /^edit$/i })).toHaveLength(2);
    expect(screen.getByRole('list')).toHaveClass('project-grid');
    expect(screen.getByRole('list').closest('.content-panel')).not.toBeNull();
  });
});

describe('Gallery ownership safety', () => {
  it('never renders a project belonging to another user, even if the API response includes one', async () => {
    mockedListProjects.mockResolvedValue([
      baseProject({ id: 'p1', title: 'Mine', owner: 'alice' }),
      baseProject({ id: 'p2', title: 'Not Mine', owner: 'mallory' }),
    ]);

    renderGallery();

    expect(await screen.findByRole('heading', { name: 'Mine' })).toBeInTheDocument();
    expect(screen.queryByText('Not Mine')).not.toBeInTheDocument();
  });
});

describe('Gallery keyboard accessibility', () => {
  it('has a logical tab order through the create action and each card link', async () => {
    mockedListProjects.mockResolvedValue([
      baseProject({ id: 'p1', title: 'First' }),
      baseProject({ id: 'p2', title: 'Second' }),
    ]);
    const user = userEvent.setup();

    renderGallery();
    await screen.findByRole('heading', { name: 'First' });

    await user.tab();
    expect(screen.getByRole('button', { name: /create new animation/i })).toHaveFocus();

    await user.tab();
    expect(screen.getByRole('link', { name: /browse templates/i })).toHaveFocus();

    await user.tab();
    expect(screen.getAllByRole('link', { name: /^edit$/i })[0]).toHaveFocus();

    await user.tab();
    expect(screen.getAllByRole('link', { name: /^edit$/i })[1]).toHaveFocus();
  });
});

describe('Gallery create action', () => {
  it('navigates to the new project editor on success', async () => {
    mockedListProjects.mockResolvedValue([]);
    mockedCreateBlankProject.mockResolvedValue(baseProject({ id: 'new-id' }));
    const user = userEvent.setup();

    renderGallery();
    await screen.findByRole('button', { name: /create new animation/i });

    await user.click(screen.getByRole('button', { name: /create new animation/i }));

    await waitFor(() => expect(screen.getByText('Editor placeholder')).toBeInTheDocument());
    expect(mockedCreateBlankProject).toHaveBeenCalledWith(expect.any(String));
  });

  it('shows an accessible error and re-enables the button on failure', async () => {
    mockedListProjects.mockResolvedValue([]);
    mockedCreateBlankProject.mockRejectedValue(new Error('boom'));
    const user = userEvent.setup();

    renderGallery();
    const createButton = await screen.findByRole('button', { name: /create new animation/i });

    await user.click(createButton);

    expect(await screen.findByRole('alert')).toHaveTextContent(/could not create/i);
    expect(screen.getByRole('button', { name: /create new animation/i })).toBeEnabled();
  });
});
