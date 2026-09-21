---
name: production-html-missing-share-metadata
description: Published HTML lacked og:/feed-alternate tags although vite preview injects them locally; bundle hash does not cover vite.config.ts (#700).
---
On 2026-09-21 https://augmentrart.com served the bare SPA shell (no
`data-server-metadata` tags) while Django share-meta/share-image APIs and feed
routes worked, and a local `vite preview` injected the tags. A matching
bundle hash (`index-*.js`) does not prove the server middleware in
`frontend/vite.config.ts` is what runs. #700 added logging on injection failure,
origin normalization, a preview-mode vitest, and a smoke check; the production
cause stays unclassified until after a Replit Publish and a log read.
