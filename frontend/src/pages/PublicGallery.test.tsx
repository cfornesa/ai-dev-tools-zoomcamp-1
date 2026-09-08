import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import * as projectsApi from '../api/projects';
import PublicGallery from './PublicGallery';

vi.mock('../api/projects');

const mockedFetchPublicGallery = vi.mocked(projectsApi.fetchPublicGallery);

function baseItem(
  overrides: Partial<projectsApi.PublicGalleryItem> & {
    kind?: projectsApi.PublicGalleryItemKind;
  } = {},
): projectsApi.PublicGalleryItem {
  const kind = overrides.kind ?? '2d';
  const base = {
    id: 'p1',
    title: 'Hand Follower',
    owner: 'alice',
    thumbnail_url: '/api/public/projects/p1/thumbnail.png',
    published_at: '2026-08-01T00:00:00Z',
    viewer_url: '/p/p1',
    kind,
  };
  if (kind === 'generated') {
    return {
      ...base,
      kind: 'generated',
      engine: 'canvas2d',
      ...overrides,
    } as projectsApi.PublicGalleryGeneratedItem;
  }
  return { ...base, kind, ...overrides } as projectsApi.PublicGalleryItem;
}

function renderPublicGallery(initialEntries: string[] = ['/gallery']) {
  return render(
    <MemoryRouter initialEntries={initialEntries}>
      <PublicGallery />
    </MemoryRouter>,
  );
}

beforeEach(() => {
  vi.resetAllMocks();
});

describe('PublicGallery loading/error/empty states', () => {
  it('shows an accessible loading status while the first page is fetched', () => {
    mockedFetchPublicGallery.mockReturnValue(new Promise(() => {})); // never resolves

    renderPublicGallery();

    expect(screen.getByRole('status')).toHaveTextContent(/loading the public gallery/i);
  });

  it('shows an accessible alert with a retry action when the initial load fails', async () => {
    mockedFetchPublicGallery.mockRejectedValueOnce(new Error('network down'));

    renderPublicGallery();

    expect(await screen.findByRole('alert')).toHaveTextContent(/couldn't load the public gallery/i);
    const retryButton = screen.getByRole('button', { name: /retry/i });
    expect(retryButton.tagName).toBe('BUTTON');

    mockedFetchPublicGallery.mockResolvedValueOnce({
      results: [baseItem()],
      next_cursor: null,
      has_more: false,
    });
    const user = userEvent.setup();
    await user.click(retryButton);

    expect(await screen.findByRole('heading', { name: 'Hand Follower' })).toBeInTheDocument();
  });

  it('shows a clear empty state when there are no public pieces', async () => {
    mockedFetchPublicGallery.mockResolvedValue({ results: [], next_cursor: null, has_more: false });

    renderPublicGallery();

    expect(await screen.findByText(/no public pieces yet/i)).toBeInTheDocument();
  });

  it('shows a filter-specific empty state with recovery to All for the authored filter', async () => {
    mockedFetchPublicGallery.mockResolvedValue({ results: [], next_cursor: null, has_more: false });

    renderPublicGallery(['/gallery?type=authored']);

    expect(await screen.findByText(/no authored public pieces yet/i)).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /show all gallery pieces/i })).toHaveAttribute(
      'href',
      '/gallery',
    );
  });

  it('shows a filter-specific empty state with recovery to All for the generated filter', async () => {
    mockedFetchPublicGallery.mockResolvedValue({ results: [], next_cursor: null, has_more: false });

    renderPublicGallery(['/gallery?type=generated']);

    expect(await screen.findByText(/no generated public pieces yet/i)).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /show all gallery pieces/i })).toBeInTheDocument();
  });
});

