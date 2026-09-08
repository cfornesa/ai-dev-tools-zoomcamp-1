---
name: replit-google-frontend-header-rewriting
description: Replit's Google Frontend edge injects its own Set-Cookie and duplicates/rewrites app-set response headers on the published custom domain; not fixable in-repo.
metadata:
  type: project
---

Replit's published custom-domain route (`animate.creatrweb.com`) sits behind
an edge that identifies itself as `server: Google Frontend` (GFE). It has two
confirmed, independent header-level side effects, both outside this
repository's control (no `.replit` header-configuration surface exists for
either):

1. **HSTS duplication** ([#490](https://github.com/cfornesa/ai-dev-tools-zoomcamp-1/issues/490)):
   the edge prepends its own `Strict-Transport-Security: max-age=63072000;
   includeSubDomains` ahead of Django's own field on dynamic (Django-served)
   responses. Per RFC 6797 §8.1 the browser only honors the first field, so
   Django's `preload` directive is ineffective there. The static HTML shell
   (served directly by `vite preview`, not proxied through Django) emits only
   the upstream field — the duplication is specific to responses that reach
   Django.

2. **Cache-Control downgrade** ([#489](https://github.com/cfornesa/ai-dev-tools-zoomcamp-1/issues/489)):
   the edge injects its own `Set-Cookie: GAESA=...` affinity cookie on
   *every* response through the domain (confirmed even on `/health/`, which
   sets no cookie itself). Per GFE's standard behavior, any response carrying
   `Set-Cookie` has its `Cache-Control: public` silently downgraded to
   `private` — `max-age`/`immutable` values pass through untouched. So a
   correctly-implemented `public, max-age=31536000, immutable` policy on a
   content-hashed asset is observed live as `private, max-age=31536000,
   immutable`.

**Diagnostic signature:** `server: Google Frontend` in the response, plus a
`Set-Cookie: GAESA=...` header the app never set. If a published response's
headers don't match what local `vite preview`/Django emit, check for this
before assuming an app-level bug — verify with `curl -sSI` against both the
local disposable stack and the live published URL side by side.

**Why this matters:** two separate issues (#489, #490) independently
diagnosed defects that trace back to the same edge behavior. Don't reopen
either as a code defect without new evidence the edge's behavior actually
changed; the correct disposition is a documented platform-boundary
acceptance, mirroring the ownership comment already in
`backend/backend/settings.py` for #490.
