import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import CosmicStarField, { COSMIC_STAR_COUNT, cosmicStars } from './CosmicStarField';

describe('CosmicStarField (#807)', () => {
  it('is decorative and renders a bounded star count', () => {
    const { container } = render(<CosmicStarField />);
    const field = screen.getByTestId('cosmic-starfield');
    expect(field).toHaveAttribute('aria-hidden', 'true');
    expect(container.querySelectorAll('.cosmic-star')).toHaveLength(COSMIC_STAR_COUNT);
    expect(COSMIC_STAR_COUNT).toBeLessThanOrEqual(120);
    expect(cosmicStars(500)).toHaveLength(120);
  });
});
