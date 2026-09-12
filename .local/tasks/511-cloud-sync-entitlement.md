## #511 — Entitlement-aware cloud-sync controls

### Goal

Allow an eligible account to enable or pause the existing opt-in cloud backup
per project, while keeping local authoring and export available for every
account state.

### Fixed contract

The existing `scenes.entitlements` service is authoritative. The named
`cloud_project_sync` feature is resolved fail-closed; the existing PostgreSQL
backup protocol remains the storage implementation. No PayPal, OAuth, or new
dependency is required for deterministic tests.

### Acceptance criteria

- [ ] `cloud_project_sync` is a known feature; missing/inactive plans and deny
      overrides return no eligibility and cannot enable remote sync.
- [ ] Local project create/open/edit/import/export paths do not call or depend
      on cloud-sync eligibility, quota, or provider availability.
- [ ] Account/editor UI explains ineligibility and the upgrade path without
      uploading project content; the explanation is keyboard-accessible and
      usable at the fixed narrow viewport.
- [ ] Eligible users can enable and pause one project's sync. Pause and
      entitlement loss stop future remote writes, retain local access, and
      clearly explain export/retained-copy behavior.
- [ ] Backend and frontend tests cover free, active, cancelled/expired,
      explicitly denied, and provider-unavailable states; `make check` passes.

### Out of scope

PayPal checkout/webhooks (#440), OAuth provisioning (#460), storage-provider
work or core backup protocol (#509), collaboration, and charging for local
storage.

### Routing

Stage 1: owner-authorized Codex GPT-5.6 Luna / Medium. Stage 2b: complex
implementation because this crosses entitlement authorization, API state, and
UI behavior. QA is normally an independent Claude Sonnet review; this task
will perform that review in Codex per the owner's instruction and record the
substitution.

### Verification

```bash
UV_CACHE_DIR=/private/tmp/codex-uv-cache make check
cd backend && uv run pytest tests/test_entitlements.py tests/test_cloud_backup.py
```

### Transaction ledger

- **Phase:** GROOMED → ENGINEERING
- **Issue owner / current transaction:** #511 only
- **Implementation commit:** pending
- **Focused/full checks:** pending
- **QA matrix:** pending
- **GitHub closure evidence:** pending
- **New gaps discovered:** none
