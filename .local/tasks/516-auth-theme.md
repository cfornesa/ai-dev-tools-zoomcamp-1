# #516 — Dark branded authentication templates

## Goal

Make login, logout, signup-closed, and social-account error pages visually
consistent with the dark AugmentrART shell while preserving allauth behavior.

## Entry point / fixture

`backend/templates/account/base.html`, `backend/templates/account/login.html`,
related account/social-account templates, and the published
`/accounts/login/` route. Inspect anonymous fresh contexts at 1280x900 and
375x812.

## Acceptance criteria

- [ ] Auth templates use the same approved dark tokens, typography, focus
  treatment, controls, borders, and branding as the React shell; no light-only
  white page remains.
- [ ] Email/password, Google/GitHub/LinkedIn provider buttons, validation,
  provider-conflict, logout, and signup-closed states remain reachable and
  truthful when providers are omitted or disabled.
- [ ] Keyboard navigation, labels, alerts, contrast, reduced motion, and narrow
  layout are accessible; no credentials or provider payloads are rendered.
- [ ] Template tests and rendered browser screenshots cover login success/error
  states at both fixed viewports; `make check` passes.

## Verification

`cd backend && uv run pytest tests/test_signup_policy.py -q`; focused template
tests; Chromium fresh anonymous contexts at 1280x900 and 375x812; `make check`.

## Out of scope

OAuth provider registration/callbacks (#420/#460), account identity policy
(#426), and React public-theme persistence.

## Routing / dependency

Stage 2a mechanical; no new dependency or API contract.
