# Production-readiness assessment — 2026-08-27

## Verdict

**NOT READY.** The project has no open GitHub backlog issue in the current
manifest, but the complete automated browser gate is failing and the local
deployment configuration is intentionally development-safe rather than
production-safe. Replit deployment verification remains outstanding.

## Reconciled scope

- `_docs/tasks.md` terminal entries are reconciled with GitHub. The apparent
  active task 154 is followed by its terminal `Status: COMPLETE` entry for
  GitHub #185; GitHub #183, #185, #191, and #192 are all closed with
  `state_reason: completed`.
- The working tree was clean at `489ea51` (`origin/main`), aside from ignored
  generated test/build artifacts.
- No new issue was created: the browser failures map to existing draft,
  collapsible-panel, graph-authoring, credential, selection-alignment, and
  responsive-shell backlog areas rather than a distinct uncovered defect.

## Evidence

### Passing automated gates

- Host-level `UV_CACHE_DIR=/private/tmp/creatrweb-uv-cache make check`:
  backend **636 passed, 22 skipped**; frontend **1,880 passed**; lint,
  format, and typecheck passed.
- `npm run build`: passed. Vite emits a chunk-size warning for the existing
  `DemoControlsPanel` bundle (1.22 MB minified).
- Isolated disposable-stack Layers browser suite: **7/7 passed**.
- Isolated camera/publishing suite: **24/24 passed**, including synthetic
  desktop and narrow 10-second diagnostics. Desktop: 60.05 FPS animation,
  23.38 FPS inference, 95 ms max long task. Narrow: 60.04 FPS animation,
  23.28 FPS inference, 0 ms max long task.
- Runtime benchmark: **3/3 passed**.

### Failed automated gate

`UV_CACHE_DIR=/private/tmp/creatrweb-uv-cache BROWSER_QA_FULL_E2E=1 make browser-qa`
ran against disposable PostgreSQL, Django, Vite, and Chromium and finished
with **122 passed, 10 failed, 2 skipped**:

1. AI proposal Reject success state — `aiAndRecovery.spec.ts:266`.
2. Three draft/concurrency/recovery cases missing an assigned session id —
   `aiAndRecovery.spec.ts:426`, `:870`, and `:1007`.
3. Three interaction-runtime graph cases cannot expose the closed Behaviors
   section — `interactionRuntime.spec.ts:393`, `:486`, and `:532`.
4. Mistral credential settings copy assertion —
   `mistralCredential.spec.ts:24`.
5. Selection-center alignment flow fails to return to the gallery —
   `projectLifecycle.spec.ts:153`.
6. Narrow signed-in empty-gallery geometry assertion —
   `responsiveShell.spec.ts:178`.

These failures block a production-ready verdict until they are fixed or
explicitly quarantined by durable, issue-linked evidence. The targeted
camera and Layers evidence does not override the full-suite failure.

### Deployment boundary

- `make deploy-check` executes successfully but reports five release-blocking
  Django warnings for the local development `.env`: DEBUG enabled, no HSTS,
  no HTTPS redirect, and insecure session/CSRF cookies.
- `.replit` production build runs locked dependency installation,
  `manage.py check --deploy`, and the frontend production build; runtime is
  `scripts/start-production.sh`. This code path was inspected but not run
  against the published Replit environment.
- GitHub workflow/status connector queries returned no workflow runs or
  combined statuses for `489ea51`; CI result is therefore **unknown**, not
  passing evidence.

## Exact next actions

1. Fix or reconcile the ten full-browser failures, preserving the existing
   issue links and adding focused deterministic coverage where needed.
2. Rerun the full isolated browser gate and the root `make check`; require
   zero unexpected failures before closing the readiness gate.
3. Obtain a successful GitHub Actions result for the commit containing those
   fixes.
4. Publish to Replit and perform the allowed manual deployment verification:
   health, anonymous shell/login, authenticated editor flow, publish/public
   viewer, and camera fallback/active behavior.
5. Re-run production checks with production-safe Replit settings and record
   the deployment evidence before changing the verdict.