describe('PublicGallery filter control', () => {
  it('renders a labeled select with exactly All, Authored, and Generated options', async () => {
    mockedFetchPublicGallery.mockResolvedValue({ results: [], next_cursor: null, has_more: false });

    renderPublicGallery();
    await screen.findByText(/no public pieces yet/i);

    const select = screen.getByRole('combobox', { name: /gallery type/i });
    expect(select).toBeInTheDocument();
    const options = screen.getAllByRole('option');
    expect(options.map((o) => (o as HTMLOptionElement).value)).toEqual([
      'all',
      'authored',
      'generated',
    ]);
    expect(options.map((o) => o.textContent)).toEqual(['All', 'Authored', 'Generated']);
  });

  it('selects All when the type query parameter is absent', async () => {
    mockedFetchPublicGallery.mockResolvedValue({ results: [], next_cursor: null, has_more: false });

    renderPublicGallery();
    await screen.findByText(/no public pieces yet/i);

    expect(screen.getByRole('combobox', { name: /gallery type/i })).toHaveValue('all');
    expect(mockedFetchPublicGallery).toHaveBeenCalledWith('all');
  });

  it('selects the filter matching the type query parameter on direct load', async () => {
    mockedFetchPublicGallery.mockResolvedValue({ results: [], next_cursor: null, has_more: false });

    renderPublicGallery(['/gallery?type=generated']);
    await screen.findByText(/no generated public pieces yet/i);

    expect(screen.getByRole('combobox', { name: /gallery type/i })).toHaveValue('generated');
    expect(mockedFetchPublicGallery).toHaveBeenCalledWith('generated');
  });

  it('recovers an invalid type query value to All', async () => {
    mockedFetchPublicGallery.mockResolvedValue({ results: [], next_cursor: null, has_more: false });

    renderPublicGallery(['/gallery?type=unknown']);
    await screen.findByText(/no public pieces yet/i);

    expect(screen.getByRole('combobox', { name: /gallery type/i })).toHaveValue('all');
    expect(mockedFetchPublicGallery).toHaveBeenCalledWith('all');
  });

  it('updates the URL when the filter is changed via keyboard', async () => {
    mockedFetchPublicGallery.mockResolvedValue({ results: [], next_cursor: null, has_more: false });
    const user = userEvent.setup();

    renderPublicGallery();
    await screen.findByText(/no public pieces yet/i);

    const select = screen.getByRole('combobox', { name: /gallery type/i });
    await user.selectOptions(select, 'generated');

    expect(mockedFetchPublicGallery).toHaveBeenLastCalledWith('generated');
  });

  it('keeps control and URL in sync when the location changes (reload, Back, Forward)', async () => {
    mockedFetchPublicGallery.mockResolvedValue({ results: [], next_cursor: null, has_more: false });
    const user = userEvent.setup();

    const { rerender } = render(
      <MemoryRouter initialEntries={['/gallery']}>
        <PublicGallery />
      </MemoryRouter>,
    );
    await screen.findByText(/no public pieces yet/i);

    const select = screen.getByRole('combobox', { name: /gallery type/i });
    await user.selectOptions(select, 'authored');
    expect(mockedFetchPublicGallery).toHaveBeenLastCalledWith('authored');

    // Simulate a location change (e.g. browser Back/Forward or reload): a
    // fresh render at `/gallery` must re-derive the control state from the
    // URL, not from stale local state.
    rerender(
      <MemoryRouter key="location-change" initialEntries={['/gallery']}>
        <PublicGallery />
      </MemoryRouter>,
    );
    await screen.findByText(/no public pieces yet/i);
    expect(screen.getByRole('combobox', { name: /gallery type/i })).toHaveValue('all');
  });
});

