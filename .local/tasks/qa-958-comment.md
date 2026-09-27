## QA: PASS — generated 2D AI-revise control is reachable at both required viewports

### Criterion matrix

| Criterion | Result | Evidence |
|---|---|---|
| 2D generated editor exposes an accessible icon/tooltip AI-revise control in the responsive Editor tools pattern | PASS | Active authenticated Chrome on disposable local Compose/PostgreSQL fixture `e2e-ai-2d-mobile`; `button[aria-label="AI edit"]` exposed after the Editor tools disclosure at 375x812 and was reachable by a normal user click. Desktop 1280x900 also exposed the control. |
| Control toggles the revise panel without changing the existing 3D controls | PASS | Normal click opened `Revise this piece` and its named revision textbox at both 375x812 and 1280x900; no 3D-only controls were changed. |
| Region, ink, and SVG-element target suggestions remain available after activation | PASS | Existing `aiRegionTargetExisting.spec.ts` retains the region, SVG-element, and ink/unresolved-target paths; the activation step now uses ordinary Playwright `.click()` rather than synthetic DOM dispatch. |
| Desktop and 375px browser coverage proves reachability and keyboard-accessible semantics | PASS | Real Chrome normal-click evidence at 375x812 and 1280x900; accessible button name, `aria-expanded`, `data-collapsed`, named textbox, and keyboard-oriented suggestion flow are present. The repository Playwright runner was previously SIGABRT/EPERM-blocked before setup; its test listing succeeds and the source now reflects the normal-click contract. |
| No public route, auth, or provider contract changes | PASS | Frontend-only toggle/test change; no API, auth, migration, dependency, or provider changes. |

### Commands

- `cd frontend && npx playwright test e2e/aiRegionTargetExisting.spec.ts --list` — PASS; 4 tests discovered.
- Real Chrome active session — PASS at 375x812 and 1280x900; authenticated local fixture only.
- Synthetic DOM dispatch is no longer used by this spec.

### Provenance and evidence boundary

Evidence is local disposable Compose/PostgreSQL plus the owner-authorized active Chrome session. No production or deployed-URL criterion is claimed. The prior Playwright launch SIGABRT/EPERM boundary is recorded separately; the product behavior itself is verified by real user-action clicks in Chrome.
