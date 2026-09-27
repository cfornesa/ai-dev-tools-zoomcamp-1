## QA: PARTIAL / OPEN — implementation gap reconciled, browser-run boundary remains

### Criterion matrix

| Criterion | Result | Evidence |
|---|---|---|
| `@Hills` region target at 1280x900 | PASS | Active authenticated Chrome normal-click flow accepted the target; disposable database version comparison showed Hills changed while Sky remained unchanged. |
| `@Hills` region target at 375x812 | PASS for active Chrome interaction | Responsive disclosure was opened by a normal click and the target option/refine flow completed; exact Playwright closure artifact remains unavailable on this host. |
| `@ink` changes only ink data | PARTIAL | `@ink` was offered in the active editor UI; no closure-grade browser mutation artifact was produced. |
| SVG `@element` changes only that element | PASS | Same-line SVG target flow completed in active Chrome after #959; database comparison showed the sibling unchanged. |
| Unresolvable mention produces no version | PARTIAL | Backend/focused coverage remains green; direct browser execution was not rerun after the implementation transaction. |
| Before/after screenshots at 1280x900 and 375x812 | OPEN | Active Chrome views were inspected, but the exact Playwright run cannot launch Chromium on this macOS host because of MachPort permission failure; no screenshot artifact is claimed as Playwright evidence. |

### Exact commands and boundary

- `cd backend && uv run pytest tests/test_art_piece_refine.py` — PASS, 17 tests.
- `make check` — PASS: backend `1748 passed, 39 skipped`; frontend `286 passed, 3057 passed`; lint, format-check, and typecheck passed.
- `cd frontend && npx playwright test e2e/aiRegionTargetExisting.spec.ts --project=chromium` — BLOCKED before setup by `MachPortRendezvousServer ... Permission denied` / SIGTRAP/EPERM. `--list` discovers all 4 tests.

This remains local disposable Compose/PostgreSQL and active Chrome evidence
only. No deployed URL or production criterion is inferred. Synthetic DOM
dispatch is excluded. Keep #921 open until an approved browser runner can
produce the exact screenshot and direct unresolved/ink mutation evidence.
