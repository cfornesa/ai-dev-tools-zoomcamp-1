# Backlog session manifest — 2026-08-26

Project: `cfornesa/ai-dev-tools-zoomcamp-1`

| Issue | URL | Backlog entry | Dependencies | Scope | Status | Blocker / follow-up | Owner / next action |
| --- | --- | --- | --- | --- | --- | --- | --- |
| #191 | https://github.com/cfornesa/ai-dev-tools-zoomcamp-1/issues/191 | Task 160 | None | Top-level Details/Tools/Layers/Inspector collapse | blocked | Verification boundary: focused/full frontend passed; real-browser and unrestricted `make check` unavailable in managed macOS environment; no follow-up issue warranted | Project owner: run browser regressions and `make check` in approved environment, then rerun QA |
| #192 | https://github.com/cfornesa/ai-dev-tools-zoomcamp-1/issues/192 | Task 161 | None | Camera capture/inference backpressure and performance diagnostics | blocked | Implementation defect fixed in `943ad25`; full frontend terminal result, profiling, browser diagnostics, and unrestricted `make check` remain unavailable | Project owner: run full suite and synthetic desktop/narrow diagnostics in approved environment, then rerun QA |

Ordering: #191 then #192 by backlog order; no dependency-blocked issues.

## Gate evidence

- #191 PM: comment `5434388109`; engineer commit `0d237cf`; QA FAIL comment `5434449656`.
- #192 PM: comment `5434466813`; engineer commits `f634ecc`, `943ad25`; QA FAIL comments `5434507848`, `5434530168`.
- No new actionable follow-ups were discovered or created; all remaining blockers are verification boundaries except the fixed #192 test typing defect.
- Memory: existing camera, browser, local verification-boundary, and editor-state topics remain applicable; no new durable topic required.
- No PR created because required issue gates are incomplete.
