---
name: Full browser readiness gate
description: Targeted browser suites do not establish project readiness; the complete disposable-stack browser command must pass.
---

Production-readiness work on this project must run the complete automated
browser acceptance command, not only the suite related to the latest issue:

`UV_CACHE_DIR=/private/tmp/creatrweb-uv-cache BROWSER_QA_FULL_E2E=1 make browser-qa`

Targeted Layers, camera, or runtime benchmarks can pass while unrelated
editor, draft-recovery, credential, or responsive scenarios fail in the full
run. Preserve every full-run failure as actionable until it is fixed or
explicitly quarantined with issue-linked evidence. The current release-gate
follow-up is GitHub #193.

This local disposable-stack evidence does not replace manual verification of
the published Replit deployment. Replit checks are a separate boundary after
the automated gate is green.
