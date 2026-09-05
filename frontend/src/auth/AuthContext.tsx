import { useEffect, useState, type ReactNode } from 'react';

import { fetchCurrentUser, logout as logoutSession } from '../api/auth';
import { AuthContext, type AuthState } from './context';

/** A network failure while checking auth is treated as signed-out rather than
 * crashing the app — the user can retry via the normal sign-in link. */
export function AuthProvider({ children }: { children: ReactNode }) {
  const [authResult, setAuthResult] = useState<AuthState>({
    status: 'loading',
    user: null,
  });
  const [logoutError, setLogoutError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    fetchCurrentUser()
      .then((user) => {
        if (cancelled) return;
        setAuthResult(user ? { status: 'signed-in', user } : { status: 'signed-out', user: null });
      })
      .catch(() => {
        if (cancelled) return;
        setAuthResult({ status: 'signed-out', user: null });
      });
    return () => {
      cancelled = true;
    };
  }, []);

  async function logout() {
    setLogoutError(null);
    try {
      await logoutSession();
      setAuthResult({ status: 'signed-out', user: null });
    } catch {
      setLogoutError('We could not log you out. Please try again.');
      throw new Error('Logout failed');
    }
  }

  function signOutLocally() {
    setAuthResult({ status: 'signed-out', user: null });
  }

  return (
    <AuthContext.Provider value={{ ...authResult, logout, logoutError, signOutLocally }}>
      {children}
    </AuthContext.Provider>
  );
}
