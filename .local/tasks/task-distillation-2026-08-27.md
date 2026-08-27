# Task distillation manifest — 2026-08-27

Project: `cfornesa/ai-dev-tools-zoomcamp-1`

| Issue | Existing record | Classification | Status | Concrete next action |
| --- | --- | --- | --- | --- |
| #191 | [GitHub #191](https://github.com/cfornesa/ai-dev-tools-zoomcamp-1/issues/191), task 160 | implementation-defect; reuse existing issue; browser and root-gate verification boundaries | blocked (issue remains open/ACTIVE) | Run the PostgreSQL-backed Django/Vite Layers browser suite at desktop/tablet/narrow widths and rerun `make check` where launcher subprocesses and loopback binding are permitted; post replacement QA evidence before closure. |
| #192 | [GitHub #192](https://github.com/cfornesa/ai-dev-tools-zoomcamp-1/issues/192), task 161 | implementation-defect; reuse existing issue; live-metrics and browser verification boundaries | blocked (issue remains open/ACTIVE) | Capture qualifying real-editor 10-second desktop/narrow baseline/post metrics after `07cf4dc`, resolve any current full-suite failures, rerun browser diagnostics and `make check` in an approved environment, then post replacement QA evidence. |

## Duplicate and coverage report

- The panel request is covered by #191; it is a correction to that issue's incomplete acceptance criteria, not a new issue.
- The camera report is covered by #192; the prior synthetic-seam pass did not disprove the user's live editor-path performance failure.
- The #191 browser skip and managed-sandbox `make check` failures are already covered by the Playwright runtime-prerequisites and local-sandbox-verification-boundaries memory topics; they do not justify a duplicate issue.
- The #192 missing desktop/narrow 10-second metrics and browser/app-service unavailability are acceptance work already inside #192, not a separate diagnostic issue. QA full-suite timeout observations are triaged below rather than copied into a new issue.
- No third actionable issue was found in the backlog or open GitHub issue search.

## Gap and blocker triage

| Gap | Current evidence | Classification | Coverage decision | Owner / exact next action |
| --- | --- | --- | --- | --- |
| #191 browser/make-check boundaries | `layersPanel.spec.ts` had 7 skipped tests because `http://localhost:5000/health/` was unreachable; managed `make check` had four launcher timeouts and one loopback-bind `PermissionError`. | verification-boundary for unavailable app/browser host; workflow/infrastructure-defect boundary for the required root gate in this sandbox | Reuse #191 and existing memory; no new issue. | Engineer/QA: start the isolated PostgreSQL-backed Django + Vite stack, verify `/health/` and `/api/whoami/`, run the Layers spec; rerun `UV_CACHE_DIR=... make check` where subprocesses and loopback binds are permitted. |
| #192 missing 10-second desktop/narrow metrics and browser diagnostics | `07cf4dc` was implemented, but no qualifying live warm-run measurements exist. QA could not reach port 5000 and Chromium failed at managed-macOS launch; browser metrics, resource counts, privacy inspection, and narrow/desktop evidence remain absent. | verification-boundary for this host; reported slow live feed remains implementation-defect scope in #192 | Reuse #192; no new issue. | Engineer/QA: run synthetic-camera/MediaPipe diagnostics in an approved environment and record dimensions/FPS, inference, drops, p50/p95/max latency, delivery FPS, long tasks, render/update counts, resources, privacy, and baseline/post values. |
| QA full-suite timeout observations | #191's one `draftAutosave.test.ts` timeout disappeared on repeat and was classified as unrelated/flaky; earlier shape-test timeouts were addressed by `56a96da`. #192's latest QA still reports 5 full-frontend failures plus root-gate failures. | non-actionable/transient for the repeated-away #191 timeout; implementation-defect/required-gate failure for reproducible frontend failures; workflow/infrastructure-defect boundary for sandbox launcher/socket failures | Keep the transient observation in evidence only; reconcile reproducible failures to #191/#192 before closure. No new issue absent a distinct uncovered defect. | Engineer: rerun the current full frontend suite and fix/reconcile failures within the owning issue; QA: rerun full frontend and root gates, classifying each failure before replacement QA comments. |

## Criterion-ready follow-up definitions

- #191 remaining verification: prove all five top-level disclosures and corrected defaults in the real browser at desktop/tablet/narrow widths, then prove the complete root gate in an approved environment. This is existing #191 scope.
- #192 remaining verification/implementation: measure the actual editor camera path for 10 seconds at desktop and narrow widths before and after optimization, compare every budget metric in #192, and resolve any current full-suite failures. This is existing #192 scope.

No criterion-ready new issue was created. Issue creation was not authorized, and the duplicate audit found no distinct actionable item requiring a pending-authorization handoff.

## Verification boundary

The user supplied a real symptom for camera performance, so it is classified as an implementation defect rather than a verification-only blocker. The prior Docker/browser setup remains a host-specific verification boundary documented in durable memory; it does not replace profiling the reported slow path.

## Memory

Existing `mediapipe` lifecycle, p5 getUserMedia, Playwright prerequisite, local sandbox verification-boundary, and wrong-Docker-project topics apply. No new durable topic is needed: the surfaced gaps are already linked to existing issue scope or documented environment boundaries.

## Session reconciliation

- Project issue search: complete open-issue search returned only #191 and #192; no unmanifested open issue was found.
- Ordering: #191 (backlog task 160) precedes #192 (task 161); no dependency between them was identified.
- Git state at inspection: `main` was clean and four commits ahead of `origin/main`; session-relevant commits are `0643318`, `56a96da`, and `07cf4dc`. This pass intentionally modified only `.local/tasks/task-distillation-2026-08-27.md` and `_docs/tasks.md`; no unrelated changes were modified or committed.
- Status/next action: both issues remain open and ACTIVE/reopened; both manifest entries are terminal `blocked` for this pass because required evidence is missing. #192 additionally lacks qualifying live metrics and has unresolved full-suite evidence.
- Memory: existing topics reused; no topic created or changed.
- Issue creation: 0 created, 0 reused as new follow-ups, 0 pending authorization.
- Failed full-suite gates: all are classified above; no failed gate remains unclassified.
