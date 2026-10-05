import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Route, Routes } from 'react-router-dom';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import * as projectsApi from '../api/projects';
import * as projects3dApi from '../api/projects3d';
import * as profileApi from '../api/profile';
import * as authModule from '../auth/useAuth';
import { formatDate } from '../components/formatDate';
import * as repository from '../storage/localProjectRepository';
import * as localThumbnail from '../storage/localThumbnail';
import Gallery from './Gallery';

vi.mock('../api/projects');
vi.mock('../api/projects3d');
vi.mock('../api/profile');
vi.mock('../auth/useAuth');
vi.mock('../storage/localProjectRepository');
vi.mock('../storage/localThumbnail');

const mockedListProjects = vi.mocked(projectsApi.listProjects);
const mockedListProjects3D = vi.mocked(projects3dApi.listProjects3D);
const mockedDeleteProject3D = vi.mocked(projects3dApi.deleteProject3D);
const mockedFetchProfile = vi.mocked(profileApi.fetchProfile);
const mockedUseAuth = vi.mocked(authModule.useAuth);
const mockedOpenLocal = vi.mocked(repository.openLocalProjectDatabase);
const mockedCreateLocal = vi.mocked(repository.createProject);
const mockedCreateScene = vi.mocked(repository.createScene);
const mockedCreateLocal3D = vi.mocked(repository.createLocal3DProject);
const mockedListLocal = vi.mocked(repository.listProjectsForOwner);
const mockedEnsureLocalThumbnail = vi.mocked(localThumbnail.ensureLocalThumbnail);
const localDb = { close: vi.fn() } as unknown as IDBDatabase;

function baseProject3D(overrides: Partial<projects3dApi.Project3D> = {}): projects3dApi.Project3D {
  return {
    id: 'p3d-1',
    owner: 'alice',
    visibility: 'private',
    title: 'Untitled 3D scene',
    thumbnail_url: null,
    editor_url: '/users/@alice/edit/untitled-3d-scene',
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
    editor_url: '/users/@alice/edit/my-animation',
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
        <Route path="/users/@alice/edit/:slug" element={<p>Editor placeholder</p>} />
        <Route path="/local-projects/:id" element={<p>Local editor placeholder</p>} />
        <Route path="/templates" element={<p>Templates placeholder</p>} />
        <Route path="/create" element={<p>Create chooser placeholder</p>} />
      </Routes>
    </MemoryRouter>,
  );
}

// Issue #268: the 4 create actions + "Browse templates" moved from
// standalone buttons into the split-button's dropdown menu -- every test
// below that used to click a button directly now opens the dropdown
// first, then clicks the corresponding `role="menuitem"`.
async function openCreateMenu(user: ReturnType<typeof userEvent.setup>) {
  await user.click(await screen.findByRole('button', { name: /more creation options/i }));
}

beforeEach(() => {
  vi.clearAllMocks();
  mockedUseAuth.mockReturnValue({
    status: 'signed-in',
    user: { username: 'alice', email: 'alice@example.com', is_application_admin: false },
  });
  mockedFetchProfile.mockResolvedValue({ handle: 'alice' } as never);
  // Default to no 3D projects; individual tests override when they need
  // to assert 3D-specific rendering.
  mockedListProjects3D.mockResolvedValue([]);
  mockedOpenLocal.mockResolvedValue(localDb);
  mockedListLocal.mockResolvedValue([]);
  mockedEnsureLocalThumbnail.mockResolvedValue(null);
  mockedCreateLocal.mockResolvedValue({
    id: 'local-new',
    ownerId: 'alice',
    title: 'Untitled animation',
    sceneOrder: [],
    activeSceneId: null,
    createdAt: '2026-01-01',
    updatedAt: '2026-01-01',
    kind: '2d',
    versionOrder: [],
    currentVersionId: null,
  });
  mockedCreateScene.mockResolvedValue({} as never);
  mockedCreateLocal3D.mockResolvedValue({
    project: {
      id: 'local-3d',
      ownerId: 'alice',
      title: 'Untitled 3D scene',
      sceneOrder: ['scene-3d'],
      activeSceneId: 'scene-3d',
      createdAt: '2026-01-01',
      updatedAt: '2026-01-01',
      kind: '3d',
      versionOrder: ['version-1'],
      currentVersionId: 'version-1',
    },
    scene: {} as never,
    version: {} as never,
  });
});

