import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { getRelatedPublicProjects } from '../api/projects';
import RelatedPublicProjects from './RelatedPublicProjects';

vi.mock('../api/projects', () => ({
  getRelatedPublicProjects: vi.fn(),
}));

const relatedProject = {
  id: 'related-2d',
  kind: '2d' as const,
  title: 'Related study',
  owner: 'Artist',
  owner_handle: 'artist',
  published_at: '2026-10-01T12:00:00Z',
  thumbnail_url: null,
  viewer_url: '/users/@artist/pieces/related-study',
};

beforeEach(() => vi.clearAllMocks());

function renderRelated(ready = true) {
  return render(
    <MemoryRouter>
      <RelatedPublicProjects projectId="source-2d" ready={ready} />
    </MemoryRouter>,
  );
}

describe('RelatedPublicProjects', () => {
  it('renders existing public cards after a successful non-empty response', async () => {
    vi.mocked(getRelatedPublicProjects).mockResolvedValue([relatedProject]);
    renderRelated();

    const user = userEvent.setup();
    const link = await screen.findByRole('link', { name: /Related study/ });
    expect(screen.getByRole('heading', { name: 'More like this' })).toBeInTheDocument();
    expect(link).toHaveAttribute('href', relatedProject.viewer_url);
    await user.tab();
    expect(link).toHaveFocus();
  });

  it('has no loading placeholder and omits an empty result', async () => {
    let resolveRequest!: (projects: (typeof relatedProject)[]) => void;
    vi.mocked(getRelatedPublicProjects).mockReturnValue(
      new Promise((resolve) => {
        resolveRequest = resolve;
      }),
    );
    renderRelated();

    expect(screen.queryByRole('heading', { name: 'More like this' })).not.toBeInTheDocument();
    expect(screen.queryByRole('status')).not.toBeInTheDocument();
    resolveRequest([]);
    await waitFor(() => expect(getRelatedPublicProjects).toHaveBeenCalledWith('source-2d'));
    expect(screen.queryByRole('heading', { name: 'More like this' })).not.toBeInTheDocument();
  });

  it('quietly omits the section after request failure', async () => {
    vi.mocked(getRelatedPublicProjects).mockRejectedValue(new Error('offline'));
    renderRelated();

    await waitFor(() => expect(getRelatedPublicProjects).toHaveBeenCalledTimes(1));
    expect(screen.queryByRole('heading', { name: 'More like this' })).not.toBeInTheDocument();
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });

  it('does not fetch before the main public piece is ready', async () => {
    vi.mocked(getRelatedPublicProjects).mockResolvedValue([relatedProject]);
    const { rerender } = renderRelated(false);

    expect(getRelatedPublicProjects).not.toHaveBeenCalled();
    rerender(
      <MemoryRouter>
        <RelatedPublicProjects projectId="source-2d" ready />
      </MemoryRouter>,
    );
    await screen.findByRole('heading', { name: 'More like this' });
    expect(getRelatedPublicProjects).toHaveBeenCalledWith('source-2d');
  });
});
