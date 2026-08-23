# Stop Unexpected Editor Refreshes from Interrupting Unsaved Work

## What & Why

Implement Task 82 / GitHub issue #112. Draft autosave and recovery exist, but
the reported unexplained refresh has not been isolated in a real browser.
This task distinguishes browser lifecycle behavior, intentional navigation,
and handled API failures before changing recovery behavior.

## Done looks like

- Chromium coverage records navigation/reload events during editing.
- Controlled autosave or server-sync failures keep the editor route active,
  preserve working state or a recovery candidate, and show an actionable
  error.
- Dirty and clean `beforeunload` behavior are both verified.
- Reload recovery is deterministic and does not loop.
- Intentional leave actions are clearly labeled.
- The existing personal Mistral credential failure journey remains separate.

## Out of scope

- Editor layout redesign.
- Layer hierarchy or pointer manipulation redesign.

## Relevant files

- `frontend/src/pages/useBeforeUnloadGuard.ts`
- `frontend/src/pages/useDraftAutosave.ts`
- `frontend/src/pages/useDraftServerSync.ts`
- `frontend/src/pages/useDraftRecovery.ts`
- `frontend/src/pages/EditorWorkspace.tsx`
- `frontend/e2e/aiAndRecovery.spec.ts`
- `frontend/e2e/mistralCredential.spec.ts`