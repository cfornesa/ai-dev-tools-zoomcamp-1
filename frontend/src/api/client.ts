/**
 * Thin fetch wrapper for the Django API: attaches the session cookie,
 * sets the CSRF header Django requires on unsafe methods, and normalizes
 * error responses into a typed ApiError.
 *
 * Requests use relative paths ('/api/...') so they're same-origin in dev
 * (proxied by vite.config.ts) and in any deployment that serves the
 * frontend and API from the same host. VITE_API_BASE_URL only matters for
 * a genuinely cross-origin deployment, which isn't set up yet (CORS/
 * SameSite cookie configuration would be needed on the Django side too).
 */

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL ?? '';

const UNSAFE_METHODS = new Set(['POST', 'PATCH', 'PUT', 'DELETE']);

export class ApiError extends Error {
  status: number;
  body: unknown;

  constructor(status: number, body: unknown) {
    super(`API request failed with status ${status}`);
    this.name = 'ApiError';
    this.status = status;
    this.body = body;
  }
}

function readCookie(name: string): string | null {
  const match = document.cookie.match(new RegExp(`(?:^|; )${name}=([^;]*)`));
  return match ? decodeURIComponent(match[1]) : null;
}

export async function apiFetch<T>(path: string, options: RequestInit = {}): Promise<T> {
  const method = (options.method ?? 'GET').toUpperCase();
  const headers = new Headers(options.headers);

  if (UNSAFE_METHODS.has(method)) {
    const csrfToken = readCookie('csrftoken');
    if (csrfToken) headers.set('X-CSRFToken', csrfToken);
  }
  if (options.body !== undefined && !headers.has('Content-Type')) {
    headers.set('Content-Type', 'application/json');
  }

  const response = await fetch(`${API_BASE_URL}${path}`, {
    ...options,
    method,
    headers,
    credentials: 'include',
  });

  if (response.status === 204) {
    return undefined as T;
  }

  const text = await response.text();
  let body: unknown = null;
  if (text) {
    try {
      body = JSON.parse(text);
    } catch {
      body = text;
    }
  }

  if (!response.ok) {
    throw new ApiError(response.status, body);
  }

  return body as T;
}
