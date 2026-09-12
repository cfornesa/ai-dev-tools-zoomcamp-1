## #445 — AugmentrART custom-domain and branding release reconciliation

### Distilled current transaction

The owner republished the app at `https://augmentrart.com`. The custom-domain
root serves the SPA, but Django routes currently return HTTP 400 because the
published production `DJANGO_ALLOWED_HOSTS`/CSRF configuration names the old
hosts only. The same release also still contains exact `CreatrART` product
branding in source/templates/tests/docs.

### Acceptance criteria

- [ ] `augmentrart.com` is an explicit production allowed host and trusted
      browser origin, while existing Replit/legacy hosts remain compatible.
- [ ] `https://augmentrart.com/health/` and `/accounts/login/` return 200;
      the login page is rendered rather than Django's generic 400 page.
- [ ] User-facing and app-default exact `CreatrART` branding is renamed to
      `AugmentrART`; internal repository slug/history identifiers are not
      treated as product branding.
- [ ] Existing login/OAuth and settings tests are updated without weakening
      assertions; migrations apply cleanly and `make check` passes.
- [ ] Credential-free published smoke and an authenticated/browser login-page
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

- **Phase:** GROOMED → ENGINEERING
- **Issue owner/current transaction:** #445 only
- **Implementation commit:** pending
- **Focused/full checks:** pending
- **QA matrix:** pending
- **GitHub evidence:** pending
