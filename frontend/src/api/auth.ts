import { ApiError, apiFetch } from './client';

export type CurrentUser = {
  username: string;
  email: string;
};

/** Returns the signed-in user, or null if nobody is signed in. */
export async function fetchCurrentUser(): Promise<CurrentUser | null> {
  try {
    return await apiFetch<CurrentUser>('/api/whoami/');
  } catch (err) {
    if (err instanceof ApiError && err.status === 401) {
      return null;
    }
    throw err;
  }
}
