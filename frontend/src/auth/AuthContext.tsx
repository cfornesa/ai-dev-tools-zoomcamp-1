import { useEffect, useState, type ReactNode } from 'react';

import { fetchCurrentUser } from '../api/auth';
import { AuthContext, type AuthState } from './context';

/** A network failure while checking auth is treated as signed-out rather than
 * crashing the app — the user can retry via the normal sign-in link. */
export function AuthProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<AuthState>({ status: 'loading', user: null });

  useEffect(() => {
    let cancelled = false;
    fetchCurrentUser()
      .then((user) => {
        if (cancelled) return;
        setState(user ? { status: 'signed-in', user } : { status: 'signed-out', user: null });
      })
      .catch(() => {
        if (cancelled) return;
        setState({ status: 'signed-out', user: null });
      });
    return () => {
      cancelled = true;
    };
  }, []);

  return <AuthContext.Provider value={state}>{children}</AuthContext.Provider>;
}
