## #509 — Cloud backup: opt-in project and media synchronization protocol

### Goal

Provide a provider-neutral, opt-in backup protocol for one authenticated
local-first project and its scene/media manifest. The server must persist
versioned metadata and media bytes in PostgreSQL, remain disabled by the
site-wide kill switch by default, and never make local authoring depend on
cloud availability.

### Fixed entry point / fixture

The Django `scenes` app, one authenticated owner, one project containing two
scenes, and one project-owned image asset referenced by both scenes. Tests use
the existing test settings and disposable database. No PayPal, OAuth provider,
object-storage vendor, or new package is required.

### Acceptance criteria

- [ ] `SiteSettings.cloud_sync_enabled` exists, defaults to `false`, is
      returned and updated through the existing application-admin settings
      service with optimistic revision checks, and is represented in the
      admin API without exposing secrets.
- [ ] Plan rows expose independently editable cloud byte/file quotas through
      the existing admin plan service/API; quota edits remain possible while
      `cloud_sync_enabled` is false and use the existing revision/authorization
      rules.
- [ ] An authenticated owner can explicitly enable backup for a project via
      one documented API workflow; a local-only project produces no sync
      writes or reads, and every sync endpoint refuses before entitlement or
      storage work when the site-wide switch is false.
- [ ] The sync contract uses stable project/scene/asset identifiers,
      checksums, revisions, and idempotency keys; repeated manifest/blob
      operations are safe, and stale revisions return a deterministic conflict
      response without overwriting newer state.
- [ ] Manifest and blob operations all pass through `scenes.permissions`
      (owner authorization); a user cannot read, write, delete, or infer
      another user's project backup.
- [ ] The service reports resumable outcomes for missing blobs, checksum
      mismatch, quota exhaustion, cancellation/retry, and offline/network
      failure without deleting the local source of truth.
- [ ] Entitlement loss changes the remote backup to read-only retention;
      explicit account deletion purges the remote copy. Local project access
      and local export remain unaffected in both cases.
- [ ] Provider access is an internal storage abstraction backed by PostgreSQL
      BLOBs for this implementation. No third-party dependency or credential
      is added; retention and cleanup policy are documented in code and API
      docs.
- [ ] Focused Django tests cover the kill switch ordering, admin quota edits,
      owner isolation, idempotency/stale revisions, checksum/quota failures,
      retention/deletion outcomes, and the two-scene shared-asset fixture;
      `make check` passes.

### Out of scope

- PayPal checkout/webhooks — [#440](https://github.com/cfornesa/ai-dev-tools-zoomcamp-1/issues/440).
- OAuth provider provisioning or live callback verification —
  [#460](https://github.com/cfornesa/ai-dev-tools-zoomcamp-1/issues/460).
- Account/editor sync controls and upgrade UX — #511.
- Collaboration, public asset URLs, automatic background sync, or a
  third-party object-storage vendor.

### Verification

```bash
UV_CACHE_DIR=/private/tmp/codex-uv-cache make check
cd backend && uv run pytest tests/test_cloud_backup* tests/test_admin_settings* tests/test_permissions*
```

### Routing

Stage 1: owner-authorized Codex GPT-5.6 Luna / Medium. Stage 2b: complex
implementation because this crosses Django models/migrations, API contracts,
authorization, entitlements, and transactional synchronization logic. QA is
an independent Claude Sonnet 5 / Medium review.

### Transaction ledger

- **Phase:** GROOMED → ENGINEERING → QA → RECONCILIATION → CLOSED
- **Issue owner / current transaction:** #509 only
- **Implementation commits:** `02702f4`, `8f3744a`, `976f275`, plus the
  follow-up entitlement/pause implementation in the current closure commit.
- **Focused/full checks:** backend focused `25 passed, 1 skipped`; frontend
  focused `3 passed`; complete `make check` passed for the implementation.
- **QA matrix:** PASS; Codex substitution for the normally rostered Claude
  Sonnet review, with criterion matrix posted to GitHub.
- **GitHub closure evidence:** QA comment
  `https://github.com/cfornesa/ai-dev-tools-zoomcamp-1/issues/509#issuecomment-5648743149`
  and reconciliation comment
  `https://github.com/cfornesa/ai-dev-tools-zoomcamp-1/issues/509#issuecomment-5648743232`.
- **New gaps discovered:** none
