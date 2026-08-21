import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import App from './App';

const shellDocument = new DOMParser().parseFromString(
  readFileSync(resolve(process.cwd(), 'index.html'), 'utf8'),
  'text/html',
);

vi.mock('./api/auth', () => ({
  fetchCurrentUser: vi.fn().mockResolvedValue(null),
}));

describe('App', () => {
  it('renders the branding heading regardless of auth state', async () => {
    render(<App />);

    expect(
      screen.getByRole('heading', { name: 'Creatrweb Animation Studio', level: 1 }),
    ).toBeInTheDocument();
    expect(shellDocument.title).toBe('Creatrweb Animation Studio');
    expect(await screen.findByText(/sign in to see your projects/i)).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Sign in with Google' })).toHaveClass('shell-action');
    expect(screen.getByRole('link', { name: 'Sign in with Google' })).toHaveAttribute(
      'href',
      '/accounts/login/',
    );
    expect(screen.getByText(/sign in to see your projects/i).closest('.content-panel')).not.toBeNull();
  });
});
