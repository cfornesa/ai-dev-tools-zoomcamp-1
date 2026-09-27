## QA: PARTIAL / OPEN — implementation is green; browser acceptance remains delegated

The implementation commit `175a8eb0` remains present and the previous
timestamp failure has been independently fixed by #960.

### Current criterion matrix

| Criterion | Result | Evidence boundary |
|---|---|---|
| Library-derived options include unplaced/placed assets and explicit non-image state | PASS | Focused Vitest covers unplaced PNG and audio metadata. |
| Add-layer request sends metadata only | PASS | Focused `useAIRun` coverage asserts scope, selected id, name/MIME/dimensions, and no blob bytes. |
| Candidate preview, Accept/Reject, undo/version history | OPEN | Requires authenticated browser acceptance flow owned by #924/#925; no synthetic substitute is promoted. |
| Keyboard listbox and 375px usability | PARTIAL | Existing component coverage passes; new unplaced-asset browser evidence is still missing. |
| Broken-asset fallback | OPEN | Requires browser render of a deliberately unavailable/undecodable local asset. |

### Exact commands

- `cd frontend && npx vitest run src/pages/aiTargeting.test.ts src/pages/ProjectMediaLibraryPanel.test.tsx src/pages/useAIRun.test.ts src/pages/AIRunPanel.test.tsx` — **PASS**, 4 files / 23 tests.
- `make check` — **PASS** after #960: backend 1,748 passed/39 skipped; frontend 286 files/3,057 tests; lint, format-check, and typecheck passed with existing warnings only.

### Evidence boundary

All evidence is local repository evidence. The exact authenticated browser
candidate/accept/reject and mobile screenshots remain open and are not closed
by the passing unit suite. #923 stays open while #924/#925 perform the
separate browser scenarios; no production or deployed-URL criterion is claimed.
