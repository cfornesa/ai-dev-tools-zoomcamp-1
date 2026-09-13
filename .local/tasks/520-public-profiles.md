# #520 — Public profiles and user profile settings

## Goal

Give each user an optional stable public profile with safe editable profile
fields and an owner-scoped settings surface, while preserving identity-linking,
privacy, and project ownership boundaries.

Owner clarification (2026-09-13): the user-selected unique handle is the
profile URL slug. The profile page should present the user's bio, URL/social
links, and profile photo alongside a gallery of that user's public pieces;
private, draft, deleted, and otherwise non-public work remains excluded.

## Entry point / fixture

Django user/profile models and APIs, `frontend/src/pages/AccountSettings.tsx`,
public gallery/project attribution, and new `/users/@handle` route. Fixture:
public user with handle/bio/links/photo, user without profile, conflicting
handle, inactive user, and private projects.

## Acceptance criteria

- [ ] A user can create/edit/clear a validated unique handle, display name,
  bio, website/social links, and profile image metadata; sensitive identity
  provider data is not public.
- [ ] `/users/@handle` shows only public profile data and public projects/pieces;
  private, deleted, draft, prompt, credential, and billing data never leaks.
- [ ] Handle conflicts, reserved names, inactive/deleted users, unsafe URLs,
  oversized text/images, CSRF, and cross-user edits fail safely and accessibly.
- [ ] Existing owner attribution remains stable and existing project routes are
  backward-compatible; profile deletion/clear behavior is explicit and does
  not delete projects.
- [ ] Backend migration/API/privacy tests, account/public browser tests, and
  rendered evidence at 1280x900/375x812 pass with `make check`.

## Verification

Add `backend/tests/test_profiles.py` and
`frontend/e2e/publicProfiles.spec.ts`; run against disposable PostgreSQL.

## Out of scope

Theme customization (#521), admin content operations (#518), OAuth provider
transport (#420/#460), and social publishing.

## Routing / dependency

Stage 2b complex: schema, public API, privacy, and ownership logic. Reuse
closed #426 identity safeguards.
