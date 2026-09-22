# Issue #724 — shared parity theme system

## Goal

Implement the shared style catalog, palette model, readable light/dark iframe
previews, and account/admin design editors specified in GitHub issue #724.

## Transaction ledger

- **Phase:** CLOSED — QA PASS
- **Issue owner / current transaction:** #724 — shared parity theme system for admin and account design settings
- **Implementation commits:** `c6bf366` and `46e540c`
- **Focused checks / full checks:** focused backend 55 passed; focused frontend 24 passed after QA fixes; full backend 1,504 passed / 39 skipped; full frontend 2,802 passed; `make check` passed with isolated `UV_CACHE_DIR` before the frontend-only QA fixes; final frontend lint/typecheck/format/full-test checks passed.
- **QA matrix:** PASS — Compose Chromium run 3/3 passed at 1280x900 and 375x812; rendered screenshots inspected for readable body/card text, Celestial heading/body separation, iframe preview controls, and responsive layout.
- **GitHub closure evidence:** QA verdict posted at https://github.com/cfornesa/ai-dev-tools-zoomcamp-1/issues/724#issuecomment-5773044482; issue closed in the authenticated Chrome session.
- **New gaps discovered:** AI generation/refinement/snapshot workflow is out of scope and tracked in #725.

## Scope contract

The issue's acceptance criteria and exact commands are authoritative in GitHub.
The source-of-truth reference implementation is in:

- `../augment-humankind/public/app/controllers/Admin/SiteIdentityAdminController.php`
- `../augment-humankind/public/app/views/admin/site-identity/index.php`
- `../augment-humankind/public/app/views/user/settings.php`
- `../augment-humankind/algorithms/SiteThemeGeneration.md` for the deferred AI workflow in #725

The ten canonical styles are `bauhaus`, `traditional`, `minimalist`,
`academic`, `airy`, `nature`, `comfort`, `audacious`, `artistic`, and
`celestial`. The original ten palettes are `original`, `bauhaus`,
`monochrome`, `newsprint`, `ocean`, `forest`, `sunset`, `sepia`,
`high-contrast`, and `pastel`; the admin-compatible `celestial` palette is
also exposed by the shared catalog.

## Next action

#724 is complete and closed. Reconcile the linked #725 transaction before
beginning its implementation.
