import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Route, Routes } from 'react-router-dom';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import * as projectsApi from '../api/projects';
import * as projects3dApi from '../api/projects3d';
import * as authModule from '../auth/useAuth';
import Gallery from './Gallery';

vi.mock('../api/projects');
vi.mock('../api/projects3d');
vi.mock('../auth/useAuth');

const mockedListProjects = vi.mocked(projectsApi.listProjects);
const mockedCreateBlankProject = vi.mocked(projectsApi.createBlankProject);
const mockedListProjects3D = vi.mocked(projects3dApi.listProjects3D);
const mockedCreateProject3D = vi.mocked(projects3dApi.createProject3D);
const mockedDeleteProject3D = vi.mocked(projects3dApi.deleteProject3D);
const mockedUseAuth = vi.mocked(authModule.useAuth);

function baseProject3D(overrides: Partial<projects3dApi.Project3D> = {}): projects3dApi.Project3D {
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
        <Route path="/ai-projects/:id" element={<p>AI editor placeholder</p>} />
        <Route path="/projects3d/:id" element={<p>3D editor placeholder</p>} />
        <Route path="/ai-projects3d/:id" element={<p>3D AI editor placeholder</p>} />
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
  // Default to no 3D projects; individual tests override when they need
  // to assert 3D-specific rendering.
  mockedListProjects3D.mockResolvedValue([]);
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

  // Gap found live in production while verifying #238's fix: 3D projects
  // could be created but never appeared in the gallery afterward --
  // Gallery.tsx only ever fetched the 2D Project list.
  it('renders 3D projects alongside 2D projects, each linking to the 3D editor', async () => {
    mockedListProjects.mockResolvedValue([baseProject({ id: 'p1', title: 'Hand Follower' })]);
    mockedListProjects3D.mockResolvedValue([
      baseProject3D({ id: 'p3d-1', title: 'Untitled 3D scene' }),
    ]);

    renderGallery();

    expect(await screen.findByRole('heading', { name: 'Hand Follower' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Untitled 3D scene' })).toBeInTheDocument();
    const editLinks = screen.getAllByRole('link', { name: /^edit$/i });
    expect(editLinks).toHaveLength(2);
    expect(editLinks.some((link) => link.getAttribute('href') === '/projects3d/p3d-1')).toBe(true);
  });

  it('does not show the empty state when only 3D projects exist', async () => {
    mockedListProjects.mockResolvedValue([]);
    mockedListProjects3D.mockResolvedValue([baseProject3D({ id: 'p3d-1' })]);

    renderGallery();

    expect(await screen.findByRole('heading', { name: 'Untitled 3D scene' })).toBeInTheDocument();
    expect(screen.queryByText('You have not created any projects.')).not.toBeInTheDocument();
  });

  // Issue #242: deleting a 3D project's card should remove it from this
  // section without a full page reload/refetch.
  it('removes a 3D project from the gallery once its card is deleted', async () => {
    const user = userEvent.setup();
    vi.spyOn(window, 'confirm').mockReturnValue(true);
    mockedListProjects.mockResolvedValue([]);
    mockedListProjects3D.mockResolvedValue([baseProject3D({ id: 'p3d-1' })]);
    mockedDeleteProject3D.mockResolvedValue(undefined);

    renderGallery();

    expect(await screen.findByRole('heading', { name: 'Untitled 3D scene' })).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Delete' }));

    await waitFor(() =>
      expect(screen.queryByRole('heading', { name: 'Untitled 3D scene' })).not.toBeInTheDocument(),
    );
    expect(screen.getByText('You have not created any projects.')).toBeInTheDocument();
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
    expect(screen.getByLabelText('Renderer')).toHaveFocus();

    await user.tab();
    expect(screen.getByRole('button', { name: /create new animation/i })).toHaveFocus();

    await user.tab();
    expect(screen.getByRole('button', { name: /create ai-assisted animation/i })).toHaveFocus();

    await user.tab();
    expect(screen.getByRole('button', { name: /create new 3d project/i })).toHaveFocus();

    await user.tab();
    expect(screen.getByRole('button', { name: /create ai-assisted 3d project/i })).toHaveFocus();

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
    // Issue #206: defaults to the p5 renderer unless the picker is changed.
    expect(mockedCreateBlankProject).toHaveBeenCalledWith(expect.any(String), 'p5');
  });

  it('passes the selected renderer through to createBlankProject (issue #206)', async () => {
    mockedListProjects.mockResolvedValue([]);
    mockedCreateBlankProject.mockResolvedValue(baseProject({ id: 'new-id' }));
    const user = userEvent.setup();

    renderGallery();
    const rendererSelect = await screen.findByLabelText<HTMLSelectElement>('Renderer');
    await user.selectOptions(rendererSelect, 'canvas2d');

    await user.click(screen.getByRole('button', { name: /create new animation/i }));

    await waitFor(() =>
      expect(mockedCreateBlankProject).toHaveBeenCalledWith(expect.any(String), 'canvas2d'),
    );
  });

  it('passes the svg renderer through to createBlankProject (issue #207)', async () => {
    mockedListProjects.mockResolvedValue([]);
    mockedCreateBlankProject.mockResolvedValue(baseProject({ id: 'new-id' }));
    const user = userEvent.setup();

    renderGallery();
    const rendererSelect = await screen.findByLabelText<HTMLSelectElement>('Renderer');
    await user.selectOptions(rendererSelect, 'svg');

    await user.click(screen.getByRole('button', { name: /create new animation/i }));

    await waitFor(() =>
      expect(mockedCreateBlankProject).toHaveBeenCalledWith(expect.any(String), 'svg'),
    );
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

  // Issue #223: a distinct creation entry point routing to the 2D
  // AI-assisted editor instead of the manual editor.
  it('navigates to the AI-assisted editor on success', async () => {
    mockedListProjects.mockResolvedValue([]);
    mockedCreateBlankProject.mockResolvedValue(baseProject({ id: 'new-ai-id' }));
    const user = userEvent.setup();

    renderGallery();
    await screen.findByRole('button', { name: /create ai-assisted animation/i });

    await user.click(screen.getByRole('button', { name: /create ai-assisted animation/i }));

    await waitFor(() => expect(screen.getByText('AI editor placeholder')).toBeInTheDocument());
    expect(mockedCreateBlankProject).toHaveBeenCalledWith(expect.any(String), 'p5');
  });

  // Issue #226: a distinct creation entry point routing to the 3D manual
  // editor, backed by the genuinely separate Project3D document family.
  it('navigates to the 3D editor on success', async () => {
    mockedListProjects.mockResolvedValue([]);
    mockedCreateProject3D.mockResolvedValue({
      id: 'new-3d-id',
      owner: 'alice',
      title: 'Untitled 3D scene',
      current_version: null,
      created_at: '2026-01-01T00:00:00Z',
      updated_at: '2026-01-01T00:00:00Z',
    });
    const user = userEvent.setup();

    renderGallery();
    await screen.findByRole('button', { name: /create new 3d project/i });

    await user.click(screen.getByRole('button', { name: /create new 3d project/i }));

    await waitFor(() => expect(screen.getByText('3D editor placeholder')).toBeInTheDocument());
    expect(mockedCreateProject3D).toHaveBeenCalled();
  });

  // Issue #231: a distinct creation entry point routing to the 3D
  // AI-assisted editor instead of the 3D manual editor.
  it('navigates to the 3D AI-assisted editor on success', async () => {
    mockedListProjects.mockResolvedValue([]);
    mockedCreateProject3D.mockResolvedValue({
      id: 'new-3d-ai-id',
      owner: 'alice',
      title: 'Untitled 3D scene',
      current_version: null,
      created_at: '2026-01-01T00:00:00Z',
      updated_at: '2026-01-01T00:00:00Z',
    });
    const user = userEvent.setup();

    renderGallery();
    await screen.findByRole('button', { name: /create ai-assisted 3d project/i });

    await user.click(screen.getByRole('button', { name: /create ai-assisted 3d project/i }));

    await waitFor(() => expect(screen.getByText('3D AI editor placeholder')).toBeInTheDocument());
    expect(mockedCreateProject3D).toHaveBeenCalled();
  });
});
