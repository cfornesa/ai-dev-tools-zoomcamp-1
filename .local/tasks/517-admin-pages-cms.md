# #517 — Protected admin shell and pages configuration

## Goal

Provide an admin-only React console whose first content domain manages the
site's configured pages without exposing admin controls or mutating public
content accidentally.

## Entry point / fixture

`backend/scenes/models.py`/migrations, `backend/scenes/admin_authorization.py`,
admin API/URLs, `frontend/src/App.tsx`, `AdminSettings.tsx`, and page/project
models. Fixture: application-admin A, ordinary user B, system pages, published
page, draft page, and a soft-deleted page in disposable PostgreSQL.

## Acceptance criteria

- [ ] Anonymous and non-admin users cannot discover or use the admin console;
  configured application-admin users see a persistent responsive admin shell
  with active context and a public-site return link.
- [ ] `/admin/pages` lists pages with title, slug, status, updated time, and
  author; admin can create, edit, publish/unpublish, and soft-delete a page
  through CSRF-protected API calls.
- [ ] System pages and required navigation entries have explicit protection;
  slug changes preserve a backward-compatible redirect/history policy; drafts
  never appear publicly.
- [ ] Validation, optimistic concurrency, audit actor/time, failure, empty,
  loading, and destructive-confirmation states are atomic and accessible.
- [ ] Backend authorization/transaction/API tests and Chromium screenshots at
  1280x900 and 375x812 cover admin, non-admin, and anonymous paths; `make check`
  passes.

## Verification

Add focused `backend/tests/test_admin_pages.py` and
`frontend/e2e/adminPages.spec.ts`; run both against disposable PostgreSQL,
then `make check`.

## Out of scope

Piece/media operations (#518), profile/theme controls (#520/#521), payment
transport, and unrestricted Django-superuser semantics.

## Routing / dependency

Stage 2b complex: new data/API, authorization, migrations, and public-route
compatibility. Depends on closed #421/#422 contracts.

## Proposed implementation pending owner confirmation (2026-09-13)

The read-only React/Node reference confirms that CMS pages are a distinct
content family rather than projects. Its compatible minimum is a dedicated
page record with bounded `title`, unique normalized `slug`, `description`,
`status`, navigation label/visibility/order, optional `system_key`, nullable
author, revision/timestamps, and soft-delete metadata. A separate redirect
history record stores old slugs. Public reads remain published-only; protected
admin reads include active drafts and system pages.

The Django implementation proposal is:

1. Add `Page` and `PageSlugRedirect` models in a migration. Use a revision
   integer for optimistic concurrency, `system_key` for protected system pages,
   and a soft-delete timestamp rather than hard deletion.
2. Add CSRF-protected, application-admin-only `/api/admin/pages/` list/create
   and `/api/admin/pages/<id>/` update/publish/unpublish/delete endpoints.
   Keep public project routes unchanged; expose the React `/admin/pages` route
   directly, without adding it to public navigation.
3. Normalize and validate slugs, reject reserved application paths and
   duplicate redirect history, preserve old slugs on rename, and reject
   deletion of required system pages/navigation entries.
4. Add transaction/API tests plus a responsive admin page UI and Chromium
   screenshots at 1280x900 and 375x812.

Rollback boundary: before the migration is applied to any shared or published
database, revert the code and migration in a coordinated release. After a
production migration, rollback requires a forward migration that preserves
page/redirect data; no destructive down-migration is proposed. This proposal
does not authorize implementation until the owner confirms the dedicated-page
model and the exact public slug policy.
