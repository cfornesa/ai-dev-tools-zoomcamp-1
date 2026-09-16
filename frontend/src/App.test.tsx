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

    expect(screen.getByRole('heading', { name: 'AugmentrART', level: 1 })).toBeInTheDocument();
    expect(shellDocument.title).toBe('AugmentrART');
    expect(
      await screen.findByText(/we couldn't load the public gallery|public gallery/i),
    ).toBeInTheDocument();
  });
});
