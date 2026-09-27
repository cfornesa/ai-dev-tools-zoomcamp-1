import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import * as templatesApi from '../api/templates';
import { AuthContext } from '../auth/context';
import * as createActions from './galleryCreateActions';
import Templates from './Templates';

vi.mock('../api/templates');
vi.mock('./galleryCreateActions');

const mockedListTemplates = vi.mocked(templatesApi.listTemplates);
const mockedCreateLocalTemplate = vi.mocked(createActions.createLocalTemplate);

const SIGNED_IN_USER = {
  status: 'signed-in' as const,
  user: { username: 'alice', email: 'alice@example.com', is_application_admin: false },
};

function baseTemplate(overrides: Partial<templatesApi.Template> = {}): templatesApi.Template {
  return {
    id: 't1',
    source_type: 'built_in',
    owner: null,
    name: 'Blank canvas',
    category: 'Basics',
    description: 'Start from an empty canvas.',
    created_at: '2026-01-01T00:00:00Z',
    ...overrides,
  };
}

function renderTemplates() {
  return render(
    <AuthContext.Provider value={SIGNED_IN_USER}>
      <MemoryRouter initialEntries={['/templates']}>
        <Routes>
          <Route path="/templates" element={<Templates />} />
          <Route path="/local-projects/:id" element={<p>Local editor placeholder</p>} />
        </Routes>
      </MemoryRouter>
    </AuthContext.Provider>,
  );
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe('Templates loading/error states', () => {
  it('shows a loading status while templates are being fetched', () => {
    mockedListTemplates.mockReturnValue(new Promise(() => {})); // never resolves

    renderTemplates();

    expect(screen.getByRole('status')).toHaveTextContent(/loading templates/i);
  });

  it('shows an alert when the templates request fails', async () => {
    mockedListTemplates.mockRejectedValue(new Error('network down'));

    renderTemplates();

    expect(await screen.findByRole('alert')).toHaveTextContent(/couldn't load the template/i);
  });
});

describe('Templates catalog rendering', () => {
  it('groups templates by category with accessible headings', async () => {
    mockedListTemplates.mockResolvedValue([
      baseTemplate({ id: 't1', name: 'Blank canvas', category: 'Basics' }),
      baseTemplate({ id: 't2', name: 'Hand follower', category: 'Gesture basics' }),
      baseTemplate({ id: 't3', name: 'Pinch particle burst', category: 'Gesture basics' }),
    ]);

    renderTemplates();

    expect(await screen.findByRole('heading', { name: 'Basics' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Gesture basics' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Blank canvas' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Hand follower' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Pinch particle burst' })).toBeInTheDocument();
    expect(screen.getByRole('region', { name: 'Browse templates' })).toHaveClass('page-shell');
  });

  it('labels a private template distinctly from built-in ones', async () => {
    mockedListTemplates.mockResolvedValue([
      baseTemplate({ id: 't1', name: 'Blank canvas', source_type: 'built_in' }),
      baseTemplate({
        id: 't2',
        name: 'My template',
        source_type: 'private',
        owner: 'alice',
        category: 'Custom',
      }),
    ]);

    renderTemplates();

    expect(await screen.findByRole('heading', { name: 'My template' })).toBeInTheDocument();
    expect(screen.getByText('Your template')).toBeInTheDocument();
  });

  it('gives each template card an accessible, unambiguous use-template action', async () => {
    mockedListTemplates.mockResolvedValue([
      baseTemplate({ id: 't1', name: 'Blank canvas' }),
      baseTemplate({ id: 't2', name: 'Hand follower' }),
    ]);

    renderTemplates();

    expect(
      await screen.findByRole('button', { name: /use the "blank canvas" template/i }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: /use the "hand follower" template/i }),
    ).toBeInTheDocument();
  });
});

describe('Templates local creation action', () => {
  it('navigates to the local project editor after transfer', async () => {
    mockedListTemplates.mockResolvedValue([baseTemplate({ id: 't1', name: 'Blank canvas' })]);
    mockedCreateLocalTemplate.mockResolvedValue('/local-projects/new-project');
    const user = userEvent.setup();

    renderTemplates();
    const useButton = await screen.findByRole('button', { name: /use the "blank canvas"/i });

    await user.click(useButton);

    await waitFor(() => expect(screen.getByText('Local editor placeholder')).toBeInTheDocument());
    expect(mockedCreateLocalTemplate).toHaveBeenCalledWith('t1');
  });

  it('shows an accessible error and re-enables the button on failure', async () => {
    mockedListTemplates.mockResolvedValue([baseTemplate({ id: 't1', name: 'Blank canvas' })]);
    mockedCreateLocalTemplate.mockRejectedValue(new Error('boom'));
    const user = userEvent.setup();

    renderTemplates();
    const useButton = await screen.findByRole('button', { name: /use the "blank canvas"/i });

    await user.click(useButton);

    expect(await screen.findByRole('alert')).toHaveTextContent(/could not create a project/i);
    expect(screen.getByRole('button', { name: /use the "blank canvas"/i })).toBeEnabled();
  });
});