describe('Gallery loading/error/empty/populated states', () => {
  it('renders local cards with metadata, fallback, and lazy thumbnail backfill', async () => {
    mockedListProjects.mockResolvedValue([]);
    mockedListLocal.mockResolvedValue([
      {
        id: 'local-with-thumbnail',
        ownerId: 'alice',
        title: 'Local illustrated piece',
        description: 'A local description',
        thumbnail: new Blob(['png'], { type: 'image/png' }),
        sceneOrder: [],
        activeSceneId: null,
        createdAt: '2026-01-01T00:00:00Z',
        updatedAt: '2026-01-02T00:00:00Z',
        kind: 'generated',
        versionOrder: [],
        currentVersionId: null,
      },
      {
        id: 'local-without-thumbnail',
        ownerId: 'alice',
        title: 'Local empty piece',
        description: '',
        sceneOrder: [],
        activeSceneId: null,
        createdAt: '2026-01-01T00:00:00Z',
        updatedAt: '2026-01-03T00:00:00Z',
        kind: '3d',
        versionOrder: [],
        currentVersionId: null,
      },
    ]);

    renderGallery();

    expect(
      await screen.findByRole('heading', { name: 'Local illustrated piece' }),
    ).toBeInTheDocument();
    expect(screen.getByText('A local description')).toBeInTheDocument();
    expect(screen.getByText('AI')).toBeInTheDocument();
    expect(screen.getByText('Generated')).toBeInTheDocument();
    expect(screen.getAllByText('Local only')).toHaveLength(2);
    await waitFor(() =>
      expect(
        screen.getByRole('img', { name: 'Preview of Local illustrated piece' }),
      ).toBeInTheDocument(),
    );
    expect(
      screen.getByRole('img', { name: 'No preview available for Local empty piece' }),
    ).toBeInTheDocument();
    expect(
      screen.getByText(`Last updated ${formatDate('2026-01-02T00:00:00Z')}`),
    ).toBeInTheDocument();
    expect(screen.getAllByRole('link', { name: 'Open local editor' })[0]).toHaveAttribute(
      'href',
      '/local-generated/local-with-thumbnail',
    );
    expect(mockedEnsureLocalThumbnail).toHaveBeenCalledWith(
      expect.objectContaining({ id: 'local-without-thumbnail' }),
    );
  });

  it('includes local 3D projects in the 3D renderer filter', async () => {
    mockedListProjects.mockResolvedValue([]);
    mockedListLocal.mockResolvedValue([
      {
        id: 'local-3d',
        ownerId: 'alice',
        title: 'Local 3D project',
        sceneOrder: [],
        activeSceneId: null,
        createdAt: '2026-01-01',
        updatedAt: '2026-01-02',
        kind: '3d',
        versionOrder: [],
        currentVersionId: null,
      },
    ]);

    renderGallery();
    await screen.findByRole('heading', { name: 'Local 3D project' });
    await userEvent.setup().selectOptions(screen.getByLabelText('Renderer'), '3d');
    expect(screen.getByRole('heading', { name: 'Local 3D project' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Open local editor' })).toHaveAttribute(
      'href',
      '/local-projects-3d/local-3d',
    );
  });

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
    const user = userEvent.setup();

    renderGallery();

    expect(await screen.findByText('You have not created any projects.')).toBeInTheDocument();
    expect(
      screen.getByText('You have not created any projects.').closest('.content-panel'),
    ).not.toBeNull();
    const plusLink = screen.getByRole('link', { name: /create a new project/i });
    expect(plusLink).toBeInTheDocument();
    expect(plusLink).toHaveAttribute('href', '/create');

    await openCreateMenu(user);
    const createMenuItem = screen.getByRole('menuitem', {
      name: /^create a new 2d project with p5\.js$/i,
    });
    expect(createMenuItem).toBeInTheDocument();
    expect(createMenuItem.tagName).toBe('BUTTON'); // native focusable element, no tabindex hacks
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
    expect(screen.queryByRole('heading', { name: 'Your 3D projects' })).not.toBeInTheDocument();
    expect(screen.getAllByRole('list', { name: '' })).toHaveLength(1);
    const editLinks = screen.getAllByRole('link', { name: /^edit$/i });
    expect(editLinks).toHaveLength(2);
    expect(editLinks.some((link) => link.getAttribute('href') === '/projects3d/p3d-1')).toBe(true);
  });

  it('defaults to All and filters the unified grid by 2D or 3D renderer', async () => {
    const user = userEvent.setup();
    mockedListProjects.mockResolvedValue([baseProject({ id: 'p1', title: 'Flat study' })]);
    mockedListProjects3D.mockResolvedValue([baseProject3D({ id: 'p3d-1', title: 'Sphere study' })]);

    renderGallery();

    await screen.findByRole('heading', { name: 'Flat study' });
    const filter = screen.getByRole('combobox', { name: 'Renderer' });
    expect(filter).toHaveValue('all');
    expect(
      within(filter)
        .getAllByRole('option')
        .map((option) => option.textContent),
    ).toEqual(['All', '2D', '3D']);
    expect(screen.getAllByRole('list')).toHaveLength(1);
    expect(screen.getByRole('heading', { name: 'Sphere study' })).toBeInTheDocument();

    await user.selectOptions(filter, '2d');
    expect(screen.getByRole('heading', { name: 'Flat study' })).toBeInTheDocument();
    expect(screen.queryByRole('heading', { name: 'Sphere study' })).not.toBeInTheDocument();
    expect(screen.getAllByRole('list')).toHaveLength(1);

    await user.selectOptions(filter, '3d');
    expect(screen.queryByRole('heading', { name: 'Flat study' })).not.toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Sphere study' })).toBeInTheDocument();
  });

  it('shows an accurate empty state when a renderer filter has no matches', async () => {
    const user = userEvent.setup();
    mockedListProjects.mockResolvedValue([baseProject({ title: 'Flat study' })]);
    mockedListProjects3D.mockResolvedValue([]);

    renderGallery();

    const filter = await screen.findByRole('combobox', { name: 'Renderer' });
    await user.selectOptions(filter, '3d');

    expect(screen.getByText('No 3D projects match this filter.')).toBeInTheDocument();
    expect(screen.queryByRole('list')).not.toBeInTheDocument();
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
  it('has a logical tab order through the split-button and each card link', async () => {
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
    expect(screen.getByRole('link', { name: /create a new project/i })).toHaveFocus();

    await user.tab();
    expect(screen.getByRole('button', { name: /more creation options/i })).toHaveFocus();

    await user.tab();
    expect(screen.getAllByRole('link', { name: /^edit$/i })[0]).toHaveFocus();

    await user.tab();
    expect(screen.getAllByRole('button', { name: /^delete$/i })[0]).toHaveFocus();

    await user.tab();
    expect(screen.getAllByRole('link', { name: /^edit$/i })[1]).toHaveFocus();

    await user.tab();
    expect(screen.getAllByRole('button', { name: /^delete$/i })[1]).toHaveFocus();
  });

  it('opens the dropdown with ArrowDown, moves focus with arrow keys, and closes with Escape back to the trigger', async () => {
    mockedListProjects.mockResolvedValue([]);
    const user = userEvent.setup();

    renderGallery();
    await screen.findByText('You have not created any projects.');

    const arrowButton = screen.getByRole('button', { name: /more creation options/i });
    arrowButton.focus();
    await user.keyboard('{ArrowDown}');

    const firstItem = await screen.findByRole('menuitem', {
      name: /^create a new 2d project with p5\.js$/i,
    });
    expect(firstItem).toHaveFocus();

    await user.keyboard('{ArrowDown}');
    expect(
      screen.getByRole('menuitem', { name: /^create a new 2d project with canvas2d$/i }),
    ).toHaveFocus();

    await user.keyboard('{Escape}');
    expect(screen.queryByRole('menu')).not.toBeInTheDocument();
    expect(arrowButton).toHaveFocus();
  });
});

describe('Gallery create action (dropdown menu, issue #268)', () => {
  it('navigates to the new project editor on success', async () => {
    mockedListProjects.mockResolvedValue([]);
    const user = userEvent.setup();

    renderGallery();
    await screen.findByText('You have not created any projects.');
    await openCreateMenu(user);

    await user.click(
      screen.getByRole('menuitem', { name: /^create a new 2d project with p5\.js$/i }),
    );

    await waitFor(() => expect(screen.getByText('Local editor placeholder')).toBeInTheDocument());
    // Issue #206: the p5 creation option remains available in the dropdown.
    expect(mockedCreateLocal).toHaveBeenCalledWith(localDb, {
      ownerId: 'alice',
      title: 'Untitled animation',
      kind: '2d',
    });
  });

  it.each([
    ['canvas2d', 'Canvas2D'],
    ['svg', 'SVG'],
  ] as const)(
    'keeps the %s creation renderer available in the dropdown',
    async (renderer, label) => {
      mockedListProjects.mockResolvedValue([]);
      const user = userEvent.setup();

      renderGallery();
      await openCreateMenu(user);

      const createAction = screen.getByRole('menuitem', {
        name: new RegExp(`^create a new 2d project with ${label}$`, 'i'),
      });
      expect(createAction).toBeInTheDocument();
      await user.click(createAction);

      await waitFor(() =>
        expect(mockedCreateScene).toHaveBeenCalledWith(
          localDb,
          'alice',
          expect.objectContaining({
            sceneJson: expect.objectContaining({ renderer: { preferred: renderer } }),
          }),
        ),
      );
    },
  );

  it('shows an accessible error and re-enables the arrow trigger on failure', async () => {
    mockedListProjects.mockResolvedValue([]);
    mockedOpenLocal.mockRejectedValue(new Error('boom'));
    const user = userEvent.setup();

    renderGallery();
    await screen.findByText('You have not created any projects.');
    await openCreateMenu(user);
    await user.click(
      screen.getByRole('menuitem', { name: /^create a new 2d project with p5\.js$/i }),
    );

    expect(await screen.findByRole('alert')).toHaveTextContent(/could not create/i);
    expect(screen.getByRole('button', { name: /more creation options/i })).toBeEnabled();
  });

  // Issue #226: a distinct creation entry point routing to the 3D manual
  // editor, backed by the genuinely separate Project3D document family.
  it('navigates to the 3D editor on success', async () => {
    mockedListProjects.mockResolvedValue([]);
    const user = userEvent.setup();

    renderGallery();
    await screen.findByText('You have not created any projects.');
    await openCreateMenu(user);

    await user.click(screen.getByRole('menuitem', { name: /^create a new 3d project$/i }));

    await waitFor(() => expect(screen.getByText('Local editor placeholder')).toBeInTheDocument());
    expect(mockedCreateLocal3D).toHaveBeenCalled();
  });

  it('navigates to the templates route from the dropdown', async () => {
    mockedListProjects.mockResolvedValue([]);
    const user = userEvent.setup();

    renderGallery();
    await screen.findByText('You have not created any projects.');
    await openCreateMenu(user);

    await user.click(screen.getByRole('menuitem', { name: /^browse templates$/i }));

    await waitFor(() => expect(screen.getByText('Templates placeholder')).toBeInTheDocument());
  });

  it('navigates to the chooser page when the "+" icon itself is clicked', async () => {
    mockedListProjects.mockResolvedValue([]);
    const user = userEvent.setup();

    renderGallery();
    await screen.findByText('You have not created any projects.');

    await user.click(screen.getByRole('link', { name: /create a new project/i }));

    await waitFor(() => expect(screen.getByText('Create chooser placeholder')).toBeInTheDocument());
  });
});
