# #518 — Admin project, piece, and media operations

## Goal

Give application-admins a list-oriented console for managing owned projects,
2D/3D/generated pieces, versions, and media while preserving ownership,
reference-aware deletion, and local-first user access.

## Entry point / fixture

Existing project/piece/media APIs and `frontend/src/pages/EditorWorkspace.tsx`,
`ArtPieceManagement.tsx`, `Project3DWorkspace.tsx`, and local media repository;
admin route `/admin/content`. Fixture: two owners, published/draft/deleted
2D, 3D, generated pieces, versions, and referenced/unreferenced media.

## Acceptance criteria

- [ ] Admin-only list views show named type, owner, status, updated time, and
  safe actions for projects, 2D/3D/generated pieces, versions, and media.
- [ ] Admin actions are explicit, audited, ownership-safe, and bounded:
  grant/revoke application access, publish/unpublish, restore soft-deleted
  content, and delete only when reference policy permits.
- [ ] No admin action deletes a user's local IndexedDB project/media or bypasses
  the existing public/version/scene invariants; cloud copies are handled only
  by the sync/retention contracts.
- [ ] Empty/loading/error/conflict/destructive-confirmation states are
  accessible and usable at 1280x900 and 375x812; non-admins are denied.
- [ ] Focused PostgreSQL API/transaction tests, Chromium browser evidence, and
  `make check` pass.

## Verification

Add `backend/tests/test_admin_content.py` and
`frontend/e2e/adminContent.spec.ts`; run with disposable PostgreSQL.

## Out of scope

Page configuration (#517), entitlement registry (#519), cloud retention (#522),
and changes to the closed local media contract (#512/#513).

## Routing / dependency

Stage 2b complex. Depends on #517's console/authorization shell and existing
closed scene/media contracts.
