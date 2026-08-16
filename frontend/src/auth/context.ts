import { createContext } from 'react';

import type { CurrentUser } from '../api/auth';

export type AuthState =
  | { status: 'loading'; user: null }
  | { status: 'signed-out'; user: null }
  | { status: 'signed-in'; user: CurrentUser };

export const AuthContext = createContext<AuthState>({ status: 'loading', user: null });