describe('PublicGallery card rendering', () => {
  it('renders each card with title, thumbnail, creator attribution, and type badge', async () => {
    mockedFetchPublicGallery.mockResolvedValue({
      results: [
        baseItem({ id: 'p1', title: 'Hand Follower', owner: 'alice' }),
        baseItem({ id: 'p2', title: 'Pinch Burst', owner: 'bob' }),
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
    expect(screen.getAllByText('2D')).toHaveLength(2);
  });

  it('renders 3D cards with the 3D viewer link and 3D badge', async () => {
    mockedFetchPublicGallery.mockResolvedValue({
      results: [
        baseItem({ id: 'p3d-1', title: 'Sphere study', kind: '3d', viewer_url: '/p3d/p3d-1' }),
      ],
      next_cursor: null,
      has_more: false,
    });

    renderPublicGallery();

    expect(await screen.findByRole('heading', { name: 'Sphere study' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /sphere study/i })).toHaveAttribute(
      'href',
      '/p3d/p3d-1',
    );
    expect(screen.getByText('3D')).toBeInTheDocument();
  });

  it('renders generated cards with the art-piece viewer link, Generated badge, and engine label', async () => {
    mockedFetchPublicGallery.mockResolvedValue({
      results: [
        baseItem({
          id: 'gen-1',
          title: 'Calm blue field',
          kind: 'generated',
          engine: 'canvas2d',
          viewer_url: '/art-pieces/p/gen-1',
        }),
      ],
      next_cursor: null,
      has_more: false,
    });

    renderPublicGallery();

    expect(await screen.findByRole('heading', { name: 'Calm blue field' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /calm blue field/i })).toHaveAttribute(
      'href',
      '/art-pieces/p/gen-1',
    );
    const card = screen.getByTestId('gallery-card-gen-1');
    expect(within(card).getByText('Generated')).toBeInTheDocument();
    expect(within(card).getByText('canvas2d')).toBeInTheDocument();
  });

  it('shows an accessible fallback when an item has no thumbnail_url', async () => {
    mockedFetchPublicGallery.mockResolvedValue({
      results: [baseItem({ id: 'p1', thumbnail_url: null })],
      next_cursor: null,
      has_more: false,
    });

    renderPublicGallery();

    expect(await screen.findByRole('img', { name: /no preview available/i })).toBeInTheDocument();
  });

  it('swaps to the accessible fallback when the thumbnail image fails to load', async () => {
    mockedFetchPublicGallery.mockResolvedValue({
      results: [baseItem({ id: 'p1', title: 'Hand Follower' })],
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
    mockedFetchPublicGallery.mockResolvedValueOnce({
      results: [baseItem({ id: 'p1', title: 'First' })],
      next_cursor: 'cursor-1',
      has_more: true,
    });
    mockedFetchPublicGallery.mockResolvedValueOnce({
      results: [baseItem({ id: 'p2', title: 'Second' })],
      next_cursor: null,
      has_more: false,
    });
    const user = userEvent.setup();

    renderPublicGallery();
    await screen.findByRole('heading', { name: 'First' });

    const select = screen.getByRole('combobox', { name: /gallery type/i });
    const loadMoreButton = screen.getByRole('button', { name: /load more/i });
    expect(loadMoreButton.tagName).toBe('BUTTON');
    // Issue #491: the filter select is now the first focusable control in
    // the gallery, before the card grid and the Load more button.
    await user.tab();
    expect(select).toHaveFocus();
    await user.tab();
    expect(screen.getByRole('link', { name: /first/i })).toHaveFocus();
    await user.tab();
    expect(loadMoreButton).toHaveFocus();
    await user.keyboard('{Enter}');

    await screen.findByRole('heading', { name: 'Second' });
    expect(screen.getByRole('heading', { name: 'First' })).toBeInTheDocument();
    expect(screen.getAllByRole('article')).toHaveLength(2);
    expect(mockedFetchPublicGallery).toHaveBeenNthCalledWith(2, 'all', { cursor: 'cursor-1' });
  });

  it('de-duplicates a repeated card defensively even if the API ever returned one', async () => {
    mockedFetchPublicGallery.mockResolvedValueOnce({
      results: [baseItem({ id: 'p1', title: 'First' })],
      next_cursor: 'cursor-1',
      has_more: true,
    });
    mockedFetchPublicGallery.mockResolvedValueOnce({
      results: [baseItem({ id: 'p1', title: 'First' }), baseItem({ id: 'p2', title: 'Second' })],
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
    mockedFetchPublicGallery.mockResolvedValue({
      results: [baseItem({ id: 'p1' })],
      next_cursor: null,
      has_more: false,
    });

    renderPublicGallery();
    await screen.findByRole('heading', { name: 'Hand Follower' });

    expect(screen.getByRole('status')).toHaveTextContent(/reached the end/i);
    expect(screen.queryByRole('button', { name: /load more/i })).not.toBeInTheDocument();
  });

  it('shows an accessible error and keeps existing cards when loading more fails', async () => {
    mockedFetchPublicGallery.mockResolvedValueOnce({
      results: [baseItem({ id: 'p1', title: 'First' })],
      next_cursor: 'cursor-1',
      has_more: true,
    });
    mockedFetchPublicGallery.mockRejectedValueOnce(new Error('boom'));
    const user = userEvent.setup();

    renderPublicGallery();
    await screen.findByRole('heading', { name: 'First' });
    await user.click(screen.getByRole('button', { name: /load more/i }));

    expect(await screen.findByRole('alert')).toHaveTextContent(/could not load more/i);
    expect(screen.getByRole('heading', { name: 'First' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /load more/i })).toBeEnabled();
  });
});
