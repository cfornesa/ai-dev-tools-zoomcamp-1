import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { describe, expect, it } from 'vitest';

import PieceCard from './PieceCard';
import { truncateExcerpt } from './pieceCardUtils';

describe('PieceCard', () => {
  it('renders a stored fallback thumbnail instead of hiding the available image', () => {
    render(
      <MemoryRouter>
        <PieceCard
          href="/users/@alice/pieces/fallback"
          title="Fallback piece"
          thumbnailUrl="/api/public/art-pieces/fallback/thumbnail.png"
          thumbnailIsFallback
        />
      </MemoryRouter>,
    );

    expect(screen.getByRole('presentation')).toHaveAttribute(
      'src',
      '/api/public/art-pieces/fallback/thumbnail.png',
    );
    expect(screen.queryByText('No preview available')).not.toBeInTheDocument();
  });

  it('uses the title as the image link name and renders the editorial metadata', () => {
    render(
      <MemoryRouter>
        <PieceCard
          href="/users/@alice/pieces/study"
          title="Editorial study"
          description="A short description."
          publishedAt="2026-09-21T12:00:00Z"
          thumbnailUrl="/study.png"
          kind="generated"
          engine="p5js"
        />
      </MemoryRouter>,
    );

    expect(document.querySelector('img')).toHaveAttribute('alt', '');
    expect(screen.getByRole('link', { name: 'Editorial study' })).toHaveAttribute(
      'href',
      '/users/@alice/pieces/study',
    );
    expect(screen.getByText('Sep 21, 2026')).toBeInTheDocument();
    expect(screen.getByText('Generated')).toBeInTheDocument();
    expect(screen.getByText('p5js')).toBeInTheDocument();
    expect(screen.getByText('A short description.')).toBeInTheDocument();
  });

  it('truncates at a word boundary and hides empty excerpts', () => {
    const long = `First sentence ${'word '.repeat(80)}`;
    expect(truncateExcerpt(long).length).toBeLessThanOrEqual(240);
    expect(truncateExcerpt(long).endsWith('…')).toBe(true);
    expect(truncateExcerpt('   ')).toBe('');
  });
});
