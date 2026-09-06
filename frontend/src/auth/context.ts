import { createContext } from 'react';

import type { CurrentUser } from '../api/auth';

type Shared = {
  logout?: () => Promise<void>;
  logoutError?: string | null;
  /** Issue #441: marks the session signed-out locally, with no network
   * call -- for a caller (`AccountSessions.tsx`) that already knows the
   * server-side session is gone because it revoked it directly, rather
   * than through the shared `logout()` above. */
  signOutLocally?: () => void;
};

export type AuthState =
  | ({ status: 'loading'; user: null } & Shared)
  | ({ status: 'signed-out'; user: null } & Shared)
  | ({ status: 'signed-in'; user: CurrentUser } & Shared);

export const AuthContext = createContext<AuthState>({
  status: 'loading',
  user: null,
  logout: async () => {},
  logoutError: null,
  signOutLocally: () => {},
});
