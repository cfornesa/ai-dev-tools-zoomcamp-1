# Batch 14 — advisory E2E matrix Wave 1

## Scope and standing constraints

- Implement #1190, #1191, then #1194; one issue per commit.
- Do not push, dispatch workflows, merge, or close issues.
- Preserve the pre-existing edits in `.local/tasks/backlog-session-2026-10-02-batch19.md` and `docs/tasks.md` exactly. The #1096/#1190/#1191/#1194 backlog records already exist in `docs/tasks.md`; no task-file edit is needed.
- Existing `DECISIONS.md` entry from 2026-10-03 already records the owner authorization and ratchet policy; no new decision is being introduced.

## Batch impact analysis

| Surface | Kind | Issues | Open issue references / interactions | Collision / required verification |
| --- | --- | --- | --- | --- |
| `.github/workflows/ci.yml` full-suite invocation, report and summary | Change | #1190, #1191 | #1190 explicitly serializes with #1191; #1155 owns fixture environment markers; #1096 tracks the matrix; #1192 owns branch protection | Keep PR smoke, public-media, WebKit, job matrix, triggers, env and permissions unchanged; inspect final diff and workflow validation. |
| `frontend/e2e/known-failures.json` | Add | #1190; future child fixes #1160–#1186 | All mapped child issues remove their own entries when fixed; #1096 owns reconciliation | Generate all 120 run #1126 failures from the failed-step logs and map file; verify issue mapping, unique keys/counts, expiry, and shard-subset behavior. |
| `frontend/scripts/e2e-ratchet.mjs` and built-in Node tests | Add | #1190 | No existing consumer; workflow is the sole production caller | Parse Playwright JSON, evaluate only tests present in that shard, and test baseline, new, fixed, expired, no-owner, and subset cases. |
| `frontend/playwright.config.ts` | Change | #1191 | #1190 shares suite execution but should not change this config | Add only action/navigation timeouts; focused browser and static checks; inspect diff. |
| `frontend/e2e/support/README.md` | Add | #1194 | #1195 depends on the documented helper inventory; #1170/#1174 may add future helpers | Inventory all exported support helpers and public constants/types; recipes must match existing APIs and typecheck. |
| `docs/process.md` standard 2 | Change | #1194 | #1195 consumes standard 2; #1193 may reference process standards | Add a link only; documentation diff review. |

### Current issue collision search (2026-10-03)

- Open issues #1190 and #1191 share `ci.yml`; #1191 depends on the ratchet and remains second in the ordered implementation.
- #1155 intersects the same E2E job only through fixture environment variables, which are out of bounds and will stay byte-identical.
- #1160–#1186 own the baseline cases; no case is fixed or removed in this batch.
- #1194 owns the helper README and standard-2 link; #1195 depends on that README and is deferred.
- #1096 tracks full-matrix reconciliation; #1192 is owner-only branch protection; neither changes this implementation.

## Implementation and verification ledger

| Issue | Commit | Files | Verification / result | QA comment | Provenance |
| --- | --- | --- | --- | --- | --- |
| #1190 | this commit | `.github/workflows/ci.yml`; `frontend/e2e/known-failures.json`; `frontend/scripts/e2e-ratchet.mjs`; `frontend/scripts/e2e-ratchet.test.mjs`; this ledger | PASS: `node --test scripts/e2e-ratchet.test.mjs` (7/7); parsed run #1126 dry run (120 baseline failures, 0 new/fixed/expired); one removed entry failed and named the test; targeted Oxlint, Prettier, workflow validation and `git diff --check` passed. | To post after batch gate. | Codex / GPT-6 / default effort; track: mixed |
| #1191 | pending | pending | pending | pending | Codex / GPT-6 / default effort; track: mixed |
| #1194 | pending | pending | pending | pending | Codex / GPT-6 / default effort; track: mixed |

## Batch gate

Pending the focused issue checks, `make check`, final impact review, and QA comments. Full `workflow_dispatch` runs remain owner actions.
