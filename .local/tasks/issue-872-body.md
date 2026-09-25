## Goal

Ensure canonical `/users/@handle/immersive/:slug` and `/users/@handle/pieces/:slug` routes receive server-rendered Open Graph, Twitter, canonical, and applicable feed metadata in the initial HTML.

## Reproduction

After deployment `0e457e07` from `origin/main` `8f1a40d`, `curl -fsSL https://augmentrart.com/users/@cfornesa/immersive/untitled-3d-scene-3` returns the bare SPA shell with no `data-server-metadata` tags. `curl -fsS https://augmentrart.com/__share-metadata-status` reports `middleware_active:true`, `origin_valid:true`, `last_error:null`, `backend_reachable:true`, so this is route classification rather than backend reachability.

## Acceptance criteria

- [ ] The Vite share-metadata middleware recognizes canonical immersive and regular piece URLs and resolves their metadata through the existing backend API without changing public route behavior.
- [ ] Initial HTML for the exact production canonical immersive URL contains escaped `og:title`, `og:description`, `og:type`, `og:url`, `twitter:card`, and canonical tags, plus image tags when available.
- [ ] Existing site/profile/feed and legacy routes remain covered; add focused tests for canonical immersive and regular routes and the middleware status diagnostic.
- [ ] `make check` passes; publish the fix and run `PUBLISHED_APP_URL=https://augmentrart.com scripts/smoke-published.sh` plus live curl/source verification.

## Scope

Reuse the existing `shareMetadataPlugin`, route descriptors, and backend share-meta APIs. Do not reopen #747 or alter production data. The separate piece layout/toolbar verification remains #748/#827.

## Routing

Stage 2b complex because this crosses frontend Vite middleware and backend metadata route translation. QA requires live production HTML after Publish, separate from local evidence.

## Related

Corrective follow-up to closed #747; observed on the owner-authorized live Chrome/production session.
