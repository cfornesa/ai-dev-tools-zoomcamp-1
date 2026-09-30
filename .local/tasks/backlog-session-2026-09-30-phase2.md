# Backlog session — Phase 2 live-provider QA

## Transaction ledger

| Issue | Status | Evidence / next action |
|---|---|---|
| #1041 | CLOSED | Local real-provider Three.js artifact published and verified desktop/mobile; QA comment 5902680957. |
| #1042 | DEPENDENCY-BLOCKED | Three bounded A-Frame attempts rejected; #1062 is the implementation follow-up. Fresh live budget required after the follow-up. QA comment 5902716257. |
| #1043 | OPEN / VERIFICATION-BLOCKED | Visible p5 animation produced, but the prompt did not preserve the required all-pairs gravity + elastic-collision rubric; reopened. Correction comment 5902920621. |
| #1044 | OPEN / RUBRIC-FAILED | Three bounded attempts; accepted structural output rendered blank. QA comment 5902866608. |
| #1045 | OPEN / RUBRIC-FAILED | Three bounded attempts rejected; no artifact published. QA comment 5902891168. |
| #1046 | OPEN / RUBRIC-FAILED | Visible published SVG lacked a gradient on source inspection; reopened. Correction comment 5902919665. |
| #1061 | CLOSED | Deterministic Three.js guard plus linked #1041 live evidence; QA comment 5902938046. |
| #1062 | OPEN / DEPENDENCY-BLOCKED | Deterministic A-Frame validator fix committed as `84893a18`; live evidence remains unavailable after the linked child’s cap. QA comment 5902805903. |
| #1063 | OPEN / VERIFICATION-BLOCKED | Deterministic p5 guard present; linked #1043 evidence does not satisfy collision rubric. |
| #1064 | OPEN / RUBRIC-FAILED | Deterministic C2 guard present; linked #1044 rendered blank. |
| #1065 | OPEN / RUBRIC-FAILED | Deterministic C2 Interactive guard present; linked #1045 produced no accepted artifact. |
| #1066 | OPEN / RUBRIC-FAILED | Deterministic SVG guard present; linked #1046 output lacked a gradient. |
| #926 | OPEN / IMPLEMENTATION-BLOCKED | Existing bounded local run failed Case A scope isolation; implementation follow-up #1060 is now closed, but the required live Case-B/C evidence remains unreached. |
| #788 | OPEN / OWNER-RUN | Scoped importer implementation complete locally; production preview, one bounded write, and live verification remain owner-run. |

Closed follow-ups reconciled since the initial ledger: #1060 (target-scope
enforcement) and #1069 (Chromium shard-5 reliability). Their QA comments and
commits are authoritative; neither remains in the open inventory.

## Gate evidence

- `UV_CACHE_DIR=/tmp/ai-dev-tools-uv-cache make check` passed: backend 1830 passed / 39 skipped; frontend 307 files / 3170 tests passed.
- Live work used only repository-owned disposable Compose and authenticated local `dev_owner`; no production data, passwords, or API keys were entered or logged.
- The temporary real-provider backend was removed after QA and the normal Compose backend was restored.
- Rostered implementation/QA services were unavailable; substitutions were recorded in issue comments. Independent stage-3 review was not run.

## 2026-09-30 reconciliation after deterministic follow-ups

The stale transaction rows above are historical. The authoritative terminal
state after the follow-up work is:

| Issue | Terminal status | Evidence / next action |
|---|---|---|
| #1041 | CLOSED | Existing local real-provider Three.js evidence and QA comment 5902680957. |
| #1042 | BLOCKED | Fresh bounded local A-Frame attempts after #1062 still rejected provider output; QA comment 5903321484. Owner/provider decision on a separately scoped experiment, then a new bounded matrix. |
| #1043 | CLOSED | Fresh exact p5 live evidence; QA comment recorded in the issue. |
| #1044 | CLOSED | Fresh exact C2 live evidence; QA comment recorded in the issue. |
| #1045 | CLOSED | Natural-language C2 Interactive prompt produced and published the public artifact; QA comment 5903208003. |
| #1046 | BLOCKED | Fresh bounded local SVG attempts after #1066 still rejected provider output; QA comment 5903320841. Owner/provider decision on a separately scoped experiment, then a new bounded matrix. |
| #1061 | CLOSED | Deterministic Three.js guard plus linked #1041 evidence. |
| #1062 | CLOSED | Commit 84893a18; focused tests and full make check; QA comment 5903309212. |
| #1063 | CLOSED | Deterministic p5 follow-up with linked live evidence. |
| #1064 | CLOSED | Deterministic C2 follow-up with linked live evidence. |
| #1065 | CLOSED | Natural-language C2 Interactive follow-up; QA comment 5903207131. |
| #1066 | CLOSED | Commit 08df1b27; focused tests and full make check; QA comment 5903314881. |
| #926 | BLOCKED | Local Chrome agent workflow reached a correctly scoped plan twice, then both runs failed with repeated_invalid_output; QA comment 5903417419. Next action: owner/provider decision before any further live quota, then bounded Cases B/C. |
| #788 | OWNER-RUN | Production-data action intentionally untouched; owner must run the approved production-only importer in the production runtime. |

The #926 failure is covered by the existing issue; no duplicate follow-up was
created. No production data, credentials, or API-key values were used. The
provider runs were local and disposable only.

## 2026-09-30 — #788 scoped-import implementation

The owner selected the sustainable scoped-flag approach. The canonical
importer now accepts repeatable `--source-id` values, rejects missing,
duplicate, and unknown IDs in production, and scopes preview/import/cleanup to
the selected fixtures. The production wrapper refuses to run without
`REFERENCE_IMPORT_SOURCE_IDS`; the approved #788 value is exactly
`legacy-c2-default,legacy-c2-interactive-default`. No production database was
read or changed by this implementation transaction.

Verification:

- Focused command tests: `35 passed, 6 warnings`.
- Full `UV_CACHE_DIR=/tmp/ai-dev-tools-uv-cache make check`: backend `1832
  passed, 39 skipped`; frontend `307 passed (3170 tests)`; exit code 0.
- Implementation/QA service substitution: rostered Ollama Cloud Kimi was
  unavailable, so Codex/GPT-5 Medium performed the implementation and
  self-review; no independent stage-3 review was available.

Terminal status remains `OWNER-RUN`: deploy the commit, run the no-write
production preview and confirm it names exactly the two C2 source IDs, then
perform the separately authorized one-write production invocation, verify the
two live C2 routes at desktop/mobile sizes and version history, verify
unrelated pieces are unchanged, and remove the startup trigger. Rollback is to
disable the gate and redeploy the prior revision before any write.

## 2026-09-30 — bounded real-provider retry evidence

The active local browser session was authenticated and the disposable backend
was temporarily run with the real provider. The normal fake-provider stack was
restored after the runs.

- **#1042:** three authorized A-Frame attempts reached the provider but were
  rejected as empty/invalid A-Frame output. No piece was saved or published.
  QA comment `5904552823`. Terminal status: `BLOCKED / provider-quality
  failure`; next action is a separately scoped generation/validator follow-up
  before more quota.
- **#1046:** three authorized SVG attempts were run. One rendered and was
  inspected, but used a hard-coded circumference and therefore failed the
  rubric; the final explicit runtime-computation attempt was rejected as
  invalid SVG. No passing artifact was created. QA comment `5904554891`.
  Terminal status: `BLOCKED / provider-quality failure`; next action is a
  separately scoped generation/validator follow-up before more quota.

No credentials were entered or exposed, and no production data was modified.
