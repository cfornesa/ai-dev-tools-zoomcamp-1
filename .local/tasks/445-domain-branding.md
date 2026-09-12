## #445 — AugmentrART custom-domain and branding release reconciliation

### Distilled current transaction

The owner republished the app at `https://augmentrart.com`. The custom-domain
root serves the SPA, but Django routes currently return HTTP 400 because the
published production `DJANGO_ALLOWED_HOSTS`/CSRF configuration names the old
hosts only. The same release also still contains exact `CreatrART` product
branding in source/templates/tests/docs.

### Acceptance criteria

- [x] `augmentrart.com` is an explicit production allowed host and trusted
      browser origin, while existing Replit/legacy hosts remain compatible.
- [x] `https://augmentrart.com/health/` and `/accounts/login/` return 200;
      the login page is rendered rather than Django's generic 400 page.
- [x] User-facing and app-default exact `CreatrART` branding is renamed to
      `AugmentrART`; internal repository slug/history identifiers are not
      treated as product branding.
- [x] Existing login/OAuth and settings tests are updated without weakening
      assertions; migrations apply cleanly and `make check` passes.
- [x] Credential-free published smoke and an authenticated/browser login-page
      check are rerun against the exact `augmentrart.com` origin after publish.

### Out of scope / blockers

PayPal checkout (#440) and optional OAuth provider provisioning (#460) remain
owner-credential boundaries. Replit's deployment edge behavior remains a
separate verification boundary; this transaction fixes application host
configuration and branding.

### Routing and order

Stage 1 issue-scoping: owner-authorized Codex GPT-5.6 Luna / Medium. Stage 2b
complex implementation because settings, migration, templates, and release
configuration cross deployment boundaries. QA and readiness run in this Codex
task per the owner's no-external-agent instruction.

### Verification

```bash
UV_CACHE_DIR=/private/tmp/codex-uv-cache make check
PUBLISHED_APP_URL=https://augmentrart.com scripts/smoke-published.sh
```

### Transaction ledger

- **Phase:** GROOMED → ENGINEERING → QA → RECONCILIATION
- **Issue owner/current transaction:** #445 only
- **Implementation commits:** `b5337a2`, `cb6af86`
- **Focused checks:** backend env/OAuth/settings tests: passed; frontend targeted
  branding/login tests: passed.
- **Full checks:** `UV_CACHE_DIR=/private/tmp/codex-uv-cache make check` passed:
  backend `1206 passed, 39 skipped, 10 warnings`; frontend lint,
  format/typecheck, and `2557 passed` tests.
- **Published smoke:** `PUBLISHED_APP_URL=https://augmentrart.com
  scripts/smoke-published.sh` passed: health 200, root 200, anonymous whoami
  401, login 200.
- **Published route evidence:** direct requests to
  `https://augmentrart.com/health/` and `/accounts/login/` return 200; login
  HTML title is `Log in · AugmentrART` and contains the AugmentrART header.
  A fresh Chrome browser context at the exact origin rendered
  `Log in · AugmentrART` with the email/password fields and Login button. The
  original tab's cached 400 document is a stale-tab artifact.
- **Deployment workaround:** production deployment secrets
  `DJANGO_ALLOWED_HOSTS` and `CSRF_TRUSTED_ORIGINS` were added in Replit and
  the production publish completed. The Replit Git panel still reports
  `UNAUTHENTICATED` on Refresh and Fetch and shows `Sync Changes 3 1`; this is
  a separate source-sync verification boundary, not a runtime failure.
- **GitHub evidence:** reconciliation comment posted at
  https://github.com/cfornesa/ai-dev-tools-zoomcamp-1/issues/445#issuecomment-5649051789;
  issue remains open because #445 is the broader release-candidate parent and still
  owns unresolved release/provider boundaries (#440/#460).
