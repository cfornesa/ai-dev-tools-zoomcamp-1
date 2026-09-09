# Current task map

## Mistral credential-store consolidation — distilled 2026-09-09

Source investigation: [#497](https://github.com/cfornesa/ai-dev-tools-zoomcamp-1/issues/497) (closed as superseded after this decomposition; its store-divergence evidence is retained in the issue body).

| Order | Issue | Status | Goal | Dependencies | Routing / next action |
| --- | --- | --- | --- | --- | --- |
| 1 | [#498](https://github.com/cfornesa/ai-dev-tools-zoomcamp-1/issues/498) | PROPOSED | Migrate legacy `MistralCredential` rows to `ProviderCredential(vendor="mistral")`, retire legacy schema/CRUD, and port rotation handling. | None | Stage 2b `implementation-complex`; obtain explicit schema migration diff + rollback review, then use only a disposable PostgreSQL target. |
| 2 | [#499](https://github.com/cfornesa/ai-dev-tools-zoomcamp-1/issues/499) | DEPENDENCY-BLOCKED | Resolve scene and art-piece Mistral credentials only from the generic owner-scoped store. | #498 | Stage 2b `implementation-complex`; begin after #498 closes. |
| 3 | [#500](https://github.com/cfornesa/ai-dev-tools-zoomcamp-1/issues/500) | DEPENDENCY-BLOCKED | Remove Account Settings’ standalone Mistral form; retain one generic Mistral card. | #498 | Stage 2a `implementation-mechanical`; begin after #498 closes. |
| 4 | [#501](https://github.com/cfornesa/ai-dev-tools-zoomcamp-1/issues/501) | DEPENDENCY-BLOCKED | Replace dual-surface Mistral test assumptions with coverage for the single generic card. | #498, #499, #500 | Stage 2a `implementation-mechanical`; begin after all prerequisites close. |

### Duplicate / coverage reconciliation

- #497 is the only open source issue for this two-store gap and is superseded by this child set.
- Closed #403, #404, #407, and #495 are historical prerequisites/evidence, not implementation duplicates.
- No task includes live Mistral calls, production/shared database operations, new vendor work, OAuth changes, or public-route changes.

### Verification boundaries

- Migration and Fernet rotation checks are isolated PostgreSQL-only. Retain the active-plus-previous-root protocol from `.agents/memory/mistral-credential-rotation.md`; no plaintext key enters logs, fixtures, responses, or reports.
- Generation coverage uses deterministic provider doubles and two-owner isolation fixtures.
- Account Settings closure requires browser-rendered inspection at 1280x900 and 375x812 in addition to focused tests.

### Next issue

**#498** is the sole next groomed transaction. It is blocked only on the required explicit schema migration/rollback review; it must terminalize before another child starts.
