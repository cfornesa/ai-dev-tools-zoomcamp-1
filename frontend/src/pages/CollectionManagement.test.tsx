import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import * as collectionsApi from '../api/collections';
import { AuthContext } from '../auth/context';
import CollectionManagement from './CollectionManagement';

vi.mock('../api/collections', async () => {
  const actual = await vi.importActual<typeof import('../api/collections')>('../api/collections');
  return {
    ...actual,
    fetchCollections: vi.fn(),
    createCollection: vi.fn(),
    updateCollection: vi.fn(),
    replaceCollectionItems: vi.fn(),
    setCollectionPublished: vi.fn(),
    deleteCollection: vi.fn(),
  };
});

const mockedFetch = vi.mocked(collectionsApi.fetchCollections);
const mockedUpdate = vi.mocked(collectionsApi.updateCollection);
const mockedReplace = vi.mocked(collectionsApi.replaceCollectionItems);
const mockedPublish = vi.mocked(collectionsApi.setCollectionPublished);

const SAMPLE: collectionsApi.Collection = {
  id: 'collection-1',
  title: 'Spring studies',
  description: 'Small experiments',
  slug: 'spring-studies',
  handle: 'alice',
  owner: 'alice',
  visibility: 'private',
  published_at: null,
  created_at: '2026-01-01T00:00:00Z',
  updated_at: '2026-01-01T00:00:00Z',
  items: [
    {
      kind: 'project',
      id: 'project-1',
      position: 0,
      title: 'First work',
      viewer_url: '/p/project-1',
      thumbnail_url: null,
      label: '2D project',
    },
  ],
};

function renderPage() {
  return render(
    <AuthContext.Provider
      value={{
        status: 'signed-in',
        user: { username: 'alice', email: 'alice@example.com', is_application_admin: false },
      }}
    >
      <MemoryRouter>
        <CollectionManagement />
      </MemoryRouter>
    </AuthContext.Provider>,
  );
}

beforeEach(() => {
  vi.clearAllMocks();
  mockedFetch.mockResolvedValue([SAMPLE]);
  mockedUpdate.mockResolvedValue({ ...SAMPLE, title: 'Renamed' });
  mockedReplace.mockResolvedValue(SAMPLE);
  mockedPublish.mockResolvedValue({ ...SAMPLE, visibility: 'public' });
});

describe('CollectionManagement', () => {
  it('edits, reorders, publishes, and exposes item removal controls', async () => {
    const user = userEvent.setup();
    renderPage();
    expect(await screen.findByRole('heading', { name: 'Edit collection' })).toBeInTheDocument();

    const title = screen.getByLabelText('Title');
    await waitFor(() => expect(title).toHaveValue('Spring studies'));
    await user.clear(title);
    await user.type(title, 'Renamed');
    await user.click(screen.getByRole('button', { name: 'Save details' }));
    await waitFor(() => {
      expect(mockedUpdate).toHaveBeenCalledWith('collection-1', {
        title: 'Renamed',
        description: 'Small experiments',
        public_slug: 'spring-studies',
      });
    });

    await user.click(screen.getByRole('button', { name: /publish collection/i }));
    expect(mockedPublish).toHaveBeenCalledWith('collection-1', true);
    expect(screen.getByRole('button', { name: 'Remove' })).toBeInTheDocument();
  });

  it('rejects an empty create title before making an API call', async () => {
    const user = userEvent.setup();
    mockedFetch.mockResolvedValue([]);
    renderPage();
    await screen.findByRole('heading', { name: 'Create collection' });
    await user.click(screen.getByRole('button', { name: 'Create collection' }));
    expect(screen.getByRole('alert')).toHaveTextContent('Enter a collection title first.');
    expect(collectionsApi.createCollection).not.toHaveBeenCalled();
  });
});
