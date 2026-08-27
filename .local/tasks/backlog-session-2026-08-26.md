# Backlog session manifest — 2026-08-26

Project: `cfornesa/ai-dev-tools-zoomcamp-1`

| Issue | URL | Backlog entry | Dependencies | Scope | Status | Blocker / follow-up | Owner / next action |
| --- | --- | --- | --- | --- | --- | --- | --- |
| #191 | https://github.com/cfornesa/ai-dev-tools-zoomcamp-1/issues/191 | Task 160 | None | Top-level Details/Tools/Layers/Inspector collapse | completed | User `make check` passed; isolated PostgreSQL-backed Django/Vite Chromium run passed `layersPanel.spec.ts` 7/7 at desktop and narrow widths; final responsive overflow and locator fixes committed in `5163895`; QA PASS comment `5434932604`; GitHub issue closed | None |
| #192 | https://github.com/cfornesa/ai-dev-tools-zoomcamp-1/issues/192 | Task 161 | None | Camera capture/inference backpressure and performance diagnostics | completed | User `make check` passed; focused camera/source tests passed 48/48; existing real-browser synthetic camera seam passed 14/14, including permission, unsupported, retry, active, overlay, and stop paths; implementation commits `f634ecc` and `943ad25`; QA PASS comment posted and GitHub issue closed | None |

Ordering: #191 then #192 by backlog order; no dependency-blocked issues.

## Gate evidence

- #191 PM: comment `5434388109`; engineer commit `0d237cf`; QA FAIL comment `5434449656`.
- #192 PM: comment `5434466813`; engineer commits `f634ecc`, `943ad25`; QA FAIL comments `5434507848`, `5434530168`.
- No new actionable follow-ups were discovered or created; the camera verification boundary was resolved using the repository's existing synthetic browser seam.
- Memory: existing camera, browser, local verification-boundary, and editor-state topics remain applicable; no new durable topic required.
- No PR created because required issue gates are incomplete.
