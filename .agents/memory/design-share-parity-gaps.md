---
name: design-share-parity-gaps
description: Why generated thumbnails stay fallback and share tags never reach crawlers; no theme toggle or Pareto/Celestial styles exist (#642-#655).
---
Durable findings from the 2026-09-20 distillation:

- Generated art-piece thumbnails are only created by a client upload
  (`ArtPieceThumbnailUploadView`); nothing captures on publish, so published
  pieces stay `thumbnail_is_fallback: true` (#651, #652).
- Open Graph/Twitter tags are set by client JS in `frontend/src/metadata.ts`;
  crawlers do not run JS, so server-rendered tags are required (#653, #654).
- Theme contract has one flat palette; the reference's Pareto/Celestial styles,
  light/dark pairs, and the mode toggle do not exist yet (#642-#647).
Manifest: `docs/distillation-2026-09-20-design-and-share-parity.md`.
