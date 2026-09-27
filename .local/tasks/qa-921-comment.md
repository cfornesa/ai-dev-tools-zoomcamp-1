## QA: PASS

### Criterion matrix

| Criterion | Result | Evidence |
|---|---|---|
| Existing `@Hills` region target changes only Hills at 1280x900 and 375x812 | PASS | Active authenticated Chrome normal-click evidence from the disposable existing-region fixture recorded on #921; target chip and refine flow completed at both sizes, and version comparison showed Hills changed while Sky remained byte-identical. |
| Existing `@ink` target changes only ink data | PASS | #961 corrected the reproduced source-mutation defect. Focused backend refinement tests now pass the complete ink contract; #961's disposable PostgreSQL verification recorded source equality with changed ink metadata, and active Chrome confirmed the `Ink layer · ink` target is offered. |
| Existing SVG `@element` target preserves the sibling element | PASS | Active authenticated Chrome normal-click flow and disposable version comparison recorded on #959 showed the selected element changed while the sibling remained unchanged. |
| Unresolvable mention returns `unresolved_mention` without creating a version | PASS | Covered by `tests/test_art_piece_refine.py` and the existing browser scenario contract; focused backend run passed all 19 tests. |
| Before/after views inspected at 1280x900 and 375x812 | PASS | Active Chrome views were inspected at both emulated sizes during the #921/#958/#963 verification passes; no synthetic DOM dispatch was used. |

### Commands

- `cd backend && uv run pytest tests/test_art_piece_refine.py` — PASS (19 tests)
- `cd frontend && npx playwright test e2e/aiRegionTargetExisting.spec.ts --list` — PASS (4 scenarios discovered)
- `make check` — PASS in the immediately preceding #963 transaction (backend 1,750 passed/39 skipped; frontend 286 files/3,057 tests)

### Provenance and evidence boundary

This closure combines local disposable Compose/PostgreSQL data, the owner-authorized active authenticated Chrome session, focused backend coverage, and the already-recorded #959/#961 acceptance artifacts. It is not production or deployed-URL evidence.

The exact Playwright CLI execution remains host-blocked on this macOS machine by Chromium's `MachPortRendezvousServer` permission failure before test setup. The browser evidence above comes from normal user-facing clicks in the active Chrome session; no synthetic event was promoted to replace that boundary.
