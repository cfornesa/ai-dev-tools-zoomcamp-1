/**
 * Cache-Control policy used by the Vite preview server in production.
 *
 * Issue #489: when `scripts/start-production.sh` eventually runs
 * `vite preview` against `frontend/dist/`, the preview server's own static
 * middleware (sirv) does not set Cache-Control, and its HTML fallback
 * middleware forces `no-cache`. We therefore set the policy ourselves in a
 * `configurePreviewServer` hook that runs *before* sirv and the fallback.
 *
 * Rules:
 * - Proxied Django paths (`/api/*`, `/accounts/*`, `/health/*`) are left
 *   untouched; the upstream Django server and the proxy own their headers.
 * - Content-hashed assets under `/assets/*` (Vite's content-addressed output)
 *   are `public, max-age=31536000, immutable`. Because the filename changes
 *   whenever the bytes change, a long immutable TTL is safe and lets CDNs
 *   and browsers cache them forever.
 * - Everything else (`/`, fallback HTML routes, non-hashed assets such as
 *   `favicon.ico`) is `no-cache`. Republishing the app must never strand a
 *   client on a stale shell or stale unhashed asset.
 */

export const PROXIED_DJANGO_PREFIXES = ['/api', '/accounts', '/health'] as const;

/**
 * Matches Vite content-hashed asset filenames.
 *
 * Vite emits hashed assets as `<basename>-<hash>.<ext>` where the hash is
 * base64url-encoded (8+ characters by default in Vite 8). The leading path
 * is anchored to `/assets/` because that is where `vite build` places
 * content-addressed files; anything else under `/assets/` that does not
 * carry a hash is treated as non-hashed and must revalidate.
 */
const HASHED_ASSET_RE = /^\/assets\/[^/]+-[A-Za-z0-9_-]{8,}\.[A-Za-z0-9]+$/;

/**
 * Return the Cache-Control value for a preview-server request pathname, or
 * `null` when the request is proxied to Django and this layer should not
 * set the header at all.
 */
export function previewCachePolicy(pathname: string): string | null {
  for (const prefix of PROXIED_DJANGO_PREFIXES) {
    if (pathname === prefix || pathname.startsWith(`${prefix}/`)) {
      return null;
    }
  }

  if (HASHED_ASSET_RE.test(pathname)) {
    return 'public, max-age=31536000, immutable';
  }

  return 'no-cache';
}
