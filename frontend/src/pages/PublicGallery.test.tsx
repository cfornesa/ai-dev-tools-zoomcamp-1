import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import * as projectsApi from '../api/projects';
import PublicGallery from './PublicGallery';

vi.mock('../api/projects');

const mockedListPublicGallery = vi.mocked(projectsApi.listPublicGallery);

function baseProject(
  overrides: Partial<projectsApi.PublicGalleryProject> = {},
): projectsApi.PublicGalleryProject {
  return {
    id: 'p1',
    title: 'Hand Follower',
    owner: 'alice',
    thumbnail_url: '/api/public/projects/p1/thumbnail.png',
    remix_provenance: null,
    published_at: '2026-08-01T00:00:00Z',
    ...overrides,
  };
}

function renderPublicGallery() {
  return render(
    <MemoryRouter initialEntries={['/gallery']}>
      <PublicGallery />
    </MemoryRouter>,
  );
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe('PublicGallery loading/error/empty states', () => {
  it('shows an accessible loading status while the first page is fetched', () => {
    mockedListPublicGallery.mockReturnValue(new Promise(() => {})); // never resolves

    renderPublicGallery();

    expect(screen.getByRole('status')).toHaveTextContent(/loading the public gallery/i);
  });

  it('shows an accessible alert with a retry action when the initial load fails', async () => {
    mockedListPublicGallery.mockRejectedValueOnce(new Error('network down'));

    renderPublicGallery();

    expect(await screen.findByRole('alert')).toHaveTextContent(/couldn't load the public gallery/i);
    const retryButton = screen.getByRole('button', { name: /retry/i });
    expect(retryButton.tagName).toBe('BUTTON');

    mockedListPublicGallery.mockResolvedValueOnce({
      results: [baseProject()],
      next_cursor: null,
      has_more: false,
    });
    const user = userEvent.setup();
    await user.click(retryButton);

    expect(await screen.findByRole('heading', { name: 'Hand Follower' })).toBeInTheDocument();
  });

  it('shows a clear empty state when there are no public projects', async () => {
    mockedListPublicGallery.mockResolvedValue({ results: [], next_cursor: null, has_more: false });

    renderPublicGallery();

    expect(await screen.findByText(/no public projects yet/i)).toBeInTheDocument();
  });
});

describe('PublicGallery card rendering', () => {
  it('renders each card with title, thumbnail, and creator attribution', async () => {
    mockedListPublicGallery.mockResolvedValue({
      results: [
        baseProject({ id: 'p1', title: 'Hand Follower', owner: 'alice' }),
        baseProject({ id: 'p2', title: 'Pinch Burst', owner: 'bob' }),
      ],
      next_cursor: null,
      has_more: false,
    });

    renderPublicGallery();

    expect(await screen.findByRole('heading', { name: 'Hand Follower' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Pinch Burst' })).toBeInTheDocument();
    expect(screen.getByText('By alice')).toBeInTheDocument();
    expect(screen.getByText('By bob')).toBeInTheDocument();
    expect(screen.getByRole('img', { name: /preview of hand follower/i })).toBeInTheDocument();
  });

  it('renders nothing in the provenance slot when remix_provenance is absent', async () => {
    mockedListPublicGallery.mockResolvedValue({
      results: [baseProject({ id: 'p1', remix_provenance: null })],
      next_cursor: null,
      has_more: false,
    });

    renderPublicGallery();
    await screen.findByRole('heading', { name: 'Hand Follower' });

    expect(screen.queryByTestId('provenance-p1')).not.toBeInTheDocument();
  });

  it('renders the provenance slot when remix_provenance is present', async () => {
    mockedListPublicGallery.mockResolvedValue({
      results: [baseProject({ id: 'p1', remix_provenance: {} })],
      next_cursor: null,
      has_more: false,
    });

    renderPublicGallery();
    await screen.findByRole('heading', { name: 'Hand Follower' });

    expect(screen.getByTestId('provenance-p1')).toBeInTheDocument();
  });

  it('shows an accessible fallback when a project has no thumbnail_url', async () => {
    mockedListPublicGallery.mockResolvedValue({
      results: [baseProject({ id: 'p1', thumbnail_url: null })],
      next_cursor: null,
      has_more: false,
    });

    renderPublicGallery();

    expect(await screen.findByRole('img', { name: /no preview available/i })).toBeInTheDocument();
  });

  it('swaps to the accessible fallback when the thumbnail image fails to load', async () => {
    mockedListPublicGallery.mockResolvedValue({
      results: [baseProject({ id: 'p1', title: 'Hand Follower' })],
      next_cursor: null,
      has_more: false,
    });

    renderPublicGallery();
    const image = await screen.findByRole('img', { name: /preview of hand follower/i });

    image.dispatchEvent(new Event('error'));

    expect(
      await screen.findByRole('img', { name: /no preview available for hand follower/i }),
    ).toBeInTheDocument();
  });
});

describe('PublicGallery pagination', () => {
  it('loads the next page on a keyboard-operable "Load more" action with no duplicate cards', async () => {
    mockedListPublicGallery.mockResolvedValueOnce({
      results: [baseProject({ id: 'p1', title: 'First' })],
      next_cursor: 'cursor-1',
      has_more: true,
    });
    mockedListPublicGallery.mockResolvedValueOnce({
      results: [baseProject({ id: 'p2', title: 'Second' })],
      next_cursor: null,
      has_more: false,
    });
    const user = userEvent.setup();

    renderPublicGallery();
    await screen.findByRole('heading', { name: 'First' });

    const loadMoreButton = screen.getByRole('button', { name: /load more/i });
    expect(loadMoreButton.tagName).toBe('BUTTON');
    // Task 51 (issue #53): each card is now a link to the public viewer
    // (`/p/<id>`), so "Load more" is the *second* stop in tab order, after
    // the one card's link.
    await user.tab();
    expect(screen.getByRole('link', { name: /first/i })).toHaveFocus();
    await user.tab();
    expect(loadMoreButton).toHaveFocus();
    await user.keyboard('{Enter}');

    await screen.findByRole('heading', { name: 'Second' });
    expect(screen.getByRole('heading', { name: 'First' })).toBeInTheDocument();
    expect(screen.getAllByRole('article')).toHaveLength(2);
    expect(mockedListPublicGallery).toHaveBeenNthCalledWith(2, { cursor: 'cursor-1' });
  });

  it('de-duplicates a repeated card defensively even if the API ever returned one', async () => {
    mockedListPublicGallery.mockResolvedValueOnce({
      results: [baseProject({ id: 'p1', title: 'First' })],
      next_cursor: 'cursor-1',
      has_more: true,
    });
    mockedListPublicGallery.mockResolvedValueOnce({
      results: [
        baseProject({ id: 'p1', title: 'First' }),
        baseProject({ id: 'p2', title: 'Second' }),
      ],
      next_cursor: null,
      has_more: false,
    });
    const user = userEvent.setup();

    renderPublicGallery();
    await screen.findByRole('heading', { name: 'First' });
    await user.click(screen.getByRole('button', { name: /load more/i }));

    await screen.findByRole('heading', { name: 'Second' });
    expect(screen.getAllByRole('heading', { name: 'First' })).toHaveLength(1);
  });

  it('shows a clear, accessible end-of-results state once has_more is false', async () => {
    mockedListPublicGallery.mockResolvedValue({
      results: [baseProject({ id: 'p1' })],
      next_cursor: null,
      has_more: false,
    });

    renderPublicGallery();
    await screen.findByRole('heading', { name: 'Hand Follower' });

    expect(screen.getByRole('status')).toHaveTextContent(/reached the end/i);
    expect(screen.queryByRole('button', { name: /load more/i })).not.toBeInTheDocument();
  });

  it('shows an accessible error and keeps existing cards when loading more fails', async () => {
    mockedListPublicGallery.mockResolvedValueOnce({
      results: [baseProject({ id: 'p1', title: 'First' })],
      next_cursor: 'cursor-1',
      has_more: true,
    });
    mockedListPublicGallery.mockRejectedValueOnce(new Error('boom'));
    const user = userEvent.setup();

    renderPublicGallery();
    await screen.findByRole('heading', { name: 'First' });
    await user.click(screen.getByRole('button', { name: /load more/i }));

    expect(await screen.findByRole('alert')).toHaveTextContent(/could not load more/i);
    expect(screen.getByRole('heading', { name: 'First' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /load more/i })).toBeEnabled();
  });
});
