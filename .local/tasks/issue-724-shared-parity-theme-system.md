# Issue #724 — shared parity theme system

## Goal

Implement the shared style catalog, palette model, readable light/dark iframe
previews, and account/admin design editors specified in GitHub issue #724.

## Transaction ledger

- **Phase:** IMPLEMENTED — QA pending
- **Issue owner / current transaction:** #724 — shared parity theme system for admin and account design settings
- **Implementation commit:** pending (working tree ready)
- **Focused checks / full checks:** focused backend 55 passed; focused frontend 19 passed; full backend 1,504 passed / 39 skipped; full frontend 2,802 passed; `make check` passed with isolated `UV_CACHE_DIR`
- **QA matrix:** pending; must include Chromium at 1280x900 and 375x812 for `/admin/settings/` and `/settings/`, with rendered iframe previews inspected visually.
- **GitHub closure evidence:** issue created at https://github.com/cfornesa/ai-dev-tools-zoomcamp-1/issues/724; closure pending.
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

Implementation is complete in the working tree. Commit the coherent change,
then enter the independent QA pass with rendered Chromium evidence before
closing #724.
