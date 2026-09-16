import { fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import * as collectionsApi from '../api/collections';
import CollectionImmersiveViewer from './CollectionImmersiveViewer';

vi.mock('../api/collections');

const mockedFetch = vi.mocked(collectionsApi.fetchPublicCollection);

const collection: collectionsApi.Collection = {
  id: 'collection-1',
  title: 'Night studies',
  description: '',
  slug: 'night-studies',
  handle: 'alice',
  owner: 'alice',
  visibility: 'public',
  published_at: '2026-09-16T00:00:00Z',
  created_at: '2026-09-16T00:00:00Z',
  updated_at: '2026-09-16T00:00:00Z',
  items: [
    {
      kind: 'project',
      id: 'piece-1',
      position: 0,
      title: 'First room',
      viewer_url: '/p/piece-1',
      thumbnail_url: '/thumb-1.png',
      label: '2D project',
    },
    {
      kind: 'project3d',
      id: 'piece-2',
      position: 1,
      title: 'Second room',
      viewer_url: '/p3d/piece-2',
      thumbnail_url: null,
      label: '3D project',
    },
  ],
};

function renderPage(path = '/users/@alice/night-studies/immersive') {
  window.history.replaceState({}, '', path);
  return render(
    <MemoryRouter initialEntries={[path]}>
      <Routes>
        <Route path="*" element={<CollectionImmersiveViewer />} />
      </Routes>
    </MemoryRouter>,
  );
}

describe('CollectionImmersiveViewer', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockedFetch.mockResolvedValue(collection);
  });

  it('mounts one live slot in deterministic order and navigates/reset with controls', async () => {
    renderPage();
    expect(await screen.findByTitle('Live view of First room')).toHaveAttribute(
      'src',
      '/embed/p/piece-1',
    );
    fireEvent.click(screen.getByRole('button', { name: 'Next' }));
    expect(await screen.findByTitle('Live view of Second room')).toHaveAttribute(
      'src',
      '/embed/p3d/piece-2',
    );
    fireEvent.click(screen.getByRole('button', { name: 'Reset' }));
    expect(await screen.findByTitle('Live view of First room')).toBeInTheDocument();
  });

  it('keeps the embed route chrome-less and reports capture fallback safely', async () => {
    renderPage('/embed/collections/@alice/night-studies');
    expect(await screen.findByTitle('Live view of First room')).toBeInTheDocument();
    expect(screen.queryByRole('heading', { name: 'Night studies' })).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Next' }));
    fireEvent.click(screen.getByRole('button', { name: 'Capture' }));
    expect(await screen.findByText('A capture is unavailable for this item.')).toBeInTheDocument();
  });
});
