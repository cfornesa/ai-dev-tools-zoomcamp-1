import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { describe, expect, it } from 'vitest';

import PieceCard from './PieceCard';

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

    expect(screen.getByRole('img', { name: 'Fallback preview of Fallback piece' })).toHaveAttribute(
      'src',
      '/api/public/art-pieces/fallback/thumbnail.png',
    );
    expect(screen.queryByText('No preview available')).not.toBeInTheDocument();
  });
});
