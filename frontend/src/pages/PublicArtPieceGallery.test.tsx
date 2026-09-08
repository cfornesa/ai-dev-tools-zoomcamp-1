import { render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom';
import { describe, expect, it } from 'vitest';

import PublicArtPieceGallery from './PublicArtPieceGallery';

function LocationProbe() {
  const location = useLocation();
  return (
    <div data-testid="location-probe">
      {location.pathname}
      {location.search}
    </div>
  );
}

describe('PublicArtPieceGallery', () => {
  it('redirects to the unified gallery with the generated filter pre-selected', () => {
    render(
      <MemoryRouter initialEntries={['/art-pieces/gallery']}>
        <Routes>
          <Route path="/art-pieces/gallery" element={<PublicArtPieceGallery />} />
          <Route path="/gallery" element={<LocationProbe />} />
        </Routes>
      </MemoryRouter>,
    );

    expect(screen.getByTestId('location-probe')).toHaveTextContent('/gallery?type=generated');
  });
});
