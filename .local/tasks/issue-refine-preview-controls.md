# Issue #963 — Generated art refine and SVG preview controls need full-width responsive grouping

## Distillation

- Source: live Chrome feedback and screenshot on 2026-09-27.
- Related but distinct: #962 covers the editable-source textarea and Undo/Redo row; #961 covers the ink refinement data contract. This issue covers the surrounding refine/preview controls and their layout grouping.
- Scope: make the refine instruction field and selected-target presentation readable and full-width within their content card; group the Sound, Draw Ink color control, and Draw Ink action with Screenshot directly below the authored preview text; keep the controls responsive at desktop, tablet, and mobile widths without changing behavior.

## Acceptance criteria

1. At 1280x900, 768x1024, and 375x812, the refine instruction textarea uses the available card width and the selected ink target is presented as an intentional field/chip within that card, not as a detached floating element.
2. For SVG/2D editor preview, the authored-preview text appears immediately above one responsive control row containing Screenshot, Sound, ink color, and Draw ink; no control is orphaned outside that grouping.
3. Existing refine, sound, ink-color, screenshot, and preview behavior remains unchanged; keyboard focus and accessible names remain available.
4. Focused frontend tests and active-Chrome verification cover desktop and mobile widths, with the exact evidence boundary recorded.

## Routing

Stage 2a mechanical frontend, unless implementation reveals an API/data contract change, in which case stop and reroute before editing backend behavior.

## Duplicate audit

Checked GitHub and local task records against #962, #961, #882, #890, and #921; none covers this exact control grouping and refine-card width defect.
