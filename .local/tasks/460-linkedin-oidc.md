## #460 — Login: optional LinkedIn sign-in via OpenID Connect

### Transaction ledger

- **Phase:** GROOMED → ENGINEERING → QA → RECONCILIATION → CLOSED
- **Stage provenance:** issue scoping and implementation performed by Codex as
  the owner-authorized substitution for the rostered external stages; no
  external model was invoked.
- **Implementation:** added all-or-none optional `LINKEDIN_OAUTH_CLIENT_ID` /
  `_SECRET` settings, generic allauth OIDC registration using LinkedIn
  discovery, gated login/callback routes, verified-email fail-closed handling,
  and local callback documentation.
- **Focused evidence:** `tests/test_linkedin_oauth.py` and environment
  settings checks pass; local login HTML shows LinkedIn when credentials are
  configured and hides it when disabled.
- **Boundary:** live LinkedIn login is not claimed from mocked callbacks.
  Published deployment currently serves the pre-change login artifact and
  must be republished before external verification.
- **QA:** PASS with deployment boundary, posted at
  https://github.com/cfornesa/ai-dev-tools-zoomcamp-1/issues/460#issuecomment-5649576285.
- **GitHub:** closed; live callback and current publish remain explicitly
  owned by #445.
