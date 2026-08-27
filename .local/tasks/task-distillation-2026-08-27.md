# Task distillation manifest — 2026-08-27

Project: `cfornesa/ai-dev-tools-zoomcamp-1`

| Issue | Existing record | Classification | Status | Concrete next action |
| --- | --- | --- | --- | --- |
| #191 | [GitHub #191](https://github.com/cfornesa/ai-dev-tools-zoomcamp-1/issues/191), task 160 | implementation-defect; reuse existing issue | active/reopened | Add a collapsible Canvas top-level section; default only Layers open and all other top-level sections closed; rerun focused and browser regressions. |
| #192 | [GitHub #192](https://github.com/cfornesa/ai-dev-tools-zoomcamp-1/issues/192), task 161 | implementation-defect; reuse existing issue | active/reopened | Profile the actual editor camera path, identify the dominant latency/resource cost, optimize it, and record desktop/narrow budget evidence. |

## Duplicate and coverage report

- The panel request is covered by #191; it is a correction to that issue's incomplete acceptance criteria, not a new issue.
- The camera report is covered by #192; the prior synthetic-seam pass did not disprove the user's live editor-path performance failure.
- No third actionable issue was found in the backlog or open GitHub issue search.

## Verification boundary

The user supplied a real symptom for camera performance, so it is classified as an implementation defect rather than a verification-only blocker. The prior Docker/browser setup remains a host-specific verification boundary documented in durable memory; it does not replace profiling the reported slow path.

## Memory

Existing `mediapipe` lifecycle, p5 getUserMedia, Playwright prerequisite, and wrong-Docker-project topics apply. No new durable topic is needed yet.
