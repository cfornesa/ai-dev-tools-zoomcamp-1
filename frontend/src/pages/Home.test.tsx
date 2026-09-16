import { render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom';
import { describe, expect, it } from 'vitest';

import { AuthContext } from '../auth/context';
import Home from './Home';

function Destination() {
  return <output data-testid="destination">{useLocation().pathname}</output>;
}

describe('Home compatibility routing', () => {
  it('routes signed-out visitors to the public gallery', () => {
    render(
      <AuthContext.Provider value={{ status: 'signed-out', user: null }}>
        <MemoryRouter initialEntries={['/home']}>
          <Routes>
            <Route path="*" element={<Home />} />
            <Route path="/gallery" element={<Destination />} />
          </Routes>
        </MemoryRouter>
      </AuthContext.Provider>,
    );
    expect(screen.getByTestId('destination')).toHaveTextContent('/gallery');
  });

  it('routes signed-in visitors to Studio', () => {
    render(
      <AuthContext.Provider
        value={{
          status: 'signed-in',
          user: { username: 'alice', email: 'alice@example.com', is_application_admin: false },
        }}
      >
        <MemoryRouter initialEntries={['/']}>
          <Routes>
            <Route path="*" element={<Home />} />
            <Route path="/studio" element={<Destination />} />
          </Routes>
        </MemoryRouter>
      </AuthContext.Provider>,
    );
    expect(screen.getByTestId('destination')).toHaveTextContent('/studio');
  });
});
