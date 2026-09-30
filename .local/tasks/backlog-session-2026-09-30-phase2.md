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
| #788 | OPEN / OWNER-RUN | Production data action; intentionally untouched. |

Closed follow-ups reconciled since the initial ledger: #1060 (target-scope
enforcement) and #1069 (Chromium shard-5 reliability). Their QA comments and
commits are authoritative; neither remains in the open inventory.

## Gate evidence

- `UV_CACHE_DIR=/tmp/ai-dev-tools-uv-cache make check` passed: backend 1830 passed / 39 skipped; frontend 307 files / 3170 tests passed.
- Live work used only repository-owned disposable Compose and authenticated local `dev_owner`; no production data, passwords, or API keys were entered or logged.
- The temporary real-provider backend was removed after QA and the normal Compose backend was restored.
- Rostered implementation/QA services were unavailable; substitutions were recorded in issue comments. Independent stage-3 review was not run.
