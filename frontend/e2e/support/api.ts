/**
 * Task 65 (issue #65): raw HTTP request helpers for test *setup* and for
 * the failure-injection/concurrency scenarios, which the issue's own
 * brief says are "reasonable and expected" to drive directly rather than
 * through UI clicks (see `projectLifecycle.spec.ts`'s module doc comment
 * for the full rationale on each).
 *
 * These wrap a Playwright `BrowserContext`'s built-in `request` fixture,
 * which already shares that context's cookie jar with whatever page(s)
 * are open in it -- so a raw POST issued right after `loginViaUI` carries
 * the same Django session cookie the browser itself is using; no separate
 * login-over-HTTP path is needed.
 *
 * Django's `CsrfViewMiddleware` requires an `X-CSRFToken` header matching
 * the `csrftoken` cookie on every unsafe (`POST`/`PATCH`/`DELETE`) request
 * under `SessionAuthentication` (DRF's default) -- exactly what
 * `frontend/src/api/client.ts` already does for the app's own fetch
 * calls. `csrfHeaders` below reads that cookie from the context the same
 * way.
 */
import type { APIResponse, BrowserContext } from '@playwright/test';

async function csrfHeaders(context: BrowserContext): Promise<Record<string, string>> {
  const cookies = await context.cookies();
  const csrfCookie = cookies.find((c) => c.name === 'csrftoken');
  if (!csrfCookie) {
    throw new Error(
      "No 'csrftoken' cookie found on this browser context. Visit any page that renders a " +
        'Django form (e.g. /accounts/login/) or call an API GET first -- Django only sets ' +
        'this cookie once something in the request cycle reads the CSRF token.',
    );
  }
  return { 'X-CSRFToken': csrfCookie.value };
}

export async function apiPost(
  context: BrowserContext,
  path: string,
  data: unknown = {},
): Promise<APIResponse> {
  const headers = await csrfHeaders(context);
  return context.request.post(path, { data, headers });
}

export async function apiDelete(context: BrowserContext, path: string): Promise<APIResponse> {
  const headers = await csrfHeaders(context);
  return context.request.delete(path, { headers });
}

export async function apiGet(context: BrowserContext, path: string): Promise<APIResponse> {
  return context.request.get(path);
}
