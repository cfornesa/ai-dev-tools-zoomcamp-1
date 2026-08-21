import { createContext } from 'react';

import type { CurrentUser } from '../api/auth';

export type AuthState =
  | { status: 'loading'; user: null; logout?: () => Promise<void>; logoutError?: string | null }
  | { status: 'signed-out'; user: null; logout?: () => Promise<void>; logoutError?: string | null }
  | {
      status: 'signed-in';
      user: CurrentUser;
      logout?: () => Promise<void>;
      logoutError?: string | null;
    };

export const AuthContext = createContext<AuthState>({
  status: 'loading',
  user: null,
  logout: async () => {},
  logoutError: null,
});
