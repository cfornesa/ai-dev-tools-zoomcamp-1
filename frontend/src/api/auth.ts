import { ApiError, apiFetch } from './client';

export type CurrentUser = {
  username: string;
  email: string;
  is_application_admin: boolean;
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

/** Invalidates the Django session through allauth's CSRF-protected logout view. */
export async function logout(): Promise<void> {
  await apiFetch('/accounts/logout/', { method: 'POST' });
}
