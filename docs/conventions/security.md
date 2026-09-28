# Security conventions (NIST CSF-aligned)

See [`CONVENTIONS.md`](../../CONVENTIONS.md). Organized by the NIST
Cybersecurity Framework's five functions. This session's full sweep found
**no live exploitable vulnerability** — every item below is a process/
architecture gap or a real defect, evidenced with file/line citations, not
speculation.

## Deliberate non-ports (record why, don't just omit)

**Raw user-supplied `iframe_code` for collections.** `augment-humankind`
(PHP)'s `PlatformCollection` model supports a free-text `iframe_code` field
letting an owner embed arbitrary iframe HTML. This app deliberately does
**not** port that field (see the 2026-09-27 editor/collections parity
plan). A free-text iframe field is exactly the kind of surface this
repo's sandboxed-rendering conventions exist to prevent — user-controlled
markup that could load an arbitrary origin, bypass this app's own CSP, or
be used to embed deceptive/malicious content under this app's domain. This
app's existing pattern (`.agents/memory/c2-opaque-sandbox-rendering.md`,
`frontend/src/export/safeEmbed.ts`) is to keep any embed surface behind a
fixed, owned route (e.g. `/embed/collections/@handle/:slug`) rather than
accepting arbitrary iframe markup from a user. If this is ever revisited,
it needs its own owner-decision issue stating the tradeoff explicitly, not
a silent addition during unrelated collections work.

## Identify

Every external integration's credential type and source is documented in
`backend/.env.example`, read via `backend/backend/settings.py`: Google/
GitHub/LinkedIn OAuth (client id/secret), PayPal (client id/secret +
webhook id), reCAPTCHA v3 (site key + secret key, off by default), Mistral/
AI providers (user-supplied key, Fernet-encrypted at rest), SMTP (host/
user/password, production only). `backend/scenes/entitlements.py`'s
`CAPABILITY_REGISTRY` is a clean single source of truth for who can do
what, deliberately excluding admin authorization (delegated to `scenes.
admin_authorization`). **Rule:** a new integration's credential(s) go
through this same env-var + `.env.example` pattern — see
[`python.md`](python.md)'s env-var-discipline section.

## Protect

- **Centralized, default-deny authorization.** `backend/scenes/
  permissions.py`'s `can()` (returns `False` for any unmatched action) and
  `require()` (raises) are the single source of truth for project/version/
  scene/draft/template/art-piece/Project3D authorization. Confirmed: no
  inline `owner_id ==` checks exist outside this module except one narrow
  case — `canonical_piece_api.py:59`'s `PublicPieceBySlugView` inlines its
  own ownership check for letting an owner preview their own not-yet-public
  piece. It's logically correct today but is a second, independently-
  maintained implementation that can silently drift from `permissions.py`'s
  rules. **Rule:** new authorization logic calls `can()`/`require()`;
  route the one existing exception through `permissions.py` too (filed as
  its own issue) rather than adding a third variant.
- **Fernet credential encryption with real key rotation.** `backend/
  ai_provider/credentials.py` uses `cryptography.fernet.Fernet`; key
  material comes from `MISTRAL_CREDENTIAL_ENCRYPTION_KEY`, never stored in
  the database or frontend; `MISTRAL_CREDENTIAL_PREVIOUS_ENCRYPTION_KEYS`
  lets old ciphertext stay readable through a planned re-encryption
  migration. **Rule:** any new encrypted-at-rest credential follows this
  exact pattern (env-var key, a documented rotation list), not a bespoke
  scheme.
- **Zero `dangerouslySetInnerHTML` anywhere in the frontend.** The one
  raw-HTML-building path (`frontend/src/export/safeEmbed.ts`'s
  `escapeHtml`/`embedJsonScript`) is used consistently everywhere HTML is
  generated (`generateHtmlExport.ts`, `DesignPreview.tsx`). **Rule:** keep
  it that way — a new feature that needs to build raw HTML/JS goes through
  `safeEmbed.ts`, never a fresh string-interpolation path, and never
  `dangerouslySetInnerHTML`.
- **Production settings fail closed at boot.** `ImproperlyConfigured` is
  raised for insecure cookies, non-positive HSTS, or a wildcard
  `ALLOWED_HOSTS` in production. Keep new production-only settings following
  this same fail-closed pattern rather than silently defaulting to
  permissive.
- **Real gap: no login-endpoint rate limiting.** reCAPTCHA v3 (`RECAPTCHA_
  ENABLED`) gates signup only (`backend/forms.py`'s `RecaptchaSignupForm`);
  login relies entirely on `django-allauth`'s defaults, with no app-level
  lockout after repeated failed passwords and no DRF throttle/`django-
  ratelimit` configured anywhere. Filed as its own issue, `owner-priority`.

## Detect

- **Real gap: `permissions.py`'s `require()` never logs a denial.** A
  `PermissionDenied` is raised but nothing records who was denied what, on
  which resource — combined with 404-masking elsewhere (`scenes/api.py`'s
  `_require_or_404`), a repeated unauthorized-access probe against another
  user's project leaves zero audit trail. Filed as its own issue,
  `owner-priority`.
- **Real gap, the most concrete one found: PayPal webhook signature
  failures are logged nowhere.** `backend/scenes/billing.py`'s
  `process_webhook_event` raises `WebhookRejected` on a failed signature
  check with no `logger` call and no `BillingEvent` row — by contrast,
  every *other* rejection reason in the same function (missing subscription
  id, etc.) does write a `BillingEvent`. A forged/tampered webhook delivery
  against `/api/billing/paypal/webhook/` today is a silent 403 with nothing
  to alert on. Filed as its own issue, `owner-priority`.
- `backend/ai_provider/logging.py`'s `log_operation_result` is a well-
  reasoned, privacy-conscious model to extend to other security-relevant
  events (deliberately minimal metadata, prompt text excluded unless
  explicitly opted in) — reuse this shape for the two logging gaps above
  rather than inventing a new logger.

## Respond / Recover

- **Account deletion is a real anonymize/retain pattern, not a naive hard
  delete.** `backend/scenes/account_deletion.py`'s own docstring: "Deletion
  is deactivation + PII scrub, never a literal `auth.User.delete()`."
  Creative content soft-deletes (`is_deleted`/`deleted_at`) then hard-
  purges after a documented 30-day grace period; billing/audit rows are
  retained indefinitely (no PII); identities/credentials/sessions are
  hard-deleted outright (no retention reason to keep decryptable key
  material). This is a coherent, dated, owner-approved pattern — keep new
  deletion features following it rather than defaulting to a plain
  `.delete()`.
- **Real gap: no dependency-vulnerability scanning anywhere in CI.**
  Confirmed: no `pip-audit`/`npm audit`/`safety`/Dependabot config exists.
  Filed as its own tracking issue.

## What's not yet machine-enforced

None of the Detect-function logging gaps or the login-rate-limit gap are
caught by any existing test or lint rule — these are real runtime behavior
gaps, not style violations, which is why they're filed as code-change
issues (with regression-risk/restoration-path sections) rather than
documentation-only notes.
