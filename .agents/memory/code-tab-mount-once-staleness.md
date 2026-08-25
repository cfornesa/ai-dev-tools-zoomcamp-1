---
name: code-tab-mount-once-staleness
description: The editor's Code tab (JSON/HTML/CSS/JS) only resyncs its displayed text when CodeTab mounts, so Undo/Redo and a Visual<->Code toggle can silently show stale content or discard unsaved edits.
metadata:
  type: project
---

`frontend/src/pages/EditorWorkspace.tsx`'s `CodeTab` is conditionally
rendered (`{previewView === 'code' && <CodeTab .../>}`), not just hidden.
Each sub-editor (`SceneCodeEditor` for JSON, `HtmlCssCodeEditor` for
HTML/CSS, `JsCodeEditor` for JS) seeds its own local text state once via a
lazy `useState` initializer that only runs on `CodeTab`'s mount. This was
an intentional design decision dating back to task 127/#159 ("Visual and
Code are mutually exclusive views, so resync on mount is enough" — the
JSON tab's own doc comment says this explicitly), and it holds fine for
edits made *through* the Visual tab.

It does **not** hold for two other, easy-to-hit cases, confirmed live
during the task 145 re-audit (2026-08-25):

1. **Undo/Redo does not resync an open Code tab.** The toolbar's
   Undo/Redo buttons stay visible and clickable while the Code tab is
   open (they are siblings of the Visual/Code toggle, not gated by it).
   Clicking Undo/Redo correctly updates `workingCopy` (verified live via
   the Visual tab's shape count), but does not remount `CodeTab`, so the
   currently-open sub-tab's textarea keeps showing pre-undo content.
   Editing/saving from that stale view would silently re-commit the
   stale data over whatever was just undone.
2. **A bare Visual<->Code toggle discards unsaved Code-tab edits, with
   zero warning.** Typing into any HTML/CSS/JS sub-tab without clicking
   its Save button, then clicking "Visual" (even without editing
   anything there) and back to "Code", resets that sub-tab's text to the
   last-committed value. There is no confirmation prompt and no draft
   recovery for this specific in-progress, uncommitted text (project-
   level draft-autosave, #125, only covers the committed working copy).

Filed as [#177](https://github.com/cfornesa/ai-dev-tools-zoomcamp-1/issues/177)
rather than fixed inline — the right fix (resync sub-editor text on a
`workingCopy` change via `useEffect`, and/or a discard-confirmation on the
Visual/Code toggle when a sub-tab is dirty) needs its own design pass, not
a one-line patch.

**How to apply:** when verifying any future Code-tab work, always check
sub-tab content immediately after an Undo/Redo click and after a bare
Visual<->Code round trip with an unsaved edit pending — do not assume "no
error shown" means the display is current. When debugging a report of "my
Code-tab edit disappeared" or "Undo doesn't seem to affect the Code tab",
check this before assuming a fresh regression.
