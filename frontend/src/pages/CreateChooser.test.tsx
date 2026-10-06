import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { AuthContext } from '../auth/context';
import * as artPieceApi from '../api/artPieces';
import * as projectsApi from '../api/projects';
import * as projects3dApi from '../api/projects3d';
import CreateChooser from './CreateChooser';

const libraries = Object.keys(
  artPieceApi.ART_PIECE_ENGINE_CAPABILITIES,
) as artPieceApi.ArtPieceLibrary[];
const generatedStartCases = libraries.flatMap((library) =>
  (['blank', 'ai'] as const).map((mode) => [library, mode] as const),
);

vi.mock('../api/artPieces');
vi.mock('../api/projects');
vi.mock('../api/projects3d');

const mockedCreateBlankProject = vi.mocked(projectsApi.createBlankProject);
const mockedCreateProject3D = vi.mocked(projects3dApi.createProject3D);

function CurrentLocation() {
  const location = useLocation();
  return <p data-testid="current-location">{location.pathname + location.search}</p>;
}

function renderChooser() {
  return render(
    <AuthContext.Provider
      value={{
        status: 'signed-in',
        user: {
          username: 'e2e_split',
          email: 'e2e-split@example.test',
          is_application_admin: false,
        },
      }}
    >
      <MemoryRouter initialEntries={['/create']}>
        <Routes>
          <Route path="/create" element={<CreateChooser />} />
          <Route path="/users/:handle/edit/:slug" element={<CurrentLocation />} />
          <Route path="/art-pieces" element={<CurrentLocation />} />
        </Routes>
      </MemoryRouter>
    </AuthContext.Provider>,
  );
}

beforeEach(() => {
  vi.clearAllMocks();
  mockedCreateBlankProject.mockResolvedValue({
    id: 'project-2d',
    editor_url: '/users/@alice/edit/2d-piece',
  } as never);
  mockedCreateProject3D.mockResolvedValue({
    id: 'project-3d',
    editor_url: '/users/@alice/edit/3d-piece',
  } as never);
});

describe('CreateChooser (issue #1276)', () => {
  it('labels each piece kind and opens the full chooser controls in keyboard order', async () => {
    const user = userEvent.setup();
    renderChooser();

    expect(screen.getByRole('region', { name: 'Create' })).toBeInTheDocument();
    expect(screen.getByRole('group', { name: 'What do you want to create?' })).toBeInTheDocument();
    expect(screen.getByRole('radio', { name: 'Structured 2D scene' })).toBeChecked();
    expect(screen.getByLabelText('2D renderer')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Start blank' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Start with AI' })).toBeInTheDocument();
    expect(screen.getByRole('region', { name: 'Create' })).toHaveClass('page-shell');

    await user.tab();
    expect(screen.getByRole('radio', { name: 'Structured 2D scene' })).toHaveFocus();
    await user.keyboard('{ArrowDown}');
    expect(screen.getByRole('radio', { name: 'Structured 3D scene' })).toHaveFocus();
    expect(screen.getByRole('radio', { name: 'Structured 3D scene' })).toBeChecked();
    await user.keyboard('{ArrowDown}');
    expect(screen.getByRole('radio', { name: 'Generated art piece' })).toHaveFocus();
    expect(screen.getByRole('radio', { name: 'Generated art piece' })).toBeChecked();
    expect(screen.getByLabelText('Generated library')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Browse templates' })).toHaveAttribute(
      'href',
      '/templates',
    );
  });

  it.each([
    ['blank', 'p5', '/users/@alice/edit/2d-piece'],
    ['ai', 'canvas2d', '/users/@alice/edit/2d-piece?start=ai'],
  ] as const)(
    'starts a structured 2D %s project in its canonical editor',
    async (mode, renderer, route) => {
      const user = userEvent.setup();
      renderChooser();
      await user.selectOptions(screen.getByLabelText('2D renderer'), renderer);
      await user.click(
        screen.getByRole('button', { name: mode === 'blank' ? 'Start blank' : 'Start with AI' }),
      );

      expect(await screen.findByTestId('current-location')).toHaveTextContent(route);
      expect(mockedCreateBlankProject).toHaveBeenCalledWith(undefined, renderer);
    },
  );

  it.each(['blank', 'ai'] as const)(
    'starts a structured 3D %s project in its canonical editor',
    async (mode) => {
      const user = userEvent.setup();
      renderChooser();
      await user.click(screen.getByRole('radio', { name: 'Structured 3D scene' }));
      await user.click(
        screen.getByRole('button', { name: mode === 'blank' ? 'Start blank' : 'Start with AI' }),
      );

      const suffix = mode === 'ai' ? '?start=ai' : '';
      expect(await screen.findByTestId('current-location')).toHaveTextContent(
        `/users/@alice/edit/3d-piece${suffix}`,
      );
      expect(mockedCreateProject3D).toHaveBeenCalledOnce();
    },
  );

  it.each(generatedStartCases)(
    'starts a %s generated piece in %s mode with the selected library',
    async (library, mode) => {
      const user = userEvent.setup();
      renderChooser();
      await user.click(screen.getByRole('radio', { name: 'Generated art piece' }));
      await user.selectOptions(screen.getByLabelText('Generated library'), library);
      await user.click(
        screen.getByRole('button', { name: mode === 'blank' ? 'Start blank' : 'Start with AI' }),
      );
      const params = new URLSearchParams({ engine: library });
      if (mode === 'blank') params.set('mode', 'blank');
      const expected = `/art-pieces?${params.toString()}`;
      expect(await screen.findByTestId('current-location')).toHaveTextContent(expected);
      expect(mockedCreateBlankProject).not.toHaveBeenCalled();
      expect(mockedCreateProject3D).not.toHaveBeenCalled();
    },
  );

  it('shows an accessible error and re-enables the start actions on creation failure', async () => {
    mockedCreateBlankProject.mockRejectedValue(new Error('boom'));
    const user = userEvent.setup();
    renderChooser();
    await user.click(screen.getByRole('button', { name: 'Start blank' }));
    expect(await screen.findByRole('alert')).toHaveTextContent(/could not create/i);
    expect(screen.getByRole('button', { name: 'Start blank' })).toBeEnabled();
    expect(screen.getByRole('button', { name: 'Start with AI' })).toBeEnabled();
  });
});
