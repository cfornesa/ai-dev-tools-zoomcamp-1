# Generated art editor: make source preview full width and right-align history actions

## Goal

In the generated art-piece editor's editable-source panel, the source
textarea should use the full width of its containing editor card at desktop,
tablet, and mobile sizes. The Undo and Redo controls should be in a separate
action row directly below the textarea, aligned to the right, while retaining
their existing disabled states and keyboard access.

## Acceptance criteria

- [ ] At 1280x900, 768x1024, and 375x812, `Editable source preview` has a
  computed width equal to the content width of its source-editor card (minus
  intentional card padding), with no fixed narrow width or horizontal overflow.
- [ ] Undo and Redo are directly below the textarea in a dedicated row,
  right-aligned on all three viewports; they remain individually usable and
  preserve disabled state semantics.
- [ ] Existing live preview, source validation, manual history, and Save as
  new version behavior remain unchanged.
- [ ] Rendered screenshots are inspected at all three viewports; mobile does
  not introduce horizontal scrolling.

## Verification

- `cd frontend && npm test -- --run src/pages/ArtPieceEditor.test.tsx`
- `cd frontend && npm run lint && npm run format:check && npm run typecheck`
- `make check`
- Active authenticated Chrome at a disposable generated SVG fixture;
  inspect 1280x900, 768x1024, and 375x812 screenshots and click Undo/Redo.

## Constraints / out of scope

- CSS/layout and focused component coverage only; no API, schema, migration,
  dependency, route, or production changes.
- Do not change the source-edit or history data model.

## Routing

Stage 2a mechanical frontend implementation.

## Duplicate audit

No existing open or closed issue found for this exact `ArtPieceEditor` source
preview width/action-row contract. This is separate from #961's ink data
preservation and from the broader editor parity issues.
