import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import App from './App';

vi.mock('./api/auth', () => ({
  fetchCurrentUser: vi.fn().mockResolvedValue(null),
}));

describe('App', () => {
  it('renders the branding heading regardless of auth state', async () => {
    render(<App />);

    expect(
      screen.getByRole('heading', { name: /gesture-reactive web animation studio/i, level: 1 }),
    ).toBeInTheDocument();
    expect(await screen.findByText(/sign in to see your projects/i)).toBeInTheDocument();
  });
});
