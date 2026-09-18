import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { describe, expect, it } from 'vitest';

import PieceCard from './PieceCard';

describe('PieceCard', () => {
  it('uses the explicit fallback flag before attempting to load a placeholder image', () => {
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

    expect(
      screen.getByRole('img', { name: 'No preview available for Fallback piece' }),
    ).toBeVisible();
    expect(screen.queryByAltText('Preview of Fallback piece')).not.toBeInTheDocument();
  });
});
