# #521 — Site-wide and per-profile customization/theme parity

## Goal

Let application-admins configure site-level visual identity and let users
customize their own profile presentation, with one consistent token system
across React and Django-auth pages and safe fallback behavior.

## Entry point / fixture

`frontend/src/index.css`, shell/layout, `backend/templates/account/base.html`,
`SiteSettings`, profile model/API from #520, and admin console from #517.
Fixture: default site theme, admin override, user profile override, cleared
override, anonymous visitor, and narrow viewport.

## Acceptance criteria

- [ ] Admins can edit a finite, validated site theme/branding configuration;
  users can edit only their own profile presentation; both support clear/reset
  to defaults without changing copy or ownership.
- [ ] Home, gallery, editor, public profile, billing, login, provider-error,
  empty, and error surfaces consume the same dark/light token contract with
  visible focus and readable contrast.
- [ ] Profile overrides are scoped to profile content; site shell and auth
  security styling cannot be overridden by user-authored CSS/HTML/JS.
- [ ] Invalid values, stale revisions, missing configuration, and runtime
  failures fail closed to the last valid/default theme without blanking content.
- [ ] Fixed rendered screenshots and interactions cover anonymous, admin,
  ordinary user, reset, desktop, and 375x812 states; security/privacy tests
  and `make check` pass.

## Verification

Add focused backend theme/profile tests and
`frontend/e2e/themeCustomization.spec.ts`; test at 1280x900 and 375x812.

## Out of scope

Arbitrary executable custom runtime in the parent document, page CMS content
editing (#517), and provider/auth semantics.

## Routing / dependency

Stage 2b complex: persisted settings, authorization, sanitization, and shared
rendering. Depends on #517 and #520. Before implementation, show migration
diff/rollback plan and document any public API contract in `docs/api.md`.

## Implementation note (2026-09-13)

Use the finite theme-token contract in `backend/scenes/theme.py` and the
`SiteSettings.theme_config`/`PublicProfile.theme_config` fields. Profile
tokens are scoped to the profile surface; arbitrary CSS/HTML/JS is never
accepted. The authentication templates retain a safe dark fallback.
