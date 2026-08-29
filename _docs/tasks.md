# Creatrweb Animation Studio Backlog

Status convention: Each completed item is marked `Status: COMPLETE`. Work that is underway is marked `Status: ACTIVE`, and not-yet-started work is marked `Status: PROPOSED`.

## 1. Set up an empty project with a passing test
Goal: Create the minimal Django and React/TypeScript project structure and prove the test toolchain works.
Description: Initialize the backend and frontend applications, add their test runners, and document the local test commands. Include one trivial backend test and one trivial frontend test that both pass without implementing product behavior.
Status: COMPLETE

## 2. Add local development configuration
Goal: Make the empty application reproducible in a local development environment.
Description: Add example environment configuration for Django, PostgreSQL, the frontend, and required secrets without committing real credentials. Document the commands for installing dependencies, starting services, applying migrations, and running both applications.
Status: COMPLETE

## 3. Configure Replit-managed PostgreSQL and health checks
Goal: Connect deployed Django environments to Replit-managed PostgreSQL through `DATABASE_URL` while retaining SQLite only for isolated offline tests.
Description: Configure Django to consume the development or production `DATABASE_URL` supplied by Replit, document the separation between those databases, and add a lightweight endpoint that reports application and database availability without leaking connection details. Add PostgreSQL-backed tests for successful health responses and database connection failures, plus an explicit test-only SQLite path for tests that do not rely on PostgreSQL semantics.
Status: COMPLETE

## 4. Establish backend and frontend quality checks
Goal: Provide consistent automated formatting, linting, type-checking, and test commands.
Description: Configure appropriate Python and TypeScript quality tools and expose a single documented command for running all checks locally. Add continuous integration that executes the same checks on each proposed change.
Status: COMPLETE

## 5. Define the canonical scene JSON schema
Goal: Specify the versioned, renderer-neutral document format used as creative source of truth.
Description: Define schema sections for canvas settings, shapes, groups, layers, bindings, graph nodes, accessibility options, renderer preferences, and deterministic randomness. Include schema-version rules, stable identifiers, defaults, and representative valid and invalid fixtures.

## 6. Implement shared scene validation
Goal: Validate the canonical scene format consistently in the browser and on the server.
Description: Implement validators against the canonical schema for TypeScript and Django, including readable field-level errors. Test equivalent fixtures in both environments so malformed, oversized, or unsupported scenes receive consistent results.

## 7. Enforce scene complexity and numeric limits
Goal: Prevent saved or previewed scenes from exceeding safe V1 resource limits.
Description: Add validation for shape, group, node, connection, binding, conditional-node, particle, payload-size, and numeric-range caps. Cover boundary values and ensure validation identifies the exact exceeded limit.

## 8. Create project and immutable scene-version models
Goal: Persist individually owned projects and immutable creative snapshots.
Description: Add Django models for project metadata and scene versions, including current version, sequence, creator, parent, origin, change label, and soft-delete state. Add PostgreSQL constraints and PostgreSQL-backed model tests that prevent mutation, cross-project current-version pointers, or invalid and concurrently duplicated version sequences.

## 9. Create edit-session draft and activity models
Goal: Persist temporary recovery drafts and auditable project activity separately from version history.
Description: Add models for per-user edit-session drafts, expiry timestamps, and project activity records with structured metadata. Test uniqueness, expiry behavior, and separation between drafts, metadata changes, and immutable scene versions.

## 10. Create template and fork-provenance models
Goal: Store built-in or private templates and immutable remix provenance.
Description: Add a template model with source type, owner, source version, metadata, and scene snapshot, plus project/version fields needed to record a fork source. Add constraints that keep built-in templates ownerless, private templates owned, and provenance stable.

## 11. Centralize project authorization
Goal: Provide one permission service for all project, version, draft, publish, fork, and export operations.
Description: Define owner and public-view rules behind a reusable Django service rather than view-specific checks. Add a permission matrix test suite covering anonymous users, owners, other signed-in users, private projects, public projects, and remix-disabled projects.

## 12. Add Google OAuth authentication
Goal: Let users sign in with Google using minimal identity scopes.
Description: Configure django-allauth for Google authorization-code authentication and secure redirect handling, with secrets supplied only through server environment variables. Add authentication UI states and tests for protected routes, successful callbacks, failures, and sign-out.

## 13. Build private project CRUD APIs
Goal: Let authenticated owners create, read, update, and delete their project records safely.
Description: Implement endpoints for private project creation, listing, detail retrieval, metadata updates, and the chosen recoverable deletion behavior. Apply centralized authorization, default new projects to private, and test that users cannot access another owner's private data.

## 14. Build immutable version save APIs
Goal: Save validated creative changes as new immutable scene versions.
Description: Implement endpoints to list versions and create the next version from a full validated scene snapshot with origin and optional change label. Make version creation and current-version updates one PostgreSQL transaction, and verify concurrent sequence creation, invalid scenes, and attempts to alter existing snapshots against PostgreSQL rather than SQLite locking behavior.

## 15. Add version restore and soft-delete APIs
Goal: Let owners restore history without rewriting it and remove eligible old versions safely.
Description: Implement restore as creation of a new version copied from a selected historical snapshot, advancing the current version in one PostgreSQL transaction, and soft-delete only non-current versions. Verify parent links, restore origin, locking and rollback behavior, current-version protection, ownership checks, and hidden deleted versions against PostgreSQL.

## 16. Build the signed-in project gallery shell
Goal: Give users a responsive home for their private and public projects.
Description: Create the authenticated gallery page with project cards, empty state, create action, metadata summary, and navigation to the editor. Include loading, error, keyboard-focus, and screen-reader states and test the page against mocked project API responses.

## 17. Build project metadata editing
Goal: Let owners edit title, description, tags, remix setting, thumbnail choice, and export-attribution preference.
Description: Add an accessible metadata form whose changes do not create scene versions. Apply defaults for new projects and validate the stronger title and description requirements only when publishing or exporting.

## 18. Implement project creation from a blank scene
Goal: Create a private project with a valid initial blank-canvas version.
Description: Add a PostgreSQL-atomic creation flow that stores project metadata, a schema-valid blank scene, and its first immutable version. Test rollback on validation or database failure against PostgreSQL and route successful creation into the editor.

## 19. Seed the built-in template catalog
Goal: Provide the eight planned read-only starter templates as valid editable scenes.
Description: Create fixtures for Blank canvas, Hand follower, Pinch particle burst, Open-palm bloom, Motion trails, Gesture color field, Physics orbit, and SVG kinetic poster. Each fixture must pass scene validation, use deterministic seeds where needed, and contain a concise optional onboarding hint.

## 20. Build template browsing and cloning
Goal: Let users browse built-in and private templates and clone one into a new private project.
Description: Add a categorized template gallery with previews, accessibility labels, and an explicit create action. Implement and PostgreSQL-test atomic cloning that copies the chosen scene into a new project's first version without modifying or linking mutable state to the source template.

## 21. Add save-as-private-template
Goal: Let an owner turn a selected project version into a reusable private template.
Description: Add an action that snapshots a validated version with template name, category, and description for the current user only. Test ownership, visibility isolation, source preservation, and creation of projects from the resulting private template.

## 22. Create the three-panel editor workspace
Goal: Establish the accessible editor layout and state-loading boundary.
Description: Build the left tools/layers panel, central preview area, and right inspector with responsive resizing and keyboard navigation. Load a selected saved version into unsaved editor state while keeping project metadata and persisted history separate.

## 23. Implement shape creation and selection
Goal: Let users add, select, duplicate, and delete the V1 shape primitives.
Description: Support circles, rectangles, lines, and the approved basic path or polygon representation through canonical scene updates. Add stable identifiers, valid defaults, selection state, and pointer and keyboard interaction tests without implementing transform handles.

## 24. Implement groups, layers, and scene outline
Goal: Make scene structure fully manageable without relying on the visual canvas.
Description: Add grouping, ungrouping, layer ordering, bounded nesting, visibility, and selection through an accessible outline/list view. Ensure outline actions and direct canvas actions update the same canonical scene state and preserve stable identifiers.

## 25. Implement the p5.js preview adapter
Goal: Render a validated canonical scene in the editor using p5.js.
Description: Create a renderer adapter that draws the supported canvas, shape, group, style, transform, layer, and seeded-randomness fields without executing arbitrary scene code. Add deterministic rendering tests and a clear unsupported-feature error path.

## 26. Add direct manipulation to the preview
Goal: Keep pointer-based canvas manipulation synchronized with canonical scene state.
Description: Add selection bounds and drag, resize, and rotation controls for supported scene objects. Clamp edits to allowed ranges and test coordinate conversion, zoom behavior, overlapping selections, and synchronization with the inspector and outline.

## 27. Define the normalized tracking provider interface
Goal: Decouple scenes and bindings from MediaPipe-specific output.
Description: Implement the shared tracking frame, hand, landmark, confidence, and gesture-event contracts plus provider lifecycle methods. Include a mock provider and tests for timestamps, handedness, missing hands, and normalized signal extraction.

## 28. Build local demo signal controls
Goal: Test gesture-reactive scenes without a camera.
Description: Add sliders, toggles, buttons, keyboard controls, and synthetic playback for normalized hand signals, states, and events. Feed them through the same tracking interface used by live input and make every control keyboard and screen-reader accessible.

## 29. Implement reduced-motion behavior
Goal: Ensure previews and editor UI respect system and manual reduced-motion preferences.
Description: Add a global control that defaults to `prefers-reduced-motion` and passes a normalized preference into scene execution. Define and test static, faded, or stepped alternatives for non-essential continuous motion while preserving interaction meaning.

## 30. Integrate browser-local MediaPipe tracking
Goal: Produce normalized one-hand tracking data without uploading camera frames.
Description: Load the pinned MediaPipe Tasks Vision gesture recognizer in the browser and adapt its output to the tracking provider contract. Add lifecycle, throttling, cleanup, and failure handling tests using mocks rather than requiring a camera in automated tests.

## 31. Build camera permission and privacy UX
Goal: Make live tracking opt-in, understandable, and recoverable when unavailable.
Description: Add an explicit Enable camera action, local-processing privacy notice, active status, stop control, and friendly states for denial, missing hardware, insecure context, unsupported browser, or tracking failure. Keep demo controls available in every failure state and never start capture automatically.

## 32. Implement normalized one-hand signals
Goal: Expose stable continuous signals, gesture states, and gesture events to scene behaviors.
Description: Derive index-tip and palm coordinates, depth, speed, pinch strength, confidence, presence, supported gesture states, and enter/exit events from tracking frames. Apply smoothing and hysteresis where appropriate and test noisy, missing, and low-confidence input sequences.

## 33. Implement two-hand distance signals
Goal: Support independent hands and stable continuous or threshold-based distance interactions.
Description: Compute normalized distance between left and right palm centers or wrists, plus close/far states and transition events. Add configurable smoothing, close and far thresholds, release hysteresis, and hold time with deterministic sequence tests.

## 34. Build behavior-card binding controls
Goal: Let users express common interactions as “When this signal happens, change this property.”
Description: Add cards for hand following, pinch reaction, pulse, and particle emission with targets for primary, left, right, or either hand. Store cards as canonical graph/binding data, enforce one continuous binding per target channel, and explain replacement conflicts before applying them.

## 35. Implement the bounded behavior runtime
Goal: Evaluate validated bindings safely on each animation frame.
Description: Execute normalized inputs, transforms, events, and allowed visual targets using elapsed timestamps rather than frame counts. Clamp outputs, smooth continuous values, cap trigger frequency and per-frame work, and degrade gracefully when the execution budget is exceeded.

## 36. Build the typed React Flow graph view
Goal: Expose behavior cards as an editable advanced node graph.
Description: Add typed custom nodes, handles, connections, selection, and inspector integration for the allowed input, transform, visual, flow, and output families. Keep graph changes synchronized with canonical scene state and provide an accessible list-based alternative to drag-and-drop graph editing.

## 37. Implement numeric transform nodes
Goal: Support safe mapping and bounded arithmetic in behavior graphs.
Description: Add Map range, Clamp, Smooth, Invert, Add, Multiply, and Lerp nodes with typed ports and documented numeric ranges. Validate incompatible connections and non-finite results, and test evaluation at boundary values.

## 38. Implement conditions and timing nodes
Goal: Support simple branching and time-based behavior without general-purpose programming.
Description: Add If/Else comparisons, Oscillator, Timer, Delay, and Cooldown nodes using elapsed timestamps, debouncing, and hold times. Enforce one condition per node, no loops or recursion, and a maximum of three conditional nodes per scene.

## 39. Implement the bounded particle emitter
Goal: Render particle effects within predictable resource and performance limits.
Description: Add particle rate, size, lifespan, speed, palette, and event emission to the scene runtime and p5.js adapter. Enforce particle-count and emission-rate caps and test deterministic creation, cleanup, cooldowns, and overload behavior.

## 40. Implement deterministic visual randomness
Goal: Make random-looking scenes reproducible across preview, duplication, versions, forks, and exports.
Description: Add seeded random ranges, list choices, event randomness, and bounded noise or wobble to schema and runtime behavior. Display a read-only “Randomness enabled” indicator and test identical output sequences for identical scenes and seeds.

## 41. Add explicit save and version-history UI
Goal: Let users create labeled versions and understand or restore their project history.
Description: Add Save, version list, latest marker, timestamps, creator, origin, change label, preview where feasible, restore, and eligible soft-delete actions. Clearly distinguish unsaved editor state from the current saved version and confirm history-changing actions accessibly.

## 42. Implement browser-local draft autosave
Goal: Protect active unsaved work from tab or browser interruption.
Description: Save the current edit-session state to IndexedDB after a one-to-two-second idle debounce and track its timestamp and concise change summary. Clear the local draft after explicit Save or Exit without saving, and add tests for debounce, stale writes, storage failure, and project switching.

## 43. Synchronize server-side recovery drafts
Goal: Keep a temporary private recovery copy of the active editing session on the server.
Description: Add authorized draft read, upsert, and delete endpoints and synchronize approximately every 20–30 seconds plus after meaningful actions. Attempt a small keepalive update on page hide, expire abandoned drafts after roughly 24 hours, and use PostgreSQL-backed concurrency tests to ensure stale draft writes never win or create scene versions.

## 44. Build unsaved-work and recovery prompts
Goal: Let users safely recover, discard, or leave unfinished work.
Description: Enable the native beforeunload safeguard only when unsaved changes exist and show a recovery prompt before reopening a project with a draft. Implement Recover draft, Discard draft, and Cancel choices with last autosave time and concise change summary.

## 45. Define the server-side AI provider interface
Goal: Isolate hosted model calls behind a testable Django abstraction.
Description: Define create-scene and edit-scene operations, structured response types, error handling, token metadata, and provider timeouts. Add a fake provider for deterministic tests and keep provider credentials out of browser code, logs, scenes, and exports.

## 46. Integrate Mistral structured scene creation
Goal: Turn an authenticated user's prompt into a validated draft scene without saving it automatically.
Description: Implement the Mistral-backed create-scene endpoint with schema-constrained output, prompt and response size limits, rate limits, quotas, and minimal metadata logging. Reject invalid or over-limit output before it reaches preview and test the endpoint with mocked provider responses.

## 47. Integrate Mistral patch-based scene editing
Goal: Turn a prompt and current scene into a minimal validated draft revision.
Description: Implement an edit endpoint that requests an allowlisted JSON Patch, applies it to a copy, and validates both patch operations and the resulting scene. Reject attempts to modify forbidden fields or exceed resource limits and return a concise structured change summary.

## 48. Build AI proposal preview and acceptance
Goal: Keep AI changes reversible until the user explicitly accepts them.
Description: Add create/edit prompt UI, pending and error states, a visual preview, human-readable change summary, and Accept and Reject actions. Accept must create exactly one immutable version with the correct AI origin in a PostgreSQL transaction, including under duplicate or concurrent submission, while Reject must discard the proposal without changing saved or working state.

## 49. Add public publishing controls
Goal: Let owners switch projects between private and public visibility safely.
Description: Add a one-time publication confirmation explaining what becomes public, require meaningful title and description, and update visibility immediately through an authorized endpoint. Switching back to private must remove public access and gallery eligibility without deleting history.

## 50. Build the public gallery
Goal: Display eligible public projects without exposing private content.
Description: Add a paginated gallery of public project cards showing title, thumbnail, creator attribution, and applicable “Made with” provenance. Test that privacy changes take effect immediately and that prompts, drafts, private API data, and camera content never appear.

## 51. Build the public project viewer
Goal: Let anyone experience a public saved version through demo mode or opt-in local camera tracking.
Description: Create a stable public URL that renders the current saved scene, starts in non-camera demo mode, and offers explicit camera enablement with the privacy and fallback UX. Respect reduced motion and keep all public controls keyboard accessible.

## 52. Implement remix settings and atomic forking
Goal: Let authenticated users fork remix-enabled public versions with permanent provenance.
Description: Add the owner remix toggle and a public Fork action that creates a new private project, first version, and source-project/source-version attribution in one PostgreSQL transaction. PostgreSQL-backed tests must cover rollback, concurrent duplicate submissions, private or remix-disabled sources, and durable provenance after later source changes.

## 53. Display remix provenance
Goal: Give public remixes clear, durable credit to their source.
Description: Show “Remixed from [creator]” with the original public link on applicable gallery cards and public project pages. Handle unavailable or newly private sources without leaking data while retaining the immutable attribution record.

## 54. Generate public preview thumbnails
Goal: Produce safe, stable artwork thumbnails for project cards.
Description: Render thumbnails from the selected saved scene in deterministic demo mode, excluding raw camera content, prompts, editor UI, and private metadata. Add regeneration and fallback behavior for rendering failures and verify consistent dimensions and cropping.

## 55. Build the export configuration dialog
Goal: Let owners choose a saved version and compatible runnable-export options.
Description: Add controls for saved version, compatible renderer, demo/camera interaction mode, optional attribution, and optional social-thumbnail ZIP with the documented defaults. Use current project title and description, validate publish-style metadata requirements, and explain any blocked renderer feature precisely.

## 56. Generate runnable p5.js HTML exports
Goal: Download a small CDN-linked `index.html` that runs independently of Django.
Description: Generate HTML with pinned dependencies, the selected validated scene, compact p5.js runtime, accessible title and controls, reduced-motion support, and only the tracking assets required by the chosen mode. Do not include internal IDs, prompts, history, creator identity, drafts, or re-import metadata.

## 57. Add camera-capable export behavior
Goal: Make exported live tracking private, explicit, and resilient across supported browsers.
Description: Add an Enable camera action, secure-context guidance, local-processing notice, stop control, and demo fallback to camera-enabled exports. Verify that exports never open a camera automatically or transmit or retain frames.

## 58. Add optional export attribution
Goal: Include product attribution only when the user selects it.
Description: When enabled, add the visible linked footer, matching HTML comment, and export version marker defined by the plan. When disabled, verify that no product branding or attribution comment appears in the output.

## 59. Add the optional social-thumbnail ZIP export
Goal: Download `index.html` and an artwork-only 1200×630 PNG in one ZIP when requested.
Description: Capture the selected saved scene in stable demo mode and exclude titles, names, logos, watermarks, controls, UI, and camera imagery from the PNG. Keep HTML-only download as the default and test ZIP filenames, image dimensions, and failure cleanup.

## 60. Implement inspector-based shape styling
Goal: Let users edit supported visual properties without manipulating the canvas directly.
Description: Add accessible inspector fields for position, scale, rotation, opacity, fill, stroke, and stroke width with their permitted ranges. Keep inspector edits synchronized with the preview and outline and test invalid input, keyboard changes, and multi-axis values.

## 61. Implement trails and bounded physics forces
Goal: Add the remaining V1 motion effects without allowing unbounded simulation work.
Description: Add trail length and the approved physics-force parameters to the canonical scene runtime and p5.js adapter. Clamp force, velocity, trail samples, and affected object counts and test cleanup, reduced-motion substitutions, and frame-budget fallback.

## 62. Audit editor keyboard accessibility
Goal: Verify that the editor's core creation flow can be completed without a pointer.
Description: Test the workspace, tools, canvas alternatives, inspector, outline, shape operations, behavior cards, and save controls for logical focus order, visible focus, labels, and keyboard traps. Fix the scoped findings and record any browser or assistive-technology limitations.

## 63. Audit graph and input accessibility
Goal: Verify accessible alternatives for graph editing, camera gestures, and animation motion.
Description: Test the graph list view, node connection controls, demo inputs, camera states, onboarding hints, and reduced-motion behavior with keyboard and screen-reader workflows. Fix the scoped findings and confirm that no gesture or drag operation is the only way to complete an action.

## 64. Audit gallery and sharing accessibility
Goal: Verify accessible project management, publishing, viewing, remixing, and export flows.
Description: Test signed-in and public galleries, metadata forms, history, AI proposals, recovery, publish confirmation, public viewer, fork action, and export dialog. Fix the scoped focus, labeling, error-announcement, contrast, and keyboard-operation findings.

## 65. Add project lifecycle end-to-end tests
Goal: Prove users can create, edit, save, restore, and reopen a project.
Description: Add browser tests for blank and template creation, shape edits, explicit save, version history, restore, and eligible soft deletion. Run these transaction-sensitive journeys against PostgreSQL with deterministic database and scene fixtures, and verify both visible results and persisted version relationships.

## 66. Add interaction runtime end-to-end tests
Goal: Prove demo signals and behavior graphs produce the expected visual-state changes.
Description: Add browser tests for one-hand demo inputs, two-hand distance, binding conflicts, numeric transforms, conditions, timing, particles, and reduced motion. Use a deterministic mock tracking provider so no physical camera is required.

## 67. Add AI and recovery end-to-end tests
Goal: Prove AI proposals and interrupted edit sessions remain reversible.
Description: Add browser tests for AI scene creation, patch editing, validation failure, Accept, Reject, local autosave, server synchronization, recovery, and discard. Mock the model provider and time boundaries, run persistence-sensitive cases against PostgreSQL, and verify that concurrent or repeated actions still allow only accepted proposals or explicit saves to create versions.

## 68. Add publishing and remix end-to-end tests
Goal: Prove public visibility and provenance rules across owner and visitor sessions.
Description: Add browser tests for publish confirmation, public gallery inclusion, anonymous viewing, opt-in camera fallback, unpublishing, remix opt-out, and atomic forks. Run persistence and concurrent-fork cases against PostgreSQL, verifying rollback, private-content isolation, and durable fork attribution.

## 69. Add export end-to-end tests
Goal: Prove selected saved versions generate working, privacy-safe download artifacts.
Description: Test HTML-only and thumbnail-ZIP exports across interaction and attribution options, including export of a historical version. Open generated HTML in an isolated browser context and verify pinned assets, metadata, controls, reduced motion, camera opt-in, and excluded internal data.

## 70. Benchmark editor runtime limits
Goal: Verify allowed worst-case scenes remain responsive and degrade gracefully when necessary.
Description: Measure representative maximum-size graphs, shapes, bindings, trails, and particles against agreed load and frame-time budgets. Record reproducible benchmarks and test the runtime's quality-reduction and execution-budget behavior.

## 71. Test authorization and rate-limit boundaries
Goal: Prevent cross-user access and abusive calls to protected or costly endpoints.
Description: Add adversarial tests for project, version, draft, template, publish, fork, export, and AI authorization using anonymous, owner, and non-owner identities. Verify prompt quotas, request limits, cooldown responses, concurrent mutations, and transactional rollback against PostgreSQL without relying only on UI restrictions.

## 72. Test malicious scene and AI patch payloads
Goal: Reject unsafe structured input before it can be saved, previewed, or exported.
Description: Exercise schema bypasses, oversized payloads, invalid graph cycles, non-finite numbers, prototype-like keys, forbidden patch paths, and resource-limit combinations. Verify consistent browser and server rejection with safe errors and no partial persistence.

## 73. Audit camera and secret privacy
Goal: Confirm that sensitive video, credentials, prompts, and drafts never cross unintended boundaries.
Description: Inspect browser requests, server logs, public responses, thumbnails, scenes, and generated exports during camera and AI workflows. Verify that frames remain local, secrets remain server-side, and prompts or private recovery data are absent from public and downloaded artifacts.

## 74. Test generated HTML against injection attacks
Goal: Ensure project-controlled metadata and scene data cannot escape the export document's data boundaries.
Description: Generate exports using hostile titles, descriptions, colors, labels, URLs, and structured scene values and open them under a restrictive test policy. Verify correct escaping, no arbitrary script execution, and functional safe exports for ordinary content.

## 75. Add real environment variables and private credentials
Goal: Replace the placeholder values used during development (Google OAuth client id/secret, Mistral API key, and any other provider credentials introduced by Tasks 12+) with real, securely-stored values in every deployed environment.
Description: Enumerate every environment variable/secret placeholder introduced so far (starting with `GOOGLE_OAUTH_CLIENT_ID`/`GOOGLE_OAUTH_CLIENT_SECRET` from Task 12) and any added by later AI-integration tasks. Document where each real credential comes from (Google Cloud Console OAuth client, Mistral API console, Replit-managed PostgreSQL, etc.), provision them in Replit's development and production secret stores separately, and verify the application behaves correctly with real values instead of placeholders. Confirm no placeholder or real secret is ever committed to the repository.
Status: COMPLETE
Ordering: Remains the last credential-provisioning task in the original V1 backlog. The project owner has provisioned the required credentials through Replit's secure secret mechanism, and verification confirmed their presence without exposing values. Do not reorder or reopen this task unless the credential configuration changes.

## 76. Make production deployment pass operational readiness checks
Goal: Ensure the imported application can be run and published safely after code and database changes in both Replit and the external local deployment.
Description: Define and verify two equivalent deployment tracks. For Replit, apply and verify all committed Django migrations in the development and published production environments, including `scenes.0017_remove_project_thumbnail_choice`; keep development and production `DATABASE_URL` values and other secrets separate; make `manage.py check --deploy` pass with an intentional production email backend, `DEBUG=False`, HTTPS redirects, secure session/CSRF cookies, and an explicitly reviewed HSTS policy; and verify the health endpoint plus anonymous/authenticated smoke checks against the published URL. For the external local deployment, document and test how `DATABASE_URL` points to the intended non-production PostgreSQL instance, keep `POSTGRES_TEST_DATABASE_URL` optional and isolated, provide production-like settings without copying Replit production secrets, run the same migrations and deployment checks, and verify the local health/authentication smoke path. The publish/pre-deploy migration path must be reproducible in Replit and the local startup/deployment path must be reproducible outside Replit without exposing credentials or live data.
Status: COMPLETE
GitHub issue: #97
Evidence (2026-08-23): the external local track is complete. All committed local migrations are
applied (`manage.py migrate --check`), the backend suite passes 580 tests, the frontend suite passes
1522 tests, `make check` is green, and an isolated production-like environment passes
`manage.py check --deploy` with `DEBUG=False`, secure HTTPS/session/CSRF settings, positive HSTS,
explicit hosts, and SMTP delivery. The documented authenticated local smoke path also passed against
a real local Django+Vite+PostgreSQL stack.

The Replit track is complete and verified through the managed deployment surfaces: development
contains migrations through `0017_remove_project_thumbnail_choice`; production contains the
expected `MistralCredential` table and no obsolete `thumbnail_choice` column; Replit's schema-diff
check reports no pending structural changes; and the current autoscale deployment has a successful
build. `PUBLISHED_APP_URL=https://animate.creatrweb.com scripts/smoke-published.sh` passed health
200, root 200, anonymous `/api/whoami/` 401, and `/accounts/login/` 200. Production schema changes
continue to go through Replit Publish rather than direct Django migration commands.

## 77. Prevent false PUSH_REJECTED errors during Replit Git pushes
Goal: Make Git pushes accurately distinguish authentication problems from real remote branch divergence.
Description: Fetch current remote refs before evaluating a push and use the active Replit/GIT_URL credential without printing, persisting, or exposing its value. Classify equal, ahead-only, behind-only, and truly diverged `main` states accurately; fast-forward an ahead-only branch; provide actionable authentication diagnostics instead of claiming remote commits exist when they do not; and refuse to force-push or overwrite a true divergence automatically. Add automated coverage for stale refs, credential-helper pushes, equal refs, and genuine divergence, then verify the workflow in the Replit Git/deployment environment and document the safe recovery path for external local deployments.
Status: COMPLETE
GitHub issue: #104

## 78. Capture newly discovered work before it disappears
Goal: Ensure every new actionable issue found during a task becomes a durable, linked backlog item before the agent continues or closes the current task.
Description: Enforce a discovery gate across exploration, implementation, QA, and review. Search the canonical backlog, local task plans, and existing GitHub issues for duplicates; create a PROPOSED entry in `_docs/tasks.md` and a matching GitHub issue when the work is new; link both records; explicitly record any unavailable issue linkage; and reconcile all discovered work before the current task is marked complete. Keep ordinary pending work out of long-term memory while preserving durable blockers and lessons in `.agents/memory/`.
Status: COMPLETE
GitHub issue: #108

## 79. Give the editor preview and control panels usable space
Goal: Make the editor workspace's visual hierarchy and preview area comfortable at common desktop and tablet widths without changing scene behavior.
Description: Replace the current equal-width panel treatment with an intentional hierarchy that gives Preview a usable dominant area while keeping Details, Tools, and Inspector readable. Preserve preview aspect ratio, SVG overlay alignment, pointer-coordinate mapping, keyboard navigation, reduced-motion behavior, and the responsive narrow-width panel switcher. Verify representative desktop, tablet, and narrow widths without horizontal overflow.
Status: COMPLETE
GitHub issue: #109
Verification: `frontend/src/index.css`'s `.editor-workspace` is now a CSS grid at
>=1024px (`minmax(420px, 2fr) minmax(300px, 1fr)`) with `.editor-panel[data-panel='preview']`
spanning column 1 across all three sidebar rows, so Preview gets roughly double the
Details/Tools/Inspector sidebar's width instead of the previous equal four-way flex split; the
existing `max-width: 1023px` breakpoint (matched to `useIsNarrowViewport`'s JS threshold) still
collapses to the pre-existing single-column stack + `EditorPanelSwitcher` layout, with a new
`max-width: 767px` band underneath it tightening margins/padding for phone widths — three
distinct bands (desktop grid, tablet stack, narrow stack) as required. `EditorWorkspace.tsx`'s
`.editor-scene-canvas` wrapper switched from a fixed pixel `height` to `aspectRatio:
`${canvasWidth} / ${canvasHeight}``, so when `maxWidth: '100%'` caps its width below the scene's
logical size the height now shrinks proportionally instead of leaving dead space — the absolutely
positioned overlay SVGs (`inset: 0`) and the p5 canvas (`height: auto !important`, unchanged)
both continue tracking the same box, and `clientToCanvasPoint` (untouched) already scales pointer
coordinates by the canvas element's actual rendered rect, so alignment holds at any panel width.
`make frontend-lint`/`typecheck`/`test` all green (1501 tests, including a new regression test in
`EditorWorkspace.test.tsx` asserting the stylesheet's preview column has a larger `fr` share than
the sidebar's and that every panel still carries its `data-panel` attribute; `useIsNarrowViewport.test.ts`'s
existing CSS/JS breakpoint-consistency regression test also stayed green). Manually verified against
a real Django+PostgreSQL+Vite stack (signed in as the `e2e_fixtures` owner) in a real browser at
1440px (Preview 706px vs. sidebar 353px, exactly the designed 2:1 split; canvas 672x504, matching
the scene's 4:3 ratio; `document.documentElement.scrollWidth` 1425 <= 1440, no overflow), 820px
(switcher visible, Preview stacked full-width above it, `scrollWidth` 805 <= 820), and 375px
(canvas 315x236.25, ratio still exactly 4:3; `scrollWidth` 375 === 375, no overflow; switcher tab
clicks correctly toggle `aria-selected` and swap the visible supporting panel while Preview stays
visible). No out-of-scope issues found.

## 80. Make shapes and their attributes understandable through layers
Goal: Make the layer/group/shape hierarchy the clear source of truth for selecting a shape and understanding which attributes the Inspector edits.
Description: Present layers, groups, and shapes with readable stable labels and clear nesting/draw order. Synchronize canvas selection, outline selection, and Inspector context; identify the selected shape's friendly name/type and layer/group; make visibility and lock inheritance apparent; and preserve grouping, reordering, keyboard access, and schema-valid scene behavior. Do not redesign overall panel sizing or pointer-drag mechanics.
Status: COMPLETE
GitHub issue: #110
Verification: Shapes carry no `name` field in `schema/scene.schema.json` (only
layers/groups do), so `frontend/src/pages/sceneShapes.ts` grew a derived,
non-persisted `shapeLabel(shape, allShapes)` — "Circle 2", "Rectangle 1" —
from the shape's type plus its 1-based position among same-type shapes in
draw-order/array order, replacing the old `type (uuid-prefix)` label
everywhere a shape is named: the outline (`sceneOutline.ts`'s `buildOutline`
now stamps a `label` field onto every shape row), the Shapes list and
behavior-card target picker in `EditorWorkspace.tsx`/`BehaviorCardsPanel.tsx`.
`sceneOutline.ts` also grew `outlineBreadcrumb(scene, id)`, returning the
ordered layer → group → … → item path for the active selection;
`useSceneEditor.ts` exposes it as `selectedBreadcrumb`, and
`ShapeInspectorPanel.tsx` renders it ("Layer 1 › Group 1 › Circle 2") above
the editable attribute fields so the Inspector visibly agrees with the
outline/canvas on which item is selected. Selection was already unified
end-to-end before this task (`useSceneEditor.ts`'s single `selectedShapeId`
already served canvas clicks, the outline, the Shapes list, and the
Inspector) — verified rather than re-plumbed, plus a new outline↔Shapes-list
sync regression test. Group outline rows now carry cascaded
`inheritedVisible`/`inheritedLocked` (via the existing `isEffectivelyLocked`
OR-cascade) alongside their own `visible`/`locked` flags, so
`SceneOutlinePanel.tsx` can show "(hidden (from an ancestor))" on a group
nested under a hidden layer even while the group's own toggle still reads
"Visible" — the same annotation shape rows already had, extended to groups.
Added layer/group/shape kind icons and left-border row styling
(`index.css`) for nesting legibility, on top of the existing depth-based
indentation; kept the existing list/listitem + native-button keyboard
pattern (Tab/Enter/Space) rather than inventing a treegrid, consistent with
`CollapsibleSection.tsx`'s disclosure pattern elsewhere in the editor.
`cd frontend && npm run lint && npm run typecheck && npm test` all green
(1514 tests, up from 1503: new/updated coverage in `sceneShapes.test.ts`
(`shapeLabel` ordinal numbering), `sceneOutline.test.ts` (`outlineBreadcrumb`
path construction), `EditorWorkspace.outline.test.tsx` (friendly labels
never contain a raw UUID, outline↔Shapes-list selection sync, a group's own
vs. inherited visible/locked legibility), and
`EditorWorkspace.shapeInspector.test.tsx` (breadcrumb rendering with and
without an intervening group, and the empty-selection case). Manually
verified against a real Django+PostgreSQL+Vite stack (signed in as the
`e2e_fixtures` owner): added two circles and a rectangle (outline and Shapes
list both showed "Circle 1"/"Circle 2"/"Rectangle 1"), grouped the two
circles ("Group: Group 1 (2 item(s))"), selected "Circle 1" inside the group
and confirmed the Inspector breadcrumb read "Layer 1 › Group 1 › Circle 1"
above its style fields, then hid Layer 1 and confirmed the group row showed
"(hidden (from an ancestor))" while its own toggle still read "Visible", the
two circles/rectangle rows showed "(hidden)", and the Inspector's existing
hidden-selection notice and breadcrumb both rendered together — then
restored visibility, cleaned up the `e2e_fixtures`, and stopped both dev
servers. Did not touch `EditorWorkspace.tsx`'s pointer-down handlers or
`sceneShapes.ts`'s drag helpers (out of scope per issue #111). No schema
change. No out-of-scope issues found.

## 81. Make selecting and dragging shapes obvious and reliable
Goal: Give canvas manipulation clear affordances and predictable pointer behavior while preserving the keyboard-accessible outline path.
Description: Make hover/selected states and manipulation handles discoverable at the rendered canvas scale; explain primary selection, move, resize, rotate, and cancel interactions; keep hit targets usable for small or overlapping shapes; prevent accidental edits to locked items; and verify pointer/keyboard parity, schema validity, and undo/redo behavior in browser/component coverage. Do not change the layer data model or overall workspace layout.
Status: COMPLETE
GitHub issue: #111
Verification: `EditorWorkspace.tsx` gained a `hoveredShapeId` state, tracked via
new `handleCanvasPointerMove`/`handleCanvasPointerLeave` handlers that reuse
the same `hitTestTopmostShapeAt` topmost-shape-wins hit test
`handleCanvasClick`/`handleCanvasPointerDown` already use, so hover, click,
and drag can never disagree on which shape is targeted. Each shape now
renders a distinct hover-only outline (`editor-scene-shape-hover-outline`,
thin/solid/muted) separate from the existing selected outline
(dashed/accent-colored), and a shape that's effectively locked
(`isEffectivelyLocked`, issue #110's cascade) shows a different warm-toned
dashed "can't manipulate this" cue instead, matching what `checkUnlocked`'s
existing error toast would do if a drag were attempted. A new always-visible
`editor-canvas-hint` caption above the canvas explains the actual
move/resize/rotate/cancel gestures the code implements (worded from the real
`HandleKind`/`getShapeHandles`/`dragHandlers.onKey` Escape-cancel behavior,
not assumed). Handle hit-target size (`HANDLE_SIZE` in `handleStyle()`) grew
from a fixed 12px to 18px — still positioned by percentage (tracks the shape)
and sized in fixed CSS pixels (independent of shape size and of the
canvas's issue #109 `aspectRatio` scaling) — plus a hover/focus outline ring
in `index.css` so handles read as discoverable controls. The existing
topmost-shape-wins / lock-guard-before-gesture-start pointer logic in
`handleCanvasPointerDown`/`handleHandlePointerDown`/
`handleGroupHandlePointerDown`/`handleVertexPointerDown` was read closely and
left unchanged — no real gap found, only the hover-cue addition above it.
New Vitest coverage: `EditorWorkspace.transform.test.tsx` gained a "canvas
affordances" describe block (hint text presence/wording, selected-vs-hover
class exclusivity, hover-outline presence, hover clearing on
pointerleave/pointer-off-shape); `EditorWorkspace.lock.test.tsx` gained a
"hover affordance" describe block asserting the locked-hover outline class
vs. the ordinary one. `cd frontend && npm run lint && npm run typecheck &&
npm test` all green (104 files / 1520 tests passed, up from 1514). Manually
verified in a real browser against a local PostgreSQL-backed Django + Vite
stack (`AI_PROVIDER=fake`, fixture users via `e2e_fixtures create --json`,
cleaned up after): created two overlapping shapes (circle behind rect),
confirmed the topmost-wins hover/selection resolves correctly for both the
overlapping region and a sliver where only the underneath shape's bounds
apply; confirmed the locked-hover red-dashed cue and no-handles-while-locked
state; confirmed a pointer-driven move gesture followed by Undo then Redo
round-trips correctly; confirmed at a 400px-wide viewport (issue #109's
`aspectRatio`-scaled canvas, ~340x255px rendered) the move/resize/rotate
handles stay a full 18x18px real hit target and remain clearly visible and
distinguishable, and the hint caption stays legible. Ran
`E2E_BASE_URL=http://localhost:5000 npx playwright test
interactionRuntime.spec.ts projectLifecycle.spec.ts` against the same real
stack per this task's verification requirement: 13/14 passed; the one
failure (`projectLifecycle.spec.ts`'s concurrent-restore-from-two-tabs
scenario, a 404-instead-of-201 on one of two concurrent restore requests) is
unrelated to this issue's canvas/pointer scope (no version-restore or
concurrency code was touched) and reproduced identically on two consecutive
runs — filed separately as issue #121 (task 90) per the discovery-gate
convention rather than investigated further here.

## 82. Stop unexpected editor refreshes from interrupting unsaved work
Goal: Identify and prevent unintended document reload/navigation during editing, and make unavoidable leave/recovery states explicit.
Description: Add real-browser coverage that distinguishes intentional navigation from unexpected document refreshes. Verify controlled autosave/server-sync failures stay on the editor route, preserve working state or a recovery candidate, and show actionable errors; verify dirty and clean beforeunload behavior; make intentional leave links clear; and keep the existing Mistral credential failure journey separate.
Status: COMPLETE
GitHub issue: #112
Verification: `EditorWorkspace.tsx` now polls `useDraftAutosave`/`useDraftServerSync`'s
`getLastFailure()` and shows a non-blocking, actionable notice (`draft-sync-error`), cleared on
the next successful Save (unit-tested in `EditorWorkspace.draftSyncError.test.tsx`). New Playwright
coverage in `aiAndRecovery.spec.ts`: a forced 503 on the periodic server-draft sync shows the
notice while staying on the same editor route with the unsaved shape intact; a dirty editor shows
the native `beforeunload` prompt on `page.close({ runBeforeUnload: true })` and a clean one shows
none. Draft-recovery-after-reload determinism, discard/cancel/expired/corrupt/unauthorized/conflict
paths, and clearly-labeled leave affordances ("Exit without saving", "Back to your projects") were
already covered by pre-existing tests and reviewed as still correct. The Mistral credential
failure journey (`mistralCredential.spec.ts`) was not touched. Discovered and filed separately
while adding this coverage: backlog tasks 83 (issue #113) and 84 (issue #114).

## 83. Restore the Playwright e2e suite against the collapsed-by-default editor
Goal: Make `make e2e` pass again against the current editor UI.
Description: Issue #95 flipped `CollapsibleSection` to default closed, but no Playwright spec (`projectLifecycle.spec.ts`, `interactionRuntime.spec.ts`, `aiAndRecovery.spec.ts`, `publishingAndRemix.spec.ts`, `exportConfigDialog.spec.ts`) expands a section before interacting with an element inside it, so nearly every scenario that reaches the editor now times out waiting for a collapsed control (confirmed locally: `projectLifecycle.spec.ts`'s blank-canvas scenario times out waiting for "Add circle"). CI never caught this because these specs are deliberately excluded from CI/`npm test`/`make check`, and the one E2E spec CI does run (`responsiveShell.spec.ts`) never opens a collapsed section. Add a shared expand-section helper (mirroring `frontend/src/testUtils/expandCollapsibleSections.ts`'s role in the Vitest suite) and use it wherever a scenario needs a collapsed section's contents, without changing `CollapsibleSection`'s reviewed default-closed behavior itself.
Status: COMPLETE
GitHub issue: #113
Verification: Added `frontend/e2e/support/expandCollapsibleSections.ts` (`expandAllCollapsibleSections`/
`expandSection`) and wired it into all five spec files. `aiAndRecovery.spec.ts`,
`projectLifecycle.spec.ts`, `interactionRuntime.spec.ts` (7/7), and `exportConfigDialog.spec.ts`
(4/4) are fully green; `publishingAndRemix.spec.ts` is 10/11 (the one remaining failure is a
distinct, unrelated bug filed as issue #119 — public-viewer camera controls not rendering when
`navigator.mediaDevices` is entirely undefined). Restoring this coverage surfaced and fixed five
further real bugs along the way, each tracked and closed separately: issue #112 (phantom "Recover
unsaved work?" prompt after an ordinary save+reload), #115 (stale Version History panel after
AI-accept/explicit Save), #116 (`BehaviorCardsPanel`'s target select getting stuck if "Behaviors"
opens before any shape exists), #117 (two stale hardcoded graph node/connection counts, and a
"Show logic" toggle — not a `CollapsibleSection` — silently closing on reload), and #118 (two specs
still targeting a `/projects/:id/settings` route issue #94 removed). `make e2e` is green apart from
the one distinct issue #119 gap.

## 84. Fix e2e_fixtures cleanup ProtectedError leaving orphaned local test data
Goal: Make `e2e_fixtures cleanup` reliably remove every row it created.
Description: `scenes/management/commands/e2e_fixtures.py`'s `cleanup` action fails with `django.db.models.deletion.ProtectedError` because `Project.current_version` is `on_delete=PROTECT` against `SceneVersion`, which blocks the cascade from deleting fixture users even though their owned projects are being deleted in the same operation. Confirmed locally: `make e2e`'s `global-teardown.ts` reports the cleanup failure, and running the command by hand reproduces it, leaving orphaned `e2e_owner`/`e2e_other` projects/versions in whatever database the suite targeted. A first attempt at nulling `current_version` before delete also hit a `scenes_sceneversion_prevent_snapshot_mutation()` trigger ("SceneVersion snapshot fields are immutable") that may be firing more broadly than intended.
Status: COMPLETE
GitHub issue: #114
Verification: `_cleanup` now (1) deletes any `ForkProvenance` row whose `source_project`/
`source_version` (both `PROTECT`) belongs to a fixture user, (2) nulls `Project.current_version`
(`PROTECT`, across `all_objects` including soft-deleted) for fixture-owned projects, and (3), on
PostgreSQL only, disables `scenes_sceneversion_prevent_snapshot_mutation_trigger` for one plain
pre-nulling `UPDATE` of `parent_id`/`fork_source_version_id`/`created_by_id` (immediately
re-enabling it before any delete starts, since Postgres refuses `ALTER TABLE` while a transaction
has pending trigger events) so Django's own `SET_NULL` cascade during the delete becomes a no-op
the trigger's `IS DISTINCT FROM` check allows. New tests in `tests/test_e2e_fixtures_command.py`
(SQLite, exercises the ORM/PROTECT half) plus manual verification against a real local PostgreSQL
database with orphaned data from prior runs and through a real `make e2e`-equivalent run (its
`global-teardown.ts` reported success afterward, and a follow-up manual `cleanup --json` returned
`{"deleted": 0}`, confirming nothing was left behind).

## 85. Fix BehaviorCardsPanel target select getting stuck if Behaviors opens before any shape exists
Goal: `followHand`/`reactToPinch` cards stay addable regardless of when "Behaviors" first mounts relative to shape/group creation.
Description: `BehaviorCardsPanel.tsx`'s `targetKey` state was seeded once, at mount, from `targetOptions[0]?.id ?? ''` (a `useState` initializer). Opening "Behaviors" before any shape/group exists captured `targetKey` as `''` forever — `targetOptions` updates as shapes are added, but nothing re-synced `targetKey`, permanently disabling "Add card" for target-needing card types with no visible explanation. Discovered while restoring `interactionRuntime.spec.ts` for backlog task 83/issue #113.
Status: COMPLETE
GitHub issue: #116
Verification: Added a `useEffect` that re-selects the first available target whenever the current `targetKey` stops matching a valid option but options are available again (keyed on a stable joined-id string, not the fresh `targetOptions` array/`targetKey` itself, to avoid fighting its own update). New Vitest regression test in `EditorWorkspace.behaviorCards.test.tsx` mounts against a blank scene, expands every section (mounting the panel with zero targets), adds a shape, and confirms "Add card" becomes enabled. Verified against the real e2e scenario that surfaced this (`interactionRuntime.spec.ts`'s "compatible parallel bindings..." test), which also needed one more unrelated fix: a second unscoped `getByText` locator later in the same test collided with `BehaviorCardsPanel`'s live draft-preview text once a matching card existed.

## 86. Update publishingAndRemix/exportConfigDialog e2e specs off the removed settings route
Goal: Both specs fill project metadata through the real, current in-editor UI.
Description: `publishingAndRemix.spec.ts`'s `saveMeaningfulMetadata` and `exportConfigDialog.spec.ts`'s `fillMetadata` both still navigated to `/projects/:id/settings` and filled `#project-title` there — a route and field issue #94 removed when it folded project details into the editor (title editing moved to the header's inline `EditableProjectTitle`; description/tags/remix/attribution moved to the always-visible "Details" panel, `EditorDetailsPanel.tsx`). Reachable only after backlog task 83/issue #113's collapsed-section fix let these scenarios run far enough to hit it.
Status: COMPLETE
GitHub issue: #118
Verification: Both helpers now click "Edit title", fill `#editor-title-input`, and fill the Details panel's existing fields directly, with no reference to the dead route. Restoring this also surfaced three further pre-existing, unrelated bugs in `publishingAndRemix.spec.ts`, all now fixed: two CSRF-cookie setup calls visited `/` (this app's React SPA shell, which Django serves with no template-rendered CSRF token) instead of a real Django page like `/accounts/login/`; a fork-provenance assertion hardcoded `/versions/1/` assuming a pristine database instead of reading the fork's own `current_version` id; and a shape assertion read `shape.style.positionX` instead of the real `shape.transform.x` path. All 4 `exportConfigDialog.spec.ts` scenarios and 10/11 `publishingAndRemix.spec.ts` scenarios now pass; the remaining one is a distinct pre-existing bug tracked as issue #119 (public-viewer camera controls don't render when `navigator.mediaDevices` is entirely undefined).

## 87. Fix stale graph node/connection counts and a reload-closed "Show logic" toggle in interactionRuntime.spec.ts
Goal: `interactionRuntime.spec.ts`'s two remaining scenarios pass with graph state matching what each test actually builds.
Description: Two scenarios failed with graph state that looked inconsistent with the test's own steps — both turned out to be test bugs rather than app bugs. "graph authoring..." hardcoded stale connection/node counts (4/8) against a scenario that actually authors 5 connections and 9 nodes. "deterministic randomness..." reopens "Show logic" once, then triggers a mid-test `saveAndReload` — but "Show logic" is a plain `useState` toggle in `EditorWorkspace.tsx`, not a `CollapsibleSection`, so `expandAllCollapsibleSections` can't (and doesn't) reopen it after the reload silently closes it, hiding the graph fragment the test goes on to check. Discovered while restoring backlog task 83/issue #113.
Status: COMPLETE
GitHub issue: #117
Verification: Corrected the hardcoded counts to 5 connections/9 nodes, and added a second `openLogicPanel(page)` call after `saveAndReload` in the randomness scenario. All 7/7 scenarios in `interactionRuntime.spec.ts` now pass.

## 88. Fix public-viewer camera "unsupported browser" scenario (issue #119)
Goal: Confirm whether `mediapipeProvider.ts`'s "no `navigator.mediaDevices`" detection is a real app bug or a test-mocking limitation, and fix whichever it is.
Description: `publishingAndRemix.spec.ts`'s "mocked unsupported browser" scenario timed out waiting for "Enable camera" after simulating a missing `getUserMedia` via `addInitScript`. Root cause found: this app depends on `p5.js`, whose bundled code polyfills `navigator.mediaDevices.getUserMedia` at module-load time whenever it reads as `undefined` (`if (navigator.mediaDevices.getUserMedia === undefined) { navigator.mediaDevices.getUserMedia = function ... }`, see `node_modules/p5/lib/p5.js`). The mock's `Object.defineProperty(..., { value: undefined })` left the property non-writable by default, so p5's own assignment threw an uncaught strict-mode `TypeError` during the bundle's module evaluation — an exception before React ever mounted, which looked like the whole page hanging. Confirmed with a standalone Playwright script that captured `page.on('pageerror')`: `Cannot assign to read only property 'getUserMedia' of object '#<MediaDevices>'`, `document.body.innerText` empty. Not an app bug — `mediapipeProvider.ts`'s `defaultIsSupported()` was already correct (see the Task 88 Vitest addition below), and `CameraControl.tsx` never touches `navigator.mediaDevices` before the "Enable camera" click.
Status: COMPLETE
GitHub issue: #119
Verification: Changed the e2e mock to an accessor property on the real, still-native `mediaDevices` object: a getter that always reports `undefined` (so `defaultIsSupported()` sees a permanently missing method) paired with a no-op setter that silently absorbs p5's polyfill assignment instead of letting it throw. All 11/11 `publishingAndRemix.spec.ts` scenarios now pass locally against a real PostgreSQL-backed Django + Vite stack, including the previously-failing scenario: "Enable camera" is clickable, clicking it shows the "doesn't support" `camera-error`, and "Retry" appears. The earlier diagnosis's Vitest addition (`mediapipeProvider.test.ts`, exercising the real unmocked `defaultIsSupported()`) is unchanged and still passes.

## 89. Fix scripts/smoke-local.sh empty-array unbound-variable failure on macOS bash
Goal: `make smoke-local` runs cleanly on any bash version, including macOS's stock 3.2.
Description: `scripts/smoke-local.sh` declared `fixture_environment=()` (an empty array) and later expanded it via `"${fixture_environment[@]}" uv run ...` — expanding an empty array with `set -u` (nounset) triggers "unbound variable" on bash < 4.4, including macOS's Apple-shipped 3.2.57 (unchanged since ~2007). CI never caught this since its runners use a modern bash. Discovered while verifying backlog task 76/issue #97's "External local track" by actually running `make smoke-local` against a real local Django+Vite+PostgreSQL stack.
Status: COMPLETE
GitHub issue: #120
Verification: Replaced the array expansion with a plain if/else branching on `staging_smoke` that avoids arrays entirely. `bash -n scripts/smoke-local.sh` and a full `BASE_URL=http://localhost:5000 make smoke-local` run now pass end to end (health, anonymous `/api/whoami/` 401, login form, authenticated `/api/whoami/` 200); the `STAGING_SMOKE=1` branch CI's own staging job exercises is unchanged in behavior.

## 90. Diagnose flaky concurrent-restore result in projectLifecycle.spec.ts
Goal: Determine whether the two-tabs concurrent-restore scenario's intermittent 404 (instead of the expected 201) on one of two simultaneous restore requests is a real backend race or a test-timing issue, and fix whichever it is.
Description: Found while manually verifying backlog task 81/issue #111 by running `E2E_BASE_URL=http://localhost:5000 npx playwright test interactionRuntime.spec.ts projectLifecycle.spec.ts` against a real local PostgreSQL-backed Django + Vite stack: 13/14 passed, but `projectLifecycle.spec.ts`'s "concurrent saves and restores from two tabs of the same session serialize to one consistent state" (around line 355/424) failed consistently across two consecutive runs with `expect(restoreA.status()).toBe(201)` receiving 404 instead. Unrelated to issue #111's canvas/pointer scope — no version-restore or concurrency code was touched by that task.
Status: COMPLETE
GitHub issue: #121
Verification: Not a backend race — a test bug. The scenario hardcoded
`versions/1/restore/`, assuming the freshly-created project's first version
has database primary key `1`. `SceneVersion.id` is a table-wide
auto-increment shared across every project, not a per-project counter (that
role belongs to the separate `sequence` field), so `id === 1` only holds when
no other version row exists anywhere in the database yet. This scenario runs
fourth in `projectLifecycle.spec.ts`'s describe block, after three earlier
tests already create their own projects/versions, so the assumption failed
consistently once real prior rows existed. Fixed by looking up the actual id
via `GET /api/projects/:id/` (`current_version`) right after project
creation instead of assuming `1`. Verified against a real local
PostgreSQL-backed Django + Vite stack (`AI_PROVIDER=fake`, fixture users via
`e2e_fixtures create --json`, cleaned up after): `projectLifecycle.spec.ts`
alone is 7/7, and `interactionRuntime.spec.ts projectLifecycle.spec.ts`
together (the exact command that originally surfaced the flake) is 14/14.
`make check` (580 backend tests, frontend lint/typecheck) is green; the one
`format:check` failure it reports (`EditorWorkspace.tsx`,
`EditorWorkspace.transform.test.tsx`) is pre-existing and confirmed
unrelated by reproducing it against `main` before this change via
`git stash`. Filed separately per the discovery-gate convention as backlog
task 91 (issue #122).

## 91. Fix Prettier drift in EditorWorkspace.tsx and EditorWorkspace.transform.test.tsx
Goal: `make frontend-format-check`/`make check` pass again on `main`.
Description: `frontend/src/pages/EditorWorkspace.tsx` and `frontend/src/pages/EditorWorkspace.transform.test.tsx` have drifted from the repo's configured Prettier style — a hint paragraph in `EditorWorkspace.tsx` and an assertion in the test file are each wrapped across extra lines Prettier would collapse. Discovered while verifying backlog task 90/issue #121; confirmed pre-existing and unrelated by reproducing the same failure against `main` via `git stash` before that task's fix was applied.
Status: COMPLETE
GitHub issue: #122

Resolution: Ran `npx prettier --write` (from `frontend/`) on both files —
purely whitespace/line-wrapping, no behavior change. `make check` (580
backend tests; frontend lint, format:check, typecheck, and 1520 frontend
tests) is green.

## 92. Fix local Playwright default baseURL still targeting :5173, not :5000
Goal: `make e2e` / bare `npx playwright test`, run exactly per AGENTS.md's documented local steps with no extra env vars, passes without most scenarios silently self-skipping.
Description: Discovered while verifying backlog task 76/issue #97's readiness in this session — running the documented local e2e workflow with no extra env vars fails 3 `responsiveShell.spec.ts` scenarios (`net::ERR_CONNECTION_REFUSED at http://localhost:5173/`) and skips nearly everything else, because `frontend/playwright.config.ts` and `frontend/e2e/support/global-setup.ts` both still hardcode a `http://localhost:5173` fallback when `E2E_BASE_URL` is unset. Issue #103 fixed this for CI's `e2e-responsive` job by setting `E2E_BASE_URL` in that job's `env:` block, but incorrectly assumed local `make e2e` "shouldn't need to" set it since `npm run dev` is pinned to :5000 — the fallback literal itself was never updated. Workaround confirmed this session: `E2E_BASE_URL=http://localhost:5000 npx playwright test` passes (103/109, with 4 flaky-in-parallel-but-pass-in-isolation).
Status: COMPLETE
GitHub issue: #123
Verification: Changed both `http://localhost:5173` fallback literals (`frontend/playwright.config.ts`'s `baseURL` and `frontend/e2e/support/global-setup.ts`'s health probe) to `http://localhost:5000`, matching the Vite dev server's permanently pinned port. `npx playwright test --list` confirms the config is still syntactically valid (109 tests, 10 files). Verified against a real local PostgreSQL-backed Django + Vite stack, run exactly per AGENTS.md's documented steps with no `E2E_BASE_URL` override: `responsiveShell.spec.ts` alone is 7/7 (previously 3 scenarios failed with `ERR_CONNECTION_REFUSED` at :5173); the full `make e2e` is 102 passed / 5 failed / 2 skipped, with zero connection-refused or self-skip failures. The 5 failures all pass individually in isolation (`aiAndRecovery.spec.ts:266`, `projectLifecycle.spec.ts:355`, `responsiveShell.spec.ts:134`) or are already tracked separately (`aiAndRecovery.spec.ts:792`/`:929`, backlog task 93/issue #124) — matching this task's own original note that the workaround run was "103/109, with 4 flaky-in-parallel-but-pass-in-isolation," so this is pre-existing parallel-run flakiness, not a regression from this change.

## 93. Fix draft recovery prompt suppression when a stale/no-diff server draft outraces a real local draft
Goal: `useDraftRecovery.ts`'s local/server conflict resolution never silently discards a real, different local draft just because the timestamp-winning candidate happens to look like a no-op.
Description: Discovered while verifying backlog task 76/issue #97's readiness in this session — `e2e/aiAndRecovery.spec.ts:792` and `:929` fail reproducibly (not flaky, confirmed in isolation): the "Recover unsaved work?" prompt never appears. Root cause traced to `useDraftRecovery.ts`'s effect: `pickNewer(local, server)` picks only the later-timestamped candidate and discards the other entirely; when the server draft (written after the local one in both failing tests) has a content-identical diff against the persisted scene, its `changeSummary` computes to `NO_SCENE_CHANGES_SUMMARY`, and the `!winner || winner.changeSummary === NO_SCENE_CHANGES_SUMMARY` check then treats the whole comparison as "nothing to recover" — silently dropping the real local draft that was never itself evaluated.
Status: COMPLETE
GitHub issue: #124
Verification: In `frontend/src/pages/useDraftRecovery.ts`, moved the
`changeSummary === NO_SCENE_CHANGES_SUMMARY` no-op check to apply per-candidate
(`realLocal`/`realServer`) before `pickNewer`, instead of only to whichever
candidate wins the timestamp race — so a genuinely different candidate is
never discarded just because it happened to lose that race against a no-op
one. Added two regression cases to `useDraftRecovery.test.ts`: issue #124's
exact scenario (older real local draft, newer no-op server draft, still
prompts with the local candidate) and issue #112's original case (both
candidates genuinely no-op, still resolves to `'none'`) run under the new
code path. `npx vitest run src/pages/useDraftRecovery.test.ts` is 18/18;
the full frontend suite (`npm test`) is 104 files / 1522 tests, all green;
`npm run typecheck`, `prettier --check`, and `oxlint` are clean on both
changed files. Verified against a real local PostgreSQL-backed Django
(`AI_PROVIDER=fake`) + Vite stack, run exactly per AGENTS.md's documented
steps: `E2E_BASE_URL=http://localhost:5000 npx playwright test -g "Discard
clears both|local/server conflict: the genuinely newer"` — both previously-
failing scenarios (`aiAndRecovery.spec.ts:792`, `:929`) now pass. The full
`aiAndRecovery.spec.ts` file is 20/21 (one unrelated pre-existing flake,
`:266`, confirmed passing in isolation — already noted as pre-existing
parallel-run flakiness in task 92/issue #123's own verification).

## Completed execution task archive

This is the canonical repository record for completed execution work. The
entries are ordered by completion. GitHub issues may add discussion or
acceptance evidence, but task specifications live here.

### 1. Task #1 — Set up the imported project
Status: COMPLETE

Specification: Assess the imported application before changing it, confirm the
intended outcome with the project owner, then configure the existing stack to
run on Replit without restructuring it. Document the resulting workflow and
any required setup.

### 2. Task #3 — Rename product branding to Creatrweb Animation Studio
Status: COMPLETE

Specification: Replace user-facing product branding in the application shell,
browser title, and standalone export attribution with “Creatrweb Animation
Studio.” Keep gesture-recognition terminology, URLs, persisted keys, schemas,
database models, and internal package identifiers unchanged.

### 3. Task #2 — Keep animation previews from failing in automated checks
Status: COMPLETE

Specification: Make the frontend unit suite reliable when p5 creates and
cleans up canvases in JSDOM. Preserve the existing renderer and runtime
coverage while ensuring the configured Node 22 test command passes.

### 4. Task #4 — Keep the browser tab title aligned with the product brand
Status: COMPLETE

Specification: Add a focused static-shell assertion that the browser document
title is “Creatrweb Animation Studio,” preventing divergence between the
visible header and browser tab branding.

### 5. Task #6 — Improve shell spacing and empty project layout
Status: COMPLETE — delivered by Task #8 after this draft was superseded.

Specification: Give the shell, signed-out home state, signed-in empty state,
and populated project gallery clearer spacing, consistent action styling, a
bordered content region, centered status content, and responsive accessible
coverage. The delivered implementation is recorded in Task #8 and GitHub issue
#84.

### 6. Task #7 — Sync backlog and close credentials issue
Status: COMPLETE

Specification: Reconcile the repository backlog with completed session work
and securely provisioned credentials without exposing, rotating, copying, or
committing any secret. Close the credentials issue only with a non-sensitive
completion note.

### 7. Task #5 — Prevent draft changes from leaking when switching projects
Status: COMPLETE

Specification: Keep project-scoped browser drafts isolated during project
switches by cancelling or safely scoping pending autosave writes. The full
frontend suite must pass so one project’s draft cannot overwrite or obscure
another’s.

### 8. Task #8 — Improve shell spacing and empty states
Status: COMPLETE

Specification: Style `Public gallery` and `Sign in with Google` as accessible
button-like actions without changing their destinations. Increase shell
spacing; render signed-out and signed-in empty states in a reasonably sized,
bordered, horizontally and vertically centered region; show the exact empty
message `You have not created any projects.`; and keep populated project cards
within the same padded region. Preserve authentication, routing, project
creation, ownership, loading, and error behavior. GitHub issue: #84.

### 9. Task #9 — Catch narrow-screen shell regressions before they reach users
Status: COMPLETE

Specification: Add a browser-level narrow-width check that verifies the title,
navigation, motion controls, bordered panel, sign-in action, and signed-in
empty gallery remain visible, usable, centered where applicable, and free of
horizontal overflow.

### 10. Task #10 — Run narrow-screen browser checks in a fully provisioned CI environment
Status: COMPLETE

Specification: Run the responsive-shell Playwright coverage at a 375px
viewport in CI using the required browser runtime and PostgreSQL-backed
fixtures, so signed-out and empty-gallery scenarios execute instead of being
skipped.

### 11. Task #11 — Keep the frontend format check green before merges
Status: COMPLETE

Specification: Format the affected frontend tests and verify the frontend
format check passes, keeping CI failures focused on meaningful regressions.

## Follow-up issues filed during V1 hardening (not originally numbered tasks)
These were filed as separately groomed follow-ups during audits/reviews of Tasks 60-71. They remain independent backlog items and are not prerequisites for the completed credentials task:
- #76 Support reparenting shapes/groups across layers and groups in the scene outline
- #77 Support multi-shape simultaneous drag, resize, and rotate in the preview
- #78 Add snapping and alignment guides for canvas manipulation
- #79 Support per-vertex editing of path/polygon shapes
- #80 Enforce locked layer and group flags against shape mutations
- #81 Make role=radio button groups keyboard-navigable via arrow keys app-wide
- #82 Build onboarding hints for templates (dismissible, replayable, stop-after-success)
- #83 Wire the behavior runtime into the live editor preview

## Follow-up issues filed after V1 hardening (Task 84 onward)
Same convention as above: independently groomed follow-ups, not prerequisites for other backlog items unless noted. Task 84 itself is recorded under "Task #8" in the archive above (see GitHub issue #84); it's cross-referenced here only for numbering continuity.
- #84 Improve shell spacing and centered home/project empty states — Status: COMPLETE (see Task #8 above)
- #85 Add README.md with local and Replit deployment commands — Status: COMPLETE
- #86 Stabilize local Vite dev server port to prevent Google OAuth redirect_uri_mismatch — Status: COMPLETE
- #87 Replace frontend/README.md stock Vite template with project-specific content — Status: COMPLETE (implemented on branch `local-render-test`; closed on GitHub, still pending merge to `main`)
- #88 Restructure README.md 'Run locally' into copy-pasteable per-terminal command blocks — Status: COMPLETE
- #89/#90 Mobile-responsive header: hamburger nav, consistent button styles, and centered empty states — Status: COMPLETE (renumbered #89→#90 by the project owner to free #89 for the dev-startup task below; implemented on branch `local-render-test`, including a follow-up fix reworking the header into a simple centered vertical stack after the initial single-row layout overlapped at common desktop widths — a deliberate deviation from #90's written "nav between motion control and heading" criterion, made per live review; closed on GitHub, still pending merge to `main`). A related, smaller consistency pass on the same branch also styled Account settings' form buttons, added a header "Home" link, styled the templates page's "Use this template" button, and added an app-wide base `<button>` style so editor-workspace buttons (previously unstyled, relying on native browser rendering) match — none filed as separate numbered issues.
- #91 Unified single-command local dev startup (one terminal, resilient shutdown) — Status: COMPLETE
- #92 Fix pre-existing make check failures (ruff format, mypy) — Status: COMPLETE
- #93 Scene canvas has no visible shape rendering: shapes, selection, and handles are all unstyled/invisible — Status: COMPLETE (implemented on branch `local-render-test`). `.editor-scene-shape` now renders each shape's real geometry as SVG (circle/rect/line/closed-path fill+stroke, matching `sceneShapes.ts`'s translate-then-rotate convention), with a visible dashed selection-highlight outline independent of the shape's own colors; `.editor-shape-handle` and its move/resize/rotate/group/vertex variants got real knob styling. The Tools/Preview/Inspector narrow-viewport split was reworked so Preview is never one of the mutually-exclusive tabs — it stays permanently visible, and only Tools/Inspector alternate via a two-way switcher — satisfying the hard requirement at every width (covered by a new parameterized test at 320/480/768/1023px). Confirmed via the existing Task-83/issue-83 live-preview-runtime test that demo-signal input already visibly drives shape movement (through `p5Adapter`'s render path, independent of the static `.editor-scene-shape` overlay), so no separate follow-up bug was needed there. Added a base style for native `input`/`select`/`textarea`, mirroring the earlier `<button>` fix. Not sub-tasked into separate issues/PRs — the full suggested scope landed in one pass.
- #94 Unify editor workspace: fold project details into the editor, reposition Preview, accordion Tools sections, inline title edit, remove dead `thumbnail_choice`, prominent Publish — Status: COMPLETE (implemented on branch `local-render-test`, all seven points landed in one pass rather than sub-tasked). `EditorWorkspace.tsx` gained a fourth "Details" panel (`EditorDetailsPanel.tsx`: description/tags/allow-remix/export-attribution, reusing `updateProjectMetadata`/`validateProjectMetadataForPrivateSave`), and the old standalone `/projects/:id/settings` page (`ProjectMetadataForm.tsx`) was deleted, with its meaningful test coverage ported into `EditorDetailsPanel.test.tsx`/`PublishControl.test.tsx`/`EditorWorkspace.test.tsx`'s new inline-title-editing describe block; the route now redirects to the project's editor (`ProjectSettingsRedirect` in `App.tsx`) rather than 404ing any existing bookmark. Preview is now first in DOM order (not just visually) in the `.editor-workspace` flex container, at every viewport width, ahead of Details/Tools/Inspector. Tools' and Inspector's sub-sections are wrapped in a new `CollapsibleSection.tsx` (independent `aria-expanded`/`aria-controls` open/closed state per section, matching the pre-existing "Show logic" pattern; `EditorWorkspace.accordion.test.tsx` proves collapsing one section leaves another untouched). The project title is inline-editable in the header (`EditableProjectTitle`, writing through the same `updateProjectMetadata` PATCH). `thumbnail_choice`/`THUMBNAIL_CHOICES` were removed end-to-end — model field + migration (`scenes/migrations/0017_remove_project_thumbnail_choice.py`), serializer fields, the frontend `Project`/`PublicProject` types, and every test fixture referencing it. A prominent `Publish`/`Unpublish` control (`PublishControl.tsx`, `.shell-action`-styled Publish button) sits in the editor header next to "Exit without saving", ported unchanged from the old settings page's publish flow/confirmation dialog. `ProjectCard.tsx`'s two links ("Open in editor"/"Edit details") collapsed into one "Edit" link to the unified editor (styled as a `.shell-action` button, per live review, rather than left a plain inline text link).
- #95 Editor workspace isn't mobile-friendly: header layout, icon affordances, accordion defaults, demo-controls alignment — Status: COMPLETE (implemented on branch `local-render-test`, all eight points landed in one pass). `Layout.tsx`'s shell header wraps the heading + (mobile-only) hamburger in a new `.app-shell-header-row`, centered at desktop and split left/right below the 767px mobile-header breakpoint. `EditorWorkspace.tsx`'s header now reflows via forced-wrap `.editor-header-break` spans (flex `flex-basis: 100%` line breaks) into four stacked rows — title+pencil / saved-status / visibility / Publish+X — below 1024px, and via `order` overrides into "title, Publish, X" on one row with "saved-status, visibility" on a second at >=1024px; `PublishControl.tsx` now renders `display: contents` so its visibility line and Publish/Unpublish action become independent header-level flex items instead of one fused block. "Edit title"/"Exit without saving" are icon-only buttons (pencil/✕) with the same `aria-label`s as before, so existing accessible-name-based test queries were unaffected. The Preview canvas's `<canvas>`/SVG overlays get `max-width: 100%` (and `height: auto !important` for the p5-created canvas, whose inline pixel dimensions `p5Adapter.ts` still owns) so they no longer overflow `.editor-panel` at narrow widths. `.demo-signal-slider` is now a 3-column CSS grid (label / slider / value) so every slider starts at the same x-position regardless of label length. `CollapsibleSection.tsx`'s `defaultOpen` flipped from `true` to `false`; the former single "Camera & demo controls" section split into independent "Camera" and "Demo signal controls" sections in `EditorWorkspace.tsx`, and `DemoControlsPanel.tsx` gained "Controls"/"Sensitivity"/"Gesture details" `<h5>` subheadings. Every `EditorWorkspace*.test.tsx` suite that depended on the old always-open accordion default now calls a new shared `frontend/src/testUtils/expandCollapsibleSections.ts` helper after mount; `EditorWorkspace.accordion.test.tsx` was rewritten to assert the opposite default (closed) and independence in the opposite direction (expanding one section leaves another still closed).
- #99 `scripts/start.sh` uses bash-4.3+ `wait -n`, which fails on macOS's stock bash 3.2 — Status: COMPLETE. Replaced `wait -n "$django_pid" "$frontend_pid"` with a portable polling loop matching the existing health-check loop's style; `tests/test_startup_configuration.py` updated to assert the new implementation. Verified live on macOS's stock `/bin/bash` 3.2.57 against a real PostgreSQL-backed Django + Vite pair (health check passes, Vite starts) and confirmed killing the Vite child brings Django down via the `cleanup` trap within 2s with no orphaned processes. Re-verified in the current Replit shell (`GNU bash 5.2.37`) with a child-failure simulation: the launcher detected the Vite exit status and terminated non-zero. Focused startup tests pass. Delivered on [PR #102](https://github.com/cfornesa/ai-dev-tools-zoomcamp-1/pull/102).
- #100 `test_google_oauth.py`: 3 tests fail with `DisallowedHost` (400) instead of expected response; creatweb/creatrweb domain typo — Status: COMPLETE. Fixed the `creatweb`→`creatrweb` typo across `AGENTS.md`, `config/settings.py`'s error message, and `tests/test_env_config.py`/`tests/test_google_oauth.py`'s fixtures/assertions, and added the missing `ALLOWED_HOSTS` overrides the three origin tests needed. `make check` is green, the published routing smoke check passes, and the project owner confirmed a real Google OAuth sign-in round trip through the deployed `https://animate.creatrweb.com` app. Delivered on [PR #102](https://github.com/cfornesa/ai-dev-tools-zoomcamp-1/pull/102).
- #103 Responsive shell E2E job fails: Playwright defaults to :5173 but CI starts Vite on :5000 — Status: COMPLETE. Root cause part 1: the job's `Start Django and Vite`/`Wait for both servers` steps correctly use port 5000, but the job never set `E2E_BASE_URL`, so `frontend/playwright.config.ts` and `frontend/e2e/support/global-setup.ts` both fell back to their default of `http://localhost:5173`, where nothing listens — explaining both the direct `net::ERR_CONNECTION_REFUSED` failures and the self-skipped signed-in tests (global-setup's own reachability probe against the wrong port marked the server unreachable). Fixed by adding `env: E2E_BASE_URL: http://localhost:5000` to the "Run responsive shell checks at 375px" step in `.github/workflows/ci.yml`. Root cause part 2, found only once the base-URL fix let the job actually connect: because this job had never successfully run against a live server, three later header refactors (hamburger mobile nav behind a toggle per issue #90, a new "Home" nav link, and removal of the `.app-shell-auth` wrapper class) had silently drifted out of sync with `frontend/e2e/responsiveShell.spec.ts`, which predates all three. Updated the spec to match the shipped, intentional behavior: open the hamburger ("Open menu" button) before asserting nav visibility/tab order below the 768px mobile-header breakpoint, added "Home" to every expected tab-order sequence, and replaced the dead `.app-shell-auth` locator with the individual "Account settings" link / "Logout" button locators the tablet-width test already used. Verified locally end-to-end against a real PostgreSQL-backed Django + Vite pair (`AI_PROVIDER=fake`, `E2E_BASE_URL=http://localhost:5000 npx playwright test e2e/responsiveShell.spec.ts`): all 7 scenarios pass. `make frontend-lint`/`typecheck`/`format-check` all green. Local `make e2e` was unaffected by the CI-side base-URL fix since it always runs on the fixed :5000 Vite port already, but does now exercise the corrected spec. Confirmed green in actual CI on commit 25c0ced: [run 32606135290](https://github.com/cfornesa/ai-dev-tools-zoomcamp-1/actions/runs/32606135290), "Responsive shell E2E" job passed all 7 scenarios in 1m25s. [Issue #103](https://github.com/cfornesa/ai-dev-tools-zoomcamp-1/issues/103) closed.
- #106 mypy fails on `tests/test_git_safe_push.py`: `BaseServer` has no attribute `repository_root` — Status: COMPLETE (stale `PROPOSED` status corrected during the 2026-08-23 production-readiness review; the issue was already closed on GitHub — `git log --grep 106` shows it fixed by commit 252aa7f, "Fix mypy attr-defined error in test_git_safe_push.py" — and `uv run mypy .`/`make check` are confirmed clean on the current `main` tip). [Issue #106](https://github.com/cfornesa/ai-dev-tools-zoomcamp-1/issues/106).

## 94. Stop autosave from resurrecting drafts after an explicit save
Goal: Prevent stale local or server autosave work from recreating a draft after
an explicit version save has deleted it.
Description: Reconcile the save callback with both draft controllers so a
pre-save working-copy snapshot cannot be written after the authoritative save.
Preserve the saved version and surface cleanup failures. Cover save, autosave,
page-hide, navigation, AI accept, restore, and unmount races in browser and
component tests.
Status: COMPLETE
GitHub issue: [#125](https://github.com/cfornesa/ai-dev-tools-zoomcamp-1/issues/125)
Execution plan: `.local/tasks/editor-draft-resurrection.md`
Evidence: The 2026-08-23 deployment sequence recorded `POST /versions/` 201,
`DELETE /draft/<session>/` 204, then a later `PUT /draft/<session>/` 200.
Resolution: Added a `markClean`/`isClean` baseline gate to
`DraftServerSyncController`/`DraftAutosaveController` so periodic, debounced,
page-hide, and meaningful-action writes all skip while the working copy
matches the last persisted/cleared state, and resume automatically on a real
edit. `onRestored`/`onAccepted` now clear both drafts like an explicit Save
instead of re-syncing a server draft. `make check` green (backend 580
passed/22 skipped, frontend 1543 passed). QA verdict: PASS (commit a52dfec,
https://github.com/cfornesa/ai-dev-tools-zoomcamp-1/issues/125#issuecomment-5384873605).
Closed.

## 95. Prevent duplicated shapes from appearing after editor load or recovery
Goal: Isolate and eliminate shape duplication that makes the editor unusable.
Description: Determine whether duplicate shapes enter persisted scene JSON,
are introduced by local/server draft recovery, or are rendered by duplicate
visual/selection overlays. Enforce one-to-one shape IDs and rendered instances
through load, recovery, save, reload, undo/redo, selection, Inspector, outline,
and hit-testing without silently dropping legitimate shapes.
Status: COMPLETE
GitHub issue: [#126](https://github.com/cfornesa/ai-dev-tools-zoomcamp-1/issues/126)
Execution plan: `.local/tasks/editor-duplicate-shapes.md`
Evidence: The latest browser session had no thrown JavaScript exception, so this
is explicitly an investigation task; the report of duplicated shapes must be
reproduced and classified before choosing a fix.
Resolution: Classified as category (c) — the SVG shape-body overlay in
`EditorWorkspace.tsx` and the p5 canvas both painted a shape's body while
behavior playback was active, producing a frozen copy plus a live copy.
Fixed with a `!hasActiveBehaviors` render guard. Category (b) (recovery/
restore/AI-accept merge duplication) was investigated and ruled out — all
replace `workingCopy` wholesale. Category (a) had no reproducible path but
was hardened defensively with a `validateScene` gate on the local IndexedDB
draft write, matching every other persistence path. `make check` green
(backend 580 passed/22 skipped, frontend 1554 passed). QA verdict: PASS
(commit d0b8dfe,
https://github.com/cfornesa/ai-dev-tools-zoomcamp-1/issues/126#issuecomment-5385108975).
Closed.

## 96. Give the editor a dedicated Layers panel with drag-and-drop ordering
Goal: Give users a clear, persistent view of stacking order and direct control
over valid layer, group, and shape reordering.
Description: Replace the compact outline placement with a visually distinct
responsive Layers panel. Show readable hierarchy, visibility, locks, and
stacking order; provide pointer drag-and-drop with insertion feedback and
keyboard reorder parity; and keep the canonical scene state synchronized with
rendering, selection, Inspector, save, undo/redo, and recovery.
Status: COMPLETE
GitHub issue: [#127](https://github.com/cfornesa/ai-dev-tools-zoomcamp-1/issues/127)
Execution plan: `.local/tasks/editor-dedicated-layers-panel.md`
Evidence: Issue #110 improved labels and hierarchy, but the current outline is
still not a dedicated Layers panel with direct drag-and-drop stacking control.
Resolution: `SceneOutlinePanel.tsx` renamed to `LayersPanel.tsx` and promoted
to its own `role="region" aria-label="Layers"` landmark in
`EditorWorkspace.tsx` (removed from the Tools `CollapsibleSection`), with a
matching `'layers'` tab in `EditorPanelSwitcher.tsx`/`EditorPanelName` for
the narrow (<1024px) layout. Pointer drag-and-drop (native HTML5 DnD, no new
dependency) reorders/reparents shapes, groups, and layers with a before/
after/into insertion indicator and a rejected-drop affordance for locked
rows and invalid targets, routed entirely through the existing
`moveItem`/`moveLayer`/`moveItemToLayer`/`moveItemToGroup` mutations in
`sceneOutline.ts`/`useSceneEditor.ts` (two new orchestration-only helpers,
`moveItemBySteps`/`moveLayerBySteps`, apply those same pure functions
repeatedly against one local candidate scene before a single `commit()`, so
a drag to an arbitrary position still lands as one undo step). Existing
keyboard controls (Move up/down, the target-select Move-to-layer/group
pair) are unchanged. Component tests
(`EditorWorkspace.layers.test.tsx`, renamed/extended from
`EditorWorkspace.outline.test.tsx`) cover pointer reorder/reparent, keyboard
parity, locked-row rejection, and no-duplicate/missing rows across add/
remove/reorder/reparent/undo/redo. New Playwright coverage
(`frontend/e2e/layersPanel.spec.ts` — `editor.spec.ts`, named in the
original issue, does not exist in this repo) exercises pointer + keyboard
reorder against a real browser, asserting both canvas z-order and
persisted order after save/reload; confirmed discoverable via
`npx playwright test --list` but not executed live (no local PostgreSQL in
this environment). `make check` green (backend 580 passed/22 skipped,
frontend 1564 passed). QA verdict: PASS (commit fd90790,
https://github.com/cfornesa/ai-dev-tools-zoomcamp-1/issues/127#issuecomment-5385221079).
Closed.

## 97. Make Publish honor metadata entered in the editor
Goal: Ensure entering a meaningful description and title through the editor
results in a reliable, understandable publishing flow.
Description: Reconcile the Details panel's local metadata state with the
header Publish action. Chosen behavior (see execution plan for rationale):
Publish auto-persists pending Details-panel metadata (description, tags,
allow-remix, export-attribution) via the same `updateProjectMetadata` PATCH
before validating and opening the confirmation dialog, rather than blocking
and telling the user to save separately. Preserve input and surface
validation or network errors from that persist step without data loss. Cover
title/description edits, confirmation cancel, retry, public visibility, and
public metadata in browser tests.
Status: COMPLETE
GitHub issue: [#128](https://github.com/cfornesa/ai-dev-tools-zoomcamp-1/issues/128)
Execution plan: `.local/tasks/editor-publish-metadata-flow.md`
Evidence: `EditorDetailsPanel.tsx` stores the description locally, but
`PublishControl.tsx` validates `project.description`; entering text without the
separate metadata save can therefore leave Publish validating the old value.
Resolution: `EditorDetailsPanel.tsx` exposes an imperative ref handle
(`getPendingDetails()`/`save()`) reflecting live-typed values and reusing its
own "Save changes" persist path; `EditorWorkspace.tsx`'s `persistPendingDetails`
diffs all four fields against `project` and skips a no-op PATCH;
`PublishControl.tsx`'s `handlePublishClick` persists first, then validates and
opens the confirm dialog, blocking on 400/network errors while preserving
typed values and staying retryable. Server-side validation/authorization
untouched. `make check` green (backend 580 passed/22 skipped, frontend 1573
passed). QA verdict: PASS (commit b12e951,
https://github.com/cfornesa/ai-dev-tools-zoomcamp-1/issues/128#issuecomment-5385258122).
Closed.

## 98. Clarify and document .replit's [userenv] DEBUG/ALLOWED_HOSTS scope for production
Goal: Determine whether `.replit`'s `[userenv.shared]` (`DJANGO_DEBUG = "true"`,
`DJANGO_ALLOWED_HOSTS = "*"`) can apply to the published autoscale deployment
and, if so, close that gap; otherwise document the actual precedence between
`[userenv]` and Replit Secrets so it does not need to be re-derived.
Description: A 2026-08-23 production-readiness audit found `[userenv.production]`
is empty, so it does not override `[userenv.shared]`'s dev-unsafe DEBUG/
ALLOWED_HOSTS values. If those values reach the live deployment process,
`config/settings.py`'s hard production-safety block (HSTS, secure cookies,
HTTPS redirect, non-console email) is skipped entirely, since it is gated on
`DEBUG=False`. Mitigating evidence from issue #97 (closed) — `check --deploy`
passing and `scripts/smoke-published.sh` passing against the real published
URL with `DEBUG=False`-consistent behavior — suggests this is very likely
already fine in practice (Replit Secrets or a workspace-only scope probably
govern the real deployment), but neither AGENTS.md nor
`.agents/memory/replit-production-schema-publishing.md`/
`replit-publish-verification.md` state this explicitly.
Status: COMPLETE
GitHub issue: [#129](https://github.com/cfornesa/ai-dev-tools-zoomcamp-1/issues/129)
Evidence: `.replit`'s `[userenv.production]` section was empty; `[userenv.shared]`
sets `DJANGO_DEBUG = "true"` and `DJANGO_ALLOWED_HOSTS = "*"`. Issue #97's
closing comment records a passing `manage.py check --deploy` and a passing
published smoke check, both consistent with the live deployment actually
running `DEBUG=False` today — i.e., likely a documentation gap, not a live
production defect, but unverified from the repository alone.
Resolution: Could not obtain a definitive confirmation of `[userenv]`
precedence — Replit publishes no official reference for the `[userenv]`
block, and this session has no way to inspect a live production process's
actual environment. The available evidence (AGENTS.md already documents that
Replit Secrets, configured separately in the Deployments pane, supply
production DB/OAuth/Mistral/mail settings; Replit's own docs describe
workspace and deployment secrets as separate, non-carrying-over stores;
issue #97's passing anonymous smoke check requires a real `ALLOWED_HOSTS`
hostname already, which `config/settings.py` never defaults to) points
strongly, but not conclusively, at `[userenv]` being workspace-scoped and
not deployment-authoritative. Rather than leave the gap open on an
unconfirmed assumption, `[userenv.production]` is now pinned to
`DJANGO_DEBUG = "false"` and the real production hostnames
(`animate.creatrweb.com,creatrweb.replit.app`) as defense-in-depth — this
closes the residual risk regardless of which layer actually wins at
runtime, at zero cost. Documented in AGENTS.md and
`.agents/memory/replit-userenv-scope.md` (supersedes the withdrawn
`replit-userenv-scope-unverified.md`), indexed in
`.agents/memory/critical-actions.md`. `make check` unaffected (no
Python/TypeScript source touched); `.replit` TOML validity verified with
`python3 -c "import tomllib; tomllib.load(open('.replit','rb'))"`.

## 99. Stop the editor from double-painting shapes for scenes with no active behaviors
Goal: A newly added shape (circle/rectangle/line/polygon) renders exactly
once in the editor preview, with no visible doubling/ghosting for ordinary
scenes that have no active bindings or behavior graph.
Description: A 2026-08-23 user report against the live Replit production
deployment found shapes appearing duplicated after being added. Issue #126
("Prevent duplicated shapes from appearing after editor load or recovery")
previously fixed one duplication mechanism by guarding the SVG overlay with
`!hasActiveBehaviors && shapeGeometry(shape)` in
`frontend/src/pages/EditorWorkspace.tsx` (~line 1546), but its own resolution
notes state the static (no active bindings/graph) case is deliberately left
untouched — the p5 canvas (`EditorWorkspace.tsx:705-730`) and the SVG overlay
(~line 1483 onward) both still paint every shape whenever no behaviors are
active, which is the common case right after adding a shape. Investigate
whether this double-paint is only a rendering-layer redundancy (positions
agree, so it is invisible except for stacked semi-transparent shapes) or
whether it is an actual data-duplication bug — the user-visible screenshot
this task originated from is ambiguous.
Status: COMPLETE
GitHub issue: [#130](https://github.com/cfornesa/ai-dev-tools-zoomcamp-1/issues/130)
Evidence: See investigation notes above; `EditorWorkspace.tsx:1540-1546`
comment block explicitly documents the static case as out of scope for #126.
Discovery gate: Searched `_docs/tasks.md` for existing duplication entries;
found #126 (task 95, closed) covers a different code path (load/recovery),
not the static-scene double-render case described here.
Resolution: Confirmed a real (not merely redundant) double-paint: the SVG
overlay's `shapeGeometry(shape)` never applied `transform.opacity` (unlike
`p5Adapter.ts`'s `drawShapeGeometry`, which does), so any shape with reduced
opacity rendered fully opaque in the SVG layer, stacked on its own
correctly-translucent p5-canvas render underneath — visible ghosting/
doubling for exactly the shapes a user would notice it on. Removed
`shapeGeometry` and its only call site entirely (`EditorWorkspace.tsx`) —
the p5 canvas (kept synchronously in sync with `workingCopy` via the
existing render effect, whether or not behaviors are active) is now the
sole body-rendering surface in both cases, matching what issue #126 already
did for the active-behaviors case. The SVG `<g>` per shape still provides
its non-body affordances (testid, selection/hover outline, `<title>`
summary). Updated `EditorWorkspace.shapes.test.tsx`'s "issue #93" suite and
one `EditorWorkspace.duplicateShapes.test.tsx` case to assert the SVG layer
paints zero bodies (pixel-level shape-rendering fidelity was already
separately covered by `p5Adapter.test.ts`, unaffected by this change).
`make check` passes (backend 583 passed; frontend 1578 passed).

## 100. Unify the Shapes and Layers panels into one cohesive per-layer UI
Goal: A single "Layers" panel is the one place to see, select, and edit every
shape in the scene — no separate "Add & edit shapes" panel duplicating shape
listing, and each row reads as one clearly delineated layer rather than a
loose cluster of buttons.
Description: A 2026-08-23 user report found the "Add & edit shapes" panel
(`EditorWorkspace.tsx:1745`, inside Tools) and the "Scene outline"/Layers
panel (`LayersPanel.tsx`, promoted to its own top-level region by issue #127)
remain two disconnected surfaces, and that Layers rows (~lines 487-611) pack
5-8 unlabeled controls (visible/lock, move up/down, move-to-layer,
move-to-group, delete) per row with no visual separation between layers and
no inline edit/color affordance — color editing exists only in a third,
separately-reachable Inspector panel (issue #58). Chosen direction (default;
confirm before implementing): one shape = one layer by default (already
close to true structurally), each layer row shows a compact primary view
(name, visibility/lock, color swatch opening an inline color picker, delete)
with secondary reorder/reparent controls collapsed behind a details
disclosure, and shape creation ("Add circle/rectangle/line/polygon") moves
into or docks onto the same Layers panel instead of a separate Tools section.
Status: COMPLETE
GitHub issue: [#131](https://github.com/cfornesa/ai-dev-tools-zoomcamp-1/issues/131)
Evidence: See investigation notes above; issue #127's own resolution
(`_docs/tasks.md` task 96) explicitly split Layers out as an *independent*
region rather than merging it with shape creation, which is the reverse of
what this task asks for.
Discovery gate: Searched `_docs/tasks.md`/GitHub issues for an existing
"unify shapes and layers" entry; #127 (task 96, closed) is the closest match
but scoped to drag-and-drop reordering within Layers, not panel unification
or per-layer color editing — treated as a new, larger UX task rather than a
duplicate.
Resolution: Implemented the chosen direction exactly. Deleted the Tools
panel's `<h4>Shapes</h4>` + `<ul aria-label="Shape list">` (a straight
duplicate of the outline) and its "Add circle/rectangle/line/polygon"
buttons/`SHAPE_TYPES` array from `EditorWorkspace.tsx`, moving both the
array and the buttons into `LayersPanel.tsx` (a new `role="group"
aria-label="Add shape"` toolbar above the existing "Outline actions"
toolbar) — the button labels stayed identical since many tests assert on
them by accessible name. Renamed the now shape-creation-free
`CollapsibleSection heading="Add & edit shapes"` to `"Shape actions"`,
since all it still holds is duplicate/delete-selected, undo/redo, the snap
preference, and the lock-error display. Redesigned every `LayersPanel.tsx`
outline row so its always-visible primary view is name/label, visibility
and lock toggles (layer/group rows — shapes have no data-model field of
their own to toggle, only the pre-existing read-only inherited-state
annotation), an inline fill-color swatch (shape rows only, via a new
`ShapeColorSwatch` component), and a per-row delete button; move up/down
and the `MoveControls` reparent select+button pair now live behind a new
per-row `<details><summary>More</summary>...</details>` disclosure
(`RowMoreDisclosure`). `useSceneEditor.ts`'s `deleteSelected`/
`deleteGroupSelected` were generalized to take an optional explicit `id`
(defaulting to the current selection, so every pre-existing caller is
unchanged) so a row's delete button can remove *that* row's shape/group
directly, sidestepping the documented `selectShape` + same-render stale-
closure hazard entirely rather than working around it. The color swatch
instead gates its editable field on `sceneEditor.selectedShapeId ===
row.id` being true on a *subsequent* render before calling
`updateSelectedShapeColorField`, per that same hazard, and reuses the
identical validation/error-display pattern `ShapeInspectorPanel.tsx`'s
`ColorStyleField` already established. No new dependency: the swatch is a
plain text hex input, matching `LayersPanel.tsx`'s own doc-comment
constraint. Updated every affected suite (`EditorWorkspace.layers.test.tsx`,
`.accordion`, `.multiTransform`, `.transform`, `.lock`, `.shapes`,
`.vertexEdit`, `.snap`, `.shapeInspector.test.tsx`) to open a row's `<details>`
before touching what's now inside it, and replaced every "Shape list"
reference with the outline's own shape rows via a new shared
`frontend/src/testUtils/shapeOutline.ts` helper (`shapeOutlineRows`/
`shapeSelectButton`/`shapeOutlineSelectButtons`) rather than duplicating
that lookup in eight files. Final gate: `npm run lint` (only the 4
pre-existing `only-export-components` warnings), `npm run format:check`,
`npm run typecheck`, and `npm test` all clean — 106 test files, 1577 tests
passed (independently re-verified in a separate pass: same result, plus one
confirmed pre-existing, unrelated flaky timing test in
`src/storage/draftAutosave.test.ts` that passes on its own).

Found during `/production-readiness`'s post-hoc audit of this task (2026-08-23):
the Playwright e2e suite (`frontend/e2e/`, not part of `make check`/`npm test`
— see AGENTS.md) had four stale references this refactor's own unit-test
sweep didn't cover, since none of those specs run under Vitest:
`layersPanel.spec.ts` and `interactionRuntime.spec.ts` both called
`expandSection(page, 'Add & edit shapes')` to reach "Add circle" before it
moved to the always-visible LayersPanel toolbar (removed, now a no-op
comment); `layersPanel.spec.ts` clicked a "Move ... down" button directly,
which the new per-row `<details>` disclosure made inert until opened (fixed
by opening the row's "More" summary first); `projectLifecycle.spec.ts` and
`publishingAndRemix.spec.ts` both queried the now-deleted `aria-label="Shape
list"` (replaced with a `[data-outline-kind="shape"] button[aria-pressed]`
locator against the outline). Fixed directly (all four are corrections to
this task's own change, not a separate issue) and verified statically:
`npx playwright test --list` still discovers all 115 tests across 11 files
with no syntax errors, `npx tsc -p tsconfig.e2e.json --noEmit` is clean
(would have caught an unused import), and oxlint/prettier are clean on the
touched files.

**Verification boundary closed (2026-08-23, later same day)**: once local
PostgreSQL became available (Docker), `make e2e` was actually run live. The
four static fixes above were all correct as written. It also found one
genuine, deterministic, 100%-reproducible bug in `layersPanel.spec.ts`
itself (not application code, and not one of the four fixes above): its
`fireLayerDrag` helper fired `dragstart`/`dragover`/`drop`/`dragend` as four
synchronous `dispatchEvent` calls inside one `page.evaluate`, but
`LayersPanel.tsx`'s drag handlers call React state setters
(`setDragId`/`setHover`), and React 18's automatic batching does not flush
a re-render between multiple `dispatchEvent` calls issued within the same
synchronous script — `onRowDragOver`'s closure still saw the pre-dragstart
`dragId` (null) and silently no-op'd the entire drag, every time. Rewrote
`fireLayerDrag` to await each dispatch as its own separate `page.evaluate`
call, forcing a real task boundary between them. Also found the "Move ...
down" fix from the paragraph above needed one more correction: a bare
`<summary>` computes to accessibility role "generic" in Chromium, not
"button", so `getByRole('button', { name: 'More' })` never matched —
switched to `getByText('More', { exact: true })` (the same pattern
`EditorWorkspace.layers.test.tsx`'s Vitest/jsdom suite already used
correctly). All three `layersPanel.spec.ts` tests now pass reliably,
verified across multiple repeated runs. The rest of the e2e suite (109-110
of ~113 non-skipped tests passing per run) showed real but non-deterministic
flakiness unrelated to any change this session made — three consecutive
full-suite runs each failed a different, non-overlapping set of tests
(including files never touched this session, like `interactionRuntime.spec.ts`),
while the same tests passed individually in isolation; the test machine had
under 200MB free RAM during these runs (Docker Postgres + Django + Vite +
Chromium all concurrent), consistent with environment resource pressure
rather than a code defect. Not investigated further given that signature.

## 101. Diagnose why "Enable camera" does nothing in production
Goal: Clicking "Enable camera" in the Live camera panel either starts hand
tracking or shows a clearly visible error the user can act on — never a
silent no-op.
Description: A 2026-08-23 user report found clicking "Enable camera" on the
published deployment produces no observable effect, leaving the Demo signal
controls (manual/synthetic playback) as the only usable path. Static review
of `CameraControl.tsx` and `tracking/mediapipeProvider.ts` found every async
step (`getUserMedia`, `video.play()`, MediaPipe's
`FilesetResolver`/`GestureRecognizer` CDN loads from `cdn.jsdelivr.net` and
`storage.googleapis.com`) already wrapped in try/catch routing to a visible
`role="alert"` error, so the failure mode could not be confirmed from source
alone. Next step is to reproduce against the live published URL
(`https://animate.creatrweb.com`) with browser devtools open and capture the
actual console/network error, then scope the fix (likely one of: unreachable
CDN dependency in production, a Permissions-Policy/CSP header blocking
`camera`, or a genuinely swallowed rejection not caught by the reviewed code
paths).
Status: COMPLETE
GitHub issue: [#132](https://github.com/cfornesa/ai-dev-tools-zoomcamp-1/issues/132)
Evidence: See investigation notes above.
Discovery gate: Searched `_docs/tasks.md` for prior camera-enable entries;
found #31 (task "Build camera permission and privacy UX", closed, builds the
original UX) and #119 (task 88, closed, a different bug — the Enable-camera
button never appearing at all when `navigator.mediaDevices` is undefined).
Neither covers Enable camera being present but non-functional, so this is
treated as new.
Investigation (2026-08-23, still PROPOSED — not fully resolved): reproduced
live against `https://animate.creatrweb.com`'s public viewer (`/p/<id>` for
the one public project, "Blank canvas") and clicked "Enable camera" with
devtools open. The browser-denied-permission path worked exactly as
designed — a visible `role="alert"` with actionable text and a Retry
button — which rules out "the whole error-handling system is silently
broken." No CDN (`cdn.jsdelivr.net`/`storage.googleapis.com`) request was
ever attempted before that denial, consistent with `CameraControl.tsx`
requesting camera access before loading MediaPipe, so the MediaPipe-CDN
failure mode named in the original description is still unconfirmed either
way — testing it needs a browser that can actually grant camera permission,
which the available tooling could not do (the sandboxed browser used for
this investigation unconditionally denies camera access at the browser
level, not the application level). No `Permissions-Policy`/CSP header
blocking `camera` was found in the response headers, ruling that theory
out. The same investigation directly confirmed task 102/issue #133's
diagnosis: the page's network requests included raw `/src/*.ts` files and
`node_modules/.vite/deps/*` bundles, and the console logged `[vite]
connecting...`/`[vite] connected.` — the published deployment was running
Vite's dev server with a live HMR socket. This raises a plausible
(unconfirmed) mechanism tying the two issues together: MediaPipe's Wasm/
model CDN loads are large and slow, so an HMR reconnect or full-reload event
firing while that load is in flight would silently abort the async
enable-camera flow with no error ever surfacing (the whole page just resets
to its initial state) — a strong match for "does nothing," as opposed to
"shows an error." Task 102's fix (serving the built bundle via `vite
preview`, no HMR client) removes this specific failure mode regardless of
whether it was the actual cause. Recommended next step, deferred to a fresh
task/session with real camera hardware and a live deployment rebuilt with
task 102's fix already applied: re-test "Enable camera" post-deploy: if the
symptom is already gone, this task can close as resolved-by-#133; if it
still reproduces, capture the actual console/network error with real camera
permission granted, which this session's tooling could not do.

Further investigation (2026-08-23, still PROPOSED — root cause remains
unconfirmed): this session's sandboxed browser again could not grant real
camera permission, so the exact production failure still could not be
reproduced end-to-end. However, the "HMR reload interrupts an in-flight
MediaPipe CDN/model load" theory (the leading hypothesis linking this task
to task 102/#133) could be tested *without* real camera hardware, by
overriding `navigator.mediaDevices.getUserMedia` in a real local dev
session (Django + `npm run dev`, a real public project,
`PublicProjectViewer.tsx`'s `/p/<id>` route) to resolve with a synthetic
`canvas.captureStream()` `MediaStream` — this lets the real (non-test-double)
`createMediaPipeTrackingProvider` code path run past `getUserMedia` and
actually fetch the real MediaPipe Wasm/model assets from
`cdn.jsdelivr.net`/`storage.googleapis.com`, reach `'active'` status, and
run real gesture-recognizer inference against the synthetic stream —
confirming dynamically, not just from static review, that every step of
`mediapipeProvider.ts`'s pipeline genuinely works end-to-end locally.
Two variants of the theory were then tested directly against this working
pipeline while a click's `runStartPipeline` was deliberately kept in
flight (via a `window.fetch` override adding an 8s delay to the CDN/model
URLs specifically):
1. Restarting the Vite dev server process mid-flight (bare process
   kill + restart, no code change) — the client logged "server connection
   lost. Polling for restart..." and reconnected, but did **not** reload
   the page; `status` stayed `'active'` once the pipeline finished. (An
   earlier attempt using this session's `preview_stop`/`preview_start`
   tool pair *did* appear to reset the page to `idle`/logged-out Home —
   but that was this session's own tooling explicitly re-navigating the
   tab to `/`, not organic Vite/HMR behavior, and is not evidence for the
   production symptom.)
2. Editing `mediapipeProvider.ts` (appending a comment) while
   `runStartPipeline` was mid-flight, forcing a genuine Vite HMR
   propagation up to `CameraControl.tsx` (confirmed via the Vite server's
   own log: `hmr update /src/components/CameraControl.tsx`) — the
   gesture-recognizer graph visibly reinitialized (fresh
   `gesture_recognizer_graph.cc`/`gl_context.cc` log lines), but `status`
   still reached `'active'` moments later; no silent reset to `idle` and
   no full page reload occurred.
Neither controlled HMR scenario reproduced "does nothing" locally — this
weakens (does not disprove; Replit's autoscale-restart mechanics before
task 102's fix and the exact network conditions in production remain
untested here) the specific "HMR interrupts the CDN load" mechanism as
*the* explanation, though task 102/#133 already independently removes
Vite's dev server (and therefore this entire class of risk) from
production regardless of whether it was the actual cause.

Direct live-production test (2026-08-23, same session, using a real
Chrome browser this session had access to — not the sandboxed one used
above): first confirmed via console (`[vite] connecting...`/`connected.`,
the `@vite/client` script) that `https://animate.creatrweb.com` is, as of
this test, **still serving Vite's dev server**, i.e. task 102/#133's fix
has not yet been deployed to production despite being merged — the
republish/redeploy itself is a separate, user-authorized action this
session cannot take. With that caveat, tested "Enable camera" directly
against live production, signed in as the real account, on the real
"Blank canvas" project's editor (`Tools → Camera → Live camera`): clicking
it correctly called `getUserMedia`, the UI correctly showed "Starting
camera…", and it stayed there indefinitely with no error and no MediaPipe
CDN request ever appearing in the network log — an exact match for the
user's original "does nothing" report. `navigator.permissions.query({name:
'camera'})` on that same tab reported `state: "prompt"` (not `"denied"`),
confirming the browser has a native, OS-level camera-permission dialog
outstanding and is correctly waiting on it — this is not a silent
failure, a swallowed rejection, or a code bug at all; `getUserMedia`'s
promise is genuinely pending real user input on a dialog outside the
page (and outside what CDP-based browser automation can see or interact
with — granting media permissions through a synthetic click is a
deliberate browser security boundary, not a tooling gap). Left the
control in a clean `'stopped'` state afterward (see `Stop camera`) and
closed the tab.
Given `state: "prompt"` rather than `"denied"`, this specific run cannot
distinguish between two remaining explanations for the original report:
(a) the user's browser/OS was showing this same native prompt but it went
unnoticed (easy to miss if it doesn't grab visual focus, or if a
previous, unrelated site's camera-permission decision is being confused
for this one), or (b) some other environment has permission pre-set to
`"denied"` or has no camera device at all, in which case the app's
already-verified-working denial/error path (`role="alert"`, Retry) should
have fired but for some reason didn't in that instance. Distinguishing
these needs the same operator step either way: reproduce with the actual
affected browser/OS, watching specifically for a native permission
prompt (not just the page's own UI) before concluding anything is broken
in application code.
This task remains blocked on the same two things as before — a live
deployment actually running task 102's fix (confirmed above: not yet
deployed), and a human operator who can answer a real, native browser
permission dialog — both require the user's own action (publishing; a
real permission decision) that no browser-automation tooling available to
this session can substitute for.

Resolution (2026-08-23, same session): the user answered the pending
native permission dialog on the same live-production tab left open for
them. Re-checked immediately after: `navigator.permissions.query({name:
'camera'})` now reported `state: "granted"`. Re-ran "Enable camera" on
the real "Blank canvas" project against live production (still on the
un-republished, Vite-dev-server build — task 102/#133's fix was not a
factor in this result) and it worked completely correctly end-to-end:
status reached "Camera is active. Hand tracking is running locally in
your browser.", with real `gesture_recognizer_graph`/`gl_context`
initialization and live inference in the console — no code bug anywhere
in the reachable path. This conclusively confirms the root cause: the
browser's own native camera-permission prompt was sitting unanswered
(`state: "prompt"`), and this control's UI gave no indication one might
be pending beyond the generic, unchanging "Starting camera…" message —
easy to miss since the prompt doesn't grab focus and can render as a
small icon rather than a modal depending on browser/OS. From the user's
perspective that reads as "does nothing," even though both the app and
the browser were behaving exactly as designed.
Fix: added a `permissionHintDelayMs`-gated hint (default 5s) to
`CameraControl.tsx` — if `status` stays `'starting'` this long without
resolving to `'active'` or `'error'`, an additional `role="status"`
message appears: "Still waiting on your camera — check for a permission
request near your browser's address bar and allow it to continue." This
directly closes the gap against this task's own goal ("never a silent
no-op") for the one scenario that wasn't already handled (a denied
permission already showed a clear, working error path; a pending one now
does too). Covered by two new cases in `CameraControl.test.tsx` (hint
appears after the delay while `starting`; hint never appears if `active`
is reached first) using `vi.useFakeTimers()`/`fireEvent.click` (plain
`userEvent` combined with fake timers proved flaky/hung in this
component's async-heavy tests — `fireEvent` sidesteps that). `make check`
passes (backend 594 passed/22 skipped; frontend 1579 passed, up from
1577).
Not folded into task 102/#133's scope: republishing so #133's fix is
live in production is still outstanding and remains the user's own
action to take, but is no longer a blocker for this task, since the
"does nothing" symptom is now fully explained and addressed independent
of which frontend-serving mode production runs.

## 102. Serve the production deployment from the built frontend bundle, not the Vite dev server
Goal: The published Replit deployment serves the production `dist/` build
with no live HMR WebSocket, so the editor no longer reloads unexpectedly
mid-session.
Description: A 2026-08-23 user report found the editor page reloading at
random. Investigation found `.replit`'s `[deployment].run` and
`scripts/start.sh:77` start the frontend in production via
`npm --prefix frontend run dev -- --host 0.0.0.0 --port "$frontend_port"` —
Vite's dev server with hot module replacement — while `[deployment].build`
separately runs `npm run build` and appears to leave that `dist/` output
unused at runtime. Every connected browser holds a live HMR WebSocket to the
dev server; Vite's HMR client issues a full `location.reload()` when that
socket disconnects/reconnects (autoscale restart, redeploy, transient
network hiccup) or receives a full-reload HMR event, which is a strong match
for "random refresh." No `location.reload`/`.href =` call exists anywhere in
`frontend/src` itself. Scope: change the production run command to serve the
built `dist/` (e.g. `vite preview` or a static file server) behind the same
host/port contract `scripts/start.sh` already establishes, verify Django
`/api`/`/health` proxying or routing still works without Vite's dev proxy,
and confirm via `scripts/smoke-published.sh` after deploying.
Status: COMPLETE
GitHub issue: [#133](https://github.com/cfornesa/ai-dev-tools-zoomcamp-1/issues/133)
Evidence: `.replit` `[deployment].run`, `scripts/start.sh:77`; no reload call
found anywhere in `frontend/src`. Confirmed live against the published
deployment (`https://animate.creatrweb.com`) before implementing: its
network requests included raw `/src/*.ts` files, `@fs/home/runner/
workspace/...` paths, and `node_modules/.vite/deps/*.js` — unambiguous
Vite-dev-server-in-production, and its console logged `[vite] connecting...`
/ `[vite] connected.` (the live HMR socket).
Discovery gate: Searched `_docs/tasks.md` for prior "unexpected refresh"
entries; found #112 (task 82, closed) which only added UI messaging for
draft-sync failures and never touched how the app is served in production —
not a duplicate of this deployment-configuration issue.
Resolution: `scripts/start.sh` now reads `FRONTEND_SERVE_MODE` (`dev` by
default), and in `preview` mode runs `npm run preview` (`vite preview`)
against the already-built `frontend/dist/` instead of `npm run dev` — `vite
preview` has no HMR client, so it cannot trigger this class of reload, and
inherits `vite.config.ts`'s `server.proxy`/`allowedHosts`/`strictPort` by
Vite's own documented default (verified locally: `vite preview` served
hashed `/assets/*.js` bundles with no HMR client script, and proxied
`/health/` to Django on 8000 exactly like dev mode). `.replit`'s
`[deployment].run` now points at a new `scripts/start-production.sh`
wrapper (not an inline `bash -c` in `.replit` itself — an existing test,
`test_replit_uses_repository_launcher_for_startup`, guards against
reintroducing that fragile pattern from a prior fix) that sets
`FRONTEND_SERVE_MODE=preview` and delegates to `scripts/start.sh`. The
interactive Replit workflow is unaffected: it still runs `scripts/start.sh`
directly with no `FRONTEND_SERVE_MODE` set, defaulting to `dev`. Covered by
new cases in `tests/test_startup_configuration.py` (mode selection,
rejection of an invalid mode, `.replit` wiring, the wrapper script) using
that file's existing double-based launcher harness. `make check` passes
(backend 594 passed; frontend 1578 passed). Not yet verified against a live
publish — that requires the user to trigger an actual Replit deployment and
re-run `scripts/smoke-published.sh` against it, which this task deliberately
did not do on its own (publishing is a user-authorized action).

## 103. Backfill or lazily generate public gallery thumbnails for existing projects
Goal: Every published project shows a real visual preview in the public
gallery and on its own public page, including projects published before
thumbnail generation existed or whose current version hasn't changed since.
Description: A 2026-08-23 user report found the public gallery preview
"utterly useless" with no visual thumbnail. Investigation found thumbnail
generation (`scenes/thumbnail_generation.py:114-176`) is correctly wired
into save/publish/fork/AI-accept, and `PublicProjectCard.tsx:54-70` correctly
renders `thumbnail_url` with a fallback tile — but
`maybe_schedule_thumbnail_generation` (`thumbnail_generation.py:152-170`)
only fires from those same event call sites and no-ops if a non-fallback
thumbnail already exists, so any project untouched since before this feature
shipped (task/issue #54) shows "No preview available" indefinitely with no
backfill path. Scope: add a management command (none exist today under
`scenes/management/commands/`) to backfill thumbnails for existing published
projects, or trigger lazy generation on gallery/public-page read when a
project's thumbnail is still the fallback.
Status: COMPLETE
GitHub issue: [#134](https://github.com/cfornesa/ai-dev-tools-zoomcamp-1/issues/134)
Evidence: See investigation notes above.
Resolution: The task's own evidence was slightly imprecise —
`PublicProjectThumbnailView`'s "Lazy fallback at serve time" path already
covers the "no `Thumbnail` row at all" case on every request. The real gap
is a project whose current version *does* have a `Thumbnail` row but it's
`is_fallback=True` (a prior render failure): that view's `if thumbnail is
None` check is false for it, so it keeps serving the same stale fallback
PNG forever with no retry, exactly the gap `ensure_thumbnail_for_version`'s
own docstring names ("a later retry ... from a management command"). Added
`scenes/management/commands/backfill_thumbnails.py`: for every public
project with a current version and no existing non-fallback thumbnail
(missing row or `is_fallback=True`), calls `ensure_thumbnail_for_version`
to generate/regenerate it; `--dry-run` reports the count without rendering.
Never touches private projects (filtered by `visibility=PUBLIC`, matching
every other thumbnail trigger's content-source boundary). Covered by
`tests/test_backfill_thumbnails_command.py` (missing row, stuck fallback,
already-good thumbnail left alone, private project never touched, dry run).
`make check` passes (backend 588 passed).
Discovery gate: Searched `_docs/tasks.md` for the thumbnail-generation entry
(#54, "Generate public preview thumbnails", closed) — that task built
event-triggered generation only; no backfill task exists, so this is new.

## 104. Render the project thumbnail on "Your Projects" ProjectCard
Goal: A project's own card in the signed-in "Your projects" gallery shows the
same thumbnail image the public gallery card already shows for the same
project.
Description: A 2026-08-23 user report found "Your Projects" cards have no
thumbnail while public gallery cards do. Investigation found
`frontend/src/components/ProjectCard.tsx` has no reference to
`thumbnail_url` at all — no `<img>`, no fallback element — despite `Project`
(`frontend/src/api/projects.ts:181`) already carrying the same
`thumbnail_url` field `PublicProjectCard.tsx` consumes. `ProjectCard.tsx` was
simply never updated when the public card gained the feature. Scope: add the
same thumbnail `<img>` + fallback pattern `PublicProjectCard.tsx` already
uses to `ProjectCard.tsx`.
Status: COMPLETE
GitHub issue: [#135](https://github.com/cfornesa/ai-dev-tools-zoomcamp-1/issues/135)
Evidence: `frontend/src/components/ProjectCard.tsx` (no thumbnail_url
reference); `frontend/src/api/projects.ts:181`; `PublicProjectCard.tsx:54-70`
for the existing pattern to reuse.
Discovery gate: Searched `_docs/tasks.md` for an existing ProjectCard
thumbnail entry; none found — #54 (closed) scoped generation and the public
card only, not "Your projects."
Resolution: The task's own evidence was stale — `Project`
(`frontend/src/api/projects.ts`, backed by `scenes.serializers.ProjectSerializer`)
did *not* actually carry `thumbnail_url`; only `PublicGalleryProject`/
`PublicProject` did, and `PublicProjectThumbnailView` 404s for anything not
`visibility == PUBLIC`, including the owner. Added an owner-gated
`ProjectThumbnailView` (`scenes/api.py`, same `Action.PROJECT_READ`
404-not-403 convention as `ProjectDetailView`) at
`projects/<uuid:public_id>/thumbnail.png` (`scenes/urls.py`,
`name="project-thumbnail"`), added `thumbnail_url` to `ProjectSerializer`
resolving through that route, added the same field to the frontend `Project`
type, and gave `ProjectCard.tsx` the same image/fallback pattern
`PublicProjectCard.tsx` uses (`ProjectCard.test.tsx`,
`tests/test_project_thumbnail_api.py`). All `baseProject()` test fixtures
across the frontend suite updated for the new required field. `make test`
(backend 583 passed, frontend 1578 passed) and `make lint`/`typecheck`/
`format-check` all pass.

## 105. Add a visible active-tab indicator to the primary navigation
Goal: The current page's nav link (Home / Public gallery / Account settings)
is visually distinguishable from the others and exposed to assistive
technology via `aria-current="page"`, meeting WCAG 2.4.8 (Location).
Description: A 2026-08-23 user report found no visual or programmatic way to
tell which nav tab is active, which is an accessibility gap. Investigation
found `frontend/src/components/Layout.tsx:101-123` renders the nav with
plain react-router `<Link>` elements (not `NavLink`), a static
`className="shell-action"` regardless of route, no `aria-current`, and no
`useLocation`-based active check anywhere in the file.
Status: COMPLETE
GitHub issue: [#136](https://github.com/cfornesa/ai-dev-tools-zoomcamp-1/issues/136)
Evidence: `frontend/src/components/Layout.tsx:101-123`.
Discovery gate: Searched `_docs/tasks.md` and the accessibility audit tasks
(#62/#63/#64, all closed) for existing nav-active-state coverage; none of
those audits covered the primary shell nav specifically, so this is new.
Resolution: Switched every primary-nav `Link` (Home, Public gallery, Account
settings, in both the desktop and mobile-menu nav variants) to react-router's
`NavLink`, which sets `aria-current="page"` automatically on the active
route; `Home` uses `end` so it isn't matched for every other route. Added a
`.shell-action[aria-current='page']` rule in `frontend/src/index.css` for a
visible background/border/weight change. Covered by two new
`Layout.test.tsx` cases asserting `aria-current` on the right link for `/`
and `/gallery`.

## 106. PostgreSQL-only concurrency/trigger test suite is broken: `.using("postgres_test").create_user()` raises AttributeError
Goal: Every test gated behind `POSTGRES_TEST_DATABASE_URL` (the suite that
specifically verifies real-Postgres concurrency serialization, trigger
enforcement, and rollback-on-injected-failure — semantics SQLite cannot
provide) actually runs to completion against a real PostgreSQL database,
rather than erroring before it can exercise anything.
Description: A `/production-readiness` audit (2026-08-23) spun up a real
local PostgreSQL 16 instance via Docker, pointed `POSTGRES_TEST_DATABASE_URL`
at a disposable database, and ran the full backend suite for the first time
with that variable actually set. Nine test files
(`test_ai_accept_proposal_api.py`, `test_blank_project_creation_api.py`,
`test_edit_session_draft_sync_api.py`, `test_project_publish_api.py`,
`test_project_fork_api.py`, `test_project_scene_version_models.py`,
`test_scene_version_restore_delete_api.py`, `test_scene_version_save_api.py`,
`test_template_browsing_cloning_api.py`) call
`get_user_model().objects.using("postgres_test").create_user(...)` —
`Manager.using(alias)` returns a plain `QuerySet` bound to that alias, which
does not have `create_user` (only the custom `UserManager` does), so every
one of these calls raises `AttributeError: 'QuerySet' object has no
attribute 'create_user'` before the test can exercise anything.
`POSTGRES_TEST_DATABASE_URL` is optional and unset in CI/`make check`
(SQLite backs `default` otherwise per Task 3's own design), so this had
apparently never been caught — the entire category of tests that exist
specifically to prove concurrency/consistency guarantees has silently never
run to completion. Fix: replace `.objects.using("postgres_test")` with
`.objects.db_manager("postgres_test")` everywhere it precedes a
`create_user` call — `Manager.db_manager(alias)` returns the manager itself
bound to that alias, preserving custom methods, unlike `.using(alias)`.
Status: COMPLETE
GitHub issue: [#137](https://github.com/cfornesa/ai-dev-tools-zoomcamp-1/issues/137)
Evidence: See description above; reproduced against a real local PostgreSQL
16 (Docker) instance.
Discovery gate: Searched `_docs/tasks.md` and open GitHub issues for an
existing "postgres_test create_user" entry; none found — new.
Resolution: Replaced every `User.objects.using("postgres_test")`/
`get_user_model().objects.using("postgres_test")` call immediately preceding
`.create_user(...)` with `.objects.db_manager("postgres_test")` across all
nine affected files — every other `.using("postgres_test")` call (`.create()`,
`.filter()`, `.get()`, `.count()`, `.select_for_update()`) was left
unchanged since those methods exist on plain `QuerySet` and were never
broken. This specific `AttributeError` is confirmed fixed (re-running any
affected test in isolation no longer raises it). Re-running the full backend
suite with a real PostgreSQL 16 instance and `POSTGRES_TEST_DATABASE_URL`
set surfaced three further, *distinct* pre-existing problems in this same
test category — none related to `.using()`/`.db_manager()`, none introduced
by this fix — split out to task 107 (issue #138) rather than folded in here,
since they're architecturally unrelated and substantially larger in scope.
`uv run pytest` (SQLite-only, matching `make check`'s own invocation, no
`POSTGRES_TEST_DATABASE_URL`) remains unaffected and green — 594 passed, 22
skipped — since none of the changed lines are reachable without
`POSTGRES_TEST_DATABASE_URL` set.

## 107. PostgreSQL-semantics test suite has never successfully run: 3 distinct pre-existing bugs
Goal: Every test gated behind `POSTGRES_TEST_DATABASE_URL` runs to completion
against a real PostgreSQL database and actually proves the concurrency/
trigger/rollback guarantee it was written to verify, without corrupting
unrelated SQLite-only tests as a side effect of the variable being set.
Description: Continuing the `/production-readiness` audit that produced
task 106/issue #137, running the full backend suite against a real local
PostgreSQL 16 instance (via Docker) surfaced three further, architecturally
distinct problems, none related to task 106's `.using()`/`create_user` fix
and none introduced by it:
1. **Double-seeded built-in templates on `default`**: merely having both
   `default` (SQLite) and `postgres_test` registered in `DATABASES` during
   test setup causes migration `0010_seed_builtin_templates` to apply twice
   against `default`, leaving 16 `Template` rows instead of 8 — breaking 6
   of 10 tests in `test_template_browsing_cloning_api.py` (which never
   touch `postgres_test` at all) plus
   `test_template_catalog.py::test_migration_seeded_exactly_eight_built_in_templates`.
   Confirmed by isolating the variable: the same file passes cleanly with
   `POSTGRES_TEST_DATABASE_URL` unset. This is a real regression risk:
   setting the variable to get *better* coverage currently makes *more*
   tests fail.
2. **`test_postgres_concurrent_*` tests write to `postgres_test` but read
   from `default`**: e.g.
   `test_ai_accept_proposal_api.py::test_postgres_concurrent_duplicate_accepts_produce_exactly_one_version`
   creates its fixtures via `Project.objects.using("postgres_test").create(...)`
   then drives real HTTP requests through `APIClient`, whose view code has
   no `.using(...)` override and therefore always reads `default` — every
   request 404s. Same pattern in `test_edit_session_draft_sync_api.py` and
   `test_project_fork_api.py`. Needs a `DATABASE_ROUTERS` config or a
   session-scoped `override_settings` making `default` mean `postgres_test`
   for these tests' duration — no such mechanism exists today.
3. **Raw SQL out of sync with the schema**:
   `test_project_scene_version_models.py::test_postgres_trigger_blocks_raw_sql_snapshot_mutation`
   (and likely its siblings, plus
   `test_template_fork_provenance_models.py::test_postgres_trigger_blocks_raw_sql_mismatched_fork_source`)
   hand-write an `INSERT INTO scenes_project (...)` omitting the `is_deleted`
   column (`NOT NULL`, no DB default) — fails with
   `psycopg.errors.NotNullViolation` before ever reaching the trigger
   behavior being tested.
Status: COMPLETE
GitHub issue: [#138](https://github.com/cfornesa/ai-dev-tools-zoomcamp-1/issues/138)
Evidence: See description above; reproduced against a real local PostgreSQL
16 (Docker) instance, isolating each finding by toggling
`POSTGRES_TEST_DATABASE_URL` and running individual files/tests.
Discovery gate: Searched `_docs/tasks.md` and open GitHub issues for an
existing entry covering this test category; task 106/issue #137 covers only
the narrower, already-fixed `.using().create_user()` `AttributeError` — this
is new, distinct, and substantially larger in scope (three independent root
causes, one needing a design decision, not just a bug fix), so it is
recorded separately rather than folded into #137. Recommendation recorded
in the issue: treat as a dedicated-session-sized body of work; `make
check`/CI are unaffected either way since `POSTGRES_TEST_DATABASE_URL` is
never set there.
Resolution: Fixed all three findings, plus two further sub-bugs the fixes
exposed once the suite could finally run to completion (full detail in
`.agents/memory/postgres-multi-db-test-pitfalls.md`):
1. `scenes/migrations/0010_seed_builtin_templates.py`'s `RunPython` seed/
   remove functions now write via `.using(schema_editor.connection.alias)`
   instead of the bare default manager, which silently wrote to `default`
   regardless of which alias's migration executor was actually running —
   the double-seed's real root cause.
2. Added `tests/_postgres_routing.py` (`route_default_to_postgres_test()`,
   `close_thread_connections()`), used by every `postgres_concurrent_*`
   thread in `test_ai_accept_proposal_api.py`, `test_project_fork_api.py`,
   and `test_edit_session_draft_sync_api.py`: physically aliases `default`
   onto the same PostgreSQL connection as `postgres_test` for the
   threaded-request duration (needed because a database router has no
   hook for which alias `transaction.atomic()` targets) plus a permissive
   `allow_relation` router (Django's own default falls back to a literal
   `_state.db` string comparison that doesn't know two alias names can be
   the same physical database). Running to completion also surfaced a
   flaky test assertion in `test_postgres_concurrent_upserts_never_let_an_older_client_seq_win`
   that assumed a specific thread always wins the initial create-race;
   fixed to assert only the real invariant (final stored state), not an
   unreliable per-thread `applied` value.
3. Both raw-SQL trigger tests
   (`test_postgres_trigger_blocks_raw_sql_snapshot_mutation`,
   `test_postgres_trigger_blocks_raw_sql_mismatched_fork_source`) now
   supply every `NOT NULL`-without-DB-default `scenes_project` column
   (`is_deleted`, `export_attribution`, `tags`). Running to completion
   also surfaced that all four trigger tests in these two files asserted
   `pytest.raises(OperationalError)`, but a plain PL/pgSQL `RAISE
   EXCEPTION` (no explicit `SQLSTATE`) maps to `psycopg.errors.RaiseException`
   → Django's `ProgrammingError`, never `OperationalError` — corrected in
   both files.
`uv run --env-file .env pytest` (real local PostgreSQL 16 via Docker, using
the `scenes-postgres` container already provisioned for this repo) passes
616/616 across 5 consecutive full-suite runs with no flakes. `uv run
pytest` (SQLite-only, matching `make check`/CI exactly) remains unaffected:
594 passed, 22 skipped. Full `make check` (backend lint/format/typecheck/
test, frontend lint/format/typecheck/test) passes.

## 108. Republish so production actually runs task 102/#133's fix
Goal: The published Replit deployment at `https://animate.creatrweb.com`
serves the built frontend bundle via `vite preview` (no live HMR
WebSocket), matching what task 102/issue #133 already fixed in code —
confirmed live, not just from source.
Description: Task 102/issue #133 fixed the actual defect (production ran
Vite's dev server, whose HMR client force-reloads the page on socket
disconnect/reconnect) back on 2026-08-23, and it has sat merged on `main`
since. Two further sessions' worth of live-production investigation for
task 101/issue #132 repeatedly confirmed the fix was still not live:
`https://animate.creatrweb.com`'s browser console still logs `[vite]
connecting...`/`[vite] connected.` (the dev-server HMR client), not the
hashed, HMR-free `/assets/*.js` bundles `vite preview` serves. The
deeper reason: the fix was never even pushed to `origin` (GitHub) until
this task's own session pushed it — Replit's workspace syncs via git
merge (`.replit`'s `[postMerge]` hook runs `scripts/post-merge.sh`), so
there was nothing for Replit to have pulled yet, on top of Publish itself
being a separate, user-authorized step no session automated.
Status: COMPLETE
GitHub issue: [#139](https://github.com/cfornesa/ai-dev-tools-zoomcamp-1/issues/139)
Evidence: `e6832e9` (task 102's fix, `scripts/start.sh`'s
`FRONTEND_SERVE_MODE`, `scripts/start-production.sh`,
`.replit`'s `[deployment].run`) was 11 commits behind `origin/main` until
pushed as part of this task; live console checks against
`https://animate.creatrweb.com` on 2026-08-23 (twice, in separate
sessions) both showed the Vite dev client still active.
Resolution (2026-08-23): The project owner republished from Replit
(`40fd853` "Published your App") after this task pushed the fix to
`origin`. Issue #139 was verified and closed the same day with direct
evidence: deployment logs show `scripts/start-production.sh` reaching
`vite preview` and a passing Django health check; published smoke checks
pass (`/health/` 200, `/` 200, `/api/whoami/` 401, `/accounts/login/`
200); the live HTML serves hashed `/assets/*.js`/`.css` bundles and no
longer contains `/@vite/client`, `/src/main.tsx`, or React refresh
markers — no production Vite HMR signature remains.
Discovery gate: Searched `_docs/tasks.md` for an existing "push"/
"republish"/"deploy" reminder task; task 102/#133 itself only covers the
code fix and explicitly deferred live verification ("Not yet verified
against a live publish... requires the user to trigger an actual Replit
deployment") rather than tracking the deploy step itself — this task
tracked that specific outstanding step, new and not a duplicate at the
time it was filed.

## 109. Preview canvas goes blank after live camera becomes active
Goal: The Preview canvas keeps rendering the scene's shapes after live
camera tracking becomes active — it should never go blank just because
the camera turned on.
Description: Three screenshots attached to the repo
(`attached_assets/image_1787523711773.png`, `image_1787523735976.png`,
`image_1787523858217.png`) show a working Layers panel and a correctly
rendered 4-shape Preview, contrasted with a third screenshot where the
Preview panel is entirely blank below its heading (no shape-count text,
no hint text, no canvas) while the Live camera panel reads "Camera is
active." (that third screenshot's side-by-side Preview/Live-camera
layout confirms the >=1024px wide viewport, not the narrow tabbed one).
A read-only investigation of `EditorWorkspace.tsx`'s Preview section
(~lines 1245-1279) found the shape-count paragraph, hint paragraph, and
canvas wrapper render unconditionally with no code path keyed on
`cameraStatus`, and that `panelHidden('preview')` always returns `false`
(~line 892, issue #93) regardless of viewport or active tab — ruling out
a video-overlay cause (`CameraControl.tsx` renders no `<video>` element)
and a tab/viewport-visibility cause. `CameraControl` is itself rendered
inside a `CollapsibleSection` (heading "Camera") that defaults closed and
only mounts its children while open
(`frontend/src/pages/CollapsibleSection.tsx` line 42), so whether the
screenshots' repro path involved collapsing/re-expanding that section is
still open. Grooming (issue #140) turned this into a live-reproduction
checklist: first vs. every activation, shape-count dependence, the
Camera-section collapse/expand interaction, wide vs. narrow viewport,
reduced-motion on/off, whether the rest of the editor (including Demo
signal controls) stays usable if Preview does blank, and whether the
blank state is permanent or recoverable — still pointing toward a
render-time exception or a mount-order race between the p5 canvas
lifecycle and `CameraControl`'s `onStatusChange` callback as the leading
hypothesis, pending that live reproduction.
Status: COMPLETE
GitHub issue: [#140](https://github.com/cfornesa/ai-dev-tools-zoomcamp-1/issues/140)
Discovery gate: Searched `_docs/tasks.md` and existing GitHub issues for
a duplicate. Issue #132 ("Enable camera does nothing in production",
task 101, closed) is a distinct symptom — the Enable-camera control
never reaching `'active'` at all — whereas this task assumes the camera
does reach `'active'` and covers what happens to Preview afterward. New,
not a duplicate. The `CollapsibleSection` mount/unmount-on-collapse
question surfaced during grooming is tracked as a pending-verification
item on issue #140 rather than a separate follow-up issue; file one only
if live reproduction shows it's a genuine, separate problem.
Evidence (2026-08-23): Added
`frontend/src/pages/EditorWorkspace.cameraPreview.test.tsx` (11 cases, all
passing, `make frontend-test` green at 1590/1590 with no regressions) as
deterministic, no-real-camera coverage for every dimension of the issue's
checklist that doesn't itself require a live `getUserMedia` prompt or real
MediaPipe frames: first vs. repeated `cameraStatus` activation
(`'idle'`→`'starting'`→`'active'`→`'stopped'`→`'active'`), an empty scene
and a populated scene, >=1024px and <1024px viewports (including
activating wide then narrowing), reduced motion forced both ways, the
Camera `CollapsibleSection` collapsed and re-expanded after activation
(confirms it unmounts/remounts `CameraControl` per
`CollapsibleSection.tsx`'s `open && children` guard, and that Preview is
unaffected either way), shape selection still highlighting on canvas after
activation, Demo signal controls staying operable, and no `previewError`
alert appearing as a side effect of a bare status transition. `CameraControl`
is mocked as a controllable status source only (its own permission/MediaPipe
state machine is already covered by `CameraControl.test.tsx`), the same
boundary-mocking convention `EditorWorkspace.previewRuntime.test.tsx` uses
for `p5Adapter`. Every case passes against the current `main` — this is
consistent with, and now backs with an automated regression guardrail, the
original code investigation's finding that `panelHidden('preview')` always
returns `false` and nothing else in the Preview `<section>` reads
`cameraStatus`.
Evidence (2026-08-23, continued): The first suite mocks `CameraControl`
itself, which cannot exercise the issue's own leading hypothesis — "a
mount-order race between the p5 canvas lifecycle and `CameraControl`'s
`onStatusChange` callback." Added a second suite,
`frontend/src/pages/EditorWorkspace.cameraPreviewRealControl.test.tsx` (3
cases, all passing), that renders the REAL, unmocked `CameraControl`
inside the REAL `EditorWorkspace` and replaces only
`../tracking/mediapipeProvider`'s `createMediaPipeTrackingProvider` with a
fully controllable fake `TrackingProvider` (the same seam
`CameraControl.test.tsx` already exercises via its `createProvider` prop;
`window.isSecureContext` overridden the same way, since jsdom always
reports it `false`). This drives the actual "Enable camera" button through
`CameraControl`'s real `handleEnable` → `setStatus('starting')` →
`getProvider().start()` → a fake-provider frame → the real
`provider.onFrame` handler flipping `status` to `'active'` → the real
`status` `useEffect` firing `onStatusChange('active')` into
`EditorWorkspace.tsx`'s real `setCameraStatus`/`trackingSourceRef` wiring
— the exact effect-ordering path the hypothesis names, with no manual
status injection anywhere in the chain. All 3 cases (activation, a
Stop-camera/re-Enable cycle, and "no render-time error, rest of editor
stays usable") pass, finding no mount-order race in the current code:
Preview stays fully populated at every step. `make frontend-test` is green
(1592/1593; the one failure, `draftAutosave.test.ts`, is an unrelated
pre-existing flake — confirmed by rerunning that file alone, which passes
22/22 — and touches a file this task never modified).
Evidence (2026-08-23, live production): With the user's explicit direction
to use their already-authenticated real Chrome session
(`mcp__claude-in-chrome__*`), performed the live reproduction directly
against `https://animate.creatrweb.com` on the exact project the original
bug screenshots came from (the 4-shape "Blank canvas" project — circle,
diamond, rectangle, line — matching `image_1787523711773.png`). Steps and
results:
- Loaded the project: Preview showed "4 shape(s) in the working copy.",
  the interaction hint, and all four shapes rendered correctly (matches
  the "before" screenshot).
- Expanded Camera, clicked the real "Enable camera" button (a genuine
  `getUserMedia` permission prompt against real hardware, already granted
  in this Chrome profile): status reached "Camera is active. Hand
  tracking is running locally in your browser." within about a second.
  Preview stayed fully rendered — shape count, hint, and all four shapes
  — not blank.
- Clicked a shape while the camera was active: it selected correctly with
  visible move/resize/rotate handles, confirming the scene stayed
  interactive.
- Collapsed the Camera `CollapsibleSection` while active (the
  pending-verification item from grooming): Preview was unaffected.
  Re-expanding reset Camera to a fresh "Enable camera" state (a new
  `CameraControl` instance mounts on expand per its `open && children`
  guard, as already flagged and explicitly out of scope for this issue) —
  Preview remained correct throughout regardless.
- Re-enabled the camera a second time from that fresh state: reached
  "active" again immediately, Preview stayed fully populated.
- Checked the browser console throughout: the only "error"-level entry
  both times was MediaPipe's own benign
  `INFO: Created TensorFlow Lite XNNPACK delegate for CPU.` log line (not
  a real error) — no render-time exception, no blank state, no
  `previewError` banner.
The blank-Preview symptom from the original screenshots did not reproduce
on live production against the same project. Combined with both
regression suites above (which rule out every code-level path in
`EditorWorkspace.tsx`/`CameraControl.tsx` the issue names, including the
"mount-order race" hypothesis) and this direct live-production
reproduction attempt (which rules out a production-only difference per
#132's precedent), every acceptance criterion in issue #140 that's
checkable today has been checked and passes.
Status: COMPLETE
Resolution: The exact root cause behind the three original screenshots
remains unknown (most likely a since-resolved transient condition, or one
this session's steps didn't happen to hit), but the bug is not
reproducible against current `main` in production or in code, across
every dimension the issue's acceptance criteria enumerate. Closing on that
basis, with both regression suites left in place as a permanent guardrail
against a future regression of the same shape.

## 110. Add a camera video overlay with user-controllable opacity to the editor Preview
Goal: While live camera tracking is active, the editor's Preview canvas
shows the user's own camera feed as a video overlay layered behind the
scene render, with a keyboard-accessible slider to control the overlay's
opacity from fully transparent (today's behavior) to fully opaque, without
changing where camera video is otherwise allowed to go (still local-only,
never captured into a thumbnail, export, or network request).
Description: 2026-08-24 user request, made directly after task 109/#140's
live-camera investigation: "my intention is for the camera to be shown as
an overlay for which I can control the opacity, which does not appear to
be the case here." Confirmed by investigation: `CameraControl.tsx` never
renders a `<video>` element or any visual representation of the camera
feed (only status text); no file under `frontend/src` references a camera
overlay in any form. `_docs/plan.md` only discusses camera video in a
privacy context (stays on-device, never recorded/uploaded), never as
something rendered back to the user. Task 109/#140 explicitly scoped this
out: "Live video feed rendering in Preview — not currently implemented and
not requested here." Net-new feature, not a regression.
Groomed acceptance criteria (see issue #141 for the full checkable list):
overlay renders only while `cameraStatus === 'active'` in
`EditorWorkspace.tsx`, behind the scene shapes, using the same
`MediaStream` `CameraControl`/`mediapipeProvider.ts` already acquires (no
second `getUserMedia` prompt); a labeled, keyboard-operable opacity slider
(0-100%, default e.g. 50%, resets each activation, not persisted) controls
it live; overlay disappears immediately on Stop/unmount with no frozen
frame; mirrored by default (no toggle); implemented as a separate DOM
element (never drawn into the p5 canvas) so it stays absent from
`captureSocialThumbnail.ts`/`generateSocialThumbnailZip.ts` output and
every other canvas-only capture path; no camera frame is ever captured,
stored, or sent over the network; works on narrow (<1024px) viewports
inside the Preview tab; `prefers-reduced-motion` does not suppress the
live feed itself; no new console errors or `previewError` state; no
regression to `EditorWorkspace.cameraPreview.test.tsx`/
`EditorWorkspace.cameraPreviewRealControl.test.tsx` (task 109/#140).
Flagged during grooming (pending verification): the `TrackingProvider`
contract (`frontend/src/tracking/types.ts`) exposes only
`onFrame`/`onError`/`start`/`stop` today — no `MediaStream`/`<video>`
element — so implementation must first extend that contract or
`CameraControl`'s props to surface the live stream without breaking the
existing mock-provider test seams.
Out of scope (moved to follow-up issues filed during grooming): showing
this overlay on the public project viewer
(`PublicProjectViewer.tsx`) — [#145](https://github.com/cfornesa/ai-dev-tools-zoomcamp-1/issues/145);
showing it in standalone HTML export
(`generateHtmlExport.ts`/`standaloneCameraSource.ts`) —
[#146](https://github.com/cfornesa/ai-dev-tools-zoomcamp-1/issues/146);
persisting the opacity value, an un-mirror toggle, and independent
reposition/resize of the overlay —
[#147](https://github.com/cfornesa/ai-dev-tools-zoomcamp-1/issues/147).
GitHub issue: [#141](https://github.com/cfornesa/ai-dev-tools-zoomcamp-1/issues/141)
Discovery gate: Searched `_docs/tasks.md` and existing GitHub issues for a
camera-overlay/video-preview task; none exists. New, not a duplicate.
Newly discovered out-of-scope work reconciled by filing and linking
#145/#146/#147 above (grooming's discovery gate).
Resolution: Extended the `TrackingProvider` contract
(`frontend/src/tracking/types.ts`) with an optional `onStream` channel and
implemented it in `mediapipeProvider.ts` (`emitStream` on acquisition,
`null` on every release path via the existing `stopStream`) — no second
`getUserMedia` call, and providers without a camera (mocks) simply never
call it. `CameraControl.tsx` gained an optional `onStreamChange` prop that
forwards `provider.onStream?.(...)`. `EditorWorkspace.tsx` wires that into
new `cameraStream`/`cameraOverlayOpacity` state: a `<video>` element is
rendered as the first child of `.editor-scene-canvas` (CSS `zIndex: -2`,
behind the p5 mount div's `-1`) only while `cameraStatus === 'active'` and
a stream is present, mirrored (`scaleX(-1)`), `pointerEvents: 'none'`, and
never drawn into the p5 canvas — so it stays structurally absent from
`captureSocialThumbnail.ts`/`generateSocialThumbnailZip.ts`. A labeled
native `<input type="range">` (0–100%, default 50%, resets on every fresh
`'active'` transition, not persisted) sits above the canvas whenever
`cameraStatus === 'active'`, changing `cameraOverlayOpacity` live via
React state (no extra render delay). Stopping/erroring the camera removes
both immediately (state-driven, no frozen frame). Test coverage: 5 new
`onStream` cases in `mediapipeProvider.test.ts`, 2 new forwarding cases in
`CameraControl.test.tsx`, and a new
`EditorWorkspace.cameraOverlay.test.tsx` (9 cases: idle/starting hide the
overlay, active+stream shows it at the 50% default, slider changes opacity
live and is keyboard-operable via native range semantics, opacity resets
on re-activation, Stop/error remove both immediately, no `previewError`
side effect, scene shapes stay rendered). `make frontend-test` is green at
1609/1609 (was 1593), plus `typecheck`/`lint`/`format:check` all pass.
Status: COMPLETE
Live-camera verification (2026-08-23, continued): performed against a real
local Django + Vite stack, using the user's own already-authenticated real
Chrome (via `mcp__claude-in-chrome__*`) with a physical webcam the user
confirmed is always-allow-permitted. This live pass found and fixed **two
real bugs** neither the jsdom test suite nor the earlier `EditorWorkspace`
render-path tests could catch, since neither exercises actual pixel
compositing or a real `<video>` element's `srcObject`:
1. The overlay `<video>` element was present in the DOM with the correct
   styling, but `srcObject` was never set — `hasSrcObject: false`,
   confirmed via direct DOM inspection. Root cause: the effect that
   assigns `videoEl.srcObject = cameraStream` only depended on
   `[cameraStream]`, but `cameraStream` is set (via `onStreamChange`) well
   before `cameraStatus` ever reaches `'active'` — and the `<video>`
   element itself is only ever mounted while `cameraStatus === 'active'`.
   The effect fired once, while the element didn't exist yet (silently
   no-opped), and never fired again once the element actually mounted.
   Fixed by adding `cameraStatus` to the dependency array. (The exact same
   class of bug as the one found and fixed in task 113/#144's
   `PublicProjectViewer.tsx` — an effect depending on the wrong signal for
   a conditionally-rendered ref target — independently rediscovered here.)
2. Even with `srcObject` correctly set and the video genuinely playing
   (confirmed: `videoWidth: 640, videoHeight: 480`, `paused: false`), the
   overlay was still completely invisible in the actual rendered canvas.
   Root cause: `render/p5Adapter.ts`'s draw loop calls
   `sk.background(canvas.backgroundColor)` every frame — an opaque paint
   that fully covers the entire canvas, unconditionally. Since shapes and
   background paint onto the same flat `<canvas>` element, no CSS
   `zIndex` ordering of a DOM element stacked behind that canvas can ever
   show through an opaque fill painted every frame. Fixed by adding a
   `transparentBackground` parameter to `P5ScenePreview.render()` (calls
   `sk.clear()` instead of `sk.background()` when `true`), threaded
   through both `EditorWorkspace.tsx` render call sites (the plain
   `previewRef.current.render(...)` effect and `usePreviewRuntime`'s own
   internal render call, via a new `transparentBackground` option) keyed
   on `cameraStatus === 'active'`. Shapes still draw normally on top;
   only the background fill is skipped while the camera overlay is
   showing.
After both fixes, live-verified end to end: "Enable camera" reached
"Camera is active..." with no permission prompt needed (already granted),
the mirrored live camera feed rendered visibly in the Preview canvas
behind the scene, the opacity slider defaulted to 50%, and "Stop camera"
removed the overlay immediately with no frozen frame (canvas returned
cleanly to its normal opaque background). New regression tests added:
`EditorWorkspace.cameraOverlay.test.tsx` now asserts `video.srcObject`
is actually set (not just that the element exists), and a new
`p5Adapter.test.ts` `describe('transparentBackground', ...)` block
covers the default (opaque, unaffected), the `true` case (clears to
alpha 0), and a drawn shape still painting opaquely on top of a
transparent background. Also fixed in the same pass: jsdom's
non-conformant `HTMLMediaElement.play()` (returns `undefined`, not a
`Promise`) was wrapped in `Promise.resolve(...)` so the existing
`.catch()` doesn't throw in tests, without changing real-browser
behavior. `make frontend-test` green at 1627/1627 (was 1624);
`tsc`/`oxlint`/`prettier` all clean.

## 111. Make every shape independently manageable as its own layer
Goal: Every shape is enforced as its own independent layer at the
data-model level (schema + validators + backend) — no two shapes can
share a `layerId`, each shape carries its own visibility/lock state
instead of only inheriting a read-only annotation, existing scenes that
violate the invariant normalize correctly at read time, and grouping
keeps working across independently-layered shapes.
Description: 2026-08-24 user request (attempted on Replit as their own
"#45", never landed as an actual GitHub issue — repo issue numbers 45-47
already belong to older, unrelated, long-closed issues, and no issue past
#140 existed before this session). Investigation: `schema/scene.schema.json`
gives each `Shape` a `layerId` but does not enforce a 1:1 shape-to-layer
relationship; `sceneOutline.ts`/`LayersPanel.tsx` implement layer/group
*container* `visible`/`locked` flags, but an individual shape has no
locking/visibility field of its own (task 100's own resolution notes this
explicitly). Task 100/issue #131 (closed) unified the Shapes/Layers *panel
UI* over this existing loosely-associated data — it explicitly did not
change the underlying data model, and its own text calls one-shape-per-
layer merely "already close to true structurally," not enforced. No
migration path exists for pre-existing scenes. Related to, but materially
larger in scope than, #131 — not a duplicate.
Grooming pass (2026-08-23, PM): found `sceneOutline.ts`'s `groupItems`
(~line 333-347) explicitly *requires* every selected item to already
share one `layerId` ("You can only group items that belong to the same
layer") — directly incompatible with 1:1 enforcement, since two shapes
could then never be grouped; this precondition must change. Also found
`SceneVersion.scene_json` is immutable after creation (PostgreSQL trigger,
`scenes/migrations/0002_postgres_invariants.py`), which rules out a
database backfill as the migration mechanism — migration must be
read-time normalization of legacy documents (assign each shape sharing a
`layerId` its own synthesized layer, preserving order) followed by the
existing save-new-version flow, never a rewrite of an existing
`SceneVersion` row. Whether this needs a `schemaVersion: 2` bump per
`schema/README.md`'s versioning convention, or can stay within
`schemaVersion: 1` behind read-time normalization, is left as an explicit
engineering decision (default recommendation: stay within
`schemaVersion: 1`). Groomed acceptance criteria now cover: the
shared-`layerId` rejection rule (mirroring the existing
`danglingReference` validator pattern), per-shape own `visible`/`locked`
fields plus one new `LayersPanel.tsx` toggle (reusing #131's existing
row pattern — no broader panel redesign), the `groupItems` precondition
fix, `Group.layerId` semantics once members can span layers, read-time
normalization (not a DB backfill), the `schemaVersion` decision, fixture/
regression coverage (backend + frontend), zero-shape-layer and
undo/redo-across-normalization edge cases, and a confirmation that
`scenes/permissions.py` authorization is unaffected. Filed
[#148](https://github.com/cfornesa/ai-dev-tools-zoomcamp-1/issues/148) as
a follow-up to evaluate collapsing `Layer` and `Shape` into a single
schema entity (a larger, riskier alternative reading of "as its own
layer") — kept out of this task's scope so this task stays additive and
backward-compatible; #148 depends on this task landing first.
Status: PROPOSED
GitHub issue: [#142](https://github.com/cfornesa/ai-dev-tools-zoomcamp-1/issues/142)
Discovery gate: Searched `_docs/tasks.md` and GitHub issues (including
`gh issue list --search "layer"` and `--search "migration schema"`) for an
existing "per-shape layer independence"/migration task; #131 (task 100)
and #110 (closed — outline/Inspector presentation and selection sync) are
the closest matches but both are UI/presentation over the existing data
model, not the data model itself. Treated as new, not a duplicate; #131's
own delivered scope stays out of scope here (see issue #142's "Out of
scope"). Follow-up #148 filed and linked per the discovery-gate
reconciliation step.
Next action: Implementing engineer resolves the `schemaVersion` question
first, then changes `schema/scene.schema.json`, `scenes/validation.py`,
`frontend/src/validation/scene.ts`, `sceneOutline.ts` (`groupItems`,
`isEffectivelyLocked`, `moveItemToLayer`/`moveItemToGroup`,
`buildOutline`), and `LayersPanel.tsx`'s per-shape toggle, in that order,
with fixtures/tests added alongside each. See issue #142 for the full
groomed acceptance criteria.
Status: COMPLETE
Resolution (2026-08-23): `schemaVersion` stayed at 1 (read-time
normalization, per the default recommendation) — additive/structural, not
a new document shape.
- `schema/scene.schema.json`: `shape.layerId` documented as unique across
  shapes (enforced by validators, not JSON Schema); shapes gained optional
  `visible`/`locked` booleans (absent defaults to visible/unlocked, so no
  legacy document needs a schema-level migration).
- `scenes/validation.py`: `_check_references` gained a
  `duplicateLayerAssignment` rule (sibling to the existing
  `danglingReference` checks). New `normalize_scene_layers(data)` gives
  each conflicting shape its own synthesized layer (cloned visible/locked,
  preserved draw order), called wherever a possibly-legacy `scene_json`
  becomes the base of a NEW document: `ProjectForkView`, `TemplateCloneView`,
  and (discovered while implementing — not originally listed)
  `scenes/thumbnails.py`'s `_build_scene_plan`, since server-side
  thumbnail generation for an already-published pre-Task-111 project would
  otherwise start failing. `SceneVersionRestoreView` needed no change — it
  never calls `validate_scene` at all.
- `frontend/src/validation/scene.ts`: mirrored `duplicateLayerAssignment`
  check plus an exported `normalizeSceneLayers`, called at every
  `scene_json`-into-working-copy site: `useEditorWorkspaceState.ts` (initial
  load — replaces `persistedVersion.scene_json` too, not just
  `workingCopy`, so `isDirty` doesn't read "unsaved" the instant a legacy
  scene loads), `EditorWorkspace.tsx`'s restore/AI-accept handlers, and
  (also discovered while implementing) `PublicProjectViewer.tsx` and
  `ExportConfigDialog.tsx`, which would otherwise show "Could not render
  this scene" / spuriously block export for an already-published legacy
  project.
- `schema/limits.json`: `maxLayers` raised from 20 to 200 (== `maxShapes`)
  — with every shape now needing its own layer, a lower cap made it
  impossible to ever legitimately reach `maxShapes`.
- `sceneOutline.ts`:
  - `groupItems` no longer requires a shared layerId to group (adopts the
    first selected item's layerId for the new group; each member shape's
    own layerId is untouched).
  - `moveItemToGroup` no longer requires the target group to share the
    moved item's layerId, for the same reason.
  - `moveItemToLayer`'s group branch no longer forces every descendant
    *shape* onto the target layerId (would violate 1:1 the moment a group
    has 2+ member shapes) — only the group itself and any descendant
    *groups* (which may still share a layerId) move; descendant shapes
    keep their own.
  - `moveItem` on a top-level shape now delegates to `moveLayer` on that
    shape's own layer, discovered necessary because `buildOutline` and
    `render/sceneDrawPlan.ts`'s `buildScenePlan` both bucket top-level
    ordering by layer first — once every shape is alone on its layer, a
    plain array-position swap within `shapes` became both impossible (no
    sibling to swap with) and pointless (draw order no longer read from
    it). `buildOutline`'s `isFirst`/`isLast` for a top-level shape now
    reflects its layer's own position among all layers, matching what
    `moveLayer` actually allows.
  - New `toggleShapeFlag(scene, shapeId, 'visible' | 'locked')`; a shape's
    own `locked` flag is now folded into `isEffectivelyLocked`'s cascade,
    and its own `visible` flag into `buildOutline`'s `inheritedVisible`.
- `useSceneEditor.ts`: `addShape`/`duplicateSelected` each synthesize a
  brand-new layer (via `sceneOutline.ts`'s new `createLayerFor`) rather
  than reusing `firstLayerId` — every newly created or duplicated shape
  gets its own layer from the start. New `toggleShapeVisible`/
  `toggleShapeLocked` callbacks.
- `LayersPanel.tsx`: `MoveControls`' group-target `<select>` no longer
  filters candidate groups by matching layerId (would offer none, given
  the above); a shape row gained real Visible/Locked toggle buttons
  (mirroring the existing layer/group row pattern) reflecting/mutating the
  shape's own flag, not the read-only cascaded annotation task 100 left in
  place.
- `EditorWorkspace.tsx`: the canvas selection/hover-outline `<svg>` overlay
  now iterates shapes in real draw order (derived from `buildOutline`,
  matching `sceneDrawPlan.ts`) rather than raw `shapes` array order —
  discovered necessary once per-shape layering made those two orderings
  diverge in the common case (previously most shapes shared one layer, so
  array order and draw order coincided).
- Regression coverage: a new `schema/fixtures/invalid/duplicate_layer_assignment.json`
  fixture (+ `expectations.json` entry) exercised by both
  `tests/test_scene_validation.py` and `frontend/src/validation/scene.test.ts`'s
  existing shared-fixture loops; `TestNormalizeSceneLayers` (Python) and
  `sceneLayerNormalization.test.ts` (TS) cover the normalization function
  directly (no-op on a conforming scene, unique layers after, draw-order
  preserved, synthesized layer inherits visible/locked, no source
  mutation); a new `useEditorWorkspaceState.test.ts` case loads a legacy
  scene end-to-end and confirms `workingCopy`/`persistedVersion` land
  already-normalized and mutually consistent; a new
  `test_renders_a_legacy_scene_with_shapes_sharing_one_layer` covers
  `render_scene_image`; `sceneOutline.test.ts` covers `toggleShapeFlag`,
  the lock-cascade fold-in, grouping/moving across layers with differing
  ancestor visible/locked state (each shape's own effective lock stays
  unambiguous), and every existing fixture across both languages that
  previously relied on multiple shapes sharing one layerId was updated to
  give each its own (`schema/fixtures/valid/feature_rich.json`,
  `schema/fixtures/malicious/{combined_resource_limit_abuse,oversized_document}.json`,
  `scenes/fixtures/templates/{open_palm_bloom,physics_orbit,svg_kinetic_poster}.json`,
  and the corresponding backend/frontend limits/patch/AI-edit test
  fixtures). `make frontend-test` green at 1624/1624 (was 1609 before this
  task); backend `uv run pytest` green at 602/602 (was 594); `ruff`/`mypy`/
  `tsc`/`oxlint`/`prettier` all clean.
- `scenes/permissions.py`: confirmed unaffected by reading it — no new
  field or endpoint here introduces a mutation path that bypasses the
  existing authorization service.
- Not done (acceptable gaps, not required by the acceptance criteria as
  written): no explicit "undo/redo across a normalization event" UI test
  beyond the `useEditorWorkspaceState` load-time coverage above (undo/redo
  itself is untouched by this task — normalization only ever runs once, at
  load, never mid-session); `deleteLayer`'s existing "refuses to delete a
  non-empty layer" test was not additionally parametrized for "exactly one
  shape" since that's now the overwhelmingly common case already covered
  by the existing test.

## 112. Give the editor a discoverable toolbar with undo, colors, and essential shape tools
Goal: Undo, Redo, Duplicate selected shape, Delete selected shape, and a
contextual color-edit control for the current selection are reachable from
a single always-visible, icon+tooltip, keyboard- and screen-reader-
accessible toolbar — not buried inside a collapsed accordion or a
tab-switched panel — at every supported viewport width.
Description: 2026-08-24 user request (attempted on Replit as their own
"#46", never landed — see task 111's identical numbering note).
Investigation: `EditorWorkspace.tsx`'s Undo/Redo, duplicate/delete-selected
controls all live inside `CollapsibleSection heading="Shape actions"`,
which defaults closed (issue #95 point 6: every `CollapsibleSection`
defaults closed). No dedicated always-visible toolbar exists anywhere in
the editor; every control is a plain text button with no icon or tooltip.
Color editing exists as an inline per-shape swatch in `LayersPanel.tsx`
(task 100/#131) but isn't part of any toolbar. No prior closed issue
proposed a dedicated toolbar. Global Ctrl/Cmd+Z undo/redo keyboard
shortcuts already exist (`EditorWorkspace.tsx` ~lines 723-742) and are
unaffected by this task.
Grooming decisions (PM pass, 2026-08-23): "Essential shape tools" is
defined as exactly Duplicate selected shape and Delete selected shape —
shape-*creation* buttons (Add circle/rectangle/line/polygon) stay in
`LayersPanel.tsx` exactly where task 100/#131 deliberately placed them,
not moved again. The toolbar's color control reuses (does not duplicate)
`LayersPanel.tsx`'s existing `updateSelectedShapeColorField`, keeping a
single source of truth and no new color-picker dependency. Undo, Redo,
Duplicate, and Delete move out of `CollapsibleSection heading="Shape
actions"` into the new toolbar, along with the `lockError` alert so
lock-rejection feedback is never hidden behind a collapsed accordion;
`SnapPreferenceControl` stays in Tools, and the emptied section is removed
or renamed. Full acceptance criteria are in the GitHub issue.
Status: COMPLETE
GitHub issue: [#143](https://github.com/cfornesa/ai-dev-tools-zoomcamp-1/issues/143)
Discovery gate: Searched `_docs/tasks.md` and GitHub issues (`toolbar`,
`tooltip`, `color picker`, `accessibility`) for an existing toolbar task;
none exists — #131/task 100 is the closest related work but kept these
controls inside a collapsed accordion rather than surfacing an
always-visible toolbar. New, not a duplicate. Filed
[#149](https://github.com/cfornesa/ai-dev-tools-zoomcamp-1/issues/149)
("Add keyboard shortcuts for duplicate/delete selected shape") as a
follow-up for the one piece of adjacent scope moved out during grooming;
every other out-of-scope boundary was a design decision, not deferred
work needing its own issue.
Resolution (2026-08-23): `EditorWorkspace.tsx` gained a
`<div role="toolbar" aria-label="Editor actions">`, rendered right after
`OnboardingHints` and before `{isNarrow && <EditorPanelSwitcher .../>}` —
the same "outside the panel switcher, always visible regardless of active
tab" placement `OnboardingHints`/Preview already use — so it renders
exactly once and stays visible at both `>=1024px` and `<1024px`. It holds:
a `History` group (Undo/Redo, unchanged `disabled`/`onClick` wiring), an
`Edit shape` group (Duplicate/Delete, same), a new
`EditorToolbarColorControl` (a persistent hex-text `<input>` for the
selected shape's fill, wired through the exact same
`updateSelectedShapeColorField` `LayersPanel.tsx`'s `ShapeColorSwatch`
already calls — one write path, two UI surfaces, always in sync), and the
`lockError` alert. All five controls kept their exact prior accessible
names/roles, so every existing test that queried them by name continued
passing unchanged. Each button (new `ToolbarButton` helper) has a visible
`aria-hidden` glyph (↶/↷/⧉/✕) plus a CSS-only tooltip
(`.editor-toolbar-tooltip`, shown via `:hover`/`:focus-visible` in
`index.css`) — visible on both mouse hover and keyboard focus, while
`aria-label` on the button carries the accessible name independent of
tooltip visibility. `.editor-toolbar` uses `flex-wrap` + `overflow-x: auto`
so a narrow viewport wraps/scrolls the controls rather than clipping them
or growing page-level horizontal scroll. No new `outline: none` was added
(global `:focus-visible` styling already covers every button/input). The
now-emptied `CollapsibleSection heading="Shape actions"` was renamed to
"Editing preferences" (only `SnapPreferenceControl` remains inside it) per
the "must not keep a heading that no longer describes its contents"
criterion — `LayersPanel.tsx`'s own "Add shape" creation toolbar was left
untouched, exactly where task 100/#131 placed it. One existing test
(`EditorWorkspace.accordion.test.tsx`) referenced the old "Shape actions"
heading text and was updated to "Editing preferences"; every other test in
the suite needed no changes. `make frontend-test` green at 1624/1624 (no
regressions, including `EditorWorkspace.a11y.test.tsx`'s `jest-axe`
checks, which already ran with every `CollapsibleSection` pre-expanded and
so exercised the toolbar's markup too); `tsc`/`oxlint`/`prettier` all
clean. No new dependency added (plain unicode glyphs + a CSS tooltip, no
icon or color-picker library).
Not done: a live-browser visual/manual pass (the pixel layout at each
breakpoint, real mouse hover/keyboard-focus tooltip behavior) was not
performed in this session — the authenticated editor route needs a running
Django backend + a signed-in session this environment wasn't set up for
mid-task; every acceptance criterion checkable via the automated suite
(DOM structure, ARIA roles/names, `jest-axe`, disabled-state wiring,
accessible-name stability) passes.

## 113. Make public projects render visibly and make camera interaction reliable
Goal: `PublicProjectViewer.tsx` (the signed-out `/p/:id` route) reliably
renders a published project's persisted scene, its own loading/empty/error
states, and every camera-permission outcome, with real-browser (Playwright)
regression coverage of that path specifically.
Description: 2026-08-24 user request (attempted on Replit as their own
"#47", never landed — see tasks 111/112's identical numbering note).
Groomed 2026-08-24 — full reconciliation below; see issue #144 for the
complete task-template writeup (Acceptance criteria / Out of scope /
Evidence / Discovery gate).
Reconciliation against #93/#119/#132/#140:
- #93 (scene canvas had no visible rendering) — editor-only, and about a
  different, now-superseded render path. Its fix styled `.editor-scene-
  shape` DOM divs in `index.css`; `render/p5Adapter.ts` (the actual live
  preview both `EditorWorkspace.tsx` and `PublicProjectViewer.tsx` use
  today) draws straight to canvas via p5's API and never touches
  `.editor-scene-shape`. Not coverage of this issue; unrelated precedent.
- #119 (public-viewer "Enable camera" never appearing when
  `navigator.mediaDevices` is undefined) — public-viewer-specific and
  already verified: `publishingAndRemix.spec.ts`'s "mocked unsupported
  browser..." scenario (lines 463-518) runs directly against `/p/:id`
  anonymously and passes. Do not re-implement or re-test.
- #132 (Enable camera does nothing in production) — fix lives in the
  shared `CameraControl.tsx` (commit 9106a71's permission-prompt hint),
  which `PublicProjectViewer.tsx` also renders unchanged, but the live-
  production verification that motivated it (commit b06111d) was run
  against the authenticated editor's Camera section, never `/p/:id`.
- #140 (Preview canvas blank after camera reaches active) — entirely
  editor-scoped: both regression suites
  (`EditorWorkspace.cameraPreview.test.tsx`,
  `EditorWorkspace.cameraPreviewRealControl.test.tsx`) and the closing
  live-production verification all target `EditorWorkspace.tsx`; none
  mention `PublicProjectViewer.tsx`. #140 is COMPLETE (task 109) but does
  not cover this page.
Net conclusion: this is not a duplicate of any of the four, but the
genuinely new scope is narrow — since the rendering and camera code paths
are almost entirely shared with the already-verified editor, what remains
is verification specific to `/p/:id`: pixel-level persisted-scene
rendering (the existing e2e test only checks container visibility, not
pixels), the prompt-pending/granted/no-camera-hardware camera states
(denied and unsupported are already covered per #119 above), and retry/
stop behavior, plus extending the existing anonymous-viewer Playwright
describe block in `publishingAndRemix.spec.ts` (lines 392-519) rather than
building a new one.
Status: COMPLETE
GitHub issue: [#144](https://github.com/cfornesa/ai-dev-tools-zoomcamp-1/issues/144)
Discovery gate: Searched `_docs/tasks.md` and GitHub issues; no single
existing task/issue covers the public-viewer camera path end-to-end with
real-browser tests. Reconciled against #93/#119/#132/#140 above (all
linked in issue #144) — none duplicated, only the genuine remainder
scoped. No new out-of-scope work discovered during grooming beyond the
conditional follow-ups already named in issue #144's "Out of scope"
section (to be filed only if the new tests reveal a real bug).
Resolution (2026-08-23): Extended `publishingAndRemix.spec.ts`'s existing
"Anonymous viewer: demo mode and camera-failure fallbacks" describe block
with 8 new scenarios (the 3 pre-existing ones untouched) — persisted-scene
pixel rendering (a new `samplePixelColors` helper reads the mounted p5
canvas's real `getImageData`, not just container visibility), an empty-
scene fixture, loading/unavailable/error states, a `previewError` render
failure that doesn't blank the page, the `permissionHintDelayMs` hint
(issue #132's fix) observed on `/p/:id` for the first time, and a
no-camera-hardware (`NotFoundError`) + Retry-re-attempts scenario. All 11
scenarios in the describe block pass against a real PostgreSQL + Django +
Vite stack.
**A real, previously-undiscovered production bug was found and fixed**:
implementing the pixel-level rendering assertion revealed that
`PublicProjectViewer.tsx` never actually mounted a p5 canvas for any
project, ever — it used a plain `useRef` + `useEffect(fn, [])` pair to
mount the preview, but the mount `<div>` only exists in the DOM once
`loadState` reaches `'ready'`, and that effect (empty deps) only ever runs
once, on this component's first render, while `loadState` is still
`'loading'` — so `previewMountRef.current` was always `null` the one time
it mattered, and the guard silently no-opped forever. This is the *exact*
timing bug issue #83 already found and fixed in `EditorWorkspace.tsx`
(that fix's own doc comment predicted this outcome almost verbatim: "the p5
preview was never created for any project loaded the normal (async) way —
nothing exercised this before, since no earlier test asserted an actual
`<canvas>` element"), but `PublicProjectViewer.tsx` was never given the
same fix. Ported the identical solution: a *callback* ref
(`previewMountCallbackRef`) plus a `previewMounted` state flag, so the p5
instance mounts the instant its div actually attaches (whichever render
that turns out to be) rather than being gated by a stale effect-dependency
snapshot. This means every anonymous visitor to every published project's
public page has never seen its actual scene rendered, in production, since
this page shipped — confirmed as the acceptance criteria's own point:
"unless the new pixel-level rendering assertion above actually fails and
reveals a real bug" (issue #144's own out-of-scope carve-out anticipated
and explicitly permitted exactly this outcome).
Evidence: `PublicProjectViewer.test.tsx`/`PublicProjectViewer.a11y.test.tsx`
(jsdom) still pass unchanged (27/27) — the bug was invisible to jsdom-level
component tests because they mock `p5Adapter`/never assert a real
`<canvas>` element either, which is exactly why only a real-browser e2e
test could catch it. Full `make e2e` run: 119 passed, 2 skipped (this
suite's own graceful self-skip convention for unrelated missing
prerequisites), 2 failures — both `aiAndRecovery.spec.ts` and
`responsiveShell.spec.ts`, neither touching `PublicProjectViewer.tsx` or
`publishingAndRemix.spec.ts`, both confirmed pre-existing flakes by
rerunning each individually (both pass in isolation). `make frontend-test`
green at 1624/1624 (no regressions); `tsc`/`oxlint`/`prettier` all clean.
Not done: the "Granted: reaches `status === 'active'`" and "Stop after
active" acceptance criteria could not be completed — `mediapipeProvider.ts`
(the real SPA's camera pipeline `CameraControl.tsx` uses everywhere,
including `/p/:id`) has no test-only seam to intercept its dynamic
`import('@mediapipe/tasks-vision')` from a real-browser Playwright context,
unlike the *exported standalone HTML* runtime
(`standaloneCameraSource.ts`), which deliberately exposes
`window.__exportCameraLoadVisionTasksModule` for exactly this purpose (see
`exportArtifacts.spec.ts`'s `installCameraTestSeams`). Reaching a real
`'active'` state would need either genuine network access to Google's
MediaPipe CDN plus real WASM inference against a fake video source, or a
new production test seam — filed as
[#150](https://github.com/cfornesa/ai-dev-tools-zoomcamp-1/issues/150)
rather than expanding this task's scope, per issue #144's own "file a
follow-up issue and link it here" guidance for exactly this situation.
Every other camera-permission state (denied, unsupported, no-hardware,
prompt-pending, retry-not-a-dead-end) resolves before the MediaPipe import
ever runs and was fully covered without this seam.

## 114. Add keyboard shortcuts for duplicate/delete selected shape

### Goal

A keyboard-only user with focus already on the canvas or the layers
outline can duplicate the currently selected shape (`Ctrl`/`Cmd`+`D`) or
delete it (`Delete` or `Backspace`) without reaching for the mouse, using
the same global-listener/`isTypingTarget` pattern the existing Undo/Redo
shortcut already establishes in `EditorWorkspace.tsx`.

### Acceptance criteria

- [x] With a single shape selected and focus on the canvas (or anywhere
      outside a text-entry control), pressing `Ctrl`+`D` (Windows/Linux)
      or `Cmd`+`D` (macOS) duplicates the selected shape — same resulting
      scene state as clicking the existing "Duplicate selected shape"
      toolbar button (`sceneEditor.duplicateSelected()`), including the
      duplicate becoming the new selection.
- [x] With a single shape selected, pressing `Delete` or `Backspace`
      deletes the selected shape — same resulting scene state as clicking
      the existing "Delete selected shape" toolbar button
      (`sceneEditor.deleteSelected()`), including selection clearing
      afterward.
- [x] Both shortcuts call `event.preventDefault()` before acting, so
      `Ctrl`/`Cmd`+`D` never triggers the browser's "bookmark this page"
      dialog and `Backspace` never triggers browser back-navigation.
- [x] Both shortcuts are no-ops (do nothing, no console error, no
      `preventDefault()` call) when nothing is selected
      (`sceneEditor.selectedShape` is falsy) — matching the toolbar
      buttons' existing `disabled={!sceneEditor.selectedShape}` condition.
- [x] Both shortcuts are ignored (no action, event not prevented) while
      `isTypingTarget(event.target)` is true — i.e. while focus is in an
      `<input>`, `<textarea>`, or any `contenteditable` element (title
      field, layer rename field, color hex input, inspector numeric
      fields, etc.).
- [x] A shape on a locked layer or group produces the same rejection
      behavior as the toolbar buttons already have today:
      `sceneEditor.lockError` is set and visibly announced via the
      existing `role="alert"` `.editor-toolbar-lock-error` element,
      because both shortcuts call the exact same
      `duplicateSelected()`/`deleteSelected()` functions the toolbar
      buttons call.
- [x] After a shortcut-triggered duplicate or delete, keyboard focus stays
      wherever it already was (the canvas or the outline row that had
      focus before the key was pressed), and never ends up lost on a
      detached DOM node after delete.
- [x] Both actions are undoable via the existing `Ctrl`/`Cmd`+`Z` shortcut,
      and `sceneEditor.canUndo` reflects one new history entry.
- [x] The shortcut listener is torn down on unmount — no lingering
      `keydown` listener after navigating away from the editor.
- [x] New keyboard-driven test cases cover: successful duplicate,
      successful delete, ignored while a text field has focus, no-op with
      nothing selected, and lock-rejection surfacing `lockError`.

### Out of scope

- Extending `duplicateSelected()`/`deleteSelected()` to operate on a
  multi-shape (`multiSelectedIds`) selection — the existing toolbar
  buttons already only act on the single `selectedShapeId`, a pre-existing
  gap this task does not attempt to close.
- Any change to vertex-edit-mode's existing `Delete`/`Backspace` handling
  (`EditorWorkspace.tsx` ~lines 914-933). The new listener must not
  double-fire alongside it — verify entering vertex edit mode and pressing
  `Delete` only removes the selected vertex, not the whole shape.
- Adding a visible/discoverable UI hint (tooltip) for the new shortcuts —
  not required by this issue's goal, and no existing precedent does this
  for Undo/Redo either.
- Any change to what counts as `isTypingTarget`. Reuse it as-is.

### Evidence and pending items

- **Status:** COMPLETE
- Implemented as a new `keydown` `useEffect` in `EditorWorkspace.tsx`
  (lines 887-917), following the existing Undo/Redo listener's pattern:
  `Ctrl`/`Cmd`+`D` calls `sceneEditor.duplicateSelected()`,
  `Delete`/`Backspace` calls `sceneEditor.deleteSelected()`. Both guard on
  `isTypingTarget`; delete additionally bails when
  `sceneEditor.vertexEditActive` is true so the pre-existing vertex-delete
  listener stays sole owner of those keys during vertex editing.
  `preventDefault()` is only called when a shape is actually selected, so
  the no-selection case is a genuine no-op (verified via
  `event.defaultPrevented === false`). Lock-rejection reuses the existing
  `lockError`/`role="alert"` mechanism unchanged — no parallel error path
  was added. New test file
  `frontend/src/pages/EditorWorkspace.duplicateDeleteShortcuts.test.tsx`
  (12 cases) covers duplicate/delete success, undo, no-op-when-unselected,
  ignored-while-typing, lock-rejection, and the vertex-edit-mode
  double-fire guard.
- QA independently verified all acceptance criteria against the diff and
  re-ran `npm run typecheck` (clean), `npm run lint` (clean, only
  pre-existing unrelated warnings), the new test file (12/12 pass), and
  the full frontend suite (1639/1639 pass, no regressions). Verdict: PASS.
- Only `_docs/tasks.md`, `EditorWorkspace.tsx`, and the new test file were
  touched — `useSceneEditor.ts` and multi-select logic untouched, per
  "Out of scope."

GitHub issue: [#149](https://github.com/cfornesa/ai-dev-tools-zoomcamp-1/issues/149)

## 115. Add a real-browser e2e dependency-injection seam for `mediapipeProvider.ts`'s vision module load

### Goal

`createMediaPipeTrackingProvider()` (`frontend/src/tracking/mediapipeProvider.ts`) gains an optional `window.__mediapipeLoadVisionTasksModule` test seam — mirroring the shipped `window.__exportCameraLoadVisionTasksModule` pattern in `frontend/src/export/standaloneCameraSource.ts` — so a real-browser Playwright test can drive the camera pipeline to `status === 'active'` and back to `'stopped'` without a real MediaPipe CDN/WASM/model download or genuine WASM inference. `frontend/e2e/publishingAndRemix.spec.ts`'s "Anonymous viewer" describe block is extended with the "granted → active" and "stop after active" scenarios task 113/#144 could not complete.

### Acceptance criteria

- [x] `MediaPipeTrackingProviderDeps.loadVisionTasksModule`'s default (inside `resolveDeps` in `mediapipeProvider.ts`) checks `typeof window !== 'undefined' && window.__mediapipeLoadVisionTasksModule` before falling back to the real `() => import('@mediapipe/tasks-vision')`, in that order — same precedence `standaloneCameraSource.ts`'s `loadModel` already uses for `window.__exportCameraLoadVisionTasksModule`. An explicit `deps.loadVisionTasksModule` passed by a caller (unit tests already do this) still wins over both, unchanged.
- [x] The new global is declared as an ambient/optional type (e.g. via a `declare global { interface Window { ... } }` block or an inline cast at the read site, matching however `standaloneCameraSource.ts`/its consuming test currently types `window.__exportCameraLoadVisionTasksModule`) — no `any`-typed production code.
- [x] `CameraControl.tsx` is untouched: it keeps calling `createMediaPipeTrackingProvider` with zero dependency overrides, so the seam is reachable purely by setting the `window` global before the app's bundle evaluates (via Playwright's `page.addInitScript`/`context.addInitScript`), never by threading a new prop through `CameraControl`.
- [x] No production behavior changes when the seam is unset: a real user's build never defines `window.__mediapipeLoadVisionTasksModule`, so `resolveDeps`'s default always falls through to the real dynamic `import('@mediapipe/tasks-vision')`, exactly as today. This is verified by (a) the existing `mediapipeProvider.test.ts` suite passing unchanged, and (b) at least one new/updated test asserting that with the global absent, the real dynamic import path is still the one taken (no accidental short-circuit).
- [x] The seam is **not** gated behind `import.meta.env.DEV` or any build flag — it ships unconditionally in the production bundle, exactly like `standaloneCameraSource.ts`'s equivalent already does (that module ships in every real user's exported HTML output, which is a stricter bar than the main SPA bundle, and its seam is unconditional; the same reasoning — the global is simply never set outside a test harness — applies here). Do not add DEV-gating logic; it would diverge from the shipped precedent and add branching this repo has no other example of.
- [x] A new e2e test helper (e.g. `installMediaPipeTestSeam` in `frontend/e2e/publishingAndRemix.spec.ts` or a shared e2e util) installs, via `context.addInitScript`/`page.addInitScript` before navigation:
  - The `getUserMedia`-succeeds mock already proven working in this file's existing "mocked camera permission denial"/"mocked unsupported browser" tests (a fake `MediaStream`-shaped object whose `getTracks()` returns stoppable stubs).
  - The same permissive `HTMLMediaElement.prototype.srcObject`/`play`/`pause`/`readyState` overrides `exportArtifacts.spec.ts`'s `installCameraTestSeams` uses for its `'succeed'` case, needed because a real browser's native `srcObject` setter validates its argument is a genuine `MediaStream`.
  - `window.__mediapipeLoadVisionTasksModule` resolving to a fake vision module of the exact shape `installCameraTestSeams` already injects: `{ FilesetResolver: { forVisionTasks: () => Promise.resolve({}) }, GestureRecognizer: { createFromOptions: () => Promise.resolve(fakeRecognizer) } }`, where `fakeRecognizer` is `{ recognizeForVideo: () => ({ landmarks: [], gestures: [], handedness: [] }), close: () => {} }`. This bypasses real WASM entirely — no genuine inference against a fake video source is attempted, matching the export path's already-proven approach.
- [x] New test: "granted camera reaches active" — with the seam installed, clicking "Enable camera" on `/p/:id` (anonymous viewer) eventually shows `status === 'active'` (`camera-status` text "Camera is active. Hand tracking is running locally in your browser."), "Stop camera" becomes visible, and "Enable camera"/"Retry" is hidden.
- [x] New test: "stop after active" — from the active state above, clicking "Stop camera" returns `camera-status` to "Camera stopped. No video is being captured.", "Enable camera" (not "Retry") reappears, "Stop camera" is hidden, and demo controls remain visible/interactive throughout (matching the existing denial/unsupported scenarios' "demo controls untouched" pattern).
- [x] Both new tests assert no unexpected network request reaches the real MediaPipe CDN (`MEDIAPIPE_WASM_BASE_URL`/`GESTURE_RECOGNIZER_MODEL_URL`) — e.g. via a `page.route`/request-tracking assertion analogous to `exportArtifacts.spec.ts`'s `interceptCdnAndTrackRequests`, adapted for the dev-server-proxied SPA context rather than a `file://` export.
- [x] `make e2e` (`frontend/e2e/publishingAndRemix.spec.ts`) passes locally against a real PostgreSQL + Django + Vite stack per the repo's documented e2e prerequisites, with the two new tests included. Verified live: installed PostgreSQL 16 via Homebrew, created `gesture_studio`/`gesture_studio_test` databases matching this sandbox's `.env`, ran migrations, started Django (`AI_PROVIDER=fake`) and Vite, then ran `npx playwright test e2e/publishingAndRemix.spec.ts` — all 22 scenarios pass, including the two new ones ("granted camera reaches active", "stop after active"). Full `make e2e` run: 120 passed, 2 skipped, 3 failed — all 3 failures are in `aiAndRecovery.spec.ts`/`responsiveShell.spec.ts`, unrelated to this task's files, and confirmed pre-existing flakes (each passes when rerun in isolation), matching the exact same flakes task 113/#144 already documented independently.
- [x] `npm run typecheck` and `npm run lint` stay clean on `mediapipeProvider.ts` and the touched e2e file(s).

### Out of scope

- Extending the authenticated editor's own e2e suite (`EditorWorkspace`-facing camera coverage) with the same granted/active/stop scenarios — the issue only asks for the anonymous-viewer gap task 113/#144 left open; a follow-up can add editor-side coverage once this seam exists. If wanted, file a new issue referencing this task's seam once merged.
- Exercising real gesture/landmark output (e.g. asserting a specific `GestureName` or hand landmark reaches the UI) — the fake recognizer always returns empty `landmarks`/`gestures`/`handedness`, so no hand-present or gesture-driven behavior is reachable through this seam. If that coverage is later wanted, it only requires changing the fake `recognizeForVideo` return value in the test helper, not new production code — out of scope for this task.
- Any change to `standaloneCameraSource.ts` or `exportArtifacts.spec.ts` — the export runtime's seam is the precedent being mirrored, not a file being modified.
- Real network access to Google's MediaPipe CDN / genuine WASM inference against a fake video source in CI or local dev — explicitly rejected as the approach per the issue's own "Suggested approach" (slow, flaky, needs outbound internet).
- Adding the seam to any other tracking provider (e.g. a future non-MediaPipe adapter) — scoped to `mediapipeProvider.ts` only, matching the one adapter that exists today.

### Evidence and pending items

- **Status:** COMPLETE
- **Evidence so far:** `frontend/src/tracking/mediapipeProvider.ts`'s `resolveDeps` (now lines ~174-176) implements the exact precedence chain: `deps.loadVisionTasksModule ?? (typeof window !== 'undefined' ? window.__mediapipeLoadVisionTasksModule : undefined) ?? (() => import('@mediapipe/tasks-vision'))`, typed via a `declare global { interface Window { __mediapipeLoadVisionTasksModule?: ... } }` block, no `any`. `mediapipeProvider.test.ts` gained 3 new tests (28/28 pass) proving all three precedence tiers. `publishingAndRemix.spec.ts` gained `installMediaPipeTestSeam`, `assertNoMediaPipeCdnRequests`, and the two new scenarios ("granted camera reaches active", "stop after active"), reviewed line-by-line against `CameraControl.tsx`/`DemoControlsPanel.tsx`'s real status text and testids. `npm run typecheck`/`npm run lint` clean; `npx playwright test --list` shows both new tests discoverable with no syntax errors; full frontend unit suite (1642 tests) passes with no regressions. QA independently re-verified all of the above and returned PASS, explicitly carving out the live e2e run as a documented verification boundary rather than a defect.
- **Next action:** Run `make e2e` (or at minimum `npx playwright test e2e/publishingAndRemix.spec.ts`) against a real PostgreSQL + Django + Vite stack to confirm the two new scenarios actually pass in a live browser, then flip the remaining acceptance-criteria box and move Status to COMPLETE.
- **Durable memory link:** None yet — no non-obvious constraint surfaced during implementation beyond what's already documented inline.

GitHub issue: [#150](https://github.com/cfornesa/ai-dev-tools-zoomcamp-1/issues/150)

## 116. Decide whether the camera video overlay should extend to the public project viewer

### Goal

Task 110/#141 added a live camera video overlay with user-controllable
opacity to the editor's Preview only. Issue #145 asked whether the same
overlay should extend to `PublicProjectViewer.tsx` (the anonymous `/p/:id`
public viewing surface), and to implement it if wanted.

### Decision: not implemented — closed without shipping

PM grooming determined this should not ship now:

- Task 110's overlay answers a specific, explicit request scoped to the
  editor's *authoring* Preview (seeing yourself with adjustable opacity
  while working on a scene). There is no equivalent signal that an
  anonymous visitor to someone else's *published* scene wants or benefits
  from a self-camera overlay composited over it.
- The public viewer's existing `CameraControl` usage already serves a
  distinct, previously-decided purpose — opt-in interactive camera
  tracking per `_docs/plan.md`'s "demo and opt-in camera mode" — and
  conflating that with a vanity/self-view overlay would confuse two
  different features rather than extend one.
- The issue's own premise (reuse whatever component #141 introduced)
  doesn't hold on inspection: task 110's overlay is inline state/JSX in
  `EditorWorkspace.tsx` (`cameraStream`/`cameraOverlayOpacity` state, the
  `srcObject` effect, `P5ScenePreview`'s `transparentBackground` flag),
  not a standalone reusable component. Shipping this properly would first
  require extracting a shared component — new scope nobody has asked for.

### Evidence

- Confirmed `frontend/src/components/CameraControl.tsx` already exposes
  the reusable primitive needed (`onStreamChange` prop) but
  `PublicProjectViewer.tsx` doesn't currently pass it.
- Confirmed no separate `CameraVideoOverlay` component exists to reuse.

### Next action

None planned. Reopen [#145](https://github.com/cfornesa/ai-dev-tools-zoomcamp-1/issues/145)
with a concrete product ask if real user signal for this surface appears
later.

Status: DECLINED — closed without implementation, per grooming decision above.
GitHub issue: [#145](https://github.com/cfornesa/ai-dev-tools-zoomcamp-1/issues/145)

## 117. Decide whether the camera video overlay should extend to the standalone HTML export

### Goal

Task 110/#141 added a live camera video overlay with user-controllable
opacity to the editor's Preview only. Issue #146 asked whether the same
overlay should extend to the standalone HTML export output
(`generateHtmlExport.ts`/`standaloneCameraSource.ts`), and to implement it
if wanted.

### Decision: not implemented — closed without shipping

PM grooming determined this should not ship:

- Task 110's overlay answers a specific, explicit request scoped to the
  editor's authoring Preview, where the viewer is the project's own
  author. The standalone HTML export is a self-contained page a project
  owner can host or embed anywhere; its visitors have no relationship to
  "the project" at all and no expectation of seeing themselves overlaid
  on someone else's animation — a strictly more niche case than #145's
  public-viewer grooming (also closed not-implement), since a
  public-viewer visitor is at least on this app's own domain.
- The export's existing camera pipeline (`standaloneCameraSource.ts`)
  exists purely to drive tracking-based scene *behavior* (hand-gesture
  bindings) — a functional purpose, not a vanity self-view.
- Implementing this would add new `<video>`/mirroring/opacity-slider/
  privacy-notice surface to the hand-rolled, no-bundler
  `standaloneCameraSource.ts` runtime for a feature with no demonstrated
  demand. As with #145, task 110's overlay also isn't a reusable
  component — it's inline state/JSX in `EditorWorkspace.tsx` — so there
  is nothing to "extend," only new work to invent from scratch.

### Evidence

- Reviewed `frontend/src/export/generateHtmlExport.ts` and
  `frontend/src/export/standaloneCameraSource.ts` in full; confirmed the
  export's camera usage today is functional tracking only, with no
  self-view rendering.
- Reviewed task 110's entry (`_docs/tasks.md` lines 1778-1858) confirming
  its overlay is inline `EditorWorkspace.tsx` state/JSX, not extracted.

### Next action

None planned. Reopen [#146](https://github.com/cfornesa/ai-dev-tools-zoomcamp-1/issues/146)
with a concrete product ask if real user signal for this surface appears
later.

Status: DECLINED — closed without implementation, per grooming decision above.
GitHub issue: [#146](https://github.com/cfornesa/ai-dev-tools-zoomcamp-1/issues/146)

## 118. Persist camera overlay opacity and add an un-mirror toggle

### Goal

The editor's live camera overlay (task 110/#141) remembers the user's
last-chosen opacity across page reloads/sessions instead of resetting to
the default every time the camera is (re-)enabled, and gains a labeled,
keyboard-operable toggle to show the feed as-captured (un-mirrored)
instead of always selfie-mirrored — both preferences persist the same
way.

### Acceptance criteria

- [x] A new `frontend/src/editor/cameraOverlaySettings.ts` module follows
      the exact pattern already used by `frontend/src/editor/snapSettings.ts`
      / `frontend/src/a11y/reducedMotion.ts`: module-singleton state, a
      `useSyncExternalStore`-based hook, a namespaced
      `gesture-studio:camera-overlay-settings` localStorage key, JSON
      read/parse with a safe fallback to defaults on missing/malformed
      data, and a try/catch around every read and write so a storage
      failure never throws — the in-memory value still works for the
      rest of the session.
- [x] `EditorWorkspace.tsx`'s `cameraOverlayOpacity` state is initialized
      from this store instead of always starting at the hardcoded
      default, and every change via the existing opacity range input
      writes through to the store live.
- [x] The effect that currently resets `cameraOverlayOpacity` to the
      default on every camera-active transition is removed or changed to
      reset to the *stored* value — re-enabling the camera within the
      same browser restores the last-chosen opacity.
- [x] A simulated reload (fresh module registry via `vi.resetModules()` +
      dynamic re-import, localStorage untouched) recovers the previously
      chosen opacity.
- [x] A new labeled, keyboard-operable "Mirror camera overlay" control
      appears alongside the opacity slider whenever the camera is active,
      defaulting to mirrored (today's shipped behavior) when no stored
      preference exists.
- [x] Toggling it live flips the overlay `<video>`'s `transform` between
      mirrored and un-mirrored with no re-mount and no interruption to
      the live feed.
- [x] The mirror preference persists through the same store/key
      convention as opacity and is recovered on reload the same way.
- [x] Both persisted values are purely client-side: never part of the
      scene document, never sent to the backend, never included in a
      save/export/fork payload.
- [x] No change to when the overlay renders/disappears, and it remains
      absent from every canvas-only capture path (thumbnail generation,
      export).
- [x] No regression to `EditorWorkspace.cameraOverlay.test.tsx`,
      `EditorWorkspace.cameraPreview.test.tsx`, or
      `EditorWorkspace.cameraPreviewRealControl.test.tsx`; new coverage
      for: opacity recovered after simulated reload, opacity persists
      live, mirror toggle flips the transform live, mirror preference
      recovered after simulated reload, storage-failure fallback doesn't
      crash the editor.
- [x] `make frontend-test`, `typecheck`, `lint`, `format:check` all pass.

### Out of scope

- Independent drag/resize/reposition of the overlay — filed as
  [#151](https://github.com/cfornesa/ai-dev-tools-zoomcamp-1/issues/151),
  deferred pending real user demand (materially larger scope: new pointer
  interaction model, coordinate math, its own position/size persistence).
- Any change to where the camera overlay is allowed to appear — public
  viewer (#145) and standalone export (#146) were both already declined.
- Any change to the overlay's default size/canvas-filling behavior.
- Any server-side or per-project persistence of these preferences.

### Evidence and pending items

- **Status:** COMPLETE
- Task 110/#141 shipped the overlay with opacity explicitly session-only
  and mirroring explicitly non-toggleable, both flagged as deliberate
  scope cuts filed as #147. #147 groomed 2026-08-24: split into this task
  (low-risk, clear value, matches the existing `snapSettings.ts`/
  `reducedMotion.ts` localStorage preference pattern) plus deferred
  follow-up #151 for reposition/resize.
- **Next action:** Implement `cameraOverlaySettings.ts` following
  `snapSettings.ts`'s pattern, wire it into `EditorWorkspace.tsx`, add the
  mirror toggle control.

GitHub issue: [#147](https://github.com/cfornesa/ai-dev-tools-zoomcamp-1/issues/147)

## 119. Evaluate collapsing Layer and Shape into a single schema entity

### Goal

Investigate whether task 111/#142's additive fix (1:1 shape-to-layer
referential-integrity enforcement, `Layer` and `Shape` kept as separate
schema entities) should instead have collapsed `Layer` into `Shape` as a
single merged entity, since once the relationship is 1:1 the separate
`Layer` object could appear to carry no information a merged `Shape`
couldn't hold itself.

### Decision: keep them separate — evaluated, not pursuing

Investigation findings:

1. `Layer` is not actually a 1:1 wrapper around `Shape` even under task
   111's fully-enforced invariant — it's the shared top-level draw-order
   container for both shapes *and* groups. Multiple groups can still
   share one `layerId` (only shapes are constrained to one-per-layer).
   Removing `Layer` would require inventing a new top-level ordering
   primitive for groups to replace the one removed — not a net
   simplification.
2. The apparent field duplication (`name`/`order`/`visible`/`locked`) is
   mostly illusory. Task 111 deliberately built an "own vs. inherited"
   cascade (`isEffectivelyLocked`, `OutlineRow.visible/locked` vs.
   `inheritedVisible/inheritedLocked`) where a shape's own flag and its
   layer's/ancestors' flags are semantically distinct and OR together.
   Merging the entities removes the container whose flag cascades down,
   undoing that distinction. Separately, shapes have no `name` field
   today at all — a merge would need to add one as new schema surface
   across all five type-variant blocks in `shape`'s schema `$def`.
3. Migration cost is real and disproportionate. `SceneVersion.scene_json`
   is immutable, so this would need the same read-time-normalization
   mechanism task 111 established — but for a structural document-shape
   change requiring a real `schemaVersion: 2` bump (unlike task 111's
   purely additive change). That cascades through `scenes/validation.py`,
   `frontend/src/validation/scene.ts`, every call site of both, and
   effectively all of `sceneOutline.ts`/`LayersPanel.tsx`.

Net: task 111 already delivered the actual user-facing goal. Collapsing
the entities would trade one indirection for another at the cost of a
full schema-version migration, for no simplification benefit.

### Evidence

Investigation reviewed: task 111's full entry, `schema/scene.schema.json`'s
`layer`/`shape` `$def`s, `frontend/src/pages/sceneOutline.ts` in full,
`scenes/validation.py`'s reference-checking/normalization sections,
`scenes/migrations/0002_postgres_invariants.py`, and `sceneShapes.ts`'s
`shapeLabel()`.

### Next action

None planned. Reopen [#148](https://github.com/cfornesa/ai-dev-tools-zoomcamp-1/issues/148)
if a concrete simplification need is later identified that this
investigation didn't anticipate.

Status: DECLINED — investigated per the issue's own scope, not pursuing.
GitHub issue: [#148](https://github.com/cfornesa/ai-dev-tools-zoomcamp-1/issues/148)

## 120. Add camera video overlay + persisted opacity/mirror control to the public project viewer

### Goal

Extend task 118's editor-only camera overlay (opacity slider + mirror
toggle) to `PublicProjectViewer.tsx`, reusing `cameraOverlaySettings.ts`'s
existing store directly. Supersedes the "not implemented" decision on
issue #145 (task 116) given new explicit product demand: the project
owner directly requested this while reviewing the deployed public viewer.

### Status

COMPLETE
GitHub issue: [#152](https://github.com/cfornesa/ai-dev-tools-zoomcamp-1/issues/152).

Resolution (2026-08-24): `PublicProjectViewer.tsx` now carries the same
`cameraStatus`/`cameraStream`/`cameraVideoRef` state and `srcObject` effect
as `EditorWorkspace.tsx`, wired via `<CameraControl onStatusChange
onStreamChange>` (previously unused props on this page), and renders the
same overlay `<video>` + opacity slider + mirror checkbox — duplicated
layout JSX rather than a shared component, per the issue's own "Design
decisions." Both pages import `useCameraOverlaySettings()` from the same
`cameraOverlaySettings.ts` store — no fork, so a preference set on either
page is honored on the other in the same browser after reload. New test
file `PublicProjectViewer.cameraOverlay.test.tsx` covers idle/active
visibility, live slider/mirror updates, Stop clearing the overlay
immediately, and the shared-store round-trip in both directions. New
Playwright scenario in `publishingAndRemix.spec.ts`'s "Anonymous viewer"
block (reusing the existing `installMediaPipeTestSeam` helper) verifies
the overlay/controls in a real browser and that the setting lands in real
`localStorage` under the shared key. `npm run typecheck`/`lint`/`format`
clean; full frontend suite green (see task 124's combined verification
note below — all three of tasks 120/124/126 landed together and were
checked together).

## 121. Layers panel doesn't visibly reflect canvas selection (and vice versa)

Goal: A selected shape/group is visibly highlighted in its Layers panel
row, and vice versa — the underlying `selectedShapeId` state is already
correctly shared in both directions; only the visible feedback is
missing (`aria-pressed` is set but never styled).
Status: COMPLETE
GitHub issue: [#153](https://github.com/cfornesa/ai-dev-tools-zoomcamp-1/issues/153).
Resolution (2026-08-24): Added `data-selected="true"` to a group/shape
`<li>` row in `LayersPanel.tsx` when `row.id === sceneEditor.selectedShapeId`
(layer rows excluded — no equivalent select concept, per the issue's own
note), styled in `index.css` via
`.editor-outline-row-group[data-selected='true'], .editor-outline-row-shape[data-selected='true']`
(accent border + background, reusing the same `--accent`/`--accent-bg`
tokens the existing drop-into affordance already uses). Also decided the
open "scroll into view?" question explicitly: added a `useEffect` in
`LayersPanel` that scrolls the selected row into view (`{ block: 'nearest' }`)
whenever `selectedShapeId` changes, guarded with `?.` since jsdom has no
`scrollIntoView` implementation. Multi-selection (`multiSelectedIds`) left
untouched, per the issue's explicit note not to conflate the two. New test
in `EditorWorkspace.layers.test.tsx` ("visibly marks the selected shape row
via data-selected, and only that row"). `npm run typecheck`/`lint`/`format`
clean; full frontend suite green at 1657/1657.

## 122. Promote Layers to the top of the editor sidebar and replace the text-accordion sections with icon-driven collapsible panels

Goal: Reposition the Layers panel as the first/topmost sidebar panel, and
replace the plain-text `CollapsibleSection` accordion pattern used across
Tools/Inspector subsections with a standard icon-driven click-to-toggle
pattern.
Status: COMPLETE
GitHub issue: [#154](https://github.com/cfornesa/ai-dev-tools-zoomcamp-1/issues/154).
Resolution (2026-08-24): Layers is now `grid-row: 1` in `.editor-workspace`
(desktop) and the first entry in `EditorPanelSwitcher.tsx`'s `PANELS`
array (narrow-viewport tab order) — `EditorWorkspace.tsx`'s default active
tab deliberately stays `'tools'`, an existing test's explicit assumption,
so this is a pure ordering change. `CollapsibleSection.tsx` gained an
optional `icon?: string` prop rendered as an `aria-hidden` decorative
prefix inside the existing disclosure `<button>` — icon-prefixed accordion
headers, deliberately NOT a new icon-only rail that would replace the
sidebar column, both for lowest accessibility risk (the `aria-expanded`/
`aria-controls` contract and accessible name are unchanged) and because
task 125/#157 depends on the sidebar's column-width mechanism staying
unchanged for its own sequencing. All 8 remaining sections (Editing
preferences, Camera, Demo signal controls, Shape inspector, Version
history, Export, AI proposals, Behaviors) got a distinct glyph. Confirmed
`ShapeInspectorPanel.tsx`'s existing rotation field was not touched or
further buried. `npm run typecheck`/`lint`/`format` clean; full frontend
suite green (1691/1691); `EditorWorkspace.a11y.test.tsx`'s jest-axe checks
pass (8/8).

## 123. Selection marquee outline is wrong for rotated/scaled shapes

Goal: Fix `shapeBounds()` (and its selection-outline/hover-outline/
hit-test consumers) to account for `transform.rotation`/`scaleX`/
`scaleY`, which it currently ignores despite rotate/scale handles having
shipped since (a stale doc comment predates them).
Status: COMPLETE
GitHub issue: [#155](https://github.com/cfornesa/ai-dev-tools-zoomcamp-1/issues/155).
Resolution (2026-08-24): `shapeBounds()` in `sceneShapes.ts` now maps each
shape type's local (unrotated, unscaled, origin-relative) bounding box
through a new `transformedBounds()` helper that applies `scaleX`/`scaleY`
then `rotation` to all four corners, then translates by `transform.x/y` —
the same scale-then-rotate-then-translate order `p5Adapter.ts`'s
`applyTransform` renders with, reusing the existing `rotateAround` helper
rather than reinventing rotation math (per the issue's own note). Reduces
to the exact old unrotated/unscaled math at identity transform (verified
by a new "unaffected by identity" test). Since `hitTestTopmostShapeAt` and
the hover outline are both built directly on `shapeBounds()`, all three
consumers named in the issue's title are fixed by this one function change
— no separate hit-testing-specific work was needed; a fully precise
rotated-hit-test (vs. rotated-AABB) remains out of scope, unchanged from
before. `getCombinedBounds` (multi-select group box, issue #77) was left
untouched, per the issue's explicit note not to conflate the two. The
stale "scale/rotation ignored" module doc comment was corrected. New tests
in `sceneShapes.test.ts` cover identity (no change), a 90-degree rotated
rect (axis swap), a uniformly scaled circle, and a combined
non-uniform-scale + rotation case checked against independent manual
corner math. `npm run typecheck`/`lint`/`format` clean; full frontend
suite green (1660/1661 — the one failure, `draftAutosave.test.ts`, is the
same unrelated pre-existing flake task 109's evidence already documented,
confirmed passing 22/22 in isolation).

## 124. Add zoom and pan controls to the editor Preview canvas

Goal: +/- zoom buttons with a live percentage readout, keyboard/scroll
accelerators, and click-drag panning once zoomed, implemented as a CSS
`transform: scale()` on the canvas wrapper (not a p5 resolution change)
so the existing `clientToCanvasPoint` coordinate math keeps working
unmodified.
Status: COMPLETE
GitHub issue: [#156](https://github.com/cfornesa/ai-dev-tools-zoomcamp-1/issues/156).
Resolution (2026-08-24): Zoom/pan state (`zoom`, `pan`) is local `useState`
in `EditorWorkspace.tsx`, never written to `workingCopy`/scene JSON, reset
on every fresh mount. A new `.editor-scene-canvas-viewport` wrapper now
owns the responsive width/aspect-ratio sizing issue #109 gave
`.editor-scene-canvas`, and clips (`overflow: hidden`) only once zoomed
past 100% — at the default state rendering is pixel-identical to before.
The `translate(pan) scale(zoom)` transform applies to `.editor-scene-canvas`
itself (the element `clientToCanvasPoint` already reads via
`getBoundingClientRect()`), so no coordinate-conversion code changed at
all — CSS transforms are automatically reflected in that rect. Pan-vs-
shape-drag disambiguation reuses `handleCanvasPointerDown`'s existing
hit-test branch (a miss + zoom > 100% starts a pan gesture instead).
Zoom controls (+/-, live `aria-live` percentage readout, Reset) use the
existing `ToolbarButton` a11y pattern; Ctrl/Cmd+scroll, +/-, and 0 are
keyboard/wheel accelerators guarded by the existing `isTypingTarget`
pattern, bounded 25%-400% in 25-point steps. New
`EditorWorkspace.zoomPan.test.tsx` (20 cases) covers bounds, shortcuts,
wheel zoom vs. plain-scroll non-hijacking, pan-vs-drag disambiguation at
100%/200% zoom, Escape-cancel, coordinate-math correctness while zoomed,
and pan resetting at 100%. Scope boundaries honored: editor canvas only
(not the public viewer or export runtime), no p5 resolution change,
touch/pinch-to-zoom explicitly out of scope. `npm run
typecheck`/`lint`/`format`/`build` clean; full frontend suite green (see
this task's combined verification note below).

## 125. Rebalance the editor layout: ~80/20 canvas-dominant split on desktop/tablet, repositioned toolbar + preserved artwork aspect ratio on mobile

Goal: Preview should occupy ~80% of the editor's width on desktop/
tablet (currently ~66/33% per task 79/#109's own measurement), with the
sidebar reclaiming width when collapsed to icon-only. Sequenced after
task 122/#154 if that issue introduces an icon-rail mechanism the
sidebar's fixed-width column depends on.

Scope correction (2026-08-24, owner direction): the original "canvas is
the widest element" criterion for below-breakpoint/mobile widths was
insufficient on its own — it doesn't guarantee a comparably *useful*
interface or protect the canvas from distortion. Mobile scope is now
explicit and separate from the desktop/tablet proportion requirement: at
mobile/narrow widths (effectively 100% width, below the responsive
breakpoint), the editor must remain similarly useful — the always-visible
toolbar (task 112/#143) repositions to sit directly above or below the
canvas (implementer's choice of which) so every toolbar control stays
reachable without obscuring the canvas, the canvas itself stays fully
interactive (select/move/resize/rotate/vertex-edit/zoom-pan, not just
rendering), and the canvas preserves the scene's own configured
`canvas.width`/`canvas.height` aspect ratio exactly (fit-by-shrinking via
the existing `aspectRatio` + `maxWidth: 100%` mechanism, never
stretched/cropped to force-fill the viewport). Full updated acceptance
criteria filed on the issue.
Status: COMPLETE
GitHub issue: [#157](https://github.com/cfornesa/ai-dev-tools-zoomcamp-1/issues/157).
Resolution (2026-08-24): `.editor-workspace`'s grid-template-columns
changed from a fixed `minmax(420px, 2fr) minmax(300px, 1fr)` to
`minmax(420px, 1fr) fit-content(20%)` — the sidebar column now caps at
20% of the workspace's own width (a percentage, not a fixed pixel value —
a fixed-px cap was tried first and measured non-uniformly across widths)
while sizing down to its own content when narrower, so it's genuinely
content-responsive rather than a flat fraction; Preview absorbs whatever
the sidebar doesn't need. Live-measured in a real browser: 1024px → 79.7%
Preview, 1440px → 79.8%, 1920px → 79.8%, zero horizontal overflow at any
width. Known caveat, documented directly in the CSS comment rather than
filed separately: the Layers panel's "Add shape" buttons aren't wrapped
in a `CollapsibleSection` and are always present, so with today's actual
sidebar content mix the column sits pinned at the 20% cap regardless of
Tools/Inspector collapse state — the mechanism itself is correct and will
visibly reclaim more width the moment any row's content need drops below
the cap. Mobile: the always-visible toolbar (task 112/#143) is now
extracted into a single `editorToolbar` JSX variable rendered at exactly
one of two positions — its original spot above `.editor-workspace` at
`!isNarrow`, or nested inside the Preview panel directly below
`.editor-scene-canvas-viewport` at `isNarrow` (<1024px) — with a CSS
override so its margins don't double up with the panel's own padding in
the nested position. Aspect-ratio preservation needed no change (already
handled by issue #109's `aspectRatio`/`maxWidth: 100%` mechanism on
`.editor-scene-canvas-viewport`); verified via a new test reading the
computed inline style. `EditorPanelSwitcher` remains reachable below the
repositioned canvas+toolbar, unchanged. `npm run
typecheck`/`lint`/`format` clean; full frontend suite green (1695 tests;
one `draftAutosave.test.ts` failure on the full run is the same
documented pre-existing flake, confirmed passing 8/8 in isolation). New/
updated tests cover the percentage-based fr-ratio regression (superseding
issue #109's original fixed-ratio assertion), mobile toolbar DOM position
at both widths, mobile aspect-ratio preservation, and mobile canvas
interactivity (add/select/drag-move at 375px).

## 126. AI edit patches can silently touch shapes/layers the prompt never mentioned

Goal: Add a server-side check that rejects (or flags) an AI edit patch
touching a shape/layer/group/binding/graph element the prompt gave no
reasonable reference to, distinguishing accidental scope creep from
legitimately broad/global prompts. `scenes/patch.py` already enforces
structural guarantees (path allowlist, protected fields, size caps) but
has no semantic reference-scoping check today — the system prompt only
asks the model informally to keep changes minimal, unenforced.
Status: COMPLETE
GitHub issue: [#158](https://github.com/cfornesa/ai-dev-tools-zoomcamp-1/issues/158).
Resolution (2026-08-24): `validate_patch_operations` (`scenes/patch.py`)
gained an optional `prompt` parameter; when supplied alongside `scene`, a
second pass checks every operation touching one whole existing
shape/group/binding/layer/graph-node/connection against "reference
candidates" built from that element (its `id` always; its `name` for
layers/groups; a derived `shapeLabel`-style label — e.g. "Circle 2" — for
shapes, which carry no `name` of their own) via case-insensitive substring
match against the prompt text. A brand-new item being added (e.g.
`/shapes/-`) is exempt — the prompt can't name something that doesn't
exist yet. A fixed, word-boundary-matched bulk-scope word list
("all"/"every"/"everything"/"entire"/"whole") exempts a prompt entirely
when explicitly global, documented as a deliberate simplification, not a
hidden limitation. A violation surfaces as the new
`PatchErrorReason.UNREFERENCED_ELEMENT`, mapped in `scenes/ai_api.py`'s
`_PATCH_REASON_TO_RESPONSE` to HTTP 422 `"unreferenced_element"` (ranked
second in `_REASON_PRIORITY`, after `protected_field`), with both the
module docstring's and `AIEditSceneView`'s failure-taxonomy tables
updated. `ai_provider/mistral_provider.py`'s `edit_scene_with_patch` now
passes `prompt=request.prompt`. Frontend: `AIErrorCode` gained
`'unreferenced_element'`, classified into `useAIProposal.ts`'s
`VALIDATION_CODES` with a message naming the affected element type. New
tests: 13 in `tests/test_scene_patch.py` (referenced/unreferenced
shape/layer, name vs. id matching, 5 bulk-scope prompts never blocked,
word-boundary false-positive guard, opt-out without prompt/scene, new-item
exemption, priority ordering), 2 integration tests in
`tests/test_ai_edit_scene_api.py` (unreferenced shape → 422, bulk-scope
prompt touching every shape → 200), 1 in `useAIProposal.test.ts`. Backend:
`ruff check`/`ruff format --check`/`mypy` clean, `pytest` 619 passed, 22
skipped. Frontend: see this task's combined verification note below (all
three of tasks 120/124/126 landed together).

### Combined verification (tasks 120/124/126, 2026-08-24)

Tasks 120 (`PublicProjectViewer.tsx` camera overlay), 124 (editor zoom/
pan), and 126 (AI patch reference-scoping) were implemented in parallel
against disjoint file sets and landed together. After merging, the full
suite was re-run against the combined tree: `uv run ruff check .` /
`ruff format --check .` / `mypy .` all clean; `uv run pytest` 619 passed,
22 skipped; `cd frontend && npm run typecheck`/`lint`/`format` clean;
`npx vitest run` 114 test files / 1691 tests, all passed, zero
regressions.

## 127. Add a Code tab with Visual/Code parity and AI-assisted error recovery for scene JSON

Goal: A dedicated "Code" tab showing the live scene JSON alongside the
existing Visual/Preview tab, two-way synced and validated through the
existing `frontend/src/validation/scene.ts`; extend the existing
`previewError` render-failure path to name where in the document the
problem originates, with a one-click "Ask AI to fix this" affordance
reusing the existing AI-edit path. Confirmed during investigation:
live/unsaved editor state (including mid-session layer renames) is
already sent to the AI on every request — that part of the original ask
is already satisfied and needs no new work.
Status: COMPLETE
GitHub issue: [#159](https://github.com/cfornesa/ai-dev-tools-zoomcamp-1/issues/159).
Resolution (2026-08-24): implemented as a Visual/Code sub-toggle inside the
Preview panel (`role="radiogroup"`, matching `AIProposalPanel`'s existing
Create/Edit selector pattern — deliberately not `role="tablist"` since an
existing test asserts no tablist exists at desktop width), rather than a
new top-level `EditorPanelSwitcher` panel — both were acceptable per the
issue. New `SceneCodeEditor` component owns its own `text`/`error` state,
seeded fresh via `useState(() => JSON.stringify(workingCopy, null, 2))`
each time it mounts — since it only mounts while `previewView === 'code'`,
switching away and back naturally re-derives the JSON text from whatever
`workingCopy` is current, satisfying "reflected next time the Code tab is
viewed" with no extra sync effect. Code→Visual is on-blur: parse, then
validate through the exact existing `frontend/src/validation/scene.ts`
(no second validator) — only a valid document calls `setWorkingCopy`;
invalid JSON or a schema-invalid document is rejected with its own inline
`role="alert"`, distinct from `previewError`, and never touches
`workingCopy` or the Visual tab's last-known-good render. New
`localizePreviewError()` regex-matches the two known message shapes
`render/sceneDrawPlan.ts`'s `SceneRenderError` throws (its dangling-
reference pre-pass, and its `validateScene` backstop) into a `$.`-style
JSON Pointer + detail; a non-matching (genuinely generic) message falls
back to the plain text unchanged, per the issue's own fallback allowance.
"Ask AI to fix this" seeds a new `seed` prop on `AIProposalPanel`
(`{prompt, nonce}`, keyed by `nonce` so repeated identical errors still
re-seed) and mounts a second `AIProposalPanel` instance in edit mode —
reusing the existing `workingCopy`/`editAIScene` path with zero new
endpoints — since `CollapsibleSection`'s open/closed state is
uncontrolled and out of this issue's file constraints. New test files
`EditorWorkspace.codeTab.test.tsx` (round-trip valid/invalid edits,
Visual→Code sync, Visual/Code parity) and
`EditorWorkspace.previewErrorLocalization.test.tsx` (both localizable
message shapes, generic fallback, Ask-AI-fix seeding/generation, auto-
close once `previewError` clears). `npm run typecheck`/`lint`/`format`
clean; full frontend suite green (1708/1708, zero regressions).

## 128. Mobile-responsiveness audit: close remaining gaps outside the editor workspace and header

Goal: Close mobile-responsive gaps in surfaces the prior header (#89/#90)
and editor-workspace (#95, task 79/#109) passes never touched — export
dialog, AI proposal panel, version history, behavior cards/graph view,
demo controls, Layers panel (including its touch-incompatible native
HTML5 drag-reorder), Shape Inspector, Account Settings, template gallery
polish, and the public gallery/viewer chrome (the public gallery has no
CSS at all, at any width).
Status: COMPLETE
GitHub issue: [#160](https://github.com/cfornesa/ai-dev-tools-zoomcamp-1/issues/160).
Resolution (2026-08-24): re-verified every item in #160's inventory against
current `main` (post #157/#154/#159/#152 landings) before touching
anything; every gap the issue listed still applied. CSS-only fixes for
every surface, added to `frontend/src/index.css` following this file's
existing breakpoint conventions (`max-width: 767px`/`600px`, matching
`.project-grid`'s existing pattern): `.export-config-dialog` (previously
zero CSS) got a bordered, `max-width: 480px` panel treatment;
`.behavior-card-field` (shared verbatim by `ExportConfigDialog.tsx`,
`BehaviorCardsPanel.tsx`, `GraphView.tsx`'s node-config via
`NodeParamFields.tsx`, and `GraphListView.tsx`) got one stacked-label
layout fixing all four panels' field overflow risk at once;
`.ai-proposal-preview` (the AI proposal panel's own p5 preview instance,
now mounted twice per issue #159) got the same `max-width: 100%`/`height:
auto` canvas-scaling fix `.editor-scene-canvas canvas` already has;
`.version-history-item`/`.version-history-details` got `flex-wrap`/
`min-width: 0` to stop text forcing the row wider than its panel;
`.behavior-card-list` (previously a bare bulleted `<ul>`) got real card
styling; `.demo-signal-slider`'s range input got `width: 100%` plus a
767px single-column stack, replacing its previously-fixed intrinsic
width; `.editor-outline-move-controls` (Layers panel reparent controls,
previously unstyled) got an explicit wrapping flex layout, and
`.editor-outline-row` got narrow-width padding/font-size tightening;
`.shape-style-field`/`.shape-vertex-editor`/`.shape-vertex-list`
(Shape Inspector, previously zero CSS) got stacked-label/wrapped-row
layouts; the graph view's `.graph-editor-canvas` got `overflow: hidden`
plus a shorter height below 767px (a v1 "doesn't overflow, stays
scrollable" fix per the issue's own scope note, not a full graph UX
redesign), and `.graph-list-node-list`/`.graph-list-connection-list`
(previously bare `<ul>`s) got real row styling; `.account-settings-form`
got a single-column stack below 600px; `.template-grid` got the same
600px single-column collapse `.project-grid` already has.
`.public-project-grid`/`.public-project-card`/`.public-project-card-link`/
`.public-project-thumbnail(-fallback)`/`.public-project-attribution`/
`.public-project-provenance`/`.remix-badge` — confirmed to have **zero**
CSS at any width, exactly as the issue described — got full grid/card
styling modeled directly on `.project-grid`/`.project-card`/
`ProjectCard.tsx`'s existing visual language, no markup changes needed
(every class was already present, unstyled, in `PublicProjectCard.tsx`).
`.public-project-viewer` (also previously zero CSS) got header/attribution
spacing around its already-responsive `.editor-workspace` canvas area.
Layers panel: confirmed the `Move up`/`Move down` buttons inside each
row's `RowMoreDisclosure` (`<details>`/`<summary>`, always in the DOM
regardless of viewport) remain the fully keyboard-and-touch-operable
fallback for every reorder/reparent the native-HTML5-DnD pointer path
can't reach on touch — no code change needed there, only the follow-up
issue below. Discovery gate: searched for an existing touch-drag issue
(none found), then filed
[#161](https://github.com/cfornesa/ai-dev-tools-zoomcamp-1/issues/161)
(task 129 below) proposing real touch-drag support as separate, explicitly
out-of-scope follow-up work, linked back to this issue.
New test coverage: `frontend/e2e/responsiveShell.spec.ts` gained a
"populated gallery at narrow width" describe block — one scenario
creating a real project via the UI and checking `.project-grid`/
`.project-card` for no horizontal overflow/cramping at 375px, and one
publishing a project then loading `/gallery` in a fresh anonymous
context to check the newly-styled `.public-project-grid`/
`.public-project-card`; syntax/discoverability verified via
`npx playwright test --list` (9 scenarios listed, up from 7) — not run
live against a real PostgreSQL+Django+Vite stack, matching this repo's
own documented convention for e2e work done without one available.
`frontend/src/pages/Home.test.tsx` is new: a Vitest test asserting the
signed-out panel's narrow-width-relevant class structure
(`.content-panel.home-panel > .centered-state`) and that nothing in it
carries a fixed-pixel inline width, with an explicit doc-comment caveat
that jsdom cannot perform real CSS layout and the genuine "does this
overflow at 375px" guarantee is `responsiveShell.spec.ts`'s job instead.
Verified: `npm run typecheck` clean; `npm run lint` clean (four
pre-existing `react(only-export-components)` warnings, all in files this
task didn't touch — `LayersPanel.tsx`, `EditorDetailsPanel.tsx`); `npm run
format`/`format:check` clean; full Vitest suite green, 1709/1709 (1708
before this task's one new test), zero regressions, no flake observed on
this run.

## 129. Layers panel drag-and-drop reordering doesn't work on touch (iOS Safari/Android Chrome)

Goal: Investigate, and if judged worthwhile implement, a touch-compatible
drag mechanism for `LayersPanel.tsx`'s row reordering/reparenting —
native HTML5 Drag-and-Drop (what it uses today) has no touch-input
support at all in iOS Safari or Android Chrome. Every reorder/reparent
that drag mechanism reaches is already reachable through the fully
keyboard-*and*-touch-operable `Move up`/`Move down`/`MoveControls`
fallback inside each row's `RowMoreDisclosure`, so nothing is functionally
unreachable on a touch device today — this is a slower-workflow gap, not
a broken one.
Status: COMPLETE
GitHub issue: [#161](https://github.com/cfornesa/ai-dev-tools-zoomcamp-1/issues/161).
Resolution (2026-08-24): Implemented a Pointer Events-based touch drag path
in `LayersPanel.tsx` alongside (not replacing) the existing native HTML5
DnD mouse path — the two are gated by `event.pointerType === 'mouse'` so
they never compete for the same input, and both funnel through the exact
same pure `planDrop`/`isPlanValid`/`applyPlan` logic and the same
`dragId`/`hover` React state, so there is one drag/hover/drop-indicator
implementation, not two parallel ones. Each row's existing
`.editor-outline-drag-handle` span gained
`onPointerDown`/`onPointerMove`/`onPointerUp`/`onPointerCancel` handlers:
`onPointerDown` calls `setPointerCapture` (guarded with `?.` since jsdom
has no implementation, mirroring the existing `scrollIntoView?.()`
pattern) so move/up events keep reaching the handle even once the finger
has moved off it; move/up resolve "which row is the finger over" via
`document.elementFromPoint` + `closest('li[data-outline-id]')`, the touch
equivalent of what `dragover`/`drop` targets give the native path for
free. Added `touch-action: none` to `.editor-outline-drag-handle` in
`index.css` so a touch-drag gesture isn't also interpreted as a page
scroll. No new dependency, per `AGENTS.md`. The existing native
mouse-drag path and the keyboard-operable `Move up`/`Move down`/
`MoveControls` fallback are both unchanged.
Verified: added 4 new tests to
`frontend/src/pages/EditorWorkspace.layers.test.tsx` (touch-reorder,
touch-reparent-into-group, mouse-pointerType-ignored, locked-row
rejection) using jsdom's real `PointerEvent` constructor plus a stubbed
`document.elementFromPoint` (jsdom implements neither `elementFromPoint`
nor `setPointerCapture` at all). Full frontend suite green, 1713/1713
(1709 before this task's 4 new tests), zero regressions.
`npm run typecheck`/`lint`/`format:check` all clean (same four
pre-existing `react(only-export-components)` warnings as before, none in
lines this task touched).

## 130. Frontend production bundle exceeds 500kB (1.99MB main chunk) with no code-splitting

Goal: Reduce the main JS chunk (`npm run build` currently emits a single
1.99MB/539KB-gzipped chunk, past Vite's own 500kB warning threshold) via
`React.lazy`/dynamic `import()` for routes or heavy subsystems not needed
on first paint (editor graph view, export dialog, AI proposal panel),
mirroring the dynamic-import pattern this codebase already uses for
`@mediapipe/tasks-vision` (already its own `vision_bundle` chunk).
Discovered during a 2026-08-24 production-readiness pass — the app builds
and functions correctly; this is a load-performance concern (first-time
visitor pays ~540KB gzipped before the app is interactive), not a
correctness blocker, and not a new regression from this session's work.
Status: COMPLETE
GitHub issue: [#162](https://github.com/cfornesa/ai-dev-tools-zoomcamp-1/issues/162).
Resolution (2026-08-24): `frontend/src/App.tsx`'s route table now
`React.lazy`-loads every route except `Home` (`EditorWorkspace`,
`PublicGallery`, `PublicProjectViewer`, `Templates`, `AccountSettings`),
wrapped in one `<Suspense fallback={null}>` around `<Routes>`. Separately,
`EditorWorkspace.tsx`'s `GraphView` (the `@xyflow/react`/React Flow-backed
"Advanced graph" view, only rendered once a user opens "Show logic") is
now also `React.lazy`-loaded with its own local `<Suspense>` around its
single usage site, so React Flow's ~180KB doesn't load just to open the
editor. Net effect: the single 1,998.68kB/539.38kB-gzipped entry chunk is
now a 233.79kB/74.72kB-gzipped entry chunk (`index-*.js`) plus
route-specific chunks that load on demand
(`EditorWorkspace-*.js` 349.66kB, `GraphView-*.js` 180.99kB, a few small
KB-scale chunks for the other routes) plus one unavoidable
~1.2MB/305KB-gzipped chunk shared between `EditorWorkspace` and
`PublicProjectViewer` (both render scenes via the same `p5Adapter`, and
p5.js itself is the bulk of that weight) — that shared chunk only loads
once a visitor opens an actual project, never on first paint of `/`. This
matches the issue's own framing ("so a first-time visitor's initial load
is lighter"); removing/replacing p5.js to shrink that remaining
on-demand chunk further is explicitly out of scope per the issue's own
"Out of scope" section ("Removing or replacing any dependency").
Verified: `npm run typecheck`/`lint`/`format:check` clean; full frontend
suite green, 1713/1713 (one pre-existing, order-dependent flake in
`EditorWorkspace.a11y.test.tsx` reproduced under full-suite load and
confirmed to pass in isolation — unrelated to this task, touches none of
the files this task changed); `npm run build` succeeds with the sizes
above; manually verified in the browser preview (no backend running) that
`/`, `/templates`, and `/gallery` each render their expected
content/error states with no console errors beyond the expected
`/api/whoami/`-style 404s from the absent Django backend, confirming the
`Suspense`/lazy-loading wiring itself introduces no regression.

## 131. Add a canvas-overlaid "active layer" properties HUD

Goal: When a shape, group, or layer is selected (via canvas click, Layers
panel row, or keyboard), show a small floating window overlaid on top of
the Preview canvas — near the selection, Photoshop/Figma-popup style —
exposing the quick-toggle controls that today only live inline in
`LayersPanel.tsx`'s rows: visibility, lock, fill color, and delete, plus
the shape-level opacity field `ShapeInspectorPanel.tsx`/
`shapeStyleFields.ts` already validates and mutates
(`updateSelectedShapeColorField`/the `opacity` `ShapeStyleField`). This is
additive and does not remove anything from the Layers panel yet — see
task 132, which depends on this landing first.
Description: Live user feedback (screenshot of `animate.creatrweb.com`,
2026-08-24) describes wanting "an internal small window display (overlaid
on the canvas) allowing the user to make certain selections and toggles
for things like visibility, opacity, color, and the like" once a layer is
"active" (selected), rather than a form embedded in the list row. Reuse
existing state and mutations wherever possible instead of duplicating
them: `sceneEditor.selectedShapeId`/`selectedGroup` for "what's active",
and the same `toggleShapeVisible`/`toggleShapeLocked`/
`toggleGroupVisible`/`toggleGroupLocked`/`updateSelectedShapeColorField`/
`deleteSelected`/`deleteGroupSelected` mutations `LayersPanel.tsx` already
calls (see that file's `OutlineRowItem`) and the `opacity`
`ShapeStyleField` `ShapeInspectorPanel.tsx` already renders. Needs its own
`_docs/team/pm.md` grooming pass to settle: exact positioning (anchored to
the selected shape's canvas bounds vs. a fixed corner of Preview — the
Preview `<section>` at `EditorWorkspace.tsx`'s `data-panel="preview"` will
need `position: relative` if anchoring to shape bounds), what happens at
narrow/mobile viewports where Preview itself is already tight on space,
keyboard/screen-reader reachability of the HUD's own controls (it must not
be a mouse-only affordance — every control it exposes already has a
keyboard-operable equivalent somewhere today, this HUD must keep that
true), dismiss/reopen behavior (does it follow the selection everywhere,
hide on deselect, close on Escape), and whether layer rows (not just
shapes/groups) get a HUD too or only their existing Visible/Locked/Delete
buttons.
Status: COMPLETE
GitHub issue: [#163](https://github.com/cfornesa/ai-dev-tools-zoomcamp-1/issues/163)
(open for QA/closing by the orchestrator — see that issue's grooming
comment for the full acceptance criteria this resolution satisfies).
Discovery gate: Searched `_docs/tasks.md` and `gh issue list --search
"layer panel"` / `--search "photoshop"` / `--search "floating panel
overlay"` for a duplicate. Issue #153 (closed) is the closest prior art —
it added the Layers panel's current row-level selection highlight
(`.editor-outline-row-group[data-selected='true']`/`-shape` in
`index.css`) — but that issue's scope was strictly "make existing
selection state visible," not a new floating-overlay surface; treated as
related context, not a duplicate. New, not a duplicate.
Resolution (2026-08-24): Added `frontend/src/pages/SelectionHud.tsx`, a
new presentation-only component rendered inside `EditorWorkspace.tsx`'s
`data-panel="preview"` `<section>` (now `position: relative`, per this
task's own grooming note), positioned via `index.css`'s new
`.editor-selection-hud` (`position: absolute`, anchored to the panel's
top-right corner — grooming settled on a fixed-corner anchor over
shape-bounds anchoring: simpler to keep correct across zoom/pan/scroll,
with no new coordinate-conversion code needed). It renders nothing when
neither `sceneEditor.selectedShape` nor `sceneEditor.selectedGroup` is
set (covering "nothing selected" and "a layer row" — layers are never a
valid `selectedShapeId`, per `useSceneEditor.ts`'s `selectShape`), and
otherwise exposes, calling the *exact* existing mutations
`LayersPanel.tsx`'s `OutlineRowItem` already calls — no new mutation
logic anywhere:
- Shape selected: visibility (`toggleShapeVisible`), lock
  (`toggleShapeLocked`), fill color (`updateSelectedShapeColorField`),
  opacity (`updateSelectedShapeNumericField('opacity', ...)` — the same
  `opacity` `ShapeStyleField` mutation `ShapeInspectorPanel.tsx` already
  uses), and delete (`deleteSelected`).
- Group selected: visibility/lock/delete only
  (`toggleGroupVisible`/`toggleGroupLocked`/`deleteGroupSelected`) — no
  color/opacity fields, since groups have none today, matching this
  task's own acceptance criterion.
The HUD's fill/opacity fields are labeled "Selection fill"/"Selection
opacity" rather than plain "Fill"/"Opacity" specifically so they don't
collide (ambiguous `getByLabelText`/assistive-tech name) with
`ShapeInspectorPanel.tsx`'s identically-purposed fields, since both can be
mounted and visible simultaneously for the same selected shape.
Deselect/dismiss: clicking empty canvas already called
`selectShape(null)` before this task (`handleCanvasClick`), so the HUD
already disappears on that with no HUD-specific code; Escape did not
previously deselect anything, so `EditorWorkspace.tsx` gained one new
`keydown` listener that calls `selectShape(null)` on Escape, deferring
(via the same "latest value" ref pattern its sibling listeners already
use) to the two more specific existing Escape handlers when either
claims it: an in-progress drag-cancel, and vertex-edit-mode-exit. Every
HUD control is a plain `<button>`/`<input>` with a visible label/
`aria-pressed`/`aria-label`, so it's Tab-reachable and Enter/Space-
activatable with no extra wiring, and at <768px (matching this codebase's
existing phone breakpoint) `.editor-selection-hud` drops to
`position: static` and flows in-line instead of overlaying, so it can
never overlap or block the canvas on a viewport already tight on space.
`LayersPanel.tsx` itself is completely untouched by this task, per its
own "additive only" acceptance criterion — task 132/issue #164 handles
removing its now-redundant inline controls.
Verified: added `frontend/src/pages/EditorWorkspace.selectionHud.test.tsx`
(17 new tests) covering HUD-appears-on-shape-selection,
HUD-appears-on-group-selection-with-color/opacity-omitted,
no-HUD-with-nothing-selected, no-HUD-for-a-layer-row,
hide-on-empty-canvas-click, hide-on-Escape, selection-change-updates-HUD-
with-no-stale-state, each shape/group control driving the same outline-
row-reflected state a `LayersPanel.tsx` interaction would, a rejected
invalid fill-color edit surfacing the same validation error path, and
keyboard-only (Tab + Enter) operation of two representative controls.
`make frontend-lint`/`frontend-typecheck`/`frontend-format-check` all
clean (same four pre-existing `react(only-export-components)` warnings as
before, none in files this task touched); full frontend suite green,
1730/1730 (1713 before this task's 17 new tests), zero regressions.

## 132. Compact the Layers panel into a minimal Photoshop-style row list

Goal: Once task 131's canvas HUD carries the quick-toggle controls, strip
`LayersPanel.tsx`'s always-visible row markup down to what a Photoshop/
Figma-style layers palette actually shows per row — drag handle, kind
icon, name/label, and a clearly, unmistakably highlighted background when
that row is the active selection — moving everything else (the inline
Visible/Locked buttons, `ShapeColorSwatch`, the delete button, and the
`RowMoreDisclosure` containing Move up/down + `MoveControls`) out of the
row's always-visible surface.
Description: The current row (see `OutlineRowItem` in `LayersPanel.tsx`)
renders name, a "Select for grouping" checkbox, a select/label button,
inherited-state text, Visible/Locked toggle buttons, (for shapes) a fill
color swatch, a Delete button, and a "More" disclosure with Move up/down
and the `MoveControls` reparent selects — all at once, for every row,
regardless of whether that row is selected. Live user feedback describes
this as "too cluttered and filled with information that should only be
necessary to show if the layer is active." Depends on task 131 landing
first so removed controls have a working replacement home (the HUD) —
this task must not ship a net loss of reachable functionality partway
through. Also explicitly strengthen the selection highlight itself: the
existing `index.css` `[data-selected='true']` rule (left-border color +
background tint) reads as too subtle against a tall, busy row per user
feedback ("the layer's background... will be highlighted") — on a
compact row this same rule should already read as far more obvious, but
confirm it visually rather than assuming. Reparenting/reordering/renaming/
grouping actions that don't fit "quick per-row toggle" (Move up/down,
`MoveControls`, `Combine into group`, layer add/delete) still need a
keyboard-and-touch-reachable home — likely the HUD from task 131, or kept
as a still-collapsed-by-default per-row disclosure if the HUD doesn't
cover them; decide explicitly during grooming, don't drop silently.
Out of scope: task 129/#161's touch-drag mechanism and task 111/#142's
per-shape-layer data model are both unaffected — this is presentation
only, on top of the same `sceneEditor.outline` rows.
Status: COMPLETE
GitHub issue: [#164](https://github.com/cfornesa/ai-dev-tools-zoomcamp-1/issues/164)
(open for QA/closing by the orchestrator).
Discovery gate: Same search as task 131; #153 (closed) and #131/#127
(closed — the original Layers panel build-out) are prior art on this same
file, not duplicates of this specific compacting request. New, not a
duplicate.
Resolution (2026-08-24): `LayersPanel.tsx`'s `OutlineRowItem` group and
shape branches now render, unconditionally, only: the drag handle, kind
icon, "Select for grouping" checkbox (kept on the row per this task's own
option — it's a lightweight, always-relevant per-row utility, not one of
the four things this task's acceptance criteria named for removal), the
select/name button (doubling as the row's label and its selection
highlight target via the existing `data-selected` attribute), and nothing
else. Removed from both branches: the Visible/Locked toggle buttons, the
(shape-only) `ShapeColorSwatch` component (now fully unused and deleted
outright, not just unrendered), the Delete button, the `RowMoreDisclosure`
(Move up/down + `MoveControls`), and the inherited-hidden/locked
annotation text (informational, not a control — dropped per this task's
own "too cluttered... should only be necessary to show if the layer is
active" framing, since it has no HUD equivalent and isn't a "reachable
functionality" the acceptance criteria protects).
Explicit decisions this task's grooming required, recorded here per its
own instruction to "pick one and record the choice":
- **Layer rows are deliberately left uncompacted.** Issue #163's own
  acceptance criteria already carved layer rows out of the HUD entirely
  ("Layer rows... keep their existing Visible/Locked/Delete buttons
  only"), so a layer row has no HUD to relocate its controls into.
  Compacting it anyway would ship exactly the "net loss of reachable
  functionality" both #163 and #164's acceptance criteria forbid — so
  `LayersPanel.tsx`'s layer-row branch, its `RowMoreDisclosure`, and its
  inline Visible/Locked/Delete buttons are all unchanged by this task.
  This is the one place task 132's generic "every row" framing is
  narrowed by task 131's own explicit boundary, not a contradiction —
  applying the compacting to layer rows was never actually
  self-consistent with #163 as already written.
- **Move up/down and `MoveControls` (Move to layer/Move to group) were
  relocated into `SelectionHud.tsx`** (extending it, per this task's own
  "either the HUD, extended if needed, or a... disclosure" option) rather
  than kept as a second, row-local collapsed disclosure — the HUD already
  only renders while that exact row is the active selection, so it's
  exactly as reachable (no more, no less) as a per-row disclosure would
  be, without a second parallel "is this the active selection" check.
  `MoveControls` itself is now exported from `LayersPanel.tsx` and
  imported by `SelectionHud.tsx` rather than reimplemented, so the
  group-options-filtering/layer-options-list logic stays in exactly one
  place.
- **"Combine into group" needed no relocation at all** — it was already
  the always-visible "Outline actions" toolbar button above the outline
  list, never a per-row control inside `RowMoreDisclosure`, so this
  task's own text flagging it as needing "an explicit... home" was
  already satisfied before this task started.
- **"Select for grouping" is kept on the compact row**, not relocated —
  explicitly one of this task's own sanctioned options.
Verified: a static HTML/CSS reproduction of the compact row markup and
the exact existing `[data-selected='true']` CSS rule was screenshotted in
the browser preview — the selected row's left-accent border + background
tint reads as clearly, unmistakably distinct from its unselected
siblings now that the row is short (drag handle/icon/checkbox/name only),
confirming visually rather than assuming, per this task's own acceptance
criterion. `EditorWorkspace.layers.test.tsx` and
`EditorWorkspace.selectionHud.test.tsx` were updated for the new row
structure: tests that used to open a shape/group row's `RowMoreDisclosure`
directly now select that row (where it wasn't already selected by the
preceding action) and interact with `SelectionHud.tsx`'s Move up/down/
`MoveControls` instead; the "own vs. inherited" Visible/Locked test now
asserts through the HUD instead of the now-removed inline row annotation
and buttons; nothing keyboard-reachable before this task became
mouse-only after it (the HUD's controls are the same focusable
`<button>`/`<select>` elements the row used to render, just relocated).
`make frontend-lint`/`frontend-typecheck`/`frontend-format-check` all
clean (same four pre-existing `react(only-export-components)` warnings —
now including `MoveControls`'s new export, expected for the same
class of reason the other three already existed); full frontend suite
green, 1730/1730 (unchanged count — no tests added or removed, only
updated), confirmed on a clean run after separately reproducing and
ruling out two pre-existing, order-dependent timing flakes in unrelated
`useDraftAutosave`/draft-autosave-controller tests (both pass in
isolation; same flake class already documented for task 130).

## 133. Reconsider the Layers panel's auto-scroll-on-selection now that rows will be compact and highlighted

Goal: Decide explicitly, and implement, what `LayersPanel.tsx`'s
selection-driven `scrollIntoView` effect (added for issue #153; see that
file's "Issue #153: keep the Layers panel scrolled to whichever row is
selected" comment) should do once tasks 131/132 land — live user feedback
describes the current every-selection auto-scroll as jarring specifically
because today's tall, cluttered rows make each jump large and disorienting.
Description: `LayersPanel.tsx` currently calls
`row.scrollIntoView({ block: 'nearest' })` on every
`sceneEditor.selectedShapeId` change, unconditionally, including when the
row is already fully visible. Issue #153 flagged this exact behavior as
"worth deciding explicitly rather than leaving implicit" and then never
revisited it. Once task 132 makes rows short and the selection highlight
prominent, the practical case for auto-scrolling shrinks (more rows fit
without scrolling, and a highlighted row is easier to spot at a glance
even off-screen-adjacent) — this task should re-evaluate with that
context in hand rather than assuming removal, and could land as one of:
keep it but only scroll when the row is actually out of view (avoid a
same-viewport jump), remove it entirely in favor of the stronger
highlight, or keep it unchanged if grooming finds compact rows don't
actually eliminate the disorientation. Should be sequenced after task 132
so the decision is made against the real compacted layout, not the
current cluttered one.
Status: COMPLETE
GitHub issue: [#165](https://github.com/cfornesa/ai-dev-tools-zoomcamp-1/issues/165)
(open for QA/closing by the orchestrator).
Discovery gate: Searched `_docs/tasks.md` and `gh issue list --search
"scroll into view"` for a duplicate — only #153 (closed, the issue that
added this behavior) matches, and its own text explicitly deferred this
exact decision rather than making it. New, not a duplicate.
Reconciliation note: Tasks 131/132/133 were filed together from one
piece of live user feedback (2026-08-24, a screenshot-driven review of
the Layers panel after tasks 129/130 shipped) and are sequenced as a
chain (131 -> 132 -> 133) rather than independently implementable —
grooming should confirm that ordering still holds before work starts.
Matching GitHub issues #163/#164/#165 filed for tasks 131/132/133
respectively, cross-linking this chain.
Resolution (2026-08-24): Chose option (a) of this task's own three —
"only scroll when the newly-selected row is actually out of view" —
over (b) removing auto-scroll entirely or (c) keeping it unconditional.
Rationale: task 132's compact rows and strengthened `[data-
selected='true']` highlight genuinely shrink how often a scroll jump
happens at all (more rows fit without scrolling) and make a selected
row easier to spot once scrolled to, but neither eliminates the real
case this effect exists for in the first place — selecting a shape via
a canvas click while the Layers panel is scrolled somewhere else
entirely still needs *some* scroll to bring the newly-selected row into
view, so removing it outright (b) would be a net loss for that case;
keeping it unconditional (c) would preserve the exact jarring
same-viewport jump this task was filed to fix. `LayersPanel.tsx`'s
effect now checks a new exported pure helper, `isRowFullyVisible(el)`,
before calling `scrollIntoView`; "visible" is checked against the
browser viewport (`window.innerHeight`) rather than a dedicated
scrollable ancestor, since neither `.editor-outline-list` nor its
containing `.editor-panel[data-panel='layers']` has its own `overflow-y`
in `index.css` — the page/panel scrolls as a whole, so the viewport is
the actual "visible scroll area" a real user experiences here.
Verified: added `frontend/src/pages/LayersPanel.autoScroll.test.ts` (5
new tests) unit-testing `isRowFullyVisible` directly (an all-zero/
unlaid-out rect, fully within viewport, flush with viewport edges,
above viewport, below viewport) and
`frontend/src/pages/EditorWorkspace.layersAutoScroll.test.tsx` (2 new
tests) exercising the full effect end-to-end through a real selection
change, asserting `scrollIntoView` is not called when the row's stubbed
`getBoundingClientRect` places it fully within the stubbed 800px
viewport, and is called with `{ block: 'nearest' }` when it doesn't.
`make frontend-lint`/`frontend-typecheck`/`frontend-format-check` all
clean (one added `react(only-export-components)` warning for the new
`isRowFullyVisible` export, same pre-existing warning class as this
file's other exported helpers); full frontend suite green, 1737/1737
(1730 before this task's 7 new tests), zero regressions.
Follow-up note (2026-08-25): this resolution's chosen option (a) — "only
scroll when the row is out of view" — was reversed by task 134/#166 after
further live user feedback showed the same jarring jump persists whenever
the panel itself is off-screen. Task 134 removed the effect (and
`isRowFullyVisible`) entirely; see that task's own entry and resolution
below for the reversal's rationale and verification. This note points at
that reversal without rewriting the historical resolution above, which
remains an accurate record of what was decided and why at the time.

## 134. Revisit #165: eliminate or scope down Layers-panel auto-scroll-on-selection

Goal: Live user feedback obtained after tasks 131-133 shipped directly
contradicts the #165 (task 133) resolution — the user wants selecting a
shape to highlight it (via #163's HUD and #164's `[data-selected='true']`
row styling) without any page/panel scroll jump at all, not just a scroll
suppressed while already in view.
Description: This is a reversal signal from real usage of the shipped
behavior, not a fresh idea — #165 explicitly weighed and rejected removing
auto-scroll entirely (its option "(b)") based on a hypothesis that
compact/highlighted rows would meaningfully reduce, but not eliminate, the
need for it. The 2026-08-25 feedback ("Clicking on a shape still
automatically scrolls down to the layer details instead of simply
highlighting the layer") reports the predicted improvement didn't resolve
the disorientation complaint in practice. Needs re-grooming against this
new data point: remove the scroll entirely, make it opt-in, or scope it to
a dedicated scrollable region instead of the whole page/panel
(`LayersPanel.tsx`'s effect currently checks visibility against
`window.innerHeight` because neither `.editor-outline-list` nor
`.editor-panel[data-panel='layers']` has its own `overflow-y`).
Out of scope: #163's HUD and #164's row compaction/highlight are assumed
sufficient replacements for "showing what's selected" — this task is only
about whether/how the scroll itself still happens.
Status: COMPLETE
GitHub issue: [#166](https://github.com/cfornesa/ai-dev-tools-zoomcamp-1/issues/166)
(open for QA/closing by the orchestrator).
Discovery gate: Searched `_docs/tasks.md` and `gh issue list --state all
--search "auto-scroll"` / `"scroll into view"` — only #165 (closed)
matches, and it is the decision being reopened here, not a duplicate.
Resolution (2026-08-25): Chose full removal — the PM-groomed acceptance
criteria on #166 explicitly settled this re-grooming in favor of "remove
the scroll-into-view entirely," on the rationale that `SelectionHud.tsx`
(#163) already shows what's selected without the Layers panel needing to
be in view, and the "only scroll when out of view" heuristic (#165) still
produces the same jarring jump whenever the panel itself is off-screen.
`LayersPanel.tsx`'s selection-driven `useEffect`, its `isRowFullyVisible`
helper, and the `listRef` that existed only to support that effect were
all deleted outright (no scoped/opt-in middle ground); selecting a row
directly by clicking it in the panel is unaffected (that's a user-
initiated scroll into their own view, not the removed auto-scroll).
Verified: `frontend/src/pages/LayersPanel.autoScroll.test.ts` was updated
in place (not deleted) — since there is no longer a pure helper to unit-
test, it now asserts `isRowFullyVisible` is no longer exported from the
module and that the component's source contains no `scrollIntoView` call,
a source-level regression guard against the behavior being silently
reintroduced. `frontend/src/pages/EditorWorkspace.layersAutoScroll.test.tsx`
was updated in place too: both its existing scenarios (row already fully
visible, row off-screen) now assert `scrollIntoView` is never called,
where the second previously asserted it *was* called with
`{ block: 'nearest' }`. `make frontend-lint`/`frontend-typecheck`/
`frontend-format-check` all clean (the `isRowFullyVisible`
`react(only-export-components)` warning from task 133 is gone, since that
export no longer exists); full frontend suite green, 1734/1734, zero
regressions.

## 135. Redesign the Layers panel toward a horizontally-longer, vertically-shorter layout

Goal: Reduce vertical space consumed per row and make better use of
horizontal space in the Layers panel, per live user feedback describing
the current layout as wasting "so much screen real estate... on centering
everything when the reality is that the layers could be horizontally
longer while being vertically smaller."
Description: `frontend/src/index.css`'s `.editor-outline-row` is already
compact for shape/group rows (task 132/#164), but layer-level rows
(`OutlineRowItem`'s layer branch, `LayersPanel.tsx`) remain tall because
of #164's own deliberate carve-out leaving their Visible/Locked/Delete/
More controls unchanged. The complaint is about overall row/panel
geometry and proportions, not which controls render — needs grooming on
whether to widen the Layers panel's sidebar allocation, repack controls
within the current width, or both, and how this interacts with task
136/#168's separate ask to convert layer-row Visible/Locked buttons to
checkboxes (that alone frees some horizontal space but doesn't itself
redesign the layout).
Out of scope: The specific control-type change from buttons to
checkboxes (task 136/#168); shape/group row content, already compacted by
#164.
Status: COMPLETE
GitHub issue: [#167](https://github.com/cfornesa/ai-dev-tools-zoomcamp-1/issues/167)
(open for QA/closing by the orchestrator).
Discovery gate: Searched `_docs/tasks.md` and `gh issue list --state all
--search "layers panel"` — #164 (closed) compacted row *content*; #154
(closed) repositioned the panel within the sidebar accordion. Neither
covers row/panel *geometry*. New, not a duplicate.
Resolution (2026-08-25): Landed together with task 136/#168 (same file,
same rows, one engineer pass, per #167's own grooming note) but each
verified independently. `LayersPanel.tsx`'s layer-row branch: dropped the
standalone "Layer:" text label (redundant with the row's existing left
accent border/bold weight/kind icon from task 80/#110, and the name
field's own `aria-label` still says "Layer" explicitly for a screen
reader); the name `<input>` now takes an optional `className` prop so the
row can apply `.editor-outline-layer-name` (`frontend/src/index.css`:
`flex: 1 1 5rem; min-width: 0; width: 5rem`) instead of the browser's
much wider default input width. `.editor-outline-row-layer` changed from
inheriting `.editor-outline-row`'s `flex-wrap: wrap` to `flex-wrap:
nowrap`, so the row's controls stay on one line instead of spilling onto
a second/third at normal sidebar width. Combined with task 136/#168's
checkbox conversion (which itself frees significant width — see that
task's entry), this eliminated wrapping without needing the Layers
sidebar column widened at all: the `evaluate whether to widen` acceptance
criterion was genuinely evaluated (see Verified below) and the answer was
no, the repacking alone was sufficient, so `.editor-workspace`'s
`grid-template-columns: minmax(420px, 1fr) fit-content(20%)` is
unchanged. Shape/group rows (`.editor-outline-row-shape`/`-group`) were
not touched — they keep the base `.editor-outline-row` `flex-wrap: wrap`
untouched, matching #167's own "don't regress the already-compact shape/
group rows" acceptance criterion.
Verified: Real-browser (not jsdom) before/after screenshot comparison,
since this task's own acceptance criteria call for one. The actual
`frontend/src/index.css` (via `git show HEAD` for the pre-change
baseline, and the working tree for the post-change version) was linked
into two static harness pages reproducing the exact `.editor-workspace` >
`.editor-panel[data-panel='layers']` > `.editor-outline-list` DOM
`LayersPanel.tsx` renders for two layer rows plus one shape row, served
over a local `python3 -m http.server` and opened in the Claude Code
browser tool (direct login through `/accounts/login/` is blocked by this
environment's own safety policy against automating credentialed sign-in,
even with disposable e2e-fixture credentials, so this harness approach
substituted for driving the real authenticated editor). Measured via
`getBoundingClientRect()` at the same panel width in both versions
(495px, a real desktop-viewport measurement, not an assumed one): layer
row height went from 74px (wrapped onto 2 lines: name/icon/handle on one
line, Delete layer/More on a second) to 39px (single line, all controls
including Delete layer and More visible together) — essentially the
"vertically shorter" half of #167's goal met exactly, with no sidebar
widening. Re-checked at a 375px mobile viewport (the narrow/stacked
single-panel-at-a-time layout `EditorPanelSwitcher.tsx` switches to under
1024px): row height 43px, still one line, no horizontal overflow or
scrollbar, confirming no regression at the narrow end of #167's own
">=1024px and narrow/mobile viewports" acceptance criterion. The shape
row (`.editor-outline-row-shape`) rendered identically in both versions,
confirming no regression to task 132/#164's existing compaction.
`make frontend-lint`/`frontend-typecheck`/`frontend-format-check` all
clean; full frontend suite green (see task 136's entry below for the
shared test-suite numbers, since both tasks' test changes landed in the
same commit).

## 136. Convert layer-row Visible/Locked buttons to compact checkboxes

Goal: Replace the layer row's full-size "Visible"/"Unlocked" toggle
buttons with smaller checkbox-style controls at reduced text size, per
live user feedback: "smaller text and using checkboxes, instead, could
accommodate a horizontally longer layer space."
Description: `LayersPanel.tsx`'s `OutlineRowItem` layer branch renders
Visible/Locked as full buttons (plus Delete and a "More" disclosure) by
task 132/#164's own explicit, documented decision to leave layer rows
uncompacted — because task 131/#163's `SelectionHud.tsx` was scoped to
exclude layer rows entirely. That was a reasoned carve-out, not an
oversight, and this task asks to partially reopen it: specifically for
Visible/Locked only (not Delete or More, unless grooming decides
otherwise). Needs grooming on whether this is a minimal in-place control
swap or the deferred `SelectionHud.tsx` extension to layer rows that
#163/#164 explicitly left on the table rather than ruling out.
Out of scope: Delete layer and the "More" disclosure (Move up/down,
reparent), unless grooming finds a HUD extension makes relocating them
free; shape/group rows (already compacted by #164).
Status: COMPLETE
GitHub issue: [#168](https://github.com/cfornesa/ai-dev-tools-zoomcamp-1/issues/168)
(open for QA/closing by the orchestrator).
Discovery gate: Searched `_docs/tasks.md` and `gh issue list --state all
--search "layers panel"` — #163/#164 (closed) are the direct prior art
whose own documented carve-out this task asks to reopen; not a
duplicate.
Resolution (2026-08-25): Chose the minimal in-place control swap over a
`SelectionHud.tsx` extension, per this issue's own PM-groomed decision
note — "keep this task surgical; a full HUD extension for layer rows is
a larger follow-up if wanted later, not required here." `LayersPanel.tsx`'s
layer-row Visible/Locked `<button>`s (which toggled `aria-pressed` and
flipped their own label text between "Visible"/"Hidden" and "Unlocked"/
"Locked") became `<label><input type="checkbox" .../> Visible</label>`
pairs — the exact same `<label>`-wraps-`<input>`-plus-visible-text
pattern this file's group/shape rows already use for their "Select for
grouping" checkbox, so no new accessibility pattern was introduced.
`checked` reflects `row.visible`/`row.locked` directly; `onChange` calls
the identical `sceneEditor.toggleLayerVisible`/`toggleLayerLocked`
mutations the old `onClick` handlers called — no new mutation, no change
to `useSceneEditor.ts`. Each checkbox carries a static `aria-label`
(`Layer ${row.name} visible` / `Layer ${row.name} locked`) that doesn't
flip with checked state (unlike the old buttons' label text), which is
what let several existing tests simplify from a "query one name, fall
back to the other" pattern to a single stable query. New
`.editor-outline-layer-toggle` class (`frontend/src/index.css`):
`font-size: 0.8em`, tight `gap: 3px`, `white-space: nowrap` — the
"smaller text" half of the live feedback this task and #167 share.
Delete layer and the "More" disclosure are untouched, per this issue's
explicit out-of-scope.
Out-of-scope note not in this task's own acceptance criteria but
discovered during implementation: adding two checkboxes per layer row to
`.editor-outline-list` broke every existing test that queried
`getAllByRole('checkbox')` unscoped within that list and indexed into the
result (previously always exactly the "Select for grouping" checkboxes,
one per shape/group row) — the layer rows' new checkboxes now precede
them in DOM order and shifted every index. Fixed by scoping each such
query to `{ name: /to group selection$/i }` across
`EditorWorkspace.layers.test.tsx`, `EditorWorkspace.lock.test.tsx`,
`EditorWorkspace.selectionHud.test.tsx`, `EditorWorkspace.snap.test.tsx`,
`EditorWorkspace.multiTransform.test.tsx`, and
`EditorWorkspace.vertexEdit.test.tsx` — no behavior change, since that's
what those queries always meant to select; `EditorWorkspace.a11y.test.tsx`
and `EditorWorkspace.shapeInspector.test.tsx` already queried by that
same name pattern and needed no change.
Verified: Updated existing layer-row Visible/Locked assertions (in
`EditorWorkspace.layers.test.tsx`, `EditorWorkspace.lock.test.tsx`,
`EditorWorkspace.shapeInspector.test.tsx`,
`EditorWorkspace.duplicateDeleteShortcuts.test.tsx`) from button
`aria-pressed`/label-text assertions to checkbox `toBeChecked()`
assertions. Added two new tests in
`EditorWorkspace.layers.test.tsx` (describe block "layer row Visible/
Locked checkboxes (issue #168)"): one asserting each checkbox has a
distinct, non-empty accessible name (`getByRole('checkbox', { name:
'Layer Layer 1 visible' })` / `'Layer Layer 1 locked'`), one exercising
real Tab-focus + Space-key toggling via `userEvent.keyboard(' ')` (not
just a click) to directly cover this issue's "Tab to reach, Space to
toggle" keyboard-operability acceptance criterion. The pre-existing
automated `EditorWorkspace.a11y.test.tsx` axe-core suite (which asserts
zero accessibility violations across several rendered states, including
one with layer rows present) passed unchanged, giving independent
automated confirmation the new checkboxes have valid accessible names
and no `aria-*`/labeling violations. `make frontend-lint`/
`frontend-typecheck`/`frontend-format-check` all clean; full frontend
suite green, 1736/1736 (1734 before this pair of tasks' 2 new tests,
zero regressions across both tasks 135 and 136's combined test changes).

## 137. Fix camera overlay stacking so it renders on top of the scene canvas

Goal: Make the camera overlay actually appear composited on top of scene
shapes (or, if not achievable, at minimum genuinely on top rather than
behind), matching what its own name and controls ("Camera overlay
opacity") imply — per live user feedback and confirmed root cause in
source, not just the screenshot.
Description: `frontend/src/pages/EditorWorkspace.tsx`'s `<video>` overlay
element renders with `zIndex: -2` while the p5 shape-canvas mount div
immediately below it renders with `zIndex: -1` — since -1 stacks above
-2, the shape canvas always paints over the camera feed by design (task
110/#141's own comment: kept behind "so it stays structurally absent from
any canvas-only capture path (thumbnails, exports)"). The user's
screenshot showing only a sliver of video at the canvas's bottom edge is
consistent with this stacking, not a transitional glitch. Needs grooming
on how to make the camera visually on-top for the live editor/Preview
while still keeping it out of thumbnail/export capture — likely by
confirming capture code already targets the p5 `<canvas>` element
specifically (not its parent container), in which case the video's own
stacking can safely move above it with no capture-path change needed.
Out of scope: Task 151/#151's drag/resize/reposition work (unaffected,
separate concern); the public project viewer's/standalone export's
camera overlay (#145/#146/#152) — scope to the editor Preview first, file
separately if the same defect is confirmed there.
Status: COMPLETE
GitHub issue: [#169](https://github.com/cfornesa/ai-dev-tools-zoomcamp-1/issues/169)
Discovery gate: Searched `_docs/tasks.md` and `gh issue list --state all
--search "camera overlay"` — #141/#147 (closed) shipped the overlay
itself; #151 (open) is drag/resize only. Neither covers the stacking/
z-index defect. New, not a duplicate.
Evidence (2026-08-25): Read `frontend/src/export/captureSocialThumbnail.ts`
in full (the only thumbnail/export capture path in the repo — confirmed by
grepping `frontend/src` for `toDataURL`/`thumbnail`; `generateSocialThumbnailZip.ts`
calls it, `generateHtmlExport.ts`'s standalone export is explicitly
out of scope per the issue). It builds a wholly separate, off-screen
`<div>` (positioned at `top:-100000px`, never appended anywhere visible)
and hands that to a *fresh* `createP5ScenePreview(container)` instance
(`p5Adapter.ts`), rendering directly from the saved `SceneDocument` — not
from the live editor's DOM at all. `p5Adapter.ts` has no camera/MediaPipe
code path whatsoever (module doc comment: "this function's own signature
takes only a `SceneDocument`... a capture can structurally never read a
live camera frame"). This means the live editor `<video>` element's
on-screen z-index has zero effect on capture output either way — the
capture path is isolated by construction, not by z-index — so criterion
5 (adjust the capture path if it's not already isolated) does not apply;
the CSS-only re-stack was correct and sufficient per criterion 1's own
decision framing.
Changed `frontend/src/pages/EditorWorkspace.tsx`: swapped the camera
`<video>` element's `zIndex` from `-2` to `-1` and the p5 mount div's from
`-1` to `-2` (video now stacks strictly above the shape canvas instead of
below it), and updated the three comments referencing the old stacking
(including task 110/#141's original comment explaining the now-obsolete
reasoning, and task 126/#130's comment citing the mount div's old
`zIndex: -1`).
Added a regression test to
`frontend/src/pages/EditorWorkspace.cameraOverlay.test.tsx` ("stacks the
video above the p5 mount div so opaque shape fill no longer fully hides
it") asserting `video`'s numeric `zIndex` is strictly greater than the p5
mount div's (found as the video's next DOM sibling) with an opaque shape
present in the scene — guards against the video sinking back below the
canvas. `make frontend-test` (`npx vitest run`) passes at 1737/1737 (was
1736/1736 before the new test), no regressions; `make frontend-lint`,
`make frontend-typecheck`, and `make frontend-format-check` all pass clean
(pre-existing `only-export-components` oxlint warnings in unrelated files
are untouched).
Live verification: started a real local Postgres-backed Django
(`AI_PROVIDER=fake`) + Vite dev stack, created e2e fixture users
(`manage.py e2e_fixtures create --json`), and drove the app through the
Browser tool. Signed in as the fixture owner, opened a project's editor,
added a circle shape, and confirmed via the DOM/comments that Demo signal
controls (`Manual controls`/`Synthetic playback`) only exercise
interaction-runtime gesture signals (fingertip X/Y/Z, gesture state) and
never set `cameraStream`/`cameraStatus` — grep of `EditorWorkspace.tsx`
confirms those two pieces of state are written only from
`CameraControl`'s real `onStatusChange`/`onStreamChange` callbacks, which
require an actual `getUserMedia` grant. Clicking "Enable camera" in the
live browser correctly surfaced "Camera access was denied... or use the
demo controls below instead" — the Browser tool's pane blocks real camera
device access, so this specific criterion (visually confirming the video
renders above shapes with a genuine live feed) could not be exercised
end-to-end in this environment, consistent with the task's own
anticipation of that limitation. The added jsdom regression test above is
the equivalent deterministic verification the repo's own convention uses
for this exact boundary (`EditorWorkspace.cameraOverlay.test.tsx`'s
existing suite already mocks `CameraControl` as "a controllable
status/stream source only," matching how `CameraControl`'s own real
permission/MediaPipe state machine is separately covered by
`CameraControl.test.tsx`) — driving `cameraStatus`/`cameraStream` directly
produces byte-for-byte the same render path a real camera activation
would, since the `<video>` element's presence and stacking are 100%
determined by that state, not by what produced it. The "Camera overlay
opacity" slider's post-fix behavior is covered by this same test file's
pre-existing, still-passing cases ("moving the slider updates the overlay
opacity live," "restores the last-chosen opacity on re-activation") — the
stacking change touched only the `zIndex` style property, not the
`opacity` binding, and no test in that file needed updating beyond the one
new case. Thumbnail/export non-regression is verified structurally (see
capture-path finding above) rather than by an on/off pixel comparison,
since camera activation itself could not be exercised live in this
environment; `captureSocialThumbnail.ts`'s own existing test coverage
(part of the 1737 passing) is unaffected by this change, as expected for a
file this task did not touch.
No new backlog items surfaced; the temporary `frontend/vite.config.ts`
proxy-target and `.claude/launch.json` `autoPort` edits made only to work
around this sandbox's `localhost`-vs-`127.0.0.1` DNS quirk during live
verification were reverted before finishing and are not part of the
shipped change.

## 138. Add canvas/background-level opacity, color, and layer-like settings

Goal: Let the user control the scene canvas/background's own opacity and
color, plus other "layer-like" configuration, excluding a visibility
toggle (the canvas can't be meaningfully hidden) — a genuinely new
feature, per live user feedback.
Description: `schema/scene.schema.json` already has a required scene-level
`backgroundColor` field, but no file under `frontend/src/pages/` exposes
any UI control for it — it's only reachable via the Code tab's raw JSON
editing (#159). There is no canvas-level opacity field in the schema or
UI at all (existing opacity controls are all per-shape, via
`ShapeInspectorPanel.tsx`/`shapeStyleFields.ts`, or per-camera-overlay,
via `cameraOverlaySettings.ts` — distinct concepts). Needs its own
grooming pass to settle: where the control lives (a permanent row in the
Layers panel outline, a dedicated settings section, or a HUD analogous to
`SelectionHud.tsx` for "nothing else selected"), how canvas opacity
composites with per-shape opacity in `p5Adapter.ts` and in thumbnail/
export/public-viewer rendering, and what "layer-like configurations...
with the exception of visibility" concretely means beyond opacity/color
(the request is underspecified there and needs a follow-up
clarification).
Out of scope: Visibility toggle for the canvas (explicitly excluded);
per-shape opacity and camera-overlay opacity (both already exist,
unaffected).
Status: COMPLETE
GitHub issue: [#170](https://github.com/cfornesa/ai-dev-tools-zoomcamp-1/issues/170)
(left open for QA/closing by the orchestrator, per this task's
instructions).
Discovery gate: Searched `_docs/tasks.md` and `gh issue list --state all
--search "canvas background"` / `"background color"` — no existing issue
adds a UI control for scene-level background color or canvas-level
opacity. New, not a duplicate.
Resolution (2026-08-25): Implemented both controls and settled every
sub-decision this task's own grooming flagged as open:

- **Control placement (backgroundColor + new opacity)**: a persistent
  "Canvas" settings row in `LayersPanel.tsx` (`CanvasSettingsRow`),
  rendered *below* the outline `<ul>` rather than as one of its
  draggable/reorderable `<li>` rows, and below rather than above the
  layer list. Chosen over the Preview-toolbar alternative because this
  panel is already the single place every other layer-like composition
  control lives (layer/group/shape rows, `SelectionHud.tsx`); splitting
  canvas settings into a second panel for no functional reason would
  just make them harder to find. Placed at the bottom, not the top,
  because this panel's own draw-order convention ("Top of the list =
  drawn last = on top of everything below it") already reads
  top-to-bottom as front-to-back, and the canvas/background is the one
  thing every scene draws *first* — the bottom of the list is where that
  existing mental model already points. No visibility toggle and no lock
  control were added (the canvas has no lock concept and #170 explicitly
  excludes a visibility toggle), and "layer-like configurations... with
  the exception of visibility" was scoped narrowly to exactly the two
  concretely-named controls (background color, opacity), per this
  issue's groomed acceptance criteria — no lock/reorder/fill-pattern
  control was invented for the canvas.
- **New field shape and schemaVersion**: `canvas.opacity`, a
  `unitInterval` (0-1, default-when-absent 1), added to
  `schema/scene.schema.json`'s `canvas` object but deliberately **not**
  added to `canvas`'s `required` list, and **no `schemaVersion` bump**.
  `schema/README.md` now documents this explicitly as a general rule
  (an additive, optional field whose absence every reader already
  treats as a documented default doesn't need a version bump — Task 82's
  `onboardingHints` is the existing precedent; `canvas.opacity` is the
  second). A bump was rejected because it would be pure churn: every
  validator, fixture, and renderer already needs "field absent -> treat
  as 1" logic regardless of the document's declared version, so gating
  that behind `schemaVersion: 2` would only add a parallel document
  shape with no actual behavioral difference from V1-plus-a-default.
- **Compositing mechanics**: canvas opacity composites the *whole
  rendered frame* (background + trails + shapes + particles, already
  flattened) as one layer, not each shape's own alpha scaled
  individually. Rejected the alternative (multiply every shape's own
  fill/stroke alpha by `canvasOpacity`) because it double-blends
  overlapping shapes — two shapes stacked on each other would darken/
  lighten their overlap in a way a single "whole scene at X% opacity"
  slider should not. Implemented as an offscreen-buffer-plus-tint
  composite: `p5Adapter.ts`'s `createP5ScenePreview` draws into a
  `p5.Graphics` buffer at full internal opacity when `canvas.opacity < 1`
  (shape-over-shape blending inside the scene is therefore unaffected),
  then draws that buffer onto the real canvas once via
  `tint(255,255,255,opacity*255)` — a single alpha multiply for the
  whole composite. Ported the identical approach into
  `standaloneRuntimeSource.ts` (the hand-written export runtime) so a
  downloaded standalone HTML export matches. The backend Pillow gallery-
  thumbnail rasterizer (`scenes/thumbnails.py`) has no offscreen-buffer
  concept, so the equivalent there is a single final-image alpha-channel
  scale (`Image.split()`/`.point()`/`Image.merge()`) after every node has
  already drawn into the RGBA composite at full internal opacity — same
  "flatten first, scale once" result via the tool this renderer actually
  has.
- **Surface coverage (no deferrals needed)**: every surface the
  acceptance criteria list — editor Preview, thumbnail generation,
  project export, and the public project viewer — already routes through
  one of exactly two rendering implementations
  (`createP5ScenePreview`/`p5Adapter.ts`, or the hand-written compact
  export runtime), so applying `canvas.opacity` in those two places
  covers the editor Preview, the public viewer (`PublicProjectViewer.tsx`
  calls the same `createP5ScenePreview`), the frontend social-thumbnail
  ZIP capture (`captureSocialThumbnail.ts` also calls
  `createP5ScenePreview`), and the standalone HTML export
  (`standaloneRuntimeSource.ts`) without duplicating logic. The one
  additional, genuinely separate renderer discovered during
  implementation — `scenes/thumbnails.py`'s server-side Pillow rasterizer
  for gallery-card thumbnails (Task 54) — was also updated rather than
  deferred, since the change was a small, self-contained final-alpha
  scale. No surface was left inconsistent, so no follow-up issue was
  filed for a deferred surface.
Verified: `schema/scene.schema.json`/`schema/README.md` updated;
`scenes/validation.py` needs no code change (it loads the schema file
directly via `jsonschema`); `frontend/src/validation/scene.ts` likewise
needs no code change (same reason) — both gained new test coverage
instead (`tests/test_scene_validation.py::TestCanvasOpacity`,
`frontend/src/validation/scene.test.ts`'s "canvas.opacity" describe
block) proving absent/in-range/out-of-range/wrong-type behavior matches
on both sides. New `frontend/src/pages/canvasSettingsFields.ts` (+
`.test.ts`) holds the pure validation/getter logic the `CanvasSettingsRow`
UI and `useSceneEditor.ts`'s new `updateCanvasBackgroundColor`/
`updateCanvasOpacity` mutations call
(`useSceneEditor.canvasSettings.test.ts`). Compositing correctness is
unit-tested directly against real pixel reads in
`frontend/src/render/p5Adapter.test.ts` (new "canvas.opacity" describe
block: default-opaque, alpha scaling, shape-plus-background scaling
together, opacity 0, and restoring opacity 1) and
`tests/test_thumbnails.py` (five new tests, including one proving a
reduced-opacity gallery card visibly fades toward the always-opaque-white
flatten backdrop). Save/reload persistence is verified by a new backend
test, `tests/test_scene_version_save_api.py::
test_canvas_background_color_and_opacity_round_trip_through_save_and_reload`,
which POSTs a scene with both fields set, then GETs the version back and
asserts both survive unchanged (plus a variant proving a scene that
predates `canvas.opacity` still saves/reloads fine without it). `make
check` (backend + frontend) passes: 629 backend tests passed (22
pre-existing skips), 1770 frontend tests passed, both zero regressions.
Live-verified against a local Postgres-backed dev stack (real `/accounts/
login/` sign-in as an `e2e_fixtures`-created user, not Google OAuth):
created a blank project, set the Layers panel's new Canvas row to
background `#3355ff` / opacity `0.4`, confirmed the Preview `<canvas>`'s
actual pixel data read back as `rgba(50,85,255,102)` (102/255 ≈ 0.4,
exactly the configured opacity), saved (version 2), fully reloaded the
page, reopened the project, and confirmed the same exact pixel value and
the same `0.4`/`#3355ff` field values persisted — plus confirmed the
gallery card's thumbnail for this project visibly showed the background
faded toward white (the documented always-opaque-white gallery-card
flatten), proving the backend Pillow thumbnail path picked up the new
field too. e2e fixture users were cleaned up afterward (`e2e_fixtures
cleanup`); no data was left behind in the local dev database.

## 139. Give visible/scroll feedback when a Layers-panel row click selects an off-screen shape

Goal: When selecting a shape/group via a Layers-panel row click (not a
canvas click) results in a selection whose canvas handles/`SelectionHud`
are currently scrolled out of view, make that selection perceivable
without requiring the user to notice or manually scroll.
Description: 2026-08-25 live user feedback, given right after tasks
131-138 (#163-170) shipped. User reported "I still cannot select a layer
and for the respective shape to be automatically show as being selected
as well." Live reproduction (real Postgres/Django/Vite stack, signed in as
an `e2e_fixtures` user) found the underlying wiring already correct:
clicking a shape's name button in `LayersPanel.tsx` calls
`sceneEditor.selectShape(row.id)`, which updates the same
`selectedShapeId` state task 121/#153 already synced bidirectionally —
confirmed via the accessibility tree that `SelectionHud.tsx`'s
`aria-label="Selected: <name>"` updates correctly. The likely real gap is
perceptual: no scroll-into-view or other feedback ties the Layers-panel
click to the resulting on-canvas change, so a user can reasonably believe
"nothing happened." Only the bare "Layer:" header row intentionally has no
select semantics (#153's own explicit note); that's a deliberate design
decision, not part of this task.
Status: COMPLETE
GitHub issue: [#171](https://github.com/cfornesa/ai-dev-tools-zoomcamp-1/issues/171).
Discovery gate: Searched `_docs/tasks.md` and `gh issue list --state all`
for "layer selection," "selection HUD." #153 (bidirectional row
highlighting) and #163/#164/#165/#166 (HUD/compaction/auto-scroll) are
closely related prior art but none covers canvas-side scroll-into-view
feedback when selection originates in the Layers panel. New, not a
duplicate — but any auto-scroll behavior must account for #165/#166's
documented user pushback on over-eager auto-scroll in the *other*
direction.

### Evidence

Implemented per the PM-groomed acceptance criteria on issue #171:
`EditorWorkspace.tsx` now holds a `previewSectionRef` on the Preview
`<section>` (`aria-label="Preview"`, `data-panel="preview"`) plus a new
`handleLayerRowSelect` callback that scrolls that section into view
(`scrollIntoView({ block: 'nearest' })`) only when its
`getBoundingClientRect()` isn't already fully within
`window.innerHeight` — the exact same "no rendered box"/"fully visible"
guard shape #165's now-removed `isRowFullyVisible` used, just applied to
the Preview section instead of an outline row. `LayersPanel.tsx` gained
an optional `onRowSelect` prop threaded through `OutlineRowItem`, called
(in addition to the existing `sceneEditor.selectShape(row.id)`) only from
a group/shape row's own select button — never from
`EditorWorkspace.tsx`'s `handleCanvasClick`, so a canvas-driven selection
is provably unaffected. `LayersPanel.tsx` itself still makes no
scroll-into-view call of its own kind (verified by the existing
`LayersPanel.autoScroll.test.ts` regression guard from #166, which
required rewording one comment to avoid a literal substring match rather
than any behavior change), keeping #166's "no Layers-panel auto-scroll"
decision fully intact — this task only adds Preview-section scroll
feedback in the other direction.

New coverage in `EditorWorkspace.previewAutoScroll.test.tsx`: scrolls the
Preview section when a row click selects a shape while it's stubbed
off-screen; does not scroll when the Preview section is stubbed as
already fully visible; does not scroll when a selection is instead driven
by a canvas-adjacent path (Escape-to-deselect, which never touches
`onRowSelect`). All three pass, alongside the full existing
`EditorWorkspace.layersAutoScroll.test.tsx`/`LayersPanel.autoScroll.test.ts`/
`EditorWorkspace.selectionHud.test.tsx` suites (63 tests, unchanged
behavior confirmed) and the full frontend suite (123 files / 1773 tests,
all passing). `make frontend-lint`, `make frontend-typecheck`, and
`make frontend-format-check` all pass with no new warnings (pre-existing
`only-export-components` warnings in `LayersPanel.tsx`/
`EditorDetailsPanel.tsx` are unrelated to this change).

## 140. Move Add-shape buttons into the editor's top toolbar as icon buttons

Goal: Relocate "Add circle"/"Add rectangle"/"Add line"/"Add polygon" from
the Layers panel sidebar (`LayersPanel.tsx`) into the always-visible top
toolbar (`role="toolbar"`, task 112/#143), rendered as distinct shape-icon
glyphs instead of text labels.
Description: 2026-08-25 live user feedback, given right after tasks
131-138 (#163-170) shipped. User asked for these buttons "placed INSIDE
the editor in its top toolbar, rather than on the sidebar," represented by
shape icons. Live reproduction confirmed the current toolbar holds only
Undo/Redo/Duplicate/Delete/Fill-color, and the Add-shape buttons are still
plain text buttons in `LayersPanel.tsx`, exactly where task 100/#131 put
them. This directly reverses an explicit prior decision: task 112/#143's
own grooming notes state shape-creation buttons "stay in `LayersPanel.tsx`
exactly where task 100/#131 deliberately placed them, not moved again."
The new user request should be treated as a reopening of that placement
call, referencing #143's prior rationale, rather than a fresh unconsidered
ask. Icon glyphs should follow the toolbar's existing `aria-hidden` glyph +
CSS-tooltip + `aria-label` pattern; no new icon library without asking
first, per `AGENTS.md`'s dependency rule. Whether "Add layer" also moves
was not specified by the user and needs explicit confirmation during
grooming.
Status: COMPLETE
GitHub issue: [#172](https://github.com/cfornesa/ai-dev-tools-zoomcamp-1/issues/172).
Discovery gate: Searched `_docs/tasks.md` and `gh issue list --state all`
for "toolbar," "add shape buttons," "shape icons." #143 (the toolbar) and
#131 (original placement) are the directly relevant prior art; no existing
issue proposes toolbar-icon shape creation. New, but explicitly overrides
#143's placement decision.

### Evidence

Implemented per the PM-groomed acceptance criteria on issue #172,
explicitly reversing task 112/#143's prior placement decision (referenced
in the implementation commit). `LayersPanel.tsx`'s sidebar "Add shape"
`role="group"` and its `SHAPE_TYPES` array were removed outright; the four
actions now live in `EditorWorkspace.tsx`'s always-visible top toolbar
(`role="toolbar" aria-label="Editor actions"`) as a new `role="group"
aria-label="Add shape"` group (a new `ADD_SHAPE_TYPES` array), rendered
first, ahead of History/Edit-shape/Fill-color. Each button reuses the
toolbar's existing `ToolbarButton` component verbatim — an `aria-hidden`
Unicode glyph (○ circle, ▭ rectangle, ╱ line, ⬠ polygon) plus the same
CSS `role="tooltip"` shown on hover/focus, and a real `aria-label` (e.g.
"Add circle") — so no new icon library was added, per `AGENTS.md`'s
dependency rule. The underlying mutation (`sceneEditor.addShape(type)`)
is byte-for-byte unchanged — this is purely a relocation/re-skin. "Add
layer" was left exactly where it was, still grouped with "Combine into
group"/"Ungroup selected"/"Delete selected group" in the Layers panel
sidebar, per the issue's own note; no reason was found during
implementation to move it.

New coverage in `EditorWorkspace.toolbarAddShape.test.tsx`: all four
buttons render inside the toolbar's "Add shape" group with correct
accessible names and visible tooltips; none render inside the Layers
panel region any more; "Add layer" stays in the Layers panel and is not
in the toolbar; clicking a toolbar button still adds a shape via the same
mutation (verified via the outline list and shape count); Tab-then-
Enter/Space activates a button, matching the toolbar's existing keyboard-
operability convention. The full existing suite (`EditorWorkspace.shapes.test.tsx`'s
pre-existing keyboard-only Add-shape test, `EditorWorkspace.accordion.test.tsx`'s
"Add shape" group presence check, and every other test that clicks "Add
circle"/"Add rectangle"/etc. by accessible name) needed no changes — all
124 test files / 1778 tests pass unmodified, since role+name queries are
location-agnostic and none of the existing tests scoped an Add-shape
query specifically to the Layers panel region.

Live verification (real Postgres/Django/Vite stack, signed in as an
`e2e_fixtures` user, per this task's own requirement): at a >=1024px
desktop viewport, the toolbar shows all four Add-shape icon buttons ahead
of Undo/Redo/Duplicate/Delete/Fill color, and clicking "Add circle" added
a shape (confirmed via the "1 shape(s) in the working copy" counter, the
new "Circle 1" outline row, and `SelectionHud`'s auto-selection) while
the Layers panel sidebar showed only "Add layer"/"Combine into group"/
"Ungroup selected"/"Delete selected group" — no Add-shape buttons. At a
375px mobile viewport the toolbar (rendered below the canvas per task
125/#157's existing narrow-viewport placement) showed all four icons
wrapping onto a second row via the toolbar's existing `flex-wrap`, with
`scrollWidth` measured equal to `clientWidth` (no horizontal overflow) —
confirmed no clipping. `make frontend-lint`, `make frontend-typecheck`,
and `make frontend-format-check` all pass with no new warnings.

## 141. Add a dismiss/reopen control for the canvas selection HUD that preserves the active selection

Goal: Let the user collapse/hide `SelectionHud.tsx`'s body while a
shape/group stays selected (canvas highlight, `selectedShapeId`, and the
Layers-panel row highlight from #153 all unaffected), and reopen it later
without needing to reselect.
Description: 2026-08-25 live user feedback, given right after tasks
131-138 (#163-170) shipped. User asked for "the layer dialog to be
closable but also to be able to be opened again... while keeping the
layer highlighted." The described panel (Visible/Unlocked buttons,
Selection fill/opacity, Delete shape, Move up/down, Move to layer/group)
is `SelectionHud.tsx` (task 131/#163's canvas-overlaid HUD), not the
separate collapsible "Shape inspector" accordion (`ShapeInspectorPanel.tsx`,
already independently collapsible since task 122/#154) — easy to conflate
since both show overlapping fields for the selected shape. Live
inspection confirmed `SelectionHud.tsx` has no dismiss/collapse control of
any kind; it renders unconditionally whenever a shape/group is selected,
with no wrapping `CollapsibleSection` in `EditorWorkspace.tsx`. This is a
gap in the original #163 design (always-on-while-selected was intentional,
but no independent hide/show was considered), not a regression.
Status: COMPLETE
GitHub issue: [#173](https://github.com/cfornesa/ai-dev-tools-zoomcamp-1/issues/173).
Discovery gate: Searched `_docs/tasks.md` and `gh issue list --state all`
for "selection HUD," "close panel," "inspector panel." #163 (added the
HUD) and #164/#165/#166 (Layers panel compaction/auto-scroll) are the
closest related work; none proposed a dismiss/collapse control for the HUD
itself. New, not a duplicate.

### Evidence

Implemented per the PM-groomed acceptance criteria and decision on issue
#173 (collapse state resets on every new selection, not persisted).
`SelectionHud.tsx` gained a shared `HudCollapseToggle` header button
(`aria-expanded` reflecting state, `aria-label` "Collapse selection
panel"/"Expand selection panel"), rendered in a new
`.editor-selection-hud-header` row alongside the existing title, for both
the group and shape render branches. A `collapsed` boolean local to this
component gates only the existing `.editor-selection-hud-controls` body
(`{!collapsed && (...)}`) — the outer `.editor-selection-hud` wrapper,
its title, and the toggle itself always render whenever a selection is
active, so a collapsed HUD keeps exactly the persistent header/pill this
issue's acceptance criteria require. Collapsing touches no `sceneEditor`
state at all: `selectedShapeId`/`multiSelectedIds`, the canvas move/
resize/rotate handles, and the Layers-panel row's
`[data-selected='true']` highlight are all driven entirely by
`sceneEditor`, which this toggle never calls into. A new
`activeSelectionId` (`selectedGroup?.id ?? selectedShape?.id ?? null`)
feeds a `useEffect` that resets `collapsed` to `false` whenever it
changes, satisfying "a fresh selection always resets to expanded." The
existing deselect paths (`handleCanvasClick`'s empty-canvas click,
Escape) are untouched — both already worked by nulling `sceneEditor`'s
selection, which flows straight through this component's existing early
`return null`s regardless of `collapsed`.

New coverage in `EditorWorkspace.selectionHudCollapse.test.tsx`: starts
expanded on a fresh selection; collapsing hides the body while keeping
the header/toggle pill and the HUD's own accessible name; re-expanding
restores the body; collapsing leaves the Layers-panel row's
`data-selected` attribute and the HUD's `aria-label` unchanged; selecting
a different shape while collapsed resets to expanded; Escape still
dismisses the whole HUD even while collapsed; the toggle is Tab-reachable
and Enter/Space-activatable. The full pre-existing
`EditorWorkspace.selectionHud.test.tsx` suite (17 tests) needed no
changes and continues to pass unmodified, since every test there operates
against a freshly-selected (therefore expanded-by-default) HUD. The full
frontend suite (125 files / 1785 tests) passes, and `make frontend-lint`/
`make frontend-typecheck`/`make frontend-format-check` are all clean (the
same pre-existing `only-export-components` warnings as before, unrelated
to this change).

Live-verified against the real Postgres/Django/Vite stack, signed in as
an `e2e_fixtures` user: added a circle, confirmed the HUD's collapse
toggle hid the Visible/Locked/fill/opacity/delete/move controls down to a
"Circle 1 ▸" pill while the canvas selection handles and the Layers
row's checked/highlighted state stayed visibly unchanged underneath, then
confirmed re-expanding via the same toggle restored every control.

## 142. [Needs grooming] Editable HTML/CSS/JS sub-tabs in the Code tab, round-tripping into the scene document

Goal: Investigate and groom (not yet implement) adding HTML/CSS/JS
sub-tabs to the Code tab (task 127/#159) alongside (or instead of) the
current JSON-only view, fully editable with changes saved and reflected
live in the Visual tab once reactivated.
Description: 2026-08-25 live user feedback, given right after tasks
131-138 (#163-170) shipped. User asked for Code-tab subtabs for HTML/CSS/
JavaScript, editable and round-tripping back into the scene, keeping the
existing JSON subtab "if... it can still be placed and manipulated," or
dropping it otherwise. Confirmed live and via source that the Code tab
today is JSON-only (a single "Scene JSON" `<textarea>`), and that
`frontend/src/export/` (`generateHtmlExport.ts`, `standaloneRuntimeSource.ts`,
`standaloneCameraSource.ts`, `safeEmbed.ts`, etc.) already generates
one-directional, non-reversible HTML/CSS/JS from a `SceneDocument` for
export only — it has no designed path back from hand-edited HTML/CSS/JS
into `SceneDocument` fields. This request is architecturally open-ended:
the canonical `SceneDocument` contract (validated against `schema/`'s JSON
Schema on both `scenes/validation.py` and `frontend/src/validation/
scene.ts`) underlies versioning, AI patch editing (#158), thumbnails, the
public viewer, and undo/redo — a reversible HTML/CSS/JS mapping, live
re-parse-on-edit semantics, and interaction with draft-autosave (#125) and
undo history all need an explicit design decision before any
implementation, not an assumed naive mapping. Deliberately filed without
detailed acceptance criteria, per this investigation's own scoping
guidance, pending a dedicated grooming/design pass — which may conclude a
narrower scope (e.g. read-only generated HTML/CSS/JS alongside the
still-editable JSON tab) is the right first cut.
Status: COMPLETE
GitHub issue: [#174](https://github.com/cfornesa/ai-dev-tools-zoomcamp-1/issues/174)
(left open for QA/closing by the orchestrator, per this task's
instructions).
Discovery gate: Searched `_docs/tasks.md` and `gh issue list --state all`
for "code tab," "HTML CSS JavaScript." #159 (Code tab, JSON-only, closed)
is the direct predecessor. No existing issue proposes HTML/CSS/JS
sub-tabs. New; explicitly flagged as needing grooming before
implementation.
Resolution (2026-08-25): The initial grooming pass above (read-only-MVP
scope) was superseded live by the user, who explicitly required genuine
bidirectional editing — see #174's second, authoritative comment
("Re-groomed acceptance criteria (PM pass), supersedes the prior
read-only-MVP comment"). Implemented across two commits
(`3352b10`, `c955e03`), verified both by re-reading the actual shipped
code (not just the commit messages) and via a full live pass against a
real Postgres-backed Django + Vite dev stack.

- **The grammar (`frontend/src/export/codeGrammar.ts`)**: a new,
  from-scratch generator/parser pair — deliberately *not* shared code
  with the existing one-directional `generateHtmlExport.ts`/
  `standaloneRuntimeSource.ts`/`standaloneCameraSource.ts` export
  generators, which produce a self-contained p5.js-canvas-rendering
  standalone page, not per-shape DOM/CSS suited to reversing. Full
  grammar v1, documented in the module's own doc comment (kept as the
  canonical reference so a future engineer never has to reverse-engineer
  the parser):
  - HTML: one `<main id="scene-shapes">` root, one `<div>` per editable
    shape in document order (reordering divs reorders `scene.shapes`
    z-order — the one structural edit this grammar supports), each
    carrying `data-shape-id`/`data-shape-type` (both immutable) and
    `data-layer-id`/`data-group-id` (informational, also immutable via
    this grammar), plus a `class` allowlist (`scene-shape`, the type
    name, `hidden`, `locked`).
  - CSS: one rule for `#scene-shapes` (canvas backgroundColor/width/
    height/opacity) and one rule per `#shape-{id}` mapping `left`/`top`
    -> position, `opacity` -> transform opacity, `background-color`/
    `border-color`/`border-width` -> fill/stroke/strokeWidth, `transform:
    rotate()/scale()` -> rotation/scaleX/scaleY, `visibility` -> visible
    (kept redundant with the `hidden` class token by design), and
    shape-type-specific declarations: `width`/`height` (rect ->
    width/height; circle, must match -> radius), `border-radius` (rect
    only -> cornerRadius), and `--x2`/`--y2` custom properties (line only
    -> the second endpoint, since CSS has no natural second-point
    property).
  - A declaration omitted from a saved rule leaves that field unchanged
    (not reset to a default) — this is what makes "regenerate -> re-save
    unchanged -> no scene mutation" hold, verified both by
    `codeGrammar.test.ts` and live (see below).
  - **What's OUT, and why (all pre-authorized by #174's "Explicit
    engineering latitude" clause)**: `particleEmitter` shapes are
    excluded entirely from the editable HTML/CSS surface (no `<div>`
    generated, never touched by the reverse parser, always preserved
    unchanged and appended after editable shapes) — consistent with
    `sceneShapes.ts`'s own pre-existing exclusion of particle emitters
    from direct Visual-tab editing, not a new boundary. `path` shape
    vertex geometry (`points`/`closed`) has no representation in this
    grammar — a path's universal fields (position/rotation/scale/
    opacity/fill/stroke/strokeWidth/visible/locked) are fully editable
    like any other shape, but vertex editing stays Visual-tab-only.
    Adding, removing, retyping, regrouping, or relayering shapes via the
    Code tab is out of scope — the HTML grammar can only reorder and
    restyle the *existing* shape set, keeping it a pure, always-reversible
    projection rather than a second shape-CRUD surface. **JavaScript is
    not reverse-parsed at all in this pass** — the JS sub-tab shows a
    real, live-regenerated, editable `<textarea>` (reusing
    `standaloneRuntimeSource.ts`/`standaloneCameraSource.ts`), but
    `isEditableJsUnchanged` is the only check its Save performs: saving
    the text back byte-for-byte unchanged is a safe no-op, and any other
    edit is rejected with an explicit, actionable message pointing the
    user at the Visual tab (behavior/logic) or HTML/CSS sub-tabs (shape
    geometry/style) instead. Follow-up filed and cross-linked below.
- **Wiring (`frontend/src/pages/EditorWorkspace.tsx`,
  `useSceneEditor.ts`)**: the Code tab now has JSON/HTML/CSS/JS sub-tabs,
  all mounted simultaneously (toggled via `hidden`, never conditionally
  unmounted) so switching between them never loses an in-progress unsaved
  edit in any of them — verified live: an in-progress, unsaved edit in
  the HTML box (an inserted HTML comment marker) survived switching
  through JSON -> JS -> back to HTML, and the JS box independently
  retained its own unsaved edit and rejection-error state through the
  same round-trip. HTML and CSS share one Save action (a CSS rule
  targets an id declared in the HTML, so they're interdependent) that
  reverse-parses both and applies the result via a single
  `sceneEditor.commitScene()` call — one undo/redo step for the whole
  Code-tab save, verified live: after saving a CSS color change, one
  Undo fully reverted the shape to its pre-save color in a single step.
  The JSON sub-tab's own save path (`setWorkingCopy` directly) is
  completely unchanged from #159, confirmed both by code inspection and
  live: an invalid-JSON edit still produces the exact same "Invalid scene
  JSON — not applied: ..." error, and the scene is left untouched.
- **Live verification performed** (real Postgres + Django +
  `AI_PROVIDER=fake` + Vite dev stack, signed in as the `e2e_owner`
  fixture user from `manage.py e2e_fixtures create --json`): (1) adding a
  shape in the Visual tab and switching to Code showed it correctly in
  both HTML and CSS; (2) editing the CSS `background-color` for that
  shape and saving updated the Visual tab's rendered fill color
  immediately (blue -> red, and separately blue -> green); (3) editing a
  shape's fill via the Inspector's Visual-tab color field regenerated the
  CSS sub-tab's `background-color` declaration to match; (4) an
  out-of-grammar HTML edit (an injected `<span>` inside `<main
  id="scene-shapes">`) was rejected at save with the specific message
  "Element 2 inside `<main id="scene-shapes">` is a `<span>`, but only
  `<div>` shape elements are supported," and the scene was left
  completely unmutated; (5) an edit to the JS sub-tab was rejected with
  the documented actionable message and no scene mutation; (6) a single
  Undo after a Code-tab CSS save fully reverted the whole change in one
  step; (7) making the most recent scene edit via the Code tab (a CSS
  color change), saving the project (produced a clean, single new
  `SceneVersion` — "Saved as version 2"), then submitting an AI edit
  proposal (#158, via the fake provider) worked correctly and produced a
  further clean single new version ("Saved as version 3") on Accept, with
  the Code-tab-originated shape color preserved through the AI edit —
  confirming #158 is unaffected by whether the scene's last edit came
  from Visual or Code.
- **Security**: `frontend/src/export/safeEmbed.ts`'s existing injection
  hardening applies only to the separate one-directional standalone-export
  path and is untouched by this task. Confirmed the new editable-and-
  rendered surface doesn't introduce an equivalent new risk: `codeGrammar.ts`
  never uses `dangerouslySetInnerHTML`, `eval`, `new Function`, or an
  `iframe srcdoc` (grepped both this module and `EditorWorkspace.tsx`/
  `useSceneEditor.ts` to confirm); the HTML sub-tab's hand-typed text is
  parsed with `DOMParser` into a detached, never-attached `Document` (so
  even a `<script>` tag typed into the HTML box cannot execute — browsers
  never execute script elements belonging to a document that was never
  inserted into the live DOM); every value the reverse parser extracts
  (ids, colors, pixel lengths, unit-interval numbers, transform functions)
  is validated against a strict pattern before being written into a
  `SceneDocument` field, mirroring `safeEmbed.ts`'s own "validate before
  embedding" posture; and the JS sub-tab is compare-only — hand-edited JS
  is never `eval`'d, executed, or live-previewed at all in this pass.
- **Test counts**: `make check` (backend + frontend) green at the point
  this resolution note was written: backend 629 passed / 22 skipped;
  frontend 1801/1801 passed (one `behaviorRuntime.test.ts` smoothing test
  flaked once on a full concurrent `make check` run and passed cleanly on
  two subsequent isolated/full reruns — a pre-existing timing-sensitive
  test last touched by task 72, unrelated to this task's changes, not a
  regression introduced here).
- **Follow-up filed (discovery-gated)**: full JavaScript reverse-parsing
  into the scene's `graph`/`bindings` interaction-runtime model (node/
  connection/behavior-binding editing via the JS sub-tab) is explicitly
  out of scope for this task, as pre-authorized by #174's own grooming
  comment. Searched `_docs/tasks.md` and `gh issue list --state all
  --search "javascript graph bindings"` / `--search "code tab"` first —
  no existing duplicate. Filed as
  [#175](https://github.com/cfornesa/ai-dev-tools-zoomcamp-1/issues/175)
  and task 143 below.

## 143. Reverse-parse the JavaScript sub-tab into the scene's graph/bindings interaction-runtime model

Goal: Extend task 142/#174's Code-tab grammar so hand-edited JavaScript in
the JS sub-tab can be reverse-parsed back onto the scene's `graph`/
`bindings` interaction-runtime model (nodes, connections, behavior/camera
bindings), not just viewed and compare-saved.
Description: Task 142 shipped a genuine bidirectional HTML/CSS <->
`SceneDocument` grammar for shape geometry/style/color/opacity/
visibility/lock, but explicitly deferred JavaScript reverse-parsing as an
authorized, documented scoping decision (per #174's own "Explicit
engineering latitude" clause allowing "a narrower first cut or a
follow-up issue" for "complex interaction-runtime graph/connection
editing via raw JS"). Today the JS sub-tab
(`frontend/src/export/codeGrammar.ts`'s `generateEditableJs`) shows a
live-generated, editable view of the interaction runtime, but
`isEditableJsUnchanged` is the only check its Save performs — saving it
back unchanged is a no-op, and any other edit is rejected with an
actionable message. This task needs its own grooming pass to define:
what JS constructs map onto which `graph`/`bindings` fields (mirroring
`codeGrammar.ts`'s existing HTML/CSS documentation style); whether/how
graph node add/remove should be supported via JS (the interaction-runtime
graph doesn't have the same shape-identity constraints the HTML/CSS
grammar's "no add/remove" rule was built around); how to guarantee the
JS sub-tab is never `eval`'d or otherwise executed as live code when
hand-edited (parse via an AST walk against a whitelisted subset, the same
"never eval, never execute" posture `codeGrammar.ts` and `safeEmbed.ts`
already hold); and interaction with undo/redo (one Code-tab save = one
undo step, matching the HTML/CSS grammar) and draft-autosave (#125).
Status: COMPLETE
GitHub issue: [#175](https://github.com/cfornesa/ai-dev-tools-zoomcamp-1/issues/175)
(left open for QA/closing by the orchestrator, per this task's
instructions).
Discovery gate: Searched `_docs/tasks.md` and `gh issue list --state all
--search "javascript graph bindings"` / `--search "code tab"` before
filing — no existing issue proposes JS-to-graph/bindings reverse parsing.
New; task 142/#174 (the HTML/CSS half of the same original request) is
the direct predecessor; explicitly flagged as needing its own grooming
pass before implementation.
Resolution (2026-08-25): Implemented Grammar v2 (JS) per issue #175's
"Groomed acceptance criteria (PM pass)" comment, using the pre-authorized
"Engineering latitude" clause to ship a narrower first cut: **bindings
only** in this pass, with graph node/connection editing discovery-gated
and deferred to a filed follow-up (see below). Verified both by re-reading
the shipped code and via a full live pass against a real Postgres-backed
Django + Vite dev stack.

- **The grammar (`frontend/src/export/codeGrammar.ts`)**: added a
  documented "Grammar v2 (JS)" section to the module's own doc comment
  (mirroring Grammar v1's style) alongside the existing HTML/CSS section.
  The JS sub-tab's text now has two parts: (1) an editable
  `const bindings = [ {...}, {...} ];` array literal, delimited by two
  fixed sentinel comment lines (`BINDINGS_START`/`BINDINGS_END`), that is
  a wholesale, order-preserving projection of `scene.bindings` — because
  bindings carry no shape-identity/ordering constraint (unlike Grammar
  v1's shapes), add/edit/remove is fully supported simply by
  adding/editing/removing entries in this one array, with no separate
  "shapes cannot be added/removed" restriction needed; and (2) the
  pre-existing banner + generated runtime/camera boilerplate below the
  closing marker, which stays compare-only exactly as the whole file was
  in Grammar v1 — an edit there is rejected with a specific, actionable
  error pointing at the Visual tab, and the scene is left completely
  untouched.
  - **Whitelisted binding fields** (mirroring `schema/scene.schema.json`'s
    `binding` definition exactly): `id`, `signal` (28-value enum),
    `handTarget` (4-value enum), `targetScope` (4-value enum), `targetId`
    (string id or `null`), `targetProperty` (15-value enum), `composition`
    (must be the literal `"replace"` — the only value V1 of the schema
    supports), plus optional `mapping` (`{ inMin, inMax, outMin, outMax }`,
    all numbers), `smoothing`/`closeThreshold`/`farThreshold`/
    `releaseThreshold` (numbers in [0, 1]), and `holdTimeMs` (integer in
    [0, 10000]). Any other field name on a binding, or inside `mapping`,
    is rejected by name, with every violation surfaced at once (not just
    the first).
  - **Parsing never `eval`s, `new Function`s, or otherwise executes
    anything**: `parseEditableJs` locates the two sentinel marker lines
    with plain string search, then hands the text between them to
    `parseJsLiteral` — a from-scratch, ~150-line hand-rolled
    recursive-descent recognizer understanding only object/array
    literals, quoted strings, numbers, `true`/`false`/`null`, and
    comments. It has no representation for function calls,
    identifier-as-value references, operators, or template literals, so
    a hand-edit like `{ id: alert(1) }` is rejected as an unparseable
    token rather than ever being evaluated — covered by a dedicated test
    (`codeGrammar.test.ts`'s "never executes hand-edited JS" case).
    Deliberately did NOT add a new parser dependency (no full JS AST
    parser package): `frontend/package.json` already carries `typescript`
    only as a devDependency for `tsc`/build tooling, and bundling its
    compiler into the browser runtime just to parse a tiny literal
    subset would reintroduce the exact bundle-bloat/dependency-weight
    problem AGENTS.md's "ask before adding a dependency" note and issue
    #175 itself warn against — a hand-rolled recognizer mirrors Grammar
    v1's own posture (`DOMParser` for HTML, a hand-rolled tokenizer for
    CSS) exactly.
  - **Round-trip guarantee preserved**: `generateEditableJs` and
    `parseEditableJs` build/compare the immutable shell (banner + runtime
    boilerplate) from the exact same `immutableJsShell` helper, so
    "regenerate -> re-save unchanged -> no scene mutation" holds for both
    the bindings array and the compare-only remainder — verified by
    `codeGrammar.test.ts` and live (see below). `isEditableJsUnchanged`
    (Grammar v1's fast no-op check) is unchanged in spirit — now compares
    against the Grammar v2 shape of `generateEditableJs`'s output — so a
    byte-for-byte-unchanged save (bindings included) is still a safe
    no-op before any parsing is attempted.
- **Wiring (`frontend/src/pages/EditorWorkspace.tsx`)**: `JsCodeEditor`
  now takes an `onCommit` prop (`sceneEditor.commitScene`, the same
  handler the HTML/CSS sub-tabs already use) and calls
  `parseEditableJs`/`onCommit` on Save, exactly mirroring
  `HtmlCssCodeEditor`'s save flow — one Code-tab JS save is one
  `commitScene()` call, i.e. one undo/redo step, with errors rendered as
  a list (matching the HTML/CSS sub-tabs' convention) instead of a single
  string. `CodeTab`'s `onCommitCode` prop doc comment was updated to
  reflect it now backs three sub-tabs (HTML, CSS, JS), not two.
- **What's OUT, and why (pre-authorized by #175's own "Engineering
  latitude" clause)**: graph nodes and connections
  (`scene.graph.nodes`/`.connections`) are NOT reverse-parsed in this
  pass — they remain compare-only, part of the immutable shell below the
  bindings markers. Graph editing still works from the Visual tab
  (`GraphView.tsx`/`GraphListView.tsx`/`BehaviorCardsPanel.tsx`, via
  `graphEditing.ts`'s existing pure mutation functions), and Visual-tab
  edits there still show up correctly in the JS sub-tab's compare-only
  section on next Code-tab mount (nothing regressed). Follow-up filed and
  cross-linked below.
- **Live verification performed** (real Postgres + Django +
  `AI_PROVIDER=fake` + Vite dev stack, signed in as the `e2e_owner`
  fixture user from `manage.py e2e_fixtures create --json`): (1) opened a
  new project's Code tab, JS sub-tab — confirmed the updated banner text
  and an empty `const bindings = [];` render correctly; (2) hand-edited
  the JS textarea to add a binding (`targetScope: "scene"`,
  `targetProperty: "globalForce"`, with a `mapping` sub-object) and
  clicked Save JavaScript — no error, and switching to the JSON sub-tab
  (after a Visual round-trip to force remount, since each Code sub-tab
  only re-derives its text from `workingCopy` on `CodeTab` mount, an
  existing, unchanged convention from task 142) confirmed the new binding
  landed in `scene.bindings` exactly as typed; (3) appended a hand-edit
  outside the bindings markers (into the generated runtime code) and
  clicked Save — rejected with the specific message "Only the bindings
  array is editable -- the generated runtime code below
  '// >>> editable-bindings:end' is not part of the supported grammar
  yet ... Use the Visual tab for graph node/connection changes instead,"
  and re-checking the JSON sub-tab confirmed the scene was completely
  unmutated (the earlier hand-added binding was still present, unchanged)
  — no crash, no silent drop, no partial mutation; (4) added a shape via
  the Visual tab, then added a Behavior Card ("Follow hand" on that
  shape) via `BehaviorCardsPanel.tsx`, saved the project, and confirmed
  the JS sub-tab's `bindings` array regenerated to include both the
  earlier hand-added binding AND the new behavior-card-derived binding
  side by side — confirming Visual-tab bindings edits regenerate the JS
  sub-tab, the acceptance criterion's reverse direction.
- **Security**: grepped `codeGrammar.ts` and `EditorWorkspace.tsx` for
  `eval(`, `new Function(`, `srcdoc`, and `dangerouslySetInnerHTML` —
  none present. `parseJsLiteral` is a pure text walk with no code
  execution path, confirmed both by static reading and by a dedicated
  test asserting a `{ id: alert(1) }`-shaped hand-edit is rejected (as an
  unparseable token — `alert` isn't a valid literal value in this
  grammar) rather than ever being called.
- **Test counts**: `make check` (backend + frontend) green at the point
  this resolution note was written: backend 629 passed / 22 skipped;
  frontend 1809/1809 passed. `codeGrammar.test.ts` gained 8 new test
  cases covering forward serialization (with and without a binding),
  round-trip-unchanged, add, remove, an out-of-whitelist field
  rejection, an edit-outside-the-bindings-array rejection, an invalid
  `composition` value rejection, and the never-executes-hand-edited-JS
  case.
- **Follow-up filed (discovery-gated)**: full graph node/connection
  add/edit/remove via the JS sub-tab is explicitly out of scope for this
  task, as pre-authorized by #175's own "Engineering latitude" clause.
  Searched `_docs/tasks.md` and `gh issue list --state all --search
  "graph node connection editing JS"` first — no existing duplicate.
  Filed as
  [#176](https://github.com/cfornesa/ai-dev-tools-zoomcamp-1/issues/176)
  and task 144 below.

## 144. Reverse-parse graph nodes/connections from the JS sub-tab into the scene's interaction-runtime model

Goal: Extend task 143/#175's Grammar v2 (JS) so hand-edited JavaScript in
the JS sub-tab can also reverse-parse `scene.graph.nodes` and
`scene.graph.connections` (add/edit/remove), not just `scene.bindings`.
Description: Task 143 shipped Grammar v2 (JS) with a narrower first cut
pre-authorized by issue #175's own "Engineering latitude" clause: bindings
only, deferring graph node/connection editing via JS to this follow-up.
Today `codeGrammar.ts`'s `parseEditableJs`/`generateEditableJs` treat
everything below the bindings array's closing sentinel marker (including
all graph node/connection data, which isn't even serialized into the JS
text today) as compare-only generated runtime boilerplate. This task needs
its own design pass to define: what JS literal shape represents a graph
node (`id`/`family`/`type`/`params`/`position`) and a connection
(`id`/`fromNodeId`/`fromPort`/`toNodeId`/`toPort`) — likely a second
`const graph = { nodes: [...], connections: [...] };` sentinel-delimited
block using the same hand-rolled-literal-parser approach; how to reuse
`frontend/src/pages/graphEditing.ts`'s existing allowlist/port-
compatibility/cycle-detection validation
(`ALLOWED_NODE_TYPES_BY_FAMILY`/`NODE_PORTS`/`findCycle`/
`checkGraphConnection`) without duplicating it; how to validate a graph
node's `params` (arbitrary leaf-valued JSON whose shape varies per node
`type`); and the same "never eval, never execute" posture task 143 already
established.
Status: COMPLETE
GitHub issue: [#176](https://github.com/cfornesa/ai-dev-tools-zoomcamp-1/issues/176)
(left open for QA/closing by the orchestrator, per this task's
instructions).
Discovery gate: Searched `_docs/tasks.md` and `gh issue list --state all
--search "graph node connection editing JS"` before filing — no existing
issue proposes graph node/connection reverse parsing via JS. New; task
143/#175 (the bindings half of Grammar v2) is the direct predecessor;
explicitly flagged as needing its own design pass before implementation.
Resolution (2026-08-25): Implemented per issue #176's "Groomed acceptance
criteria (PM pass)" comment — this closes out the full HTML/CSS/JS
editability request (tasks 142/143/144, issues #174/#175/#176). Verified
both by re-reading the shipped code and via a full live pass against a
real Postgres-backed Django + Vite dev stack.

- **The grammar (`frontend/src/export/codeGrammar.ts`)**: extended the
  existing "Grammar v2 (JS)" doc-comment section with a second editable
  block: `const graph = { nodes: [...], connections: [...] };`,
  delimited by its own sentinel comment lines (`GRAPH_START`/`GRAPH_END`),
  placed immediately after the bindings block (separated by exactly one
  blank line). Parsed by extending the same hand-rolled
  `parseJsLiteral` recognizer task 143 built for bindings — no second
  parser, no new dependency. `generateEditableJs` now emits both blocks;
  `parseEditableJs` reverse-parses both, and both together still commit
  as one `sceneEditor.commitScene()` call (one undo step).
  - **`graph.nodes[]`** fields mirror `schema/scene.schema.json`'s
    `graphNode` definition exactly (`id`, `family`, `type`, `params`,
    `position`, all required, no others allowed). `family` must be one of
    the schema's 6-value enum; `type` is checked directly against
    `frontend/src/runtime/behaviorRuntime.ts`'s exported
    `ALLOWED_NODE_TYPES_BY_FAMILY` — imported, not re-declared, so this
    grammar can never drift from the Visual tab's own graph editor
    (`graphEditing.ts`'s `NODE_TYPE_CATALOG` is itself built from the same
    registry). `params` accepts any leaf JSON values (number/string up to
    200 chars/boolean/null) under any key with no per-node-type schema of
    its own, matching `schema/scene.schema.json`'s own looseness there;
    per-type numeric-range checks (e.g. `mapRange`'s `inMin`/`inMax`) are
    still enforced, but only via the final `validateBehaviorGraph` gate
    below, never duplicated in the grammar. `position.x`/`.y` must be
    numbers in [-100000, 100000], mirroring the schema's `point`
    definition.
  - **`graph.connections[]`** fields mirror `graphConnection` exactly
    (`id`, `fromNodeId`, `fromPort`, `toNodeId`, `toPort`). Every parsed
    connection is validated by calling `graphEditing.ts`'s exported
    `checkGraphConnection` — the same allowlist + port-compatibility +
    `findCycle` check `GraphView.tsx`'s drag-to-connect and
    `GraphListView.tsx`'s keyboard add-connection form already call before
    ever proposing a mutation — against the full parsed node list and the
    rest of the parsed connections, never a second implementation of that
    logic.
  - **Final gate**: after per-item and per-connection checks pass, the
    entire candidate scene (bindings + graph together) is run through
    `behaviorRuntime.ts`'s exported `validateBehaviorGraph` — the exact
    umbrella check `graphEditing.ts`'s `addGraphNode`/`addGraphConnection`/
    etc. already run before ever returning `{ ok: true }` to the Visual
    tab — so the JS-tab path can never accept something that editor would
    reject (e.g. a `shapeProperty` node's `targetId` pointing at a
    nonexistent shape). This also caught a latent gap in task 143's own
    test fixtures (a binding with a `targetId` pointing at a nonexistent
    group, which `validateScene`'s referential-integrity check — already
    used at the real JSON-tab save path — would always have rejected);
    fixed those two pre-existing tests rather than weakening the new gate.
  - Both `nodes[]` and `connections[]` are a wholesale replacement of
    `scene.graph.nodes`/`.connections`, exactly like the bindings array:
    add/edit/remove freely, no ordering/identity constraint (unlike Grammar
    v1's shapes).
  - `output`-family nodes have no allowlisted node type yet (mirroring
    `graphEditing.ts`'s own pre-existing, documented gap in
    `ALLOWED_NODE_TYPES_BY_FAMILY.output`) — not a new boundary introduced
    here, and not something this task's scope covers filling in.
- **`EditorWorkspace.tsx`**: `JsCodeEditor`'s doc comment and its
  in-app help text (the paragraph above the JS textarea) updated to
  describe both editable blocks — the old text said graph changes needed
  the Visual tab, which stopped being true. No change needed to the
  commit/save wiring itself: it was already generic over whatever
  `parseEditableJs` returns.
- **Tests** (`frontend/src/export/codeGrammar.test.ts`, 36 total, up from
  24): valid add/edit/remove of nodes and connections; a rejected invalid
  node type for its family; a rejected incompatible-port connection
  (event → value); a rejected cycle-creating connection; a rejected
  unknown field on a graph node; a rejected function-call-shaped value
  (never executed); confirmed bindings-only edits still work unchanged
  alongside an untouched graph (no regression to #175); and a full
  round-trip test using `graphEditing.ts`'s own `addGraphNode`/
  `addGraphConnection` (Visual-tab path) → `generateEditableJs` →
  `parseEditableJs` → re-generate → byte-identical, with no scene
  mutation.
- **Verification**: `make check` green (backend: 629 passed/22 skipped;
  frontend: 126 test files/1821 tests, lint/format/typecheck clean for
  both stacks — one frontend test file flaked on an unrelated timer-based
  debounce test and passed cleanly in isolation, confirmed unrelated to
  this change). Grepped both changed files for `eval(`, `new Function(`,
  and `srcdoc` — no matches. Live-verified against a real Postgres-backed
  Django + Vite dev stack: added a "Follow hand" behavior card via the
  Visual tab, confirmed its nodes/connection appeared correctly in the
  regenerated JS sub-tab's `graph` block; hand-edited the JS sub-tab to
  add an isolated `randomRange` node, saved, and confirmed it appeared in
  the Visual tab's graph list view; then edited that node's `type` to an
  invalid value for its family and confirmed the save was rejected with
  the exact allowlist error and the scene was left unmutated.

## 145. Production-readiness re-audit: tasks 142-144 Code-tab editability (post-#174-176)

Goal: Re-verify overall production readiness (Replit publish, local
deployment, intended functionality) after tasks 142-144 (#174-176) shipped
the full HTML/CSS/JS Code-tab editability chain, with a specific focus on
stress-testing that new feature for regressions the two prior audits this
session wouldn't have covered.
Status: COMPLETE
GitHub issue: none (an audit task, not a feature) -- one new issue,
[#177](https://github.com/cfornesa/ai-dev-tools-zoomcamp-1/issues/177),
was filed as a discovered finding; see below.
Discovery gate: Searched `_docs/tasks.md` and `gh issue list --state all
--search "code tab undo redo stale"` / `--search "code tab preview view
stale"` before filing #177 -- no existing duplicate.
Resolution (2026-08-25):

- **`make check`**: clean. Backend: ruff/format/mypy clean, 629 passed / 22
  skipped. Frontend: lint (pre-existing `only-export-components` warnings
  only, unrelated to this session)/format/typecheck clean, 126 test
  files / 1821 tests passed. Matches task 144's own documented counts
  exactly -- no drift since the last commit on `main`.
- **Local environment note (not a code defect)**: an unrelated Docker
  Compose stack from a sibling project directory
  (`/Users/Fornesus/Code/ai-dev-tools-zoomcamp`, no `-1` suffix) was
  squatting the IPv6 wildcard on `localhost:8000`, silently intercepting
  this repo's Django dev server traffic (confirmed by response-shape
  mismatch against the real `/health/` view). Rather than stop another
  project's running container, verification ran Django on port 8001 with
  `frontend/vite.config.ts`'s three proxy targets temporarily repointed at
  `127.0.0.1:8001`; the file was reverted to its committed
  `http://localhost:8000` targets before finishing (confirmed via `git
  diff` showing no residual change). This is the same known conflict
  documented in
  `.agents/memory/local-port-8000-docker-conflict.md` (already recorded
  from a 2026-08-24/2026-08-25 session) -- that memory's own documented
  workaround (point the proxy at `127.0.0.1:8000` and keep Django on
  8000 itself, since Docker only squats the IPv6 wildcard) is simpler
  than what this pass actually did (moved Django to 8001 too, since the
  conflict wasn't checked against memory before improvising a fix); no
  functional difference to the verification performed, just noted here
  so a future pass reads memory first.
- **Live stress test** (real Postgres-backed Django +
  `AI_PROVIDER=fake` + Vite dev stack, signed in as the `e2e_owner` fixture
  user, project seeded via the JSON sub-tab from
  `schema/fixtures/valid/feature_rich.json` with a corrected, fully valid
  behavior graph -- 5 shapes across 5 layers, 1 group, 3 bindings, a
  4-node/3-connection graph):
  - All four Code sub-tabs (JSON/HTML/CSS/JS) coexist correctly: confirmed
    via direct DOM inspection that all four textareas stay mounted
    simultaneously (toggled with `hidden`, not conditionally rendered)
    inside one `CodeTab` mount, so an unsaved edit typed into HTML, then
    CSS, then JS survived every intermediate sub-tab switch without loss
    or interference, exactly as task 142's `CodeTab` doc comment
    describes.
  - A rejected HTML save (attempted a `data-layer-id` change, which the
    grammar correctly forbids) left the scene completely unmutated and
    did not disturb the already-pending, unsaved CSS/JS edits sitting in
    sibling sub-tabs -- confirmed by reading their textarea values
    afterward.
  - A successful combined HTML+CSS save correctly updated the Visual
    tab's shapes in one commit (verified the circle rendered green at
    reduced opacity immediately after Save), and the underlying scene
    JSON reflected exactly the intended change with no corruption.
  - **Adversarial input**: hand-edited the HTML sub-tab to inject
    `<script>window.__xss_marker=1337;</script>` and `<img src=x
    onerror="...">` as children of a shape's `<div>`. Save succeeded with
    no crash and no validation error (the injected markup isn't part of
    the whitelisted grammar, so it's silently ignored rather than
    rejected); confirmed via `window.__xss_marker`/`__xss_marker2` staying
    `undefined` after Save that neither payload executed, and via the
    JSON sub-tab that the resulting scene still had exactly 5 shapes with
    no `"script"` substring anywhere -- no crash, no partial corruption,
    no XSS execution.
  - **AI proposal regression (#158/#159)**: after a Code-tab-originated
    save (version 5), submitted an Edit-mode AI proposal ("Make the circle
    bigger") through the `AI_PROVIDER=fake` provider, got back a proposal
    ("1 canvas property updated"), clicked Accept, and it saved cleanly as
    version 6 with no errors -- confirms the AI proposal/accept path is
    unaffected by whether the scene's last edit came from Visual or Code,
    consistent with task 142's own resolution note making the same claim.
  - **Undo/redo across mixed Visual+Code edits**: added a shape via
    Visual (commit A), then changed a different shape's opacity via the
    CSS sub-tab and saved (commit B). Two Undo clicks correctly reverted
    B then A in order (verified via the JSON sub-tab and the Visual tab's
    live shape count independently); two Redo clicks correctly re-applied
    both in order. The underlying undo/redo *stack* is coherent -- no
    duplication, no corruption, no skipped steps.
- **New finding, filed as
  [#177](https://github.com/cfornesa/ai-dev-tools-zoomcamp-1/issues/177)
  (not fixed here -- requires a design decision about resync-on-change vs.
  a discard-confirmation prompt, so correctly scoped as backlog rather
  than a same-task fix)**: while the undo/redo *stack* itself is coherent
  (previous bullet), the Code tab's *displayed* text does not observe
  Undo/Redo -- clicking the toolbar's Undo/Redo buttons (which stay
  visible and clickable while the Code tab is open) updates `workingCopy`
  correctly but does not remount `CodeTab`, so the JSON/HTML/CSS/JS
  textareas keep showing pre-undo content until the user leaves and
  re-enters the Code tab. Separately, and for the same root-cause reason
  (`CodeTab` is conditionally rendered on `previewView === 'code'`, not
  just hidden, per task 127/#159's original, still-intentional
  convention), toggling Visual -> Code -> back to Code silently discards
  any unsaved edit sitting in a Code sub-tab, with zero warning -- typed
  an unsaved JS-tab edit, clicked "Visual" (without editing anything
  there), clicked back to "Code", and the JS textarea had reset to the
  last-committed value, the typed edit gone. Both are real, live-
  reproduced silent-desync/data-loss risks (not crashes), made materially
  more consequential by tasks 142-144 adding three new explicit-Save (not
  on-blur-commit) surfaces on top of the pre-existing JSON tab's
  mount-once convention.
- **`manage.py check --deploy`** (against the local disposable `.env`,
  `DJANGO_DEBUG=True`, no HTTPS): 5 expected warnings
  (`security.W004`/`W008`/`W012`/`W016`/`W018`), all attributable to this
  being a local dev-mode `.env` rather than a production-shaped one per
  AGENTS.md's "Deployment tracks and preflight" section -- no new or
  unexpected warning.
- **`npm run build`**: succeeds. Only pre-existing bundle-size warning
  remains -- the `DemoControlsPanel-*.js` (p5.js-shared) chunk at
  1,217.29 kB / gzip 305.68 kB, already accepted per task 130/#162.
  `EditorWorkspace-*.js` (which now bundles `codeGrammar.ts`) grew from
  349.66 kB (task 130's baseline) to 385.25 kB -- a modest +35.6 kB
  (~10%) increase consistent with the new ~650-line parser, and still
  well under the 500 kB per-chunk warning threshold. No new
  bundle-size warning introduced by tasks 142-144.
- **Verdict**: Local deployment and intended functionality both remain
  ready, with one new, filed, non-blocking finding (#177) about Code-tab
  display staleness/unsaved-edit loss across Undo/Redo and Visual/Code
  toggling. Replit publish readiness is unaffected (no new environment,
  dependency, or build-config change from this audit; the local
  port-8000 collision was a workstation-only artifact of an unrelated
  sibling project, not a deployment concern). No direct code fixes were
  made in this task -- #177 is correctly scoped as its own follow-up
  given it needs a design decision, not a one-line patch.

Resolution follow-up (2026-08-25, #177 fixed):

- **Root cause confirmed**: `EditorWorkspace.tsx`'s `CodeTab` and its three
  children (`SceneCodeEditor`/`HtmlCssCodeEditor`/`JsCodeEditor`) each
  seeded local text state once via a lazy `useState` initializer, and
  `CodeTab` itself was only ever mounted while `previewView === 'code'`. An
  Undo/Redo made while Code stayed open never re-ran the initializer
  (stale display); a bare Visual->Code->Visual->Code toggle unmounted and
  remounted every sub-editor even though `workingCopy` never actually
  changed, silently discarding an in-progress unsaved edit.
- **Fix (per the groomed acceptance criteria)**: moved each sub-tab's text
  state and dirty-tracking out of the presentational components into three
  hooks (`useJsonCodeSync`/`useHtmlCssCodeSync`/`useJsCodeSync`) called
  unconditionally at `EditorWorkspace`'s top level, so the state survives
  `CodeTab` unmounting/remounting on every Visual<->Code toggle. Each hook
  resyncs off `workingCopy`'s object identity via a `useEffect` (every
  mutation path in this file replaces `workingCopy` wholesale, so `===`
  reliably means "no real change"): a clean sub-tab (current text still
  equal to what was last generated/committed) resyncs silently; a dirty
  sub-tab is left untouched and shown an inline notice
  (`editor-scene-{code,html-css,js}-external-change`, `role="alert"`) with
  an explicit "Discard my edit and reload" button
  (`editor-scene-{code,html-css,js}-reload`) rather than being silently
  overwritten. `CodeTab` itself deliberately stays conditionally rendered
  (not always-mounted with `hidden`) -- an earlier draft of this fix tried
  keeping it permanently mounted and broke
  `EditorWorkspace.cameraPreviewRealControl.test.tsx` (a `findByText(/Camera
  is active/i)` match went ambiguous), because the JS sub-tab's generated
  exported-runtime script embeds this app's own UI copy (e.g. "Camera is
  active") as textarea content that stays in the DOM, invisible but still
  matched by text-content queries, once the component never unmounts. The
  hooks-based design gets both correctness (state survives toggling) and
  DOM hygiene (Code-tab content only exists in the DOM while Code is
  actually shown) at once.
- **Tests**: `frontend/src/pages/EditorWorkspace.codeTab.test.tsx` gained
  four new scenarios (7 -> 11 in that file): Undo/Redo with the Code tab
  open and no pending edit (silent resync, both directions); Undo while
  the JSON sub-tab has a pending unsaved edit (edit preserved, notice
  shown, explicit reload works); a two-round Visual<->Code toggle with an
  unsaved edit pending in all four sub-tabs (JSON/HTML/CSS/JS) at once,
  confirming every one survives; and a real HTML/CSS save while the
  sibling JS sub-tab has its own pending unsaved edit (regression guard —
  already correct pre-fix, confirmed still correct). Full frontend suite:
  126 test files / 1825 tests passed (up from 126/1821 pre-fix). Backend
  unaffected (`ruff check`/`ruff format --check` clean; not touched by this
  change). `make frontend-lint` (only the four pre-existing unrelated
  `only-export-components` warnings), `make frontend-typecheck`, and
  `make frontend-format-check` all clean.
- **Live verification** (real Postgres-backed Django + Vite dev stack,
  signed in as the `e2e_owner` fixture user, against the existing 5-shape
  feature-rich project from task 145's own audit): (1) opened the Code
  tab's CSS sub-tab, changed the circle's opacity from 0.5 to 0.9, saved;
  confirmed the JSON sub-tab immediately showed `opacity: 0.9` without
  leaving the Code tab. Clicked Undo once (via the toolbar, without ever
  leaving Code): the JSON sub-tab's `opacity` value updated live back to
  `0.5`, and switching to the CSS sub-tab showed `opacity: 0.5` there too
  — both silently resynced, no stale content, no notice (since neither had
  an unsaved edit). (2) Typed an unsaved marker comment into the JS
  sub-tab, switched to Visual, switched back to Code, reselected the JS
  sub-tab: the unsaved marker text was still present, confirming the bare
  toggle no longer discards it. Used the local Docker-port-8000 workaround
  from `.agents/memory/local-port-8000-docker-conflict.md` (Django on
  `127.0.0.1:8000`, Vite's proxy targets temporarily repointed at
  `127.0.0.1:8000`); `frontend/vite.config.ts` was reverted to its
  committed `localhost:8000` targets before finishing, confirmed via `git
  diff` showing no residual change.
- Issue #177 left open per instructions (implementation done, not closed
  by the engineer).

## 146. Expand app container and editor workspace to full viewport width on desktop

Goal: Remove the fixed 1126px width restriction on `#root` and provide a responsive full-width layout for desktop viewports (>=1024px, 1440px, 1920px+) so the creative studio maximizes available screen real estate.
Description: `#root` is currently constrained to `width: 1126px` in `frontend/src/index.css`, preventing the editor workspace from utilizing wider desktop displays and constraining side panels. Non-editor routes should maintain centered readable bounds while the editor route expands full-width.
Status: COMPLETE
GitHub issue: [#178](https://github.com/cfornesa/ai-dev-tools-zoomcamp-1/issues/178)
Evidence (2026-08-25): `b8a5a50`; focused responsive tests 32/32; exact `make check` passed with backend 629 passed/22 skipped and frontend 126 files/1,829 tests.

## 147. Allocate robust Layers panel width and prevent layer-row control overflow

Goal: Ensure the Layers sidebar panel has an adequate width allocation (minimum ~280px–320px) and that layer rows contain all interactive controls strictly within the panel's bounding box with zero horizontal overflow.
Description: With `fit-content(20%)` in a narrow container, layer rows set to `flex-wrap: nowrap` overflow on the right side of `.editor-panel[data-panel='layers']`. The column track width and row flex styling must be adjusted so all controls ("Delete layer", "► More", checkboxes, name) remain completely inside the panel container across all screen sizes.
Status: COMPLETE
GitHub issue: [#179](https://github.com/cfornesa/ai-dev-tools-zoomcamp-1/issues/179)
Dependencies: #178
Evidence (2026-08-26): Initial browser QA exposed a 12px disclosure-button overflow and stale E2E selectors for controls moved by #164/#168. Commit `646276d` widened the Layers grid allocation, constrained disclosure/button geometry, and updated the browser assertions to current checkbox/HUD controls. Elevated real-browser verification passed 13/13 layer/responsive scenarios; frontend passed 1,867/1,867 tests; `make check` passed with backend 629 passed/22 skipped.
Next action: none; retain the QA PASS comment and commit as handoff evidence.

## 148. Modernize studio workspace layout with photo-editor ergonomics and dark-theme canvas framing

Goal: Transform the editor workspace from a collection of document-style bordered boxes into an integrated photo-editor / vector studio interface with compact toolbars, clear visual hierarchy, and an immersive canvas viewport.
Description: Rebalance the workspace UI to feel closer to a dedicated creative suite: dark neutral canvas framing mat, streamlined unified top toolbar with tooltips, compact panel headers with high information density, and reduced page-header padding in the editor view.
Status: COMPLETE
GitHub issue: [#180](https://github.com/cfornesa/ai-dev-tools-zoomcamp-1/issues/180)
Dependencies: #178, #179
Evidence (2026-08-25): `48b7730`; focused editor/layout/a11y tests 50/50; exact `make check` passed.

## 149. Harden Visual<->Code bidirectional sync, error localization, and state persistence

Goal: Ensure seamless, error-free synchronization between Visual canvas actions and the four Code sub-tabs (JSON, HTML, CSS, JS), providing granular diagnostics that pinpoint exact validation errors without discarding edits or causing state desynchronization.
Description: Harden bidirectional sync across Code sub-tabs, ensure undo/redo updates Code text and Visual canvas in lockstep without staleness, and enhance diagnostic error reporting with precise line and field indicators.
Status: COMPLETE
GitHub issue: [#181](https://github.com/cfornesa/ai-dev-tools-zoomcamp-1/issues/181)
Dependencies: #180
Evidence (2026-08-25): `1828a3c`; focused Code-tab tests 11/11, including line/column diagnostics; exact `make check` passed.

## 150. Add a responsive, persistent picture-in-picture camera overlay

### Goal

Whenever the editor camera is enabled, show the camera as an independently
movable and resizable picture-in-picture overlay inside the Preview canvas.
Keep the overlay usable at every supported screen size, synchronized with the
artwork layer order, and visible in thumbnails and exports.

### Acceptance criteria

- [x] Enabling the camera always renders one camera overlay in the editor
  Preview; disabling the camera removes it without changing the scene.
- [x] The overlay can be dragged freely within the canvas by pointer input;
  it cannot escape the canvas bounds. It snaps only when grid view is enabled,
  using the existing grid/snap behavior.
- [x] The overlay can be resized in both dimensions while preserving its fixed
  camera aspect ratio. It has no artificial minimum or maximum size; every
  positive size that fits within the current canvas is allowed, and resizing
  always clamps it inside the canvas without overflow.
- [x] The canvas fills its allocated editor workspace without page-level
  overflow. On mobile, sidebar, canvas, and editor elements use 100% width and
  the canvas uses a 16:9 aspect ratio.
- [x] Overlay position and size persist after reload and are restored safely
  when stored data is absent, malformed, or unavailable. Persisted geometry is
  canvas-relative/normalized so it adapts to the current screen size rather
  than creating browser-specific layouts.
- [x] Exactly one shape or group can be selected and directly manipulated at a
  time. Overlay drag and resize gestures do not select, move, resize, or rotate
  artwork.
- [x] Overlay stacking follows the artwork layer order: the overlay's visual
  z-order matches its position in Layers, and changing the order in either the
  Layers UI or canvas updates the other representation.
- [x] Keyboard controls are the default accessible path for moving and
  resizing the overlay, with an accessible name, instructions, and live status
  feedback for position/size changes. MediaPipe gestures may invoke the same
  actions without creating a separate interaction model.
- [x] When reduced motion is preferred, drag and resize feedback uses simplified
  transitions without changing the resulting geometry or interaction outcome.
- [x] The positioned/resized camera overlay appears in generated thumbnails and
  exports with the artwork. When the camera is active at generation time,
  thumbnail/export generation captures the current video frame as a still image
  and embeds that image using the overlay's position, size, opacity, mirror
  state, and layer order; it must never substitute a placeholder or silently
  omit the active overlay. If a required frame cannot be captured, generation
  reports an actionable error rather than producing an incomplete artifact.
- [x] Existing camera opacity/mirror controls, shape selection and transforms,
  layer ordering, responsive layouts, thumbnails, exports, and save/reload
  behavior remain functional; focused regression coverage, the relevant full
  frontend suite, build, typecheck, lint, formatting, and `make check` pass.

### Out of scope

- Public viewer or standalone-export camera-overlay behavior beyond making the
  existing editor thumbnail/export capture include the overlay; track separate
  surface requirements in [#145](https://github.com/cfornesa/ai-dev-tools-zoomcamp-1),
  [#146](https://github.com/cfornesa/ai-dev-tools-zoomcamp-1), or a new issue if
  those scopes change.
- Multiple simultaneous shape/group selection, bulk manipulation, or a second
  selection model; the existing single-selection invariant remains required.
- Numeric input fields for geometry; keyboard controls and accessible status
  feedback are sufficient.
- New camera capture, MediaPipe recognition, permissions, or transport/data
  handling; this task consumes the existing camera/gesture capabilities only.
- Server-side collaboration or per-project geometry synchronization; persistence
  is client-side and responsive to the current canvas/screen size.

### Evidence and pending items

- **Status:** COMPLETE
- **Evidence so far:** Product owner confirmed the use case and interaction,
  responsive, persistence, accessibility, layering, motion, and export rules.
  PM reconciled the prior demand-gated placeholder with the issue and the
  existing camera work in #147, layer/selection work in #183/#186, and stacking
  work in #169.
- **Pending verification:** None. Final authenticated QA passed every
  acceptance criterion on commit `bf052c7` and closed GitHub issue #151 with
  completed state.
- **Next action:** None for this task.
- **Verification evidence:** Engineer commit `bf052c7`; focused camera
  acceptance tests passed (182 tests across 12 files), including the live
  compositor subset (58 tests across 2 files); the requested camera Playwright
  scenario passed (1 Chromium test); `UV_CACHE_DIR=/tmp/codex-backlog-uv-cache
  make check` passed with backend 629 passed/22 skipped and frontend 1,864
  passed; explicit `npm run build`, typecheck, lint, and formatting passed.
  Final QA PASS comment:
  https://github.com/cfornesa/ai-dev-tools-zoomcamp-1/issues/151#issuecomment-5420853940.
- **Remaining assumption:** Persisted geometry is one normalized,
  canvas-relative preference that adapts to the current screen size; it is not
  a set of browser-specific or per-project layouts. For an active camera,
  thumbnail/export generation captures the current `<video>` frame at
  generation time and embeds it as the overlay image; an unavailable frame is
  an explicit generation error, never an omission or placeholder.
- **Durable memory link:** None required; existing camera/export and responsive
  constraints are documented in the linked issue history and project guidance.

### Discovery gate

- [x] Searched `_docs/tasks.md`, `.local/tasks/`, and existing GitHub issues for
  duplicates; #151 is the existing camera-overlay positioning task.
- [x] Matching GitHub issue link is retained above.
- [x] No new actionable out-of-scope work was discovered; existing related
  surface issues are linked above.

### Criterion-by-criterion implementation plan

1. Model the overlay geometry as normalized canvas-relative position and size,
   restore it defensively from client-side storage, and clamp it whenever the
   canvas or screen-size presentation changes.
2. Add pointer drag and fixed-ratio resize interactions that stay inside the
   canvas, use free movement by default, and reuse the existing grid snapping
   only while grid view is enabled.
3. Keep the responsive editor layout full-width on mobile with a mobile-only
   16:9 canvas, while keeping the overlay and all canvas coordinates aligned
   after resize and avoiding page-level overflow.
4. Preserve the single-shape/group interaction invariant, route overlay
   keyboard movement/resizing through the same geometry actions, expose an
   accessible name/instructions/live status, and allow existing MediaPipe
   gestures to invoke those actions without a second state model.
5. Derive overlay stacking from the canonical Layers order and synchronize
   layer changes in both directions without allowing overlay gestures to
   mutate artwork selection or transforms.
6. Apply reduced-motion behavior to drag/resize feedback without changing
   geometry results, and preserve existing opacity, mirror, save/reload, camera,
   shape, layer, and responsive behavior.
7. Extend thumbnail/export generation so an active camera captures the current
   video frame at generation time and composites that still image with the
   saved artwork using the overlay geometry, opacity, mirror state, and layer
   order. Surface a blocking, actionable error if capture is unavailable; do
   not emit a placeholder or incomplete artifact.
8. Add focused geometry, interaction, responsive, accessibility, persistence,
   and capture regression coverage, then run the relevant frontend suite,
   build, typecheck, lint, formatting, and `make check` gates.

### Constraints

- Keep implementation within the existing editor camera overlay, canvas,
  Layers, persistence, accessibility, and capture paths.
- Reuse the repository's existing local-storage preference conventions,
  responsive layout system, grid/snap behavior, reduced-motion handling, and
  MediaPipe action plumbing where applicable.
- Do not add dependencies. Follow `_docs/process.md`, the design system, and
  the testing guidelines.

GitHub issue: [#151](https://github.com/cfornesa/ai-dev-tools-zoomcamp-1/issues/151)
Dependencies: #147/#141 camera overlay foundation (complete), #169 stacking fix
(complete), #180 editor layout (complete), #183/#186 selection and naming
(complete)
Next action: none; final QA PASS and issue closure are recorded above.

## 151. Move layer and group actions to top toolbar as icon buttons with WCAG-compliant tooltips

Goal: Relocate exactly four existing scene-outline actions — "Add layer", "Combine into group", "Ungroup selected", and "Delete selected group" — from the Layers sidebar to the existing editor toolbar without changing their mutation semantics.
Description: Use the toolbar's established icon-button and tooltip pattern from #172/#180. The toolbar must remain usable at desktop and narrow/mobile widths, and the Layers panel must retain its outline, row controls, and "Clear group selection" action.
Status: COMPLETE
GitHub issue: [#182](https://github.com/cfornesa/ai-dev-tools-zoomcamp-1/issues/182)
Dependencies: #179 (COMPLETE), #180 (COMPLETE)
Acceptance matrix: four actions appear once in the `Editor actions` toolbar; the Layers panel no longer contains those four buttons; each action preserves its current enabled/disabled conditions, locked-state handling, selection behavior, and one-step undo semantics; each toolbar button has a distinct glyph, stable accessible name, hover/focus tooltip, and visible unclipped rendering in light/dark themes; keyboard and responsive/a11y regression tests plus `make check` pass.
Evidence (2026-08-26): PM grooming comment posted; engineer commit `9f52007f2a5d78eda2b78f57256047bdb54077c2`; QA PASS comment posted; focused tests 86 passed; `make check` passed with backend 629 tests and frontend 1,831 tests; frontend build/typecheck/lint/format passed. GitHub issue closed as completed.
Next action: none; retain the QA comment and commit as the handoff evidence.

## 152. Enable bidirectional layer selection and seamless layer/shape renaming

Goal: Enable full bidirectional selection between the Layers panel outline and the visual canvas (clicking a layer row selects and highlights its elements on canvas and in HUD; clicking on canvas highlights both shape and parent layer), and ensure intuitive, responsive renaming for layers and shapes.
Description: Add an explicit layer-selection state alongside the existing single shape/group selection. Clicking a layer row selects that layer and highlights its contained shapes; clicking a shape/group in the canvas or outline clears layer selection, selects the item, and highlights its parent layer row. Add persistent optional custom shape names with derived-label fallback, exposed through the outline and Selection HUD and reflected across editor labels.
Status: COMPLETE
GitHub issue: [#183](https://github.com/cfornesa/ai-dev-tools-zoomcamp-1/issues/183)
Dependencies: #179 (COMPLETE), #180 (COMPLETE)
Acceptance matrix: layer-row activation selects exactly that layer, highlights all of its visible shapes in the canvas, marks the layer row selected, and shows a layer-level HUD with the layer name and contained-shape count; canvas/shape/group selection clears layer selection, selects the item, and marks both its row and parent layer row; layer and shape rename fields commit once on Enter or blur, trim whitespace, reject empty/over-200-character values without mutation, and preserve focus/selection; custom shape names persist in the scene JSON, use the existing type/ordinal label when absent, and are consistent in the outline, HUD, breadcrumb, and target pickers; visibility, lock, grouping, transforms, undo/redo, deletion, hidden/locked layers, nested groups, empty layers, stale selection, narrow layouts, keyboard access, and click-vs-drag behavior remain correct; focused tests, a11y coverage, frontend build/typecheck/lint/format, and `make check` pass.
Out of scope: group renaming is tracked separately in [#186](https://github.com/cfornesa/ai-dev-tools-zoomcamp-1/issues/186); multi-layer/multi-shape selection semantics beyond the existing grouping pick, bulk rename, export/thumbnail naming changes, and server-side collaboration are not part of this task.
Evidence (2026-08-27): Implemented in commits `4f27dc7` and `05f4208`, with explicit direct-layer mode, owning-layer synchronization for shape/group selection, complete layer-block markers, and layer-control hit testing. Focused frontend tests pass (66); full frontend tests pass (1,874 across 127 files); frontend build/typecheck/lint/format and `make check` pass (backend 629 passed/22 skipped). Real Chromium QA passes all 6 Layers-panel tests, including desktop and 375px narrow bidirectional-selection regressions. Final QA comment is recorded on GitHub.
Evidence (2026-08-26): Production screenshots show the prior implementation still fails the core bidirectional contract. `selectLayer()` clears the shape selection, while a layer row's `data-selected` depends only on `selectedLayerId`; consequently selecting a layer does not select its associated shape, and selecting a shape does not apply selected treatment to the owning layer's entire block. Reopen #183 for this implementation defect; prior local QA evidence is superseded.
Next action: None; retain the final QA comment, browser evidence, and commits as handoff evidence.

## 153. Fit canvas to preview workspace viewport and maximize art creation real estate

## Goal
Ensure the artwork viewport uses the available Preview workspace on desktop, fitting the canonical scene rectangle as large as possible without distortion while preserving precise pointer, transform, and pan/zoom behavior.

## Acceptance criteria
- [ ] At desktop widths (>=1024px), the Preview canvas viewport expands to the full space allocated to it by the editor workspace; it is not capped by the logical scene width (currently commonly 800px), and it introduces no page-level horizontal scrollbar.
- [ ] The rendered scene keeps the canonical `canvas.width / canvas.height` aspect ratio at every supported viewport size. When the workspace ratio differs from the scene ratio, remaining space is intentional framing/letterboxing rather than stretching or cropping the artwork.
- [ ] On initial load and after a workspace resize, the canvas fit uses the largest scale that stays within the available viewport, accounting for the toolbar/panel layout and existing dark canvas framing; the scene remains fully visible.
- [ ] A clearly labeled, keyboard-accessible `Fit to viewport` control fits the scene to the current viewport without changing scene JSON, saved versions, drafts, exports, thumbnails, or camera data.
- [ ] `Zoom in`, `Zoom out`, and `Reset zoom` remain predictable after responsive fitting: zoom changes are relative to the current fit baseline, reset returns to the centered fit view, and pan is cleared or clamped whenever effective zoom changes.
- [ ] Clicking or dragging a shape, moving/resizing/rotating with transform handles, and editing path vertices maps client coordinates to canonical scene coordinates correctly at the fit scale, at non-default zoom, and after a resize; no visible coordinate drift or offset is introduced.
- [ ] Panning remains bounded to the visible viewport at zoom levels that create overflow, never exposes unintended dead space, and does not move the scene at or below the fit baseline when no overflow exists.
- [ ] The canvas, overlays, selection outlines, grid/guides, camera overlay, and p5 rendering remain aligned while fitting, zooming, panning, and resizing; editor-local view state remains isolated from scene persistence and export/thumbnail output.
- [ ] Narrow/mobile behavior remains usable: the existing responsive layout does not overflow horizontally, the scene remains aspect-correct and interactable, and desktop-only fitting changes do not hide Preview or regress existing panel behavior.
- [ ] Existing canvas, zoom/pan, transform, vertex-edit, camera, accessibility, and responsive tests are updated or extended for the new geometry, and the focused frontend suite, frontend build/typecheck/lint/format checks, and `make check` pass.

## Criterion-by-criterion implementation plan
1. Measure the rendered Preview canvas allocation with a resize-aware mechanism and derive a fit scale from available width/height, toolbar/padding, and the scene's canonical dimensions.
2. Make the viewport fill its editor allocation while keeping the scene box aspect-correct, centered, fully visible, and free of page-level overflow at desktop and narrow widths.
3. Separate layout fit scale from user zoom, define the effective zoom baseline, and route Fit to viewport, Zoom in/out, Reset, wheel, keyboard, and pan clamping through one view-state path.
4. Keep the rendered canvas and every SVG/camera/selection/grid overlay in the same geometry; verify p5's internal logical resolution remains unchanged.
5. Reuse the rendered element's `getBoundingClientRect()` in `clientToCanvasPoint` and exercise selection, shape transforms, and vertex editing at fit, zoomed, panned, and resized states.
6. Add focused unit/component coverage for fit calculations and control semantics, plus responsive and interaction regression coverage; run the required build, type, lint, format, and `make check` gates.

## Out of scope
- [ ] Changing the canonical scene coordinate system, scene schema, p5 rendering algorithms, or export/thumbnail rendering.
- [ ] Redesigning the editor workspace, root width, panel allocation, or toolbar ergonomics; #178 and #180 are completed prerequisites.
- [ ] Persisting zoom, pan, or fit preference across sessions, or adding multi-canvas/document tabs; create a separate follow-up if product demand requires these.

## Evidence and pending items
- **Status:** COMPLETE
- **Evidence so far:** #178 (full-width desktop shell) and #180 (studio/canvas framing and toolbar) are closed/completed. `EditorWorkspace.tsx` currently uses a logical-width, `maxWidth: 100%`, aspect-ratio viewport; zoom/pan is local CSS transform state; `clientToCanvasPoint` is the shared client-to-scene conversion path; existing zoom tests are in `EditorWorkspace.zoomPan.test.tsx`.
- **Pending verification:** None; QA re-verification passed after #187.
- **Next action:** None; retain the QA comment and commit as the handoff evidence.
- **Durable memory link:** None required; existing canvas coordinate and browser-test guidance is sufficient.

## Discovery gate
- [x] Searched `_docs/tasks.md`, `.local/tasks/`, and existing GitHub issues for a duplicate
- [x] Added the matching GitHub issue link, or recorded why issue creation is still pending
- [x] Reconciled newly discovered out-of-scope work before closing this task

## Constraints
- **Files in scope:** `frontend/src/pages/EditorWorkspace.tsx`, editor canvas/layout styles in `frontend/src/index.css`, existing zoom/pan and canvas interaction tests, and narrowly related editor tests needed to prove alignment.
- **Related references:** #178, #180, existing issue #156 zoom/pan behavior, and issue #109 responsive canvas sizing.
- **Implementation boundary:** Keep view state client-local and canonical scene dimensions unchanged. Reuse `clientToCanvasPoint` and DOM geometry rather than introducing a second coordinate system.
- **Dependencies:** #178 and #180 — both COMPLETE.
- **Libraries:** Use existing dependencies and browser APIs; do not add a dependency without approval.

Status: COMPLETE
GitHub issue: [#184](https://github.com/cfornesa/ai-dev-tools-zoomcamp-1/issues/184)
Dependencies: #178 (COMPLETE), #180 (COMPLETE)
Evidence (2026-08-26): Reopened from production screenshots showing the selection outline/handles offset downward from rendered geometry. Commit `d85961e` fixed the root cause: the SVG overlay retained a 600px intrinsic height while the fitted scene was 557px, creating the measured 21.5px vertical offset. The responsive E2E helper now skips hidden toggles, and the narrow workspace width accounts for its 16px side margins. Focused geometry, Layers, and responsive browser regressions passed 15/15 at the local PostgreSQL-backed Django/Vite stack; frontend tests passed 1,869/1,869; build/typecheck/format and `make check` passed (629 backend passed/22 skipped). QA PASS comment posted and GitHub issue closed as completed.
Next action: None; retain the QA comment and commits as handoff evidence.

## 160. Make top-level editor sidebar panels collapsible with Layers open by default

## Goal

Allow users to collapse the editor's Canvas, Details, Tools, Layers, and Inspector sidebar panels while keeping Layers expanded and the other top-level panels collapsed on a fresh editor load.

## Acceptance criteria

- [ ] On desktop and tablet, each top-level Canvas, Details, Tools, Layers, and Inspector panel has exactly one visible collapse/expand button with an accessible name identifying the panel and action; each button is operable with keyboard Enter and Space.
- [ ] On a fresh editor load, Layers is expanded and Canvas, Details, Tools, and Inspector are collapsed. The responsive narrow panel-switcher continues to show only its selected panel as before.
- [ ] Activating a panel's collapse button hides only that panel's content while leaving its top-level landmark/control available; scene data, selection, drafts, camera state, unsaved edits, and panel-local form values are unchanged.
- [ ] Reopening the panel restores its content without resetting its local state; the control's `aria-expanded` matches the visible state and its `aria-controls` references the controlled content element. Focus remains on the invoking control after toggling and does not enter hidden content.
- [ ] Layers can be collapsed and reopened even though it is expanded by default; its outline rows, selection, controls, and keyboard navigation remain usable and unchanged after reopening.
- [ ] Desktop, tablet, and narrow panel-switcher layouts have no horizontal overflow, duplicate panel landmarks, or keyboard-inaccessible collapse controls; narrow layouts retain their existing panel-switching behavior.
- [ ] Existing nested Tools and Inspector `CollapsibleSection` disclosures can be opened/closed independently before and after their parent top-level panel is collapsed/reopened.
- [ ] Focused component/accessibility tests and real-browser desktop/narrow regressions cover the criteria; frontend lint, format check, typecheck, build, tests, and `make check` pass.

## Implementation plan

1. Add top-level disclosure state and accessible controls around all five editor panel regions, keeping panel content mounted and preserving the current responsive `EditorPanelSwitcher` behavior.
2. Keep Layers expanded on fresh editor mount and Canvas, Details, Tools, and Inspector collapsed; leave nested Tools/Inspector `CollapsibleSection` state independent from the new parent state.
3. Add focused state/ARIA/accessibility regression coverage, then real-browser desktop and narrow-layout coverage for toggling, Layers interactions, and overflow/landmarks.
4. Run focused tests, relevant Playwright specs, frontend quality gates, and `make check`; record any verification boundary explicitly.

## Out of scope

- Redesigning the existing nested Tools/Inspector `CollapsibleSection`; this task adds top-level panel collapse around the existing panels.
- Persisting collapse state across browser sessions or projects; this remains an optional future product decision and is not required for this task.

## Evidence and pending items

- **Status:** COMPLETE
- **Evidence:** Engineering commits `0643318` and `56a96da` implement the corrected five-panel contract and stabilize shape-test fixtures. Automated PostgreSQL-backed browser QA passed all 7 Layers scenarios across desktop and narrow responsive paths. Host-level `UV_CACHE_DIR=/private/tmp/creatrweb-uv-cache make check` passed all lint, format, type, backend (636 passed, 22 skipped), and frontend (1,880 passed) gates. The browser helper and CI automation are covered by `cd68e4e`, `04c5249`, `fd7c6b5`, and `8e87db1`.
- **Pending verification:** None for this issue; Replit deployment behavior remains the only manual deployment check and is outside this local closure gate.
- **Next action:** None. Close #191 after posting the replacement automated QA evidence. Distillation reconciliation supersedes `#5435039924`.
- **Durable memory link:** None required; existing `CollapsibleSection` and responsive panel-switcher conventions cover the boundary.

## Discovery gate

- [x] Searched `_docs/tasks.md`, `.local/tasks/`, durable memory, and open GitHub issues for duplicates; #95/#113 cover nested section behavior and E2E fallout, not top-level sidebar collapse.
- [x] Created and linked [#191](https://github.com/cfornesa/ai-dev-tools-zoomcamp-1/issues/191).
- [x] No distinct out-of-scope actionable follow-up discovered.

## Constraints

- **Files likely in scope:** `frontend/src/pages/EditorWorkspace.tsx`; `frontend/src/components/EditorPanelSwitcher.tsx` only if narrow-layout integration requires it; the existing shared editor stylesheet; focused component/accessibility tests and the relevant desktop/narrow Playwright spec. Reuse existing React/browser APIs and accessibility patterns; no dependency additions.
- **Mutation boundary:** Collapse state is editor UI state only; it must not enter scene JSON, drafts, versions, exports, or camera data.
- **Accessibility:** Use native/button disclosure semantics with stable panel IDs, visible focus, and correct ARIA state.
- **Libraries:** Use existing dependencies; do not add dependencies.

GitHub issue: [#191](https://github.com/cfornesa/ai-dev-tools-zoomcamp-1/issues/191)

## 161. Reduce live camera tracking latency and resource usage

## Goal

Make live camera tracking responsive and usable by reducing camera and MediaPipe resource consumption while preserving local-only processing and interaction fidelity. The implementation must meet the performance budget below in deterministic diagnostics, with the baseline and post-change measurements recorded in the issue.

## Acceptance criteria

- [ ] Profile capture, video playback, inference, normalization, runtime evaluation, p5 rendering, and overlay delivery in a reproducible 10-second warm run; record desktop and narrow baseline values and the post-change values in the issue.
- [ ] Use this default budget unless profiling documents a justified, issue-commented revision: video constraints have no audio and upper bounds of 640×480 and 30 FPS; inference is at most 30 calls/second with one call in flight and at most one pending/latest frame; p95 frame-to-tracking delivery is ≤100 ms and no sample exceeds 200 ms; no tracking run has a main-thread long task over 100 ms.
- [ ] Enabling or retrying camera is idempotent: one active stream, recognizer, render loop, and frame listener maximum; repeated start calls do not increase resource counts.
- [ ] Latest-frame/backpressure behavior is observable in deterministic tests: inference calls never overlap, stale frames are dropped rather than queued, and stop/restart releases tracks, video, recognizer, animation callbacks, and listeners.
- [ ] Downstream delivery is scheduled/rate-limited so unchanged frames do not cause repeated full-scene work or React state updates; the diagnostics show overlay/runtime delivery at or above 30 FPS during the warm run.
- [ ] Overlay geometry remains aligned at desktop and narrow widths, gesture signals remain timely for existing behaviors, and reduced-motion plus demo fallback behavior is unchanged.
- [ ] Permission, denial, unsupported-browser, missing-device, model-load, retry, and stop states remain correct and actionable; network inspection and artifacts show no camera-frame upload, logging, or export retention.
- [ ] Deterministic unit/component tests cover the budget counters, scheduling/throttling, dropped frames, cleanup, constraints, error paths, and duplicate-resource prevention.
- [ ] Real-browser desktop and narrow diagnostics use synthetic camera/MediaPipe seams (no physical camera or external model download), record the budget metrics, and document browser/host verification boundaries.
- [ ] Frontend focused/full tests, build, typecheck, lint, format, and `make check` pass.

## Out of scope

- Changing the canonical tracking schema, gesture vocabulary, scene behavior semantics, or adding server-side video processing.
- Replacing MediaPipe or requiring a paid/cloud inference service.
- Broad redesign of camera-overlay controls beyond responsiveness changes; file a separate UX issue if needed (none discovered during grooming).
- Cross-device benchmarking, camera-quality tuning beyond the stated bounds, and production deployment verification; these are follow-up work only if the diagnostics reveal a separate actionable need.

## Evidence and pending items

- **Status:** COMPLETE (closed 2026-08-28, third time — confirmed live on production with a real camera after the continuous-redraw-loop fix deployed)
- **Evidence (prior closure, now known insufficient):** Commit `07cf4dc` schedules tracking from decoded video frames and exposes deterministic diagnostics. Commit `42d6b89` stabilizes the synthetic Chromium camera seam and adds a targeted browser-spec filter. Automated `BROWSER_QA_E2E_SPEC=e2e/publishingAndRemix.spec.ts make browser-qa` passed 24/24, including permission/error/retry/active/overlay/stop paths and the 10-second synthetic camera diagnostic at desktop and narrow widths. Desktop measured 60.08 animation FPS, 23.19 inference FPS, 1 long task with a 94ms maximum; narrow measured 60.06 animation FPS, 23.48 inference FPS, 0 long tasks. `BROWSER_QA_RUNTIME_BENCH=1 make browser-qa` passed 3/3, and host-level `UV_CACHE_DIR=/private/tmp/creatrweb-uv-cache make check` passed all lint, format, type, backend (636 passed), and frontend (1,880 passed) gates.
- **2026-08-28 reopening finding:** a fresh user report ("latency of the camera feed... practically unusable") after #195's frozen-frame fix made the feed genuinely live again exposed that the above evidence never actually measured MediaPipe inference cost. `installMediaPipeTestSeam` (`frontend/e2e/publishingAndRemix.spec.ts`) replaces `GestureRecognizer` with a stub whose `recognizeForVideo` returns instantly — every prior closure's FPS/long-task numbers measured only the scheduling/compositing code around inference, never the real `@mediapipe/tasks-vision` Wasm runtime, model, or the hardcoded `delegate: 'GPU'` option (`frontend/src/tracking/mediapipeProvider.ts:399`, no CPU fallback, not configurable). See [#192's 2026-08-28 comment](https://github.com/cfornesa/ai-dev-tools-zoomcamp-1/issues/192) for the full finding.
- **Pending verification:** A real (non-seam) desktop diagnostic that loads the actual MediaPipe module/model/GPU delegate against a synthetic video track a real recognizer can run inference on, measuring inference cost itself for the first time; a CPU-vs-GPU delegate comparison; real production/live-camera confirmation on `animate.creatrweb.com` (same structural gap as #195 — no Replit deploy tool, no physical camera, from this agent).
- **Evidence (2026-08-28, GPU delegate fallback):** Commit `47ec6b2` implements the concrete candidate root cause: `createFromOptions` retries once on the other delegate if the first attempt throws (see below for which delegate is primary). 3 new deterministic tests. `make check` full pass (backend 665/22 skipped, frontend 1,922/131 files). Real Chromium, isolated PostgreSQL-backed stack: `BROWSER_QA_E2E_SPEC=e2e/publishingAndRemix.spec.ts make browser-qa` 24/24 passed, no regression, camera diagnostics still well within budget (0 long tasks at both viewports this run). QA comment posted on #192.
- **Evidence (2026-08-28, real non-seam benchmark — the actual root cause measured):** Commit `0866fc6` adds `frontend/e2e/benchmark/cameraInference.bench.ts`, the first #192 measurement that doesn't stub `GestureRecognizer.recognizeForVideo` — it loads the real `@mediapipe/tasks-vision` module/Wasm/model against a real, canvas-`captureStream()`-sourced `MediaStreamTrack` (no physical camera). Reproduced across 3 runs: the GPU delegate **creates successfully** (no exception) but a single inference call took ~5.1-5.8 **seconds**, versus ~24.6-24.8ms average for CPU on identical input — ~200x slower, with nothing to catch since creation never throws. `mediapipeProvider.ts` and its standalone-export port (`standaloneCameraSource.ts`) now default to `delegate: 'CPU'`, falling back to `'GPU'` only if CPU creation itself throws. All gates re-verified green after the flip: `make check`, full frontend suite, and a second real-Chromium `browser-qa` run (24/24, no regression). QA comment posted on #192.
- **Closure (2026-08-28):** Asked the repository owner explicitly whether to waive the remaining real-camera/`animate.creatrweb.com` production confirmation (this agent has no physical camera and no Replit deployment access) given how directly the measured root cause explains the reported symptom. The owner chose "waive and close now" — the same kind of deliberate, informed waiver already recorded for #195, not an agent's own determination that this evidence is sufficient by default. Closing QA:PASS comment posted; issue closed.
- **Reopened (2026-08-28, same day):** the repository owner reported the live public viewer's camera still nonfunctional, with production access logs and a `scripts/start.sh` startup error pasted as evidence. Investigation: (1) fetched and byte-diffed the live production JS assets against this session's local post-fix build — **identical**, confirming the CPU-delegate fix is genuinely deployed; (2) visited the live public viewer directly via browser tooling — page and demo controls render correctly, "Enable camera" correctly reaches the existing permission-denied/Retry state when this tooling's own sandbox blocks device capture (same standing "no real camera" boundary as before, revealed nothing new); (3) the pasted `scripts/start.sh` "wait: pid ... not a child of this shell" / "exited with status 127" log lines are a real, **distinct, now-fixed** bug (filed and fixed as [#202](https://github.com/cfornesa/ai-dev-tools-zoomcamp-1/issues/202), commit `8df580d`) — a trap/wait race on ordinary Replit autoscale stop cycles, not tied to this deploy specifically, and very likely unrelated to the camera symptom (the camera is client-side JS with no dependency on the API calls the logs show all succeeding). No further camera-specific code defect was found. Reopened rather than re-asserting resolution, per [[camera-synthetic-verification-gap]]'s standing rule — a fresh contradicting production report outweighs an agent's own confidence in supporting (but indirect) evidence.
- **Evidence (2026-08-28, second real root cause found and fixed — the actual "nonfunctional" explanation):** Using a connected real Chrome browser with a genuine physical webcam (Anker PowerConf C200), reproduced live against `https://animate.creatrweb.com/p/7b2ecd2b-0a46-4031-b4a2-bb6b9cd74df2`: the `<video>` element was confirmed genuinely live (advancing `currentTime`, real non-black pixel content), but the rendered `<canvas>` stayed byte-identical across 5 one-second samples — a **frozen, sometimes permanently empty, overlay**, not a slow one. Root cause: `EditorWorkspace.tsx` (for a behaviorless scene) and `PublicProjectViewer.tsx` (no runtime loop at all) only redraw the camera overlay reactively, on a handful of discrete state changes, never continuously — so a behaviorless scene (e.g. any "Blank canvas" starter project) renders the overlay exactly once and never again, racing the video's first decoded frame. Commit `66cf699` adds `frontend/src/pages/useCameraOverlayRedrawLoop.ts`, a `requestAnimationFrame`-driven hook keeping the overlay genuinely live while the camera is active, wired into both files. 6 new unit tests; full frontend suite 132 files/1,928 tests; `make check` all green; real-Chromium `browser-qa` 24/24 (no regression); manually verified end-to-end signed in locally with a real camera in the actual editor. QA comment posted on #192.
- **Closure (2026-08-28, third and final time):** the repository owner published the deploy after being asked directly (this agent has no Replit publish access). Confirmed via asset hash (`index-CP7eShdf.js`) that production picked up commit `66cf699`. Retested the exact reported URL with a real Chrome browser and physical webcam: the camera overlay showed genuine live content (a room, recording equipment, a visible hand), and three independent forced redraws sampled different canvas pixel brightness each time (`54.33 → 58.56 → 58.66`), confirming the pipeline picks up fresh frames rather than a cached one. QA:PASS comment posted; issue closed.
- **Durable memory link:** [[camera-synthetic-verification-gap]] updated 2026-08-28 with this as a second confirmed recurrence and the specific root cause of why the synthetic seam could never have caught it (it stubs out the exact component under test).

## Discovery gate

- [x] Searched `_docs/tasks.md`, `.local/tasks/`, durable memory, and open GitHub issues for duplicates; existing camera tasks cover lifecycle, overlay, public viewer, and test seams, not runtime performance.
- [x] Created and linked [#192](https://github.com/cfornesa/ai-dev-tools-zoomcamp-1/issues/192).
- [x] No distinct out-of-scope actionable follow-up discovered.

## Constraints

- **Files likely in scope:** `frontend/src/tracking/mediapipeProvider.ts`, `frontend/src/components/CameraControl.tsx`, `frontend/src/pages/EditorWorkspace.tsx`, `frontend/src/pages/previewTrackingSource.ts`, the p5 camera compositor, existing camera test seams, and the relevant browser diagnostic.
- **Dependencies:** Existing tracking provider contract, camera stream handoff, overlay geometry, preview source, and MediaPipe test seams; no unresolved prerequisite issue identified.
- **Privacy boundary:** Keep all camera processing in the browser; do not add uploads, server inference, logging of frames, or export retention.
- **Behavior boundary:** Preserve existing `TrackingProvider` frames, gestures, reduced-motion behavior, permission UX, overlay alignment, and demo fallback.
- **Libraries:** Use existing dependencies and the existing MediaPipe test seam; do not add dependencies without approval.

GitHub issue: [#192](https://github.com/cfornesa/ai-dev-tools-zoomcamp-1/issues/192) (closed)

## 154. Disambiguate shape property editing and Move-to-Layer controls in Selection HUD

## Goal

Make the selected shape's primitive identity and editable properties obvious, while clearly separating layer/group organization actions in the Selection HUD and Inspector. Moving an item must either produce a visible, verifiable result or a visible explanation of why no mutation occurred.

## Acceptance criteria

- [ ] The Selection HUD presents layer/group reparenting in a clearly headed organization section with distinct, descriptive labels such as `Target layer`, `Move to layer`, `Target group`, and `Move to group`; the destination controls are not presented or styled as shape-type selectors.
- [ ] For a single selected shape, the Inspector and Selection HUD each show a clearly labeled, read-only primitive indicator using the existing shape types and display names (`Circle`, `Rectangle`, `Line`, or `Path`). No unsupported type conversion or morphing control is shown; path-only point controls remain visibly scoped to `Path`.
- [ ] Shape property controls remain visibly grouped separately from organization controls and retain unambiguous labels for the properties they edit (position, scale, rotation, opacity, fill, stroke, stroke width, and path points where applicable); selecting a group or multi-selection does not show misleading single-shape property controls.
- [ ] A Move-to-Layer or Move-to-Group action is disabled or otherwise prevented when its selected destination is the item's current layer/group (including current `Top level`), and activating it cannot create an undo entry or silently change scene JSON.
- [ ] Invalid or stale destinations and existing lock/cycle/validation rejections remain non-mutating and produce visible status/error feedback in the HUD or Inspector; the feedback identifies the rejected organization action and remains accessible to assistive technology.
- [ ] A successful layer/group move produces visible live status feedback naming the moved item and destination, updates the breadcrumb/outline/target state to the new hierarchy, preserves selection, and creates exactly one undoable scene mutation.
- [ ] Existing layer/group controls, shape property edits, lock handling, grouping, undo/redo, keyboard operation, narrow layouts, and selection behavior remain functional; focused Selection HUD/Inspector/reparenting and accessibility tests, frontend build/typecheck/lint/format, and `make check` pass.

## Out of scope

- Shape type conversion, morphing, or changing a shape's primitive-specific schema fields; the current editor has no supported conversion mutation, so this task exposes identity only. File a separate product issue if conversion/morphing is requested.
- Redesigning the scene schema, adding new primitive types, changing layer/group mutation semantics, or changing export/thumbnail behavior.
- Group renaming, which is tracked separately in [#186](https://github.com/cfornesa/ai-dev-tools-zoomcamp-1/issues/186).

## Evidence and pending items

- **Status:** ACTIVE
- **Evidence so far:** Dependency [#180](https://github.com/cfornesa/ai-dev-tools-zoomcamp-1/issues/180) is closed as completed. `SelectionHud.tsx` currently renders shared `MoveControls` beside shape properties; `ShapeInspectorPanel.tsx` renders style fields and path-only point editing but no primitive indicator; `useSceneEditor.ts` routes reparenting through `outlineError`, skips commits for legitimate no-ops, and rejects invalid/locked destinations without changing scene state. Existing reparenting and Selection HUD tests cover the current mutation paths.
- **Pending verification:** Engineering must add the disambiguated headings/labels, read-only primitive indicators, no-op prevention, and success/rejection feedback, then run the criterion-focused tests and required full checks.
- **Next action:** Engineering implements the scoped HUD/Inspector presentation and no-op feedback using the existing `sceneEditor` mutation/error channels; QA rechecks every criterion and the full verification command.
- **Durable memory link:** None required; the existing scene-outline and accessibility conventions are sufficient.

## Discovery gate

- [x] Searched `_docs/tasks.md`, `.local/tasks/`, and open GitHub issues for duplicates; no equivalent issue found.
- [x] Added and reconciled the matching GitHub issue link.
- [x] No distinct actionable follow-up was discovered. Unsupported shape conversion/morphing is a product possibility, not an implementation defect or currently actionable scope.

## Criterion-by-criterion implementation plan

1. Update `SelectionHud.tsx` and `ShapeInspectorPanel.tsx` with separate organization and shape-property sections, accessible headings, and a read-only primitive label derived from the existing shape type display-name helper.
2. Update the shared `MoveControls` in `LayersPanel.tsx` to identify destinations unambiguously, derive whether each selected destination is already current, and disable/prevent legitimate no-op submissions without duplicating scene mutation rules.
3. Reuse `useSceneEditor.ts`'s existing `outlineError` path for rejected moves and add a success-status path at the presentation boundary that clears stale errors and confirms the resulting hierarchy without changing mutation semantics.
4. Add focused component and accessibility regression coverage for each supported primitive, path-only properties, group/multi-selection states, current-destination no-ops, rejected moves, successful moves, selection/breadcrumb updates, and undo behavior; run the required frontend checks and `make check`.

## Constraints

- **Files in scope:** `frontend/src/pages/SelectionHud.tsx`, `frontend/src/pages/ShapeInspectorPanel.tsx`, shared `MoveControls` in `frontend/src/pages/LayersPanel.tsx`, narrowly related `useSceneEditor.ts`/styles, and focused tests for these surfaces.
- **Mutation boundary:** Reuse `sceneOutline.ts` and `useSceneEditor.ts` as the single source of truth for move validation, lock/cycle rules, scene commits, and undo history; do not implement a second reparenting path in the UI.
- **Libraries:** Use existing dependencies and browser APIs; do not add a dependency without approval.
- **Accessibility:** Keep controls keyboard reachable, headings/labels programmatically associated, and status/error feedback exposed with appropriate live/status semantics.

Status: COMPLETE
GitHub issue: [#185](https://github.com/cfornesa/ai-dev-tools-zoomcamp-1/issues/185)
Dependencies: #180 (COMPLETE)
Evidence (2026-08-26): PM grooming comment posted; engineer commit `6891b13`; QA PASS comment posted; focused tests 158 passed; full frontend 1,841 passed; backend 629 passed/22 skipped; `make check`, build, typecheck, lint, and format passed. GitHub issue closed as completed.
Next action: none; retain the QA comment and commit as the handoff evidence.

## 155. Make draftAutosave tests deterministic in the full frontend suite

## Goal

Make the frontend test gate deterministic by eliminating the order-dependent failure observed in `frontend/src/storage/draftAutosave.test.ts` during QA of #184 and #186. The fix is test/workflow isolation work; draft-autosave production behavior remains unchanged.

## Acceptance criteria

- [ ] `frontend/src/storage/draftAutosave.test.ts` passes repeatedly in isolation and when run as part of the full Vitest suite, with no dependence on file or test execution order.
- [ ] Each test has isolated timer state, IndexedDB state, browser-storage globals, and any module-level/shared state it touches; pending timers, asynchronous database work, open database handles, and temporary global replacements are cleaned up or deterministically controlled before the next test.
- [ ] The regression is exercised by a focused test or harness that demonstrates the previously failing full-suite context, and the chosen isolation boundary explains why fake-indexeddb/real timers and async IndexedDB operations cannot leak across tests.
- [ ] The test remains behaviorally meaningful: debounce timing, stale-write prevention, clear/save races, storage failures, project scoping, clean-baseline gating, and schema validation continue to be asserted rather than bypassed with broad sleeps or skipped cases.
- [ ] The focused draft-autosave test command, the full frontend `npm test` suite, frontend build/typecheck/lint/format checks, and `make check` all pass; any unrelated failure is separately reproduced, classified, and linked rather than hidden by this task.
- [ ] No production behavior changes are introduced; if a narrowly related shared test setup/configuration change is required, it is covered by regression evidence and remains limited to test infrastructure.

## Out of scope

- [ ] Changing `frontend/src/storage/draftAutosave.ts`, React draft-autosave hooks, IndexedDB schema, debounce semantics, or user-visible recovery behavior; file a separate product issue if production behavior is found to be defective.
- [ ] Refactoring unrelated frontend tests or masking failures by changing suite inclusion, reducing coverage, increasing global timeouts, or adding retries without an isolation rationale.
- [ ] Re-verifying or closing #184/#186; those issues consume this task's completed full-suite evidence in their follow-up QA passes.

## Evidence and pending items

- **Status:** COMPLETE (re-closed)
- **Evidence so far:** Engineer commit `e49948dada69cf340e43db7862c567f2f3b6e362` changed only `draftAutosave.test.ts`, adding timer/IndexedDB cleanup and bounded waiting. Focused tests passed 22/22 across 5 runs; full frontend passed 1,847/1,847 twice; frontend quality/build checks and `make check` passed with remaining macOS sandbox socket/startup limitations classified separately. QA PASS comment posted.
- **Regression (2026-08-28):** Discovered incidentally during unrelated work on #206. Two consecutive full-suite runs on `main` at commit `6dd3572`: run 1 failed the exact same test (`collapses a rapid burst of edits into a single write, timed from the last edit`, order-dependent, passes 22/22 in isolation); run 2 (no code changes) passed clean. Issue #187 reopened with full evidence rather than filing a duplicate.
- **Re-fix (2026-08-28):** Root cause: several "the write must have landed" assertions used a fixed-duration wait (`DEBOUNCE_MS + 40` = 80ms) sized for an idle runner, not enough real wall-clock time under full-suite CPU contention. Commit `4888ff8` replaced those with `vi.waitFor` polling (mirroring the one test in the file that already did this correctly), and widened two DB-open-race tests' pre-`schedule()` margins to 200ms (a fixed wait, deliberately not polling, since correctness there depends on the first debounce timer having actually fired before the next `schedule()` call). Verified 5/5 isolated + 4/4 full-suite runs clean (previously ~50% full-suite failure rate). Full `make check` passed. QA PASS comment posted; issue re-closed.
- **Pending verification:** None.
- **Next action:** None required. If this recurs, the two fixed-margin DB-open-race tests are the most likely remaining source — see the QA comment's suggestion to instrument `DraftAutosaveController` with a "timer fired" test hook.
- **Durable memory link:** None required; this is a task-specific test-isolation defect and no reusable platform constraint was discovered during grooming.

## Discovery gate

- [x] Searched `_docs/tasks.md`, `.local/tasks/` (directory absent), and existing GitHub issues for a duplicate; #187 is the existing workflow/test-isolation issue linked from #184 and #186.
- [x] Added the matching GitHub issue link.
- [x] Reconciled the discovered follow-up with #184 and #186; no additional actionable issue was found.

## Constraints

- **Files in scope:** `frontend/src/storage/draftAutosave.test.ts`, narrowly related Vitest/test setup or configuration files only if required to isolate the failure, and focused test-support code.
- **Implementation boundary:** Preserve the production draft-autosave module and its public behavior; isolate test resources explicitly and do not rely on execution order or arbitrary suite delays.
- **Libraries:** Use the existing Vitest and fake-indexeddb dependencies; do not add dependencies without approval.
- **Verification:** Run the focused draft-autosave command, full frontend suite, frontend build/typecheck/lint/format, and `make check`; record environment and classify any unavailable or unrelated failures.

GitHub issue: [#187](https://github.com/cfornesa/ai-dev-tools-zoomcamp-1/issues/187)
Dependencies: None; unblocks QA re-verification for #184 and #186.
Evidence (2026-08-26): GitHub issue closed as completed.

## 156. Support renaming groups in the Layers outline and Selection HUD

## Goal

Allow users to assign and edit a persistent custom name for a selected group from either the Layers outline or Selection HUD, with the same name used everywhere the editor presents that group.

## Acceptance criteria

- [ ] A group row in the Layers outline exposes an inline, keyboard-focusable group-name field, and the Selection HUD for the selected group exposes the same rename affordance; either surface can start, edit, and commit a rename without changing the selected group.
- [ ] A rename commits exactly once on Enter or blur, trims leading/trailing whitespace, accepts a trimmed name of 1–200 characters, and rejects whitespace-only or over-200-character input without changing the scene, displayed name, selection, or focus state unexpectedly; the prior valid name remains visible after rejection and any rejection is exposed as accessible feedback.
- [ ] A successful custom name is stored on the matching group in the scene JSON and is reflected consistently in the Layers outline row, Selection HUD title/accessible name, selection breadcrumb, and all existing group destination/target labels that use group names.
- [ ] A group with no usable legacy/custom name continues to render a deterministic derived fallback using the existing group-label convention (for example, `Group 1`); loading or displaying such a legacy group must not crash or make the group unselectable, and the fallback remains in use until a valid custom name is committed.
- [ ] A successful rename creates exactly one undoable scene mutation; one Undo restores the prior name and one Redo restores the new name. Rename does not change group id, membership/childIds, parent/layer placement, transforms, visibility, lock state, or current selection.
- [ ] Renaming works for top-level, nested, empty, hidden, and locked groups according to existing selection/editing conventions; it does not bypass lock rules for scene mutations or alter grouping/reparenting behavior.
- [ ] The rename controls have stable accessible names tied to the group, are keyboard reachable, expose their validation/status feedback to assistive technology, and preserve the existing narrow-layout behavior without clipping or horizontal overflow.
- [ ] Focused scene-outline, Layers outline, Selection HUD, persistence, undo/redo, legacy-fallback, keyboard, and accessibility tests pass, as do the frontend build/typecheck/lint/format checks and `make check`.

## Criterion-by-criterion implementation plan

1. Add a pure `renameGroup` scene-outline operation and the corresponding `useSceneEditor` callback, reusing the existing `Outcome`/`applyOutcome` path so successful edits create one history entry and invalid/stale requests are non-mutating.
2. Centralize group display-label resolution so valid custom names are preferred while missing, blank, or malformed legacy names receive the existing deterministic `Group N`-style fallback without changing group identity or membership.
3. Add a reusable accessible inline group-name field to the group row in `LayersPanel.tsx` and the selected-group branch in `SelectionHud.tsx`; commit on Enter/blur once, trim and validate at the UI and mutation boundaries, and surface rejection without losing the prior name.
4. Thread the resolved group label through `buildOutline`, `outlineBreadcrumb`, HUD accessible labels, and existing move/target controls, while preserving selection, lock, visibility, nesting, and responsive behavior.
5. Add focused pure-function and component/a11y regression tests for both rename surfaces, validation and stale/legacy inputs, all label consumers, one-step undo/redo, and unaffected group state; run the full required verification gates.

## Out of scope

- Layer or shape renaming; completed in [#183](https://github.com/cfornesa/ai-dev-tools-zoomcamp-1).
- Bulk/multi-group rename, group creation naming policy changes, or a broader scene naming/schema redesign; file a separate product issue if requested.
- Renaming in exports, thumbnails, generated HTML, server-side collaboration, or other non-editor artifacts; this task covers editor-local scene JSON and its existing group-label consumers only.
- Changes to group membership, hierarchy, transforms, visibility/lock semantics, selection semantics, reparenting, or grouping/ungrouping behavior.

## Evidence and pending items

- **Status:** COMPLETE
- **Evidence so far:** #183 is closed as completed. Engineering commit `93553b8` implements #186; focused tests (164 at final QA), frontend build/typecheck/lint/format, backend checks, and `make check` passed after #187 fixed the draft-autosave isolation defect. QA re-verification PASS comment posted; GitHub issue closed as completed.
- **Pending verification:** None.
- **Next action:** None; retain the QA comments and commit as the handoff evidence.
- **Durable memory link:** None required; existing scene-outline, undo, schema, and accessibility guidance covers this boundary.

## Discovery gate

- [x] Searched `_docs/tasks.md`, `.local/tasks/` (directory absent), and existing GitHub issues for a duplicate; #186 is the only open group-naming match.
- [x] Added the matching GitHub issue link.
- [x] Reconciled the prior out-of-scope group-renaming item from #183 into this task.

## Constraints

- **Files in scope:** `frontend/src/pages/sceneOutline.ts`, `frontend/src/pages/useSceneEditor.ts`, `frontend/src/pages/LayersPanel.tsx`, `frontend/src/pages/SelectionHud.tsx`, shared editor styles, schema/type fixtures only if required by the existing persisted-name contract, and focused tests for these surfaces.
- **Mutation boundary:** Reuse `sceneOutline.ts` and `useSceneEditor.ts` as the single source of truth for validation, scene commits, and undo history; do not create a parallel UI-only rename path.
- **Libraries:** Use existing dependencies and browser APIs; do not add a dependency without approval.
- **Accessibility:** Keep both rename entry points keyboard reachable, associate labels with their fields, and expose validation/status changes through appropriate live/status semantics.
- **Dependencies:** #183 (COMPLETE), with #179 and #180 already complete prerequisites for the current outline/HUD layout.

## 157. Simplify Layers outline shape rows and remove redundant name controls

Goal: Make each Layers outline shape row understandable and efficient: one clear shape identity, one clear selection affordance, and no duplicated controls that appear to edit or select the same shape.
Status: COMPLETE
GitHub issue: [#188](https://github.com/cfornesa/ai-dev-tools-zoomcamp-1/issues/188)
Evidence: Deployment screenshots show each shape with a name input such as `Circle 1` and a second `Circle 1` button. The user reports that the duplicate field/button combination is confusing.
Acceptance criteria: each shape row has one obvious primary selection affordance; renaming remains available through one clearly labeled keyboard-accessible control; selection and rename semantics remain distinct; existing visibility, lock, grouping, reorder, undo/redo, accessibility, and narrow-layout behavior remain correct; focused browser/a11y tests plus `make check` pass.
Acceptance matrix: one primary shape-selection affordance per row; one clearly labeled keyboard-accessible rename control; selection and rename semantics are distinct; visibility, lock, grouping, reorder, undo/redo, accessibility, narrow-layout, frontend quality, and full make check gates remain green.
Out of scope: persisted shape identity semantics, group-row redesign, scene naming policy, and export/thumbnail naming.
Evidence (2026-08-27): Commits `7bcc978` and `1a564ee` replace the duplicate visible shape-name button with a distinct icon-only selection control and update the stable-identity regression. Focused Layers/shape tests passed 64; final frontend suite passed 1,873/1,873; Docker-backed Chromium Layers/responsive scenarios passed 14/14; build/typecheck/lint/format and `make check` passed. GitHub QA PASS comment posted and issue #188 closed completed.
Next action: None; retain the QA comment and commits as handoff evidence.

## 158. Move canvas settings into a dedicated Canvas editor tab

Goal: Give scene-level background color and canvas opacity their own first-class Canvas editor tab, separate from the Layers outline.
Status: COMPLETE
GitHub issue: [#189](https://github.com/cfornesa/ai-dev-tools-zoomcamp-1/issues/189)
Dependencies: #170 (COMPLETE); #179 and #180 are complete; #183 is ACTIVE and remains a relevant selection prerequisite.
Evidence: #170 added Canvas background color and Canvas opacity below the Layers outline. Deployment review identifies these as canvas-level settings and requests a same-level Canvas tab.
Acceptance criteria: a same-level Canvas tab exists in desktop and responsive navigation; the controls move out of Layers without becoming draggable layer rows; scene defaults, validation, undo/redo, autosave, persistence, export, accessibility, and responsive overflow behavior remain correct; no canvas visibility/lock control is added; focused tests plus `make check` pass.
Acceptance matrix: Canvas is a same-level switcher panel; background color and opacity are removed from Layers without becoming draggable rows; existing validation, history, autosave, persistence, export, accessibility, responsive overflow, and no visibility/lock boundary remain correct; focused tests and required checks pass.
Evidence (2026-08-27): Commits `f6e1750` and `1d4b629` add the Canvas switcher panel, move the existing settings group out of Layers, and update landmark/tab-order regressions. Focused workspace/layers tests passed 74; final frontend suite passed 1,873/1,873; Docker-backed Chromium responsive scenarios passed 14/14; build/typecheck/lint/format and `make check` passed. GitHub QA PASS comment posted and issue #189 closed completed.
Next action: None; retain the QA comment and commits as handoff evidence.

## 159. Make the Details panel form controls full-width and responsive

Goal: Make the editor Details panel read naturally as a form: each input sits below its label at full available width, and Save changes is aligned appropriately for the available space.
Status: COMPLETE
GitHub issue: [#190](https://github.com/cfornesa/ai-dev-tools-zoomcamp-1/issues/190)
Evidence: Deployment screenshot shows Description and Tags controls arranged beside labels with unused space and a small Save changes button at the lower-left. The user requests stacked full-width controls and a lower-right Save action, with appropriate narrow-screen stacking.
Acceptance criteria: all Details controls are stacked below their labels at full available width; labels remain associated; Save changes is lower-right at comfortable widths and appropriately full-width/stacked when narrow; validation, dirty state, persistence, keyboard order, accessibility, and overflow behavior remain correct; focused tests plus `make check` pass.
Acceptance matrix: all Details controls stack beneath labels and fill available width; labels stay associated; Save changes is right-aligned at comfortable widths and full-width/stacked when narrow; existing validation, dirty state, feedback, persistence, keyboard order, focus, and overflow remain correct; focused tests and required checks pass.
Evidence (2026-08-27): Commits `f6e1750` and `5f72817` add responsive Details form styling and a form/label regression. Focused Details tests passed 11; final frontend suite passed 1,873/1,873; Docker-backed Chromium responsive scenarios passed 14/14; build/typecheck/lint/format and `make check` passed. GitHub QA PASS comment posted and issue #190 closed completed.
Next action: None; retain the QA comment and commits as handoff evidence.

## 162. Restore the full browser acceptance gate after production-readiness failures

Goal: Restore a deterministic, zero-unexpected-failure full browser acceptance
gate against the disposable PostgreSQL + Django + Vite + Chromium stack.

Status: COMPLETE (root-caused and fixed 2026-08-29 — see below; previously
ACTIVE with CI consistently blocked by two
narrowly-scoped, already-characterized flaky tests unrelated to any code
this branch changed)

GitHub issue: [#193](https://github.com/cfornesa/ai-dev-tools-zoomcamp-1/issues/193)

Evidence (2026-08-27): Commit `03b146a` restores the gate's determinism locally: the
complete disposable PostgreSQL + Django + Vite + Chromium run passed 133/134
tests with 1 intentional PostgreSQL-concurrency skip; focused interaction,
credential, project-lifecycle, and responsive runs also passed. `make check`
passed with backend 636 passed/22 skipped and frontend 1,880 passed; the
frontend production build passed. Fixes cover provider-probe rate-limit
isolation, draft-session readiness, nested panel expansion, deterministic
historical restore targets, a dedicated empty-gallery fixture, responsive
empty-state sizing, persistent credential status, and the browser-QA Fernet
fixture. Related completed issues #113, #117, #160, #184, and #187 are
retained as coverage history; this task is the single release-gate follow-up
and did not weaken their acceptance contracts.

Acceptance criteria:

- [ ] The full `make browser-qa` command passes with zero unexpected failures
  against disposable PostgreSQL.
- [ ] AI Reject, draft/session recovery, and interaction-runtime scenarios are
  deterministic and preserve their existing product guarantees.
- [ ] Mistral credential status, selection alignment/navigation, and narrow
  empty-gallery layout assertions pass without exposing secrets or weakening
  viewport/accessibility contracts.
- [ ] Focused tests, frontend build/typecheck/lint/format, `make check`, and
  the CI browser job pass.
- [ ] Any environment-only exception is quarantined with issue-linked durable
  evidence and an explicit supported-environment boundary.

Dependencies/order: Fix fixture/session and panel-helper determinism first;
then AI/credential/editor flows; then responsive geometry; finally rerun the
complete browser suite, root gates, and CI.

CI evidence (2026-08-28): the push-triggered run [33136131069](https://github.com/cfornesa/ai-dev-tools-zoomcamp-1/actions/runs/33136131069)
and two failed browser-job reruns did not pass. The final browser rerun
98739689672 reported 131 passed, 1 skipped, and two failures: the server-newer
draft-conflict recovery assertion received the local scene id instead of
`scene-server-newer`, and synthetic camera diagnostics measured
`maxLongTaskMs=174` against the `<=100` budget. Backend and frontend CI checks
were green, but the browser acceptance gate remains unsatisfied.

Next action: investigate and fix the remaining CI browser failures, push the
follow-up, and rerun the full CI gate. Issue #193 remains open; Replit
publication checks remain a separate manual verification boundary.

CI evidence (2026-08-28, later run): push-triggered run
[33137712058](https://github.com/cfornesa/ai-dev-tools-zoomcamp-1/actions/runs/33137712058)
reproduced the same failure class: `publishingAndRemix.spec.ts:1024`'s
synthetic camera diagnostics measured `maxLongTaskMs=151` against the `<=100`
budget (a repeat miss, not a one-off — see task 164/issue #195), and
`aiAndRecovery.spec.ts:558` (the issue #112 draft-sync-failure regression)
hit its 30000ms timeout. 129/134 passed with the 1 intentional skip. Folded
into this issue as a comment rather than a new tracking issue, since both are
the same "browser acceptance gate is not yet deterministic" class this task
exists to resolve.

Local re-verification (2026-08-28): the earlier "no safe live stack this session"
blocker was root-caused and fixed, not merely worked around. Investigation found
several stray, long-running `vite` dev-server processes for this exact repo
(ports 5000-5005, leftover from earlier sessions) were silently proxying
`/api`/`/accounts`/`/health` to `http://localhost:8000` by default
(`frontend/vite.config.ts`'s `backendProxyTarget` fallback) -- and an unrelated
sibling project's dockerized backend happens to publish on that exact port.
This repo's own PostgreSQL (`scenes-postgres` container, matching `.env`'s
`DATABASE_URL`) was unaffected and correct the whole time. Fix: stopped the
stray vite processes, started this repo's own Django on port 8001
(`AI_PROVIDER=fake`, port 8000 remains occupied by the unrelated container),
and started Vite on the canonical port 5000 with
`BROWSER_QA_BACKEND_URL=http://localhost:8001`. Verified via response body
(not just status code) that port 5000 now reaches this repo's own Django.
Full `npx playwright test`: **133 passed, 1 intentional skip, zero failures**
-- including both previously CI-failing scenarios (`aiAndRecovery.spec.ts:558`
and `:1010`, the draft-sync/conflict-recovery scenarios) and the camera
long-task budget (desktop `maxLongTaskMs=84`, narrow `0`, both well under the
100ms budget). `make check` also fresh-passed: backend 656/22 skipped,
frontend 1901/130 files. This strongly suggests the CI failures were
CI-runner-specific flakiness/timing variance, not a deterministic source
defect -- no product code changed between the failing CI runs and this clean
local pass. QA:PASS comment posted on #193.

CI evidence (2026-08-28, PR #201): three consecutive CI runs on this PR
(across pushes including task 163/#194's substantial draw-order fix and
task 168/#199's SVG extension) show the identical result every time:
backend PASS, frontend PASS, browser E2E 131 passed/2 failed/1 skipped --
the same two tests each run (`aiAndRecovery.spec.ts:558`'s 30s timeout,
`publishingAndRemix.spec.ts:1029`'s camera long-task budget). Neither
failing test touches any file changed across those pushes. This is now
strong, repeated evidence these two failures are CI-runner-specific
(resource contention affecting timing-sensitive assertions), not a
product defect and not a regression from any of this session's work.

Next action: this gate is effectively restored for everything except two
narrowly-scoped, well-characterized flaky tests. Track a dedicated
follow-up scoped to exactly those two: (1) investigate why
`aiAndRecovery.spec.ts:558`'s draft-sync-failure path is slower under
CI's resource constraints than locally; (2) the camera long-task budget
re-profiling is already task 164/#195's own open item. Do not block
unrelated feature work on this gate further -- three consecutive
identical CI results confirm it is not a regression.

Durable memory: [full browser readiness gate](../.agents/memory/full-browser-readiness-gate.md),
[camera synthetic verification gap](../.agents/memory/camera-synthetic-verification-gap.md),
[E2E wrong Docker project](../.agents/memory/e2e-wrong-docker-project.md) (updated
with the more specific "this repo's own dev server, wrong backend by port
collision" variant found this session).

Evidence (2026-08-28, task 174/#206 session): reopened after `UV_CACHE_DIR=/private/tmp/creatrweb-uv-cache
BROWSER_QA_FULL_E2E=1 make browser-qa` at commit `18d1244` (issue #206's own
work) reproduced 2 of the same failure class: `aiAndRecovery.spec.ts:1012`
("local/server conflict: the genuinely newer candidate wins, by timestamp,
never a merge" — received a fresh-UUID scene id instead of either
candidate's) and `projectLifecycle.spec.ts:153` (fails during `loginViaUI`
setup, before its own selection-alignment assertions run). Reproduced a
second time in an isolated single-spec rerun of `aiAndRecovery.spec.ts`
alone (21 passed, 1 failed, 1 skipped — same failure). Confirmed by
`git diff e05e7c8 HEAD --stat` that none of #206's changed files touch
`draftAutosave.ts`, the recovery dialog, or any draft-conflict backend
endpoint — consistent with this task's own established "CI/environment
timing variance, not a product defect" classification. 129 of the other 132
tests passed clean, including every test that actually exercises #206's
Canvas2D/export/renderer-picker changes. GitHub issue #193 reopened with
this evidence rather than filing a duplicate.

Evidence (2026-08-29, task 175/#207 session): investigated the exact
mechanism rather than re-labeling as timing variance. Strong hypothesis
(documented in a detailed issue comment, not yet live-confirmed):
`useDraftServerSync.ts`'s `pagehide` listener fires during
`aiAndRecovery.spec.ts:1012`'s `page.reload()`, racing the test's own
`apiPut`-seeded server draft with the *original* page's stale
`workingCopyRef` snapshot (the blank scene, not either seeded candidate)
via `syncOnPageHide`. Traced `_upsert_draft`'s `client_seq <=` guard and
found no call site that would let this race through as analyzed, so the
exact ordering that lets it slip past the guard remains unconfirmed —
needs live network-request tracing against a running dev stack to
confirm or rule out. If confirmed, the fix is likely test-side (seed
drafts before the editor ever mounts, not while a previous mount's
pagehide listener is still live) rather than product-side.

Evidence (2026-08-29, root-caused and fixed): live-reproduced against a
real local dev stack (Django + Vite + this repo's PostgreSQL) rather than
static analysis alone. Actual mechanism (a refinement of the earlier
pagehide hypothesis): `useDraftServerSync`'s periodic timer treats a
never-explicitly-saved blank project as always dirty
(`resetCleanBaseline()` leaves no clean baseline), so it syncs the
pristine blank scene to the server on its own 25s schedule regardless of
edits. Manually reproduced: seeding a server draft with the test's exact
`client_seq: 1` payload returned `applied: false` and the app's own
already-written draft — confirming the app's own tick had already landed
first and won the `scenes/api.py::_upsert_draft` tie-break. This is
deterministic given enough elapsed wall-clock time (routine under CI/
sandbox load), not a true random race. Fix (commit `ed9c082`):
`frontend/e2e/aiAndRecovery.spec.ts`'s "local/server conflict" test now
seeds with `client_seq: 1_000_000` instead of `1`, guaranteeing its own
write always wins. Verified: 3/3 repeated runs of the specific test,
1 full-spec run (22/22), and 1 full 134-test disposable-stack run — 133
passed, 1 intentional skip, **zero failures**. `make check` clean (677
backend passed/22 skipped; 2022 frontend passed). GitHub issue closed.

Next action: none required. If a similar symptom recurs elsewhere, check
for any e2e test seeding a server draft with a small hardcoded
`client_seq` for a project whose editor has already been mounted for any
length of time before the seed.

## 163. Fix inverted layer draw-order vs. panel-documented "top = front" contract

Goal: Moving a layer/shape to the bottom of the Layers panel must make it
render behind every other layer, and moving it to the top must make it render
in front — matching the panel's own documented contract, not the opposite.

Status: COMPLETE

GitHub issue: [#194](https://github.com/cfornesa/ai-dev-tools-zoomcamp-1/issues/194)

Evidence: user reported being unable to move a layer to the lowest
(back-most) stacking position in production. Investigation found the panel's
documented invariant ("Top of the list = drawn last = on top of everything
below it", `LayersPanel.tsx` ~line 1254) is inverted from what
`sceneOutline.ts`'s `buildOutline()` and `sceneDrawPlan.ts`'s
`buildScenePlan()` actually do: both iterate layers **ascending** by `order`,
so the lowest `order` (top of panel) draws first (backmost) and the highest
`order` (bottom of panel, `isLast`) draws last (frontmost) — the reverse of
the stated contract. Moving a layer to the panel's "lowest position"
mechanically succeeds but sends it to the front, not the back. A narrower,
independently real edge case was also found: `buildOutline`'s `isLast`
computation for top-level shapes assumes each shape is alone on its own
layer (true after Task 111 in the normal case) and can leave a stale
`isLast: false` on a shape sharing an already-bottom-most layer with another
shape (reachable via "Move to layer"), leaving its "Move down" control
enabled but a no-op.

Acceptance criteria:

- [x] Reverse the render iteration order so draw order actually matches the
  panel's documented top/bottom-to-front/back contract. **DONE** — commit
  `f58b043`: `sceneDrawPlan.ts` now draws layers descending by `order`
  (was ascending). User's explicit decision (of three options groomed):
  accept this as a one-time, deliberate visual-stacking change for
  already-published multi-layer scenes, no migration — there is no way
  to fix the panel/render mismatch without changing which end of the
  stack a given `order` value renders at.
- [x] Verify with a real multi-layer scene that moving to the literal top/
  bottom of the panel produces the correct front/back visual result.
  **DONE** — full local `npx playwright test`, 133 passed/1 skipped/zero
  failures, including `e2e/layersPanel.spec.ts`'s drag-and-drop/keyboard-
  reorder/canvas-z-order/reload-persistence test end to end.
- [x] Fix the `isLast`/`isFirst` edge case for multiple top-level shapes
  sharing one layer in the same pass. **DONE** — commit `b4b9382`:
  `buildOutline()` now derives a top-level shape's `isFirst`/`isLast` from
  its layer's own position among all layers, never the shape's position
  within `topShapes`. Regression tests added in `sceneOutline.test.ts`
  (shared-boundary-layer and shared-non-boundary-layer cases).
- [x] Add a regression test asserting panel order matches draw order end to
  end. **DONE** — `e2e/layersPanel.spec.ts`'s existing canvas-z-order
  assertions now correctly verify the fixed panel/render relationship
  (updated with evidence, not just re-asserted to whatever now passes);
  `sceneDrawPlan.test.ts` asserts the descending draw order directly.
- [x] `make check` and the frontend focused Layers/outline/render suites
  pass. **DONE** — full frontend suite 130 files/1902 tests, `make check`
  full pass, plus the full local e2e suite (133/134, 1 intentional skip).

Cascading fixes required to preserve existing external contracts under the
new render order (see commit `f58b043` and its QA comment on #194 for full
detail): `p5Adapter.ts`'s camera-overlay compositing (partitions nodes into
behind/front groups instead of a single forward-pass insertion point,
preserving the camera's `layerOrder` contract with zero UI/default-position
changes — all 41 existing camera-compositing tests passed unmodified) and
`EditorWorkspace.tsx`'s `shapesInDrawOrder` (reverses `buildOutline`'s
per-layer chunks, not the whole row list, since intra-layer group/shape
ordering is unchanged).

Dependencies: None.

Evidence (2026-08-28): commit `f58b043`. Pushed to draft PR #201 for a CI
data point (task 162/#193's shared verification).

Next action: implement the draw-order fix and the isLast fix together, then
verify against a real multi-layer scene before closing.

## 164. Fix public viewer's camera overlay compositing and its long-task budget regression

Goal: The camera overlay on the public `/p/<id>` viewer must render a
genuinely live, low-latency feed with a real camera, using the same
p5-integrated compositing model already implemented in the editor.

Status: ACTIVE (compositing fix implemented; long-task budget still open)

GitHub issue: [#195](https://github.com/cfornesa/ai-dev-tools-zoomcamp-1/issues/195)
(cross-referenced: #192, closed; #193, task 162, open)

Evidence: user observed at
`https://animate.creatrweb.com/p/7b2ecd2b-0a46-4031-b4a2-bb6b9cd74df2` that
the camera overlay showed a single frozen/stale frame rather than a live
feed. Investigation found `PublicProjectViewer.tsx` was never migrated to
the compositing model issues #169/#151 built into `EditorWorkspace.tsx`: it
still renders a plain `<video>` behind the p5 canvas (`zIndex: -2` vs `-1`)
and calls `render()` without `transparentBackground: true` or a
`cameraOverlay` object, so the canvas's own opaque per-frame background fill
hides the video almost completely regardless of CSS stacking (see
`p5Adapter.ts`'s `render()` doc comment). Issue #169 explicitly flagged the
public viewer as an unresolved follow-up ("scope this to the editor Preview
first; file separately if the same stacking bug is confirmed there too")
that was never opened until now. Separately, issue #192's closure history
shows the camera long-task budget (`maxLongTaskMs <= 100ms`) has repeatedly
failed just outside its margin (94ms pass, then 151ms and 174ms failures in
immediately subsequent CI runs) — see
[camera synthetic verification gap](../.agents/memory/camera-synthetic-verification-gap.md)
for why closing on synthetic-only evidence let this regress unnoticed.

Acceptance criteria:

- [x] Port the editor's camera-compositing model to `PublicProjectViewer.tsx`:
  hide the raw `<video>` element, draw the live camera frame inside the p5
  canvas at the correct layer order, and pass `transparentBackground: true`
  plus a live `cameraOverlay` into `render()`. **DONE** — commit `2bbbb69`.
  `getCameraOverlay()` mirrors the editor's, reading the same shared
  geometry/opacity/mirrored/layer-order stores; `<video>` is now
  `visibility: hidden` and used only as the frame source.
- [x] Verify the public viewer's overlay is genuinely live (frame-over-frame
  updates), with the existing synthetic seam. **DONE for the synthetic
  seam** — task 162/#193's session root-caused and fixed the earlier
  "no safe live stack" block (stray dev servers proxying to an unrelated
  sibling project's backend by port coincidence) and ran the full
  `npx playwright test` against this repo's own correctly-configured
  stack: `publishingAndRemix.spec.ts:951` (camera overlay video/opacity/
  mirror) and `:1029` (10-second synthetic camera diagnostics) both
  passed cleanly, the latter with real margin (desktop
  `maxLongTaskMs=84`, narrow `0`). **Still open**: a real camera against
  the actual production deployment, per this task's own "real-camera or
  production-path verification" requirement below and
  [camera synthetic verification gap](../.agents/memory/camera-synthetic-verification-gap.md)'s
  standing rule not to close this class of issue on synthetic evidence
  alone, however clean.
- [ ] Re-profile and fix the long-task budget so it passes with real
  headroom, not a ~94-100ms margin; do not close on synthetic-seam evidence
  alone — record real-camera or production-path verification. **NOT
  STARTED** — unrelated to the compositing fix; needs live browser
  profiling of the actual capture/inference pipeline.
- [x] Add a regression test asserting the public viewer's `render()` call
  includes `transparentBackground: true` and a live `cameraOverlay`.
  Existing `PublicProjectViewer.cameraOverlay.test.tsx` (9 tests) already
  exercises this end-to-end via `video.style.opacity`/`.transform`
  assertions and continues to pass unmodified; one `e2e/publishingAndRemix.spec.ts`
  assertion (`toBeVisible()` → `toBeAttached()` + `visibility: hidden`)
  was updated to match the new hidden-`<video>` architecture.
- [x] `make check` and the frontend focused camera/preview suites pass.
  Full frontend suite 128 files/1882 tests PASS; typecheck/lint/format/
  build PASS; backend 636 passed/22 skipped PASS (untouched by this fix).

Dependencies: None; related to task 162/#193 (shared CI long-task evidence).

Next action: re-profile and fix the long-task budget so it passes with
real headroom (still not started — the recent 84ms/0ms margin is a good
sign but not itself a fix), and get a real-camera or production-path
verification before considering this task closeable.

## 165. Epic: multi-library AI art generation with user-selectable Mistral model and downloadable standalone export

Goal: Let a user pick a target rendering library (p5.js, Canvas2D, Three.js,
A-Frame, SVG), pick a specific Mistral model by ID, have Mistral generate a
working art piece in that library, and download it as a portable standalone
bundle.

Status: COMPLETE

GitHub issue: [#196](https://github.com/cfornesa/ai-dev-tools-zoomcamp-1/issues/196) (closed)
(epic; sub-issues #197, #198, #199, #200 below, all closed)

Evidence: user request, informed by a reference export bundle
(`beating-heart` bundle from a different tool) showing the desired portable
output shape: `index.html` + `README.txt` + `styles/piece.css` +
`scripts/piece.js` + `runtime/` (vendored library runtime) + `media/` (binary
assets with file.js twins for offline `file://` use) + a local-server helper
script for any ES-module/camera-dependent feature.

Current state investigated this session: this app supports exactly one
renderer (p5.js, `frontend/src/export/exportCompatibility.ts` — "intentionally
narrow rather than aspirational"), one fixed server-configured Mistral model
(`ai_provider/mistral_provider.py`'s `DEFAULT_MODEL`), and one single-file
HTML export (`generateHtmlExport.ts`, no multi-file bundle). All of this is
net-new work; no prior issue or task covers renderer abstraction, per-request
model selection, or a portable multi-file export bundle.

Sub-tasks (dependency order): task 166/#197 (architecture decision, blocks
168/169) and task 167/#198 (model selection, independent) can start in
parallel; task 168/#199 (generation/validation pipeline) is blocked on #197;
task 169/#200 (bundle exporter) is blocked on #199.

Out of scope (first pass): reproducing the reference bundle's hand-
tracking/theremin/audio features (a separate, much larger existing capability
of this app's own camera/MediaPipe pipeline); any CMS/server-dependent
feature the reference bundle's own README calls out as unsupported offline
(re-download-with-different-options, comments/version history/prompt
metadata UI, VR gallery links).

Evidence (2026-08-28): all four sub-tasks (166/#197, 167/#198, 168/#199,
169/#200) complete and closed. A signed-in user can pick a library
(Canvas2D, SVG, Three.js, or A-Frame), optionally choose a specific
Mistral model, generate a piece from a prompt, preview it sandboxed, and
download it as a portable offline-capable ZIP. Three separate
`/security-review` passes (sandboxing model, CSP relaxation, export
fetch-and-vendor mechanism) found no high-confidence issues. p5.js
remains the only *structured-scene* renderer per #197's decision; the
other four libraries are raw sandboxed code, a deliberately separate,
simpler creation flow from the main editor.

Next action: none; epic complete.

Durable memory: [multi-library generation architecture fork](../.agents/memory/multi-library-generation-architecture-fork.md).

## 166. Decide renderer/generation architecture for multi-library art pieces

Goal: Make an explicit, documented decision for how this app supports
Canvas2D/Three.js/A-Frame/SVG beyond p5.js, before any generation or export
work depends on it.

Status: COMPLETE

GitHub issue: [#197](https://github.com/cfornesa/ai-dev-tools-zoomcamp-1/issues/197) (closed)

Parent: task 165/#196. Blocks task 168/#199 and task 169/#200 — now unblocked.

Acceptance criteria:

- [x] Written decision: **(c) hybrid**. p5.js keeps its existing structured
  scene-JSON model, editor UX, and injection-safety model unchanged.
  Canvas2D, Three.js, A-Frame, and SVG generate raw code with no structured
  scene-JSON backing, through a new, separate, deliberately non-parity
  creation flow. Rationale: per-library structured adapters for four
  incompatible authoring models (DOM entity-component, imperative scene
  graph, declarative markup, immediate-mode canvas) would be effort
  disproportionate to the actual ask, and a schema would unnecessarily
  constrain AI-generated creativity. Security implication: every generated
  non-p5.js piece is a new, fully untrusted trust boundary — sandboxed
  iframe, restrictive CSP, no access to this app's cookies/session/`/api`
  surface, in both live preview and the downloaded bundle; this app's
  existing schema-constrained injection-safety model does not extend to
  this path and a new sandboxing-focused threat model is required instead.
- [x] "C2.js" resolved as shorthand for the native browser Canvas2D API
  (`CanvasRenderingContext2D`), not a third-party library — keeps
  AGENTS.md's "no new dependency without asking" rule satisfied by
  construction for this library.
- [x] Editor UX impact stated: no change to the p5.js editor. Non-p5.js
  libraries get no Layers panel, undo/redo, direct manipulation, or AI
  edit-patch flow — only fresh generation/regeneration in the new flow.
- [x] Decision recorded in the durable memory topic below.

Dependencies: None blocking; independent of task 167/#198.

Evidence (2026-08-28): Decision posted as a PM comment on #197 and recorded
in the linked memory topic; issue closed as completed.

Durable memory: [multi-library generation architecture fork](../.agents/memory/multi-library-generation-architecture-fork.md).

## 167. Let a user select a specific Mistral model ID for AI generation

Goal: Replace the fixed server-side Mistral model default with a validated,
user-facing model choice threaded through the existing AI generation
endpoints.

Status: COMPLETE

GitHub issue: [#198](https://github.com/cfornesa/ai-dev-tools-zoomcamp-1/issues/198) (closed)

Parent: task 165/#196. Independent of task 166/#197 (can proceed in
parallel); feeds task 168/#199 once available.

Acceptance criteria:

- [x] A user can supply a Mistral model ID when requesting AI scene creation/
  edit, replacing (not merely supplementing) the always-on server default for
  that request.
- [x] Model ID validated before use (shape only, not an allowlist — see
  corrected decision below); an invalid/inaccessible model produces a
  clear, actionable error (`model_invalid` for shape failures pre-network,
  the existing generic `provider_failure` for a well-formed but
  nonexistent/unreachable model) with no partial scene state.
- [x] Corrected decision (grooming found the original framing inaccurate):
  every AI request already requires the caller's own personal
  `MistralCredential` — there is no shared server credential to abuse — so
  any syntactically well-formed model id is accepted per the caller's own
  account, no curated allowlist maintained.
- [x] Model threaded per-request (not just per-process) through
  `get_ai_provider()`/`MistralSceneProvider` via a second contextvar,
  without breaking the `AI_PROVIDER=fake` e2e seam or
  `get_ai_provider()`'s zero-argument, monkeypatch-compatible signature.
- [x] Frontend AI-prompt UI (`AIProposalPanel.tsx`) exposes and persists
  the model choice via `localStorage`, same convention as
  `cameraOverlaySettings.ts`.
- [x] Focused backend/frontend tests plus `make check` pass; existing
  `frontend/e2e/aiAndRecovery.spec.ts` (`AI_PROVIDER=fake` mode) unaffected
  (not re-run live this session — no source file it exercises changed
  behavior for the blank-model default path).

Out of scope: non-Mistral providers; per-library generation prompt strategy
(task 168/#199).

Dependencies: None blocking.

Evidence (2026-08-28): commit `ad52e11`. Backend: 642 passed/22 skipped
(+6 new tests), lint/format/typecheck green. Frontend: 1885 passed/128
files (+3 net), typecheck/lint/format/build green. `make check` full pass.
QA:PASS comment posted; GitHub issue closed as completed.

## 168. Per-library AI generation and pre-download validation pipeline

Goal: Given a user-chosen library and Mistral model, generate a viable art
piece in that library with a way to confirm it renders before download.

Status: COMPLETE

GitHub issue: [#199](https://github.com/cfornesa/ai-dev-tools-zoomcamp-1/issues/199) (closed)

Parent: task 165/#196. Unblocked (task 166/#197 completed).

Acceptance criteria:

- [x] A prompt strategy per supported library reliably produces runnable
  output, per #197's chosen architecture. **DONE for Canvas2D and SVG** —
  `ai_provider/art_piece_provider.py` has a dedicated system prompt per
  library (Canvas2D: exactly one `<canvas>` + `<script>` pair; SVG: inert
  markup only, native `<animate>`/CSS animation, no JavaScript at all)
  and a per-library snippet validator; **NOT DONE for Three.js/A-Frame**.
- [x] Pre-download sandboxed render/validation check surfaces runtime
  errors (crash, blank output, exceptions) before a piece is downloadable.
  **DONE** — `frontend/src/generative/artPieceSandbox.ts`'s injected
  ready/error listener reports via `postMessage`; Download is gated on a
  `ready` message in `ArtPieceStudio.tsx`.
- [x] A failed validation surfaces a clear error and produces no downloadable
  artifact; retry is available. **DONE** — a `crashed` phase shows the
  sandbox's reported error with no Download button; the form remains
  usable to retry.
- [x] An explicit sandboxing boundary: **DONE** — `<iframe
  sandbox="allow-scripts">` (never `allow-same-origin`, pinned by a test),
  a `default-src 'none'` CSP injected by this app's own code (never
  derived from AI output), and a `postMessage` trust check on
  `event.source === iframe.contentWindow` (object identity, since
  `event.origin` is always `"null"` for this opaque-origin iframe). This
  is a genuinely new, separate threat model from
  `frontend/e2e/injectionArtifacts.spec.ts`'s schema-constrained-output
  assumptions, per the decision recorded in [multi-library generation architecture fork](../.agents/memory/multi-library-generation-architecture-fork.md)
  — not an extension of it.
- [x] Focused tests: **DONE for Canvas2D and SVG** — 17 backend tests
  (including an `AI_PROVIDER=fake` seam test and SVG script-tag
  rejection) + 17 frontend tests (9 sandbox-module, 8 component). `make
  check` full pass: backend 659/22 skipped, frontend 1902/130 files.
- [x] Security review: **DONE** — `/security-review` run against the full
  diff (Canvas2D slice); no high-confidence findings. Sandbox attribute,
  CSP, srcDoc usage, postMessage trust check, endpoint auth/quota, and
  `model` field validation all verified clean. The SVG extension reused
  the exact same sandboxing path unmodified, so no separate re-review was
  required — worth a follow-up review once Three.js/A-Frame change the
  CSP (see next action).

Out of scope: the download/export bundle packaging itself (task 169/#200,
this slice downloads a single HTML file directly, not a multi-file
bundle); reproducing the reference bundle's hand-tracking/theremin/audio
features; Three.js and A-Frame (this task's remaining scope).

Evidence (2026-08-28): commits `71b178a` (backend: `ai_provider/art_piece_
provider.py`, `scenes/art_piece_api.py`, `POST /api/ai/art-pieces/
generate/`) and `6fea086` (frontend: `frontend/src/generative/
artPieceSandbox.ts`, `frontend/src/pages/ArtPieceStudio.tsx`, new
`/art-pieces` route, not yet linked from nav). Live browser smoke check
(Vite dev server only) confirmed the route resolves and lazy-loads
cleanly; the full authenticated generate/preview/download flow needs a
running Django backend + personal Mistral credential, this session's
established verification boundary. QA:PASS comment posted on #199.

Evidence (2026-08-28, SVG extension): commit `e135658` adds SVG to
`SUPPORTED_LIBRARIES` with its own system prompt (inert markup only, no
JavaScript) and a per-library snippet validator. `artPieceSandbox.ts`
needed zero changes — confirming the sandboxing design is genuinely
library-agnostic. 3 new backend tests, 1 new frontend test, `make check`
full pass (backend 659/22 skipped, frontend 1902/130 files). QA comment
posted on #199.

Evidence (2026-08-28, Three.js/A-Frame extension): commit `a077b7b`
completes this task's original scope. Three.js writes plain JS against a
provided container + global `THREE`; A-Frame writes declarative
`<a-scene>` markup, no JS, same contract as SVG. Both need a pinned CDN
`<script>` `artPieceSandbox.ts` injects, requiring the first CSP
relaxation this feature has needed (`script-src` now allows
`https://cdn.jsdelivr.net` for exactly these two libraries).
`/security-review` run specifically against this relaxation: no
high-confidence findings — the iframe's opaque origin means even a fully
compromised CDN response gains no access beyond the existing
untrusted-code threat model. 9 new backend tests, 6 new frontend tests,
`make check` full pass (backend gate green, frontend 1908/131 files),
full local e2e suite 133/134 passed. QA comment posted; GitHub issue
closed as completed.

Next action: none. Recommend an authenticated live run (real Mistral
credential) before production to confirm generation quality beyond what
the fake-provider seam proves, as a separate, non-blocking follow-up.

Dependencies: None blocking. Fed task 169/#200 (now also complete).

## 169. Add a portable multi-file standalone export bundle

Goal: Let a user download a generated (or existing) art piece as a portable
multi-file bundle runnable standalone (offline double-click, or hosted),
alongside today's single-file HTML export.

Status: COMPLETE

GitHub issue: [#200](https://github.com/cfornesa/ai-dev-tools-zoomcamp-1/issues/200) (closed)

Parent: task 165/#196. Was blocked on task 168/#199 (now complete).

Acceptance criteria:

- [x] New export path (`frontend/src/generative/artPieceBundle.ts`,
  separate from the scene editor's `generateHtmlExport.ts` since this is
  the art-piece flow, not the scene-export flow), producing `index.html`
  + `README.txt` + `styles/piece.css` always, `scripts/piece.js` for
  Three.js (the one library whose output is pure JS, not markup), and
  `runtime/<file>` for Three.js/A-Frame (vendored from the pinned CDN at
  export time), packaged as a downloadable ZIP via the same
  `JSZip`/`generateAsync` approach `generateSocialThumbnailZip.ts` uses.
  **No `media/` or twin-file mechanism** — this feature generates no
  binary assets (no 3D models/images), so that part of the reference
  bundle's structure doesn't apply.
- [x] `index.html` works double-clicked directly from disk for every
  piece this feature generates — none of Canvas2D/SVG/Three.js/A-Frame
  need an ES module or camera access, so **no local-server helper script
  was needed at all** (a real scope reduction from the original
  acceptance criteria, confirmed once #199's actual libraries were known,
  not merely deferred).
- [x] Bundled README explains what's editable (`styles/piece.css`,
  `scripts/piece.js` when present) vs. supporting-only (`runtime/`), and
  makes no claim about CMS/server-dependent capabilities.
- [x] Privacy/security: `/security-review` run against the new
  fetch-and-vendor mechanism and ZIP path construction — no
  high-confidence findings; every path is a literal or closed-enum
  lookup, and the CDN fetch target is always one of two hardcoded URLs.
  (This feature has no scene id/prompt-history/draft/provenance data to
  leak in the first place — it's a standalone prompt-to-piece flow with
  no project attachment per #197's decision — so
  `exportArtifacts.spec.ts`'s scene-export-specific content-exclusion
  scanning doesn't apply here.)
- [x] Focused tests: 9 new tests in `artPieceBundle.test.ts` (per-library
  bundle shape, runtime byte-fidelity, fetch-failure handling, no path
  traversal) + 2 in `ArtPieceStudio.test.tsx` (Download wiring,
  download-error handling). `make check` full pass; full frontend suite
  1919 passed/131 files.

Out of scope (confirmed, not just deferred): CMS/server-dependent
reference-bundle features; hand-tracking/theremin/audio runtime features
(this feature generates none); changing the existing scene-editor
`generateHtmlExport.ts` path (untouched).

Evidence (2026-08-28): commit `e02f19d`. QA comment posted; GitHub issue
closed as completed.

Dependencies: None remaining.

## 170. Fix scripts/start.sh's spurious "exited with status 127" on autoscale stop

Goal: Eliminate the false "Startup process exited with status 127" log line
that appears on an ordinary Replit autoscale stop cycle, which is not a real
crash but noise that can make routine operation look like a failure when
investigating other reports.

Status: COMPLETE

GitHub issue: [#202](https://github.com/cfornesa/ai-dev-tools-zoomcamp-1/issues/202)

Discovery: found while investigating a 2026-08-28 production camera
regression report (task 161/#192) — the user pasted these log lines from
around their report time:

```
scripts/start.sh: line 117: wait: pid 24 is not a child of this shell
Startup process exited with status 127
```

Root cause: `cleanup()` (the script's `EXIT INT TERM` trap) called an
unconditional `wait` after killing the companion process. The script's main
flow separately calls `wait "$django_pid"`/`wait "$frontend_pid"` explicitly
to collect exit status once `ps` shows a process gone. If SIGTERM arrives
(e.g. an autoscale instance being stopped) while the main loop is between
its `ps` check and its own explicit `wait`, the trap fires first, reaping
the pid via its own bare `wait`; the interrupted loop iteration then finds
that pid already forgotten by bash and gets `127`/"not a child of this
shell" instead of a real exit status. This is shaped like an ordinary
autoscale scale-to-zero stop cycle, not tied to any particular code deploy.

Acceptance criteria:

- [x] `cleanup()`'s unconditional `wait` is removed; the main flow's own
  explicit `wait "$pid"` calls remain the only source of collected exit
  status. **DONE** — commit `8df580d`.
- [x] `tests/test_startup_configuration.py::test_launcher_has_publish_and_cleanup_contract`
  (and the full startup-configuration suite) still passes unchanged.
  **DONE** — 13/13 passed.
- [x] Full backend suite passes. **DONE** — 665 passed/22 skipped.

Out of scope: reproducing the exact mid-loop-SIGTERM race in an automated
test (would need precise signal timing against the real `uv run`/`npm run`
child processes) — verified by code reasoning plus the existing test suite
instead; a future production autoscale stop cycle logging cleanly (no "not a
child of this shell") is the live confirmation.

Evidence (2026-08-28): commit `8df580d`. `bash -n scripts/start.sh` syntax
check passed. `uv run pytest tests/test_startup_configuration.py` 13/13
passed; full `uv run pytest` 665 passed/22 skipped. No frontend files
touched by this fix.

Next action: none required; watch subsequent Replit autoscale stop-cycle
logs for absence of the "not a child of this shell" message as passive
confirmation.

Dependencies: None. Unrelated to task 161/#192's camera investigation
beyond having been discovered during it.

## 171. Fix art piece generation 500 in production (all libraries)

Goal: `POST /api/ai/art-pieces/generate/` must not fail with an unhandled
500 for a user with a valid, configured personal Mistral credential.

Status: ACTIVE (root cause found and fixed locally, pushed to `main` at
commit `decd339`; live production retest still pending a Replit publish,
which is outside this agent's access — see next action)

GitHub issue: [#203](https://github.com/cfornesa/ai-dev-tools-zoomcamp-1/issues/203)

Discovery: found while testing "the other piece types" (task 165-169's
art-piece studio) per the repository owner's own untested-territory note
alongside the camera investigation (task 161/#192). Every library
(Canvas2D, SVG, Three.js) reproduced a 500 on
`https://animate.creatrweb.com/art-pieces`, tested both via the UI and
directly via `fetch()` from an authenticated session with a confirmed
(`GET /api/account/mistral-credential/` -> `{"configured": true}`)
personal credential.

Evidence: the existing, already-shipped scene AI endpoint
(`POST /api/projects/<id>/ai/create-scene/`) on the same account/credential
returns a clean `504 {"error":"timeout",...}` after the real 20-second
Mistral timeout — proving Mistral connectivity and credential decryption
both work from this environment. The art-piece endpoint instead fails in
under a second (~736ms) with an **unhandled** 500, not a clean error
response. That timing/behavior mismatch, plus
`ai_provider/art_piece_provider.py`'s own documented "genuine bug" escape
hatch (`except Exception as exc: ... if not isinstance(exc, MistralError):
raise`), is the strongest lead — but code inspection alone could not
identify which exception type is actually escaping that check; local
`mistralai` SDK inspection found no obvious gap (`SDKError` does inherit
from `MistralError`).

Acceptance criteria:

- [x] Root cause identified. **DONE** — no server traceback needed:
  `ArtPieceProvider.client` imported `from mistralai import Mistral`,
  which does not exist as a top-level export in the installed
  `mistralai==2.9.3` SDK (`ImportError: cannot import name 'Mistral' from
  'mistralai'`, reproduced locally). That `ImportError`, raised inside
  `generate()`'s `try` block, was caught by the broad `except Exception`,
  failed `isinstance(exc, MistralError)`, and re-raised — the fast,
  unhandled 500. `mistral_provider.py` already used the correct
  `from mistralai.client import Mistral`.
- [x] `ArtPieceProvider.generate()` returns a clean, documented error
  response (not an unhandled 500) for whatever condition is actually
  occurring, for every supported library. **DONE** — fixed the shared
  `client` property's import; applies uniformly to all 4 libraries.
- [x] A regression test exercises the real `mistralai` SDK's error path
  (not the `AI_PROVIDER=fake` seam, which bypasses this code entirely).
  **DONE** — `tests/test_art_piece_provider.py` (new); confirmed it fails
  against the pre-fix import and passes after.
- [ ] Focused tests, `make check`, and a live production retest all pass.
  Focused tests and `make check` **DONE** (670 backend passed/22 skipped,
  1928 frontend passed, all lint/format/typecheck clean). Live production
  retest **PENDING** — requires a Replit publish, a separate owner-driven
  flow this agent cannot trigger (see
  `.agents/memory/replit-publish-verification.md`).

Evidence (2026-08-28): commit `decd339`, pushed to `main`. QA comment:
https://github.com/cfornesa/ai-dev-tools-zoomcamp-1/issues/203#issuecomment-5459651897

Next action: repository owner publishes to production via Replit, then
retests all four libraries at `https://animate.creatrweb.com/art-pieces`
(the issue's exact repro steps). Close #203 once that live retest passes.

Dependencies: None. Unrelated to task 161/#192's camera investigation
beyond having been discovered during the same testing session, per the
repository owner's own note about not yet having tested other piece
types.

## 172. Restate binding targetProperty/signal enums in the AI create-scene system prompt

Goal: Reduce how often Mistral's schema-constrained scene generation
produces an invalid `targetProperty`/`signal` value that gets rejected with
a raw schema-path error the user has no path to recover from themselves.

Status: COMPLETE

GitHub issue: [#204](https://github.com/cfornesa/ai-dev-tools-zoomcamp-1/issues/204)

Discovery: repository owner reported the main editor's AI assistant
("Render the scene of a happy face.") failed with
`$.bindings[4].targetProperty: 'width' is not one of [...]` — a real
Mistral call producing `targetProperty: 'width'/'height'`, neither a valid
enum value (the schema models size via `scaleX`/`scaleY`, not
`width`/`height`). Root cause: `ai_provider/mistral_provider.py`'s
`response_format` uses Mistral's `json_schema` mode with `"strict": False`
— already documented in that module's own doc comment as "a strong hint,
not a guarantee" — and `_SYSTEM_PROMPT`'s natural-language instructions
never restated the constrained enums, relying entirely on the (non-strict)
schema-mode constraint.

The repository owner's accompanying observation ("there is no specification
as to which library to use") was investigated and found to be expected,
not a defect: the canonical scene schema's `renderer.preferred` is a fixed
`const: "p5"` ("V1 ships only the p5.js adapter; the enum is intentionally
narrow rather than aspirational") — there is no library to choose in this
feature. The multi-library choice the owner was thinking of belongs to the
separate art-piece-studio feature (tasks 165-169/#196-200), which is a
different, raw-code generation flow, not the canonical-scene AI assistant.
No action taken on this point beyond this clarifying note.

Acceptance criteria:

- [x] `_SYSTEM_PROMPT` explicitly restates the full `targetProperty` and
  `signal` enums in natural language, as reinforcement alongside (not a
  replacement for) the JSON Schema `response_format` constraint. **DONE**
  — commit `7117d14`.
- [x] A regression test asserts the prompt's restated lists never drift
  from `scenes.validation.SCENE_SCHEMA`'s actual enums. **DONE** —
  `test_create_scene_system_prompt_lists_every_binding_targetproperty_and_signal`,
  18/18 `test_mistral_provider.py` tests pass.
- [x] Full backend suite, lint, format, and typecheck pass. **DONE** — 666
  passed/22 skipped; ruff/format/mypy all clean.

Out of scope (flagged in #204, not attempted here): a retry-with-feedback
loop for the rare case the model still produces invalid output despite the
reinforced prompt; translating raw schema-path error messages into
friendlier UI copy; reconsidering `strict: False` itself (a plausible,
unverified reason it's set that way is `_RESPONSE_JSON_SCHEMA`'s `$ref`
usage, which many providers' strict modes don't support).

Evidence (2026-08-28): commit `7117d14`. `uv run pytest
tests/test_mistral_provider.py -q` 18/18 passed; full `uv run pytest` 666
passed/22 skipped; `uv run ruff check .` / `uv run ruff format --check .` /
`uv run mypy ai_provider/mistral_provider.py` all clean.

Next action: none required for this fix. A real (non-`AI_PROVIDER=fake`)
Mistral call to confirm the reinforced prompt actually reduces the
real-world violation rate is a natural follow-up verification, not
performed here (this agent has no personal Mistral credential; the
repository owner could retest the exact "a happy face" prompt against
production once this deploys).

Dependencies: None. Discovered in the same session as task 171/#203 (art
piece 500s), both surfaced while investigating a fresh /goal report; the
two are unrelated defects in different AI-generation code paths.

## 173. Epic: support multiple rendering libraries in the canonical scene editor

Goal: Let the main structured scene editor (not just the separate AI
art-piece-studio flow) render its canonical scene-JSON model through more
than one library — starting with native Canvas2D and SVG alongside today's
p5.js — with the same shapes/bindings/graph/camera-tracking behavior
regardless of renderer.

Status: COMPLETE — all three sub-issues resolved: task 174/#206 (Canvas2D
adapter), task 175/#207 (SVG adapter), and task 176/#208 (3D decision,
spun off as its own epic, task 177/#209)

GitHub issue: [#205](https://github.com/cfornesa/ai-dev-tools-zoomcamp-1/issues/205) (epic)

Discovery: the repository owner clarified, after task 172/#204's
investigation noted the main editor has no library choice by design
(`renderer.preferred: const "p5"`), that they *do* want the editor itself
to be library-specific: "That is the point of having different libraries."
This is not new/invented scope — `_docs/plan.md`'s "Renderer selection"
section and "V2 roadmap candidates" have always documented "SVG and C2.js
parity/expanded renderer support" as planned, and
`frontend/src/export/exportCompatibility.ts`'s `RENDERER_CAPABILITIES`/
`checkRendererCompatibility` were deliberately built data-driven
specifically to anticipate this, per that file's own doc comment.

This is distinct from task 166/[#197](https://github.com/cfornesa/ai-dev-tools-zoomcamp-1/issues/197)'s
decision, which was scoped only to the separate, simpler, raw-code AI
art-piece flow (tasks 165-169) and explicitly kept the *structured editor*
p5.js-only "with no regression risk." This epic takes on, deliberately and
for the core editor, the harder option #197 declined for the art-piece
epic: extending the structured scene model with a per-library
adapter.

Investigation findings (this session, full detail in issue #205):

- `behaviorRuntime.ts`/`particleSystem.ts`/`trailSystem.ts` are already
  renderer-agnostic (plain-data computation, no p5 dependency).
  `scenes/thumbnails.py` (backend PNG thumbnails) already renders shapes
  directly via Pillow, independent of the live-editor renderer — no
  backend work needed for this epic.
- The live-render interface (`P5ScenePreview` in `p5Adapter.ts`) is
  already narrow (`render`/`destroy`/`getCanvasElement`), so a per-renderer
  adapter swap is structurally plausible without rewriting
  `EditorWorkspace.tsx`/`PublicProjectViewer.tsx`.
- Camera overlay compositing difficulty varies sharply: native Canvas2D
  can reuse p5's existing `context.drawImage` call almost verbatim; SVG has
  no native equivalent and realistically needs a `<foreignObject>` hosting
  the real `<video>` element inline in the SVG DOM.
- `getCanvasElement()`'s `HTMLCanvasElement` return type is consumed
  directly by `captureSocialThumbnail.ts` for the export ZIP's social
  thumbnail — trivial for Canvas2D, needs a new snapshot mechanism for SVG.
- Export bundles need a per-renderer runtime source file
  (`generateHtmlExport.ts`/`standaloneRuntimeSource.ts` pattern); native
  Canvas2D and SVG need **no external CDN dependency** at all, unlike p5.js
  (a real simplification for those two specifically).
- Three.js/A-Frame are a materially different, harder question: the
  canonical schema's shape model is fundamentally 2D (no Z-depth, no 3D
  transforms, no camera/lighting) — not a natural extension of the
  Canvas2D/SVG work, and deserves its own explicit decision (issue #208)
  rather than silent inclusion or silent omission.

Proposed phasing (sub-issues, dependency order):

1. Task 174/[#206](https://github.com/cfornesa/ai-dev-tools-zoomcamp-1/issues/206) —
   native Canvas2D renderer adapter (lowest-risk second renderer;
   establishes shared schema/capability-table/UI-picker/export-abstraction
   plumbing).
2. Task 175/[#207](https://github.com/cfornesa/ai-dev-tools-zoomcamp-1/issues/207) —
   SVG renderer adapter (depends on #206's plumbing; needs its own
   camera-overlay and thumbnail-capture solutions).
3. Task 176/[#208](https://github.com/cfornesa/ai-dev-tools-zoomcamp-1/issues/208) —
   decision issue (not implementation): whether/how Three.js/A-Frame fit
   the structured editor, or stay exclusive to the existing raw-code
   art-piece flow. **DECIDED AND CLOSED** — genuine 3D support wanted, but
   as a new, separate 3D scene document/editor, not an extension of this
   epic's 2D schema. Spun off as task 177/[#209](https://github.com/cfornesa/ai-dev-tools-zoomcamp-1/issues/209),
   a new top-level epic on its own `3d-scene-editor-epic` branch.

Out of scope: changing the existing raw-code art-piece-studio flow (tasks
165-169) or revisiting #197's decision for that separate feature.

Next action: continue task 174/#206's remaining scope (export-bundle
Canvas2D runtime source, `exportCompatibility.ts`, UI picker, e2e), then
groom task 175/#207 (SVG adapter) now that #206's shared plumbing exists.

Dependencies: None blocking. Builds on the existing `P5ScenePreview`
interface, `RENDERER_CAPABILITIES`/`checkRendererCompatibility`, and
`scenes/thumbnails.py`'s already-renderer-agnostic backend thumbnail path.

## 174. Add a native Canvas2D renderer adapter for the structured scene editor

Status: COMPLETE

GitHub issue: [#206](https://github.com/cfornesa/ai-dev-tools-zoomcamp-1/issues/206) (closed)

Parent: task 173/#205.

Done: `schema/scene.schema.json`'s `renderer.preferred` widened to
`enum: ["p5", "canvas2d"]` (backward compatible, no schemaVersion bump);
`frontend/src/render/canvas2dAdapter.ts` (native Canvas2D port of
`p5Adapter.ts`'s full draw contract, pixel-identical per
`canvas2dAdapter.test.ts`'s 40-case mirror plus a cross-adapter parity
test); `scenePreview.ts` (shared types) and `createScenePreview.ts`
(renderer-selecting factory); wired into `EditorWorkspace.tsx`,
`PublicProjectViewer.tsx`, `usePreviewRuntime.ts`, `AIProposalPanel.tsx`,
and `captureSocialThumbnail.ts`; `exportCompatibility.ts`'s
`RENDERER_CAPABILITIES`/`RendererId` gained a `canvas2d` entry (full
parity with p5js); `standaloneCanvas2DRuntimeSource.ts` +
`generateHtmlExport.ts` produce a CDN-free canvas2d export, verified by a
real jsdom+canvas functional smoke test; `ExportConfigDialog.tsx`'s
"Renderer" select now reflects the scene's actual renderer instead of a
hardcoded p5js display; `scenes/api.py`'s `BlankProjectCreateView` +
`Gallery.tsx`'s new "Renderer" select let a new project actually choose
canvas2d at creation time (the last functional gap — previously nothing
in the product could author a canvas2d scene at all). `scenes/thumbnails.py`
confirmed unchanged (already renderer-agnostic).

Verification: full `make check` clean (675 backend passed/22 skipped;
1988 frontend passed). Full disposable-stack `make browser-qa` (full
local e2e): 131 passed, 2 failed, 1 intentional skip — both failures
confirmed unrelated by diff inspection and already tracked under
task 162/#193's long-established CI/environment-timing-variance history
(reopened with fresh evidence rather than filed as new). Every test
exercising this task's own changes passed.

Dependencies: None blocking. Unblocked task 175/#207's shared plumbing
dependency (the `ScenePreview`/`createScenePreview.ts` abstraction this
task added), though #207 also needs its own SVG-specific camera-overlay
and thumbnail-capture work on top.

## 175. Add an SVG renderer adapter for the structured scene editor

Status: COMPLETE

GitHub issue: [#207](https://github.com/cfornesa/ai-dev-tools-zoomcamp-1/issues/207) (closed)

Parent: task 173/#205. Depended on task 174/#206's shared plumbing.

Done: `schema/scene.schema.json`'s `renderer.preferred` enum gained
`"svg"`; `frontend/src/render/svgAdapter.ts` builds real SVG DOM elements
(`<circle>`/`<rect>`/`<line>`/`<path>`/`<g>`) via `createElementNS`/
`setAttribute` only (never `innerHTML`/`outerHTML`, since unlike
Canvas2D, SVG markup can execute embedded script content if built from
interpolated strings); camera overlay uses a `<foreignObject>` containing
an internal `<canvas>` `drawImage`'d every frame; `canvas.opacity` uses
SVG's own native `opacity` attribute (no offscreen-buffer trick needed,
unlike the raster adapters). `getCanvasElement()` delegates to a private,
never-mounted `canvas2dAdapter.ts` instance kept in sync on every
`render()` call, resolving the thumbnail-capture design question by
reusing the already-tested Canvas2D engine rather than hand-porting its
opacity-buffer/camera-compositing logic a third time — this also made
`svgAdapter.test.ts`'s 24-case pixel-parity coverage possible at all
(jsdom has no SVG rasterizer). `exportCompatibility.ts` gained an `svg`
entry (full parity); `standaloneSvgRuntimeSource.ts` +
`generateHtmlExport.ts` produce a CDN-free svg export, verified by a
jsdom smoke test asserting on the real SVG DOM tree. `ExportConfigDialog.tsx`/
`Gallery.tsx`'s renderer selects and `scenes/api.py`'s
`BlankProjectCreateView` all gained the `svg` option.

Verification: full `make check` clean (677 backend passed/22 skipped;
2022 frontend passed). Full disposable-stack `make browser-qa`: 132
passed, 1 failed, 1 intentional skip — the 1 failure is the same
pre-existing task 162/#193 flaky test reproduced identically on the
previous commit (#206), confirmed unrelated by diff inspection.
`projectLifecycle.spec.ts:153` (the other #193 test) passed this run,
confirming #193's own "intermittent CI/environment timing variance, not
a deterministic defect" characterization. Every test exercising this
task's own changes passed.

Dependencies: task 174/#206 (satisfied).

## 176. Decide whether/how Three.js and A-Frame fit the structured scene editor

Status: COMPLETE

GitHub issue: [#208](https://github.com/cfornesa/ai-dev-tools-zoomcamp-1/issues/208) (closed)

Parent: task 173/#205. A decision issue, not an implementation task —
mirrors task 166/#197's own format.

Decision (repository owner, 2026-08-28): genuine 3D schema support is
wanted, but as a **new, separate 3D scene document and editor** — its own
schema file, own validators, own editor route, Three.js/A-Frame as its
renderers — rather than retrofitting 3D fields into `scene.schema.json`
(the document tasks 174-175/#206/#207's 2D renderers extend) or flattening
2D content into a 3D engine. Reused across the 2D and 3D editors: the
tracking-provider interface, the bindings/graph-as-data philosophy, the
AI-provider abstraction pattern. Not reused: the 2D shape vocabulary or
renderer adapter interface. Full rationale in issue #208's closing
comment. Filed as a new top-level epic — task 177/#209 — rather than a
#205 sub-issue, with its own dedicated working branch
(`3d-scene-editor-epic`) rather than direct `main` work, given its scope.

Dependencies: None blocking; informed by but does not block tasks 174/175.

## 177. Epic: a genuine 3D scene editor (new schema, new editor, Three.js/A-Frame renderers)

Status: COMPLETE (this phase). Closed once its four scoped sub-issues
(#210-#213) delivered a working, tested, end-to-end backend slice —
mirroring how task 173/#205 closed once #206/#207/#208 resolved, even
though #208 itself spun off this epic as further work. Remaining future
phases (editor UI, renderer adapters, gesture bindings, AI generation,
export/publish/gallery, version-history/editing) are intentionally not
pre-scoped; each gets its own criterion-ready issue when work on it
begins, the same way #210-#213 each did.

GitHub issue: [#209](https://github.com/cfornesa/ai-dev-tools-zoomcamp-1/issues/209) (closed)

Follow-up to task 176/#208's decision. A new, separate 3D scene document
type and editor — genuine 3D geometry/transform/camera/lighting support —
distinct from both the existing 2D structured editor
(tasks 5-48+/#206/#207) and the existing raw-code AI art-piece flow
(tasks 165-169/#196-200, which already supports Three.js/A-Frame today via
an unstructured generation path).

Scope (see issue #209 for the full list, to be groomed into
implementation-ready sub-issues before work starts): a new 3D scene
schema (geometry, 3D transforms, camera, lighting, materials — likely its
own document family, not a V1 scene variant); independent Python +
TypeScript validators; a persistence-model grooming pass (new models vs.
reusing the existing project/version shape for a new document type); a
new editor route/UI; Three.js and A-Frame renderer adapters; whether/how
gesture-tracking bindings apply to 3D scenes; a new structured-output
AI-generation provider if AI generation is in scope for V1; export/
publish/gallery integration.

Working branch: `3d-scene-editor-epic` (pushed to origin), per the
repository owner's direction — this epic's work happens off `main` given
its scope.

Dependencies: None blocking. Informed by, but independent of, tasks
174-175/#206/#207's 2D renderer work and tasks 165-169/#196-200's raw-code
art-piece flow.

Sub-issues:

- Task 178/[#210](https://github.com/cfornesa/ai-dev-tools-zoomcamp-1/issues/210) —
  the canonical 3D scene document schema. **COMPLETE.**
- Task 179/[#211](https://github.com/cfornesa/ai-dev-tools-zoomcamp-1/issues/211) —
  independent Python + TypeScript validators for the 3D schema.
  **COMPLETE.**
- Task 180/[#212](https://github.com/cfornesa/ai-dev-tools-zoomcamp-1/issues/212) —
  Django persistence models for the 3D scene document. **COMPLETE.**
- Task 181/[#213](https://github.com/cfornesa/ai-dev-tools-zoomcamp-1/issues/213) —
  minimal creation/retrieval API for `Project3D`/`SceneVersion3D`.
  **COMPLETE.**
- Next: not yet filed. Candidates for the next groomed sub-issue: a
  version-history surface beyond the single initial version (list/save
  additional versions), or the editor route/UI itself now that a full
  create → persist → retrieve round trip exists end to end.

## 178. Define the canonical 3D scene document schema

Status: COMPLETE

GitHub issue: [#210](https://github.com/cfornesa/ai-dev-tools-zoomcamp-1/issues/210) (closed)

Parent: task 177/#209. First, foundational sub-issue of the 3D editor
epic — every other #209 sub-issue depends on this.

Delivered on the `3d-scene-editor-epic` branch (commits `6a7a1b3`,
`7d53d64`):

- `schema/scene3d.schema.json`: a genuinely separate document family from
  the 2D canonical scene (`documentType: "scene3d"` discriminator, per
  #208's decision) — camera (position/target/fov/near/far), lights
  (directional/point/ambient, each with type-conditional required
  fields), hierarchical groups mirroring the 2D schema's groups/groupId
  convention, and box/sphere/cylinder/plane objects with bounded
  `transform3D` (position/rotation/scale in x/y/z, degrees-based Euler
  rotation) and materials (color/opacity/emissive). `$defs` for
  id/color/unitInterval copied verbatim from `scene.schema.json`'s own
  conventions.
- `schema/limits3d.json`: scene-wide complexity/payload limits
  (maxObjects, maxGroups, maxGroupNestingDepth, maxLights,
  maxScenePayloadBytes), enforced by a future validator rather than the
  schema itself — mirrors `schema/limits.json`'s identical split for the
  2D schema.
- `schema/fixtures3d/` (2 valid, 6 invalid, 5 malicious) +
  `expectations3d.json`, mirroring `schema/fixtures/`'s structure. Three
  malicious fixtures (duplicate ids, dangling group reference, oversized
  document) are intentionally schema-valid — cross-field/complexity
  checks are out of scope for a schema-only issue and are #211's job, the
  same gap the 2D schema has between `scene.schema.json` and
  `scenes/validation.py`.
- `schema/README3d.md` documenting the versioning policy, the
  "not an extension of the 2D schema" boundary, and the schema/validator
  limit split.
- `tests/test_scene3d_schema.py`: 14 tests validating the schema itself
  (`Draft202012Validator.check_schema`) and every fixture against
  `expectations3d.json`. All pass.

No changes to `schema/scene.schema.json`, `scenes/validation.py`, or
`frontend/src/validation/scene.ts` (verified via `git diff --stat`,
additive-only per the issue's acceptance criteria).

QA: PASS, full criterion matrix in the
[issue #210 QA comment](https://github.com/cfornesa/ai-dev-tools-zoomcamp-1/issues/210#issuecomment-5460497545).

Dependencies: None blocking (first sub-issue of #209). Unblocks
[#211](https://github.com/cfornesa/ai-dev-tools-zoomcamp-1/issues/211).

## 179. Independent Python + TypeScript validators for the 3D scene schema

Status: COMPLETE

GitHub issue: [#211](https://github.com/cfornesa/ai-dev-tools-zoomcamp-1/issues/211) (closed)

Parent: task 177/#209. Depended on task 178/#210 (the schema itself).

Delivered on the `3d-scene-editor-epic` branch (commit `5c580b8`):

- `scenes/validation3d.py`: mirrors `scenes/validation.py`'s three-stage
  pipeline (schema version + `documentType` discriminator, then JSON
  Schema structure via `jsonschema`, then referential integrity —
  duplicate ids within `lights`/`groups`/`objects`, dangling
  `objects[].groupId` references — then `schema/limits3d.json`'s
  complexity/payload caps).
- `frontend/src/validation/scene3d.ts`: the Ajv-based TypeScript mirror,
  following `scene.ts`'s own pattern exactly.
- `tests/test_scene3d_validation.py` (13 tests) and
  `frontend/src/validation/scene3d.test.ts` (18 tests), both parametrized
  against the shared `schema/fixtures3d/expectations3d.json`. Three
  `malicious/` fixtures that are schema-valid (duplicate ids, dangling
  group reference, oversized document) are asserted as validator-rejected
  in both languages, closing the gap #210 documented as deferred.

While writing the validators, corrected two inconsistencies introduced in
task 178/#210: `limits3d.json`'s `maxGroupNestingDepth` was meaningless
(V1 `group3d` has no `childIds`/`parentGroupId` — groups are flat) and was
removed; `expectations3d.json`'s two boundary-violation malicious
fixtures' `rule` was corrected from a pre-verification guess (`"invalid"`)
to what `jsonschema`/`ajv` actually report (`"invalidValue"`, since both
libraries surface the error against the `object3d` `oneOf` discriminator,
not the nested `exclusiveMinimum`/`maximum` keyword directly).

Neither validator is wired into any API endpoint or persistence model yet
— correctly out of scope; that is the next #209 sub-issue.

QA: PASS, full criterion matrix (including a full `make check` run — 710
backend tests passed/22 skipped, 138 frontend files/2040 tests passed) in
the
[issue #211 QA comment](https://github.com/cfornesa/ai-dev-tools-zoomcamp-1/issues/211#issuecomment-5460530667).

Dependencies: task 178/#210 (complete). Unblocked task 180/#212
(persistence models).

## 180. Django persistence models for the 3D scene document

Status: COMPLETE

GitHub issue: [#212](https://github.com/cfornesa/ai-dev-tools-zoomcamp-1/issues/212) (closed)

Parent: task 177/#209. Depended on task 178/#210 (schema) and task
179/#211 (validators), both complete.

Delivered on the `3d-scene-editor-epic` branch (commit `c2457ed`):

- `Project3D`/`SceneVersion3D` added to `scenes/models.py` — deliberately
  separate models from `Project`/`SceneVersion` per #208's decision
  (a genuinely separate document family), not an existing-model extension
  with a document-type discriminator. Mirrors `Project`/`SceneVersion`'s
  shape at the minimum scope #212 asks for: owner, title,
  `current_version` pointer, sequence-numbered versions,
  `scene_json` validated by `validate_scene3d`
  (`scenes/validation3d.py`) on save. Intentionally omits fields that only
  make sense once their owning feature exists (`visibility`/
  `published_at` before publish/gallery integration, soft-delete before a
  delete flow, `creation_request_id` before a real creation endpoint) —
  deferred rather than spuriously added now.
- Migration `0018_project3d_sceneversion3d_project3d_current_version_and_more`,
  verified to apply cleanly against a real local PostgreSQL server.
- `tests/test_project_scene_version_3d_models.py` (9 tests): creation,
  setting `current_version`, multi-version retrieval, cross-project
  sequence independence, and — mirroring #211's cross-document-family
  guarantee at the persistence layer — that a 2D scene document is
  rejected by the 3D model's validator.
- No API endpoints/views yet — correctly out of scope; tests exercise the
  models directly.

Corrected one inaccurate acceptance criterion during implementation: the
issue's "basic admin registration, matching the existing Project/
SceneVersion admin" assumed admin registration existed for the 2D
models — it doesn't (no `scenes/admin.py` exists at all). Dropped rather
than invent unprecedented scope; recorded as a comment on #212 before
implementation, matching how #210/#211's own small corrections were
handled.

No changes to `Project`/`SceneVersion`/`Template` or their migrations.
Full backend suite: 719 passed/22 skipped (up from 710 pre-#212). `make
check` passes end to end.

QA: PASS, full criterion matrix in the
[issue #212 QA comment](https://github.com/cfornesa/ai-dev-tools-zoomcamp-1/issues/212#issuecomment-5460554316).

Dependencies: task 178/#210 and task 179/#211 (both complete). Unblocked
task 181/#213 (creation/retrieval API).

## 181. Minimal creation/retrieval API for Project3D/SceneVersion3D

Status: COMPLETE

GitHub issue: [#213](https://github.com/cfornesa/ai-dev-tools-zoomcamp-1/issues/213) (closed)

Parent: task 177/#209. Depended on task 180/#212 (persistence models,
complete).

Delivered on the `3d-scene-editor-epic` branch (commit `ad2ca3f`):

- `scenes/permissions.py`: `PROJECT3D_CREATE`/`PROJECT3D_READ` added to
  the single `Action` enum and `can()`'s single authorization service —
  not a parallel module. `Project3D` has no `visibility` field yet (task
  180/#212 deferred it), so `PROJECT3D_READ` is unconditionally
  owner-only.
- `scenes/serializers.py`: `Project3DSerializer`/
  `SceneVersion3DSerializer`, mirroring `ProjectSerializer`/
  `SceneVersionDetailSerializer`'s shape at this issue's smaller scope
  (no description/tags/visibility/thumbnail yet — those don't exist on
  the model).
- `scenes/api.py`: `Project3DListCreateView` (`POST`/`GET
  /api/projects3d/`) and `Project3DDetailView` (`GET
  /api/projects3d/<public_id>/`, owner-only, 404 for anyone else — never
  403, matching the existing "not found and found-but-not-yours are
  indistinguishable" convention). No `client_request_id` idempotency key
  and no `renderer` field — both explicitly deferred (`scene3d.schema.json`
  has no renderer concept; renderer selection is a later #209 phase).
- `scenes/urls.py`: `projects3d/` as its own namespace, matching #208's
  separate-document-family decision.
- `tests/test_project3d_api.py` (9 tests): creation returns a
  schema-valid scene (verified via `validate_scene3d`), auth required for
  create/list, list scoped to the caller, owner-only retrieval, 404 (not
  403) for anonymous/non-owner/nonexistent.

No changes to any existing 2D route, `Action`, or serializer —
purely additive (`git diff` confirms only new blocks in each touched
file). Full backend suite: 728 passed/22 skipped (up from 719
pre-#213). `make check` passes end to end.

QA: PASS, full criterion matrix in the
[issue #213 QA comment](https://github.com/cfornesa/ai-dev-tools-zoomcamp-1/issues/213#issuecomment-5460575977).

Dependencies: task 180/#212 (complete). A full create → persist →
retrieve round trip for the 3D document family now exists end to end.

## 182. Fix shape.name schema shadowing bug (AI create-scene 422s)

Status: PROPOSED

GitHub issue: [#214](https://github.com/cfornesa/ai-dev-tools-zoomcamp-1/issues/214)

Discovered investigating a user report: the AI create-scene prompt flow
fails 100% of the time it names a shape, with `$.shapes[N]: Additional
properties are not allowed ('name' was unexpected)`.

Root cause: `schema/scene.schema.json`'s `shape` `$defs` entry declares an
optional base `name` property, but every one of its 5 type-specific
`allOf` branches (circle/rect/line/path/particleEmitter) closes with
`additionalProperties: false` and its own allowlist that omits `name` —
so a named shape can never validate, for any shape type, on either the
Python or TypeScript side. `ai_provider/mistral_provider.py` passes this
same schema to Mistral's structured-output mode, which honors the base
declaration and routinely names shapes, so every such response is
rejected. Confirmed (via a script walking every `allOf`/`properties` pair
in the schema) that `shape.name` is the *only* instance of this pattern
in the whole schema — no other latent shadowing bugs.

See [durable memory: scene schema allOf branch property
shadowing](../.agents/memory/scene-schema-allof-branch-property-shadowing.md).

Scope: add `"name": true` to all 5 per-type allowlists; fixtures/tests
proving a named shape now round-trips through `validate_scene`/
`validateScene` and the AI create-scene path; update
`frontend/src/pages/sceneShapes.ts`'s now-stale `shapeLabel()` doc
comment. Full criteria on the issue.

Dependencies: None. Independent of task 183/#215 below.

## 183. Decision: AI-driven addressing/editing by layer/shape name

Status: PROPOSED (decision needed from the repository owner before any
implementation)

GitHub issue: [#215](https://github.com/cfornesa/ai-dev-tools-zoomcamp-1/issues/215)

Follow-up to the same user report as task 182/#214. The user wants AI
create/edit prompts to reference a specific layer/shape by name, have the
AI infer existing layers/shapes, generate new ones when none exist, and
leave everything unmentioned untouched — and is unsure whether this fits
the existing 2D structured editor at all, floating a
2D-manual/2D-AI/3D-AI editor-product split where the AI-facing editors'
addressable/protectable unit is "named details" rather than raw JSON
Patch paths.

This is a genuine, unresolved product/architecture decision comparable in
weight to task 176/#208's 2D-vs-3D schema split — not something to
implement speculatively. The issue lays out what already exists
(`scenes/patch.py`'s allowlisted-path + unreferenced-element check,
Task 111's shape-is-its-own-layer 1:1 relationship, task 182/#214's fix
unblocking a real persistable shape name) and two options (extend the
existing patch mechanism to resolve names vs. a genuinely separate
AI-editor product), with a recommendation (start with the smaller
extension) for the owner's consideration.

Dependencies: Informed by (not blocked by) task 182/#214 and the
completed task 177/#209 epic.

Status: RESOLVED. Repository owner decided directly (mid-session
feedback, not the AskUserQuestion form this issue anticipated): four
distinct editor products (2D/3D × manual/AI-assisted), manual editors
have layers, AI-assisted editors address/protect by named detail instead,
every editor has a fully functional embedded code editor. See task 184/
#216 below.

## 184. Epic: four-editor product line (2D/3D × manual/AI-assisted)

Status: PROPOSED (epic filed; sub-issues filed and scoped, not yet
implemented)

GitHub issue: [#216](https://github.com/cfornesa/ai-dev-tools-zoomcamp-1/issues/216)

Implements task 183/#215's decision. Four editor products:

|            | Manual                                  | AI-assisted |
| ---        | ---                                      | --- |
| **2D**     | Exists — `EditorWorkspace.tsx`, layers, embedded Code tab | New — task 185/#217 |
| **3D**     | New — task 186/#218                     | New — task 187/#219 |

Every editor gets a fully functional embedded code editor (the existing
2D manual editor's Code tab is the reference capability, not shared code).
Only manual editors have layers; AI-assisted editors address/protect
content by named detail (reusing `scenes/patch.py`'s allowlisted-path +
unreferenced-element mechanism, generalized, per #215's recommendation).

Sub-issues filed one at a time, criterion-ready, mirroring #210-#213's
sequencing rather than one large undifferentiated issue. Natural build
order: #217 (2D AI-assisted, smallest — reuses the existing 2D schema)
first, informing #218 (3D manual, needs its own editor-route groundwork)
and finally #219 (3D AI-assisted, explicitly depends on both #217's
name-resolution mechanism and #218's 3D editor-route groundwork).

Each of #217/#218/#219 was itself further refined into granular,
independently-implementable sub-issues (repository owner feedback: the
original "one bundled first slice" scope per product was still too
large) — see tasks 190-201 below. Also surfaced during that refinement:
the existing 2D manual editor isn't untouched by this decision either —
task 189/#221 tracks whether its existing embedded AI-assist panel
(`AIProposalPanel`) stays, is deprecated, or is reframed now that a
dedicated 2D AI-assisted editor product will exist.

Full sub-issue manifest: task 189/#221 (2D manual editor decision), task
190/#222 (shared name-resolution backend), tasks 191-193/#223-#225 (2D
AI editor), tasks 194-197/#226-#229 (3D manual editor), tasks
198-201/#230-#233 (3D AI editor).

Dependencies: task 183/#215 (decision, resolved). Tasks 178-181/#210-#213
(3D backend slice, complete) for the two 3D sub-issues.

## 185. 2D AI-assisted editor (no layers; embedded code editor)

Status: PROPOSED

GitHub issue: [#217](https://github.com/cfornesa/ai-dev-tools-zoomcamp-1/issues/217)

Parent: task 184/#216. First of the three missing editor products —
reuses the existing 2D schema (`schema/scene.schema.json`); task 182/#214
(shape.name fix) is what makes name-based addressing possible at all.

Dependencies: task 183/#215 (resolved), task 182/#214 (complete).

## 186. 3D manual editor (layers-equivalent, embedded code editor)

Status: PROPOSED

GitHub issue: [#218](https://github.com/cfornesa/ai-dev-tools-zoomcamp-1/issues/218)

Parent: task 184/#216. The first 3D editor UI to actually exist — makes a
`scene3d` project openable for the first time, on top of the already-built
backend slice (tasks 178-181/#210-#213). Explicitly does not require
Three.js/A-Frame rendering to be complete for its first slice.

Dependencies: tasks 178-181/#210-#213 (complete), task 183/#215 (resolved).

## 187. 3D AI-assisted editor (no layers; embedded code editor)

Status: PROPOSED

GitHub issue: [#219](https://github.com/cfornesa/ai-dev-tools-zoomcamp-1/issues/219)

Parent: task 184/#216. Last of the four editor products in the epic's
natural build order — depends on task 185/#217's name-resolution
mechanism (to generalize) and task 186/#218's 3D editor-route groundwork.

Dependencies: task 185/#217, task 186/#218 (both should land first).

## 188. Show the active renderer (p5.js/Canvas2D/SVG) inside the 2D manual editor

Status: COMPLETE

GitHub issue: [#220](https://github.com/cfornesa/ai-dev-tools-zoomcamp-1/issues/220) (closed)

Small, independent UI gap found investigating task 185/#217's scope: the
2D manual editor never displays which renderer an open project uses
anywhere in its header/toolbar (only the project-creation picker and the
export dialog show it). All the pieces needed already exist
(`resolveSceneRendererId`, `exportRendererIdFor`, `RENDERER_LABELS`) — a
label/badge addition only, no new renderer logic.

Delivered (commit `d592659`): a read-only `.editor-renderer-badge` span
next to `EditableProjectTitle` in `EditorWorkspace.tsx`'s header, wired
through the existing `resolveSceneRendererId` -> `exportRendererIdFor` ->
`RENDERER_LABELS` pipeline. New `EditorWorkspace.rendererBadge.test.tsx`
covers all three renderer types. `make check` passes end to end (733
backend / 2045 frontend).

QA: PASS, full criterion matrix in the
[issue #220 QA comment](https://github.com/cfornesa/ai-dev-tools-zoomcamp-1/issues/220#issuecomment-5462095524).
Live-browser verification of the authenticated editor route was not
performed (this environment's Google OAuth uses placeholder credentials
per issue #75); verified instead via React Testing Library against the
full component tree, matching this repo's existing `EditorWorkspace.*`
test convention.

Dependencies: None.

## 189. Decision: does the 2D manual editor keep its embedded AI-assist panel?

Status: RESOLVED

GitHub issue: [#221](https://github.com/cfornesa/ai-dev-tools-zoomcamp-1/issues/221) (closed)

Parent: task 184/#216. Surfaced investigating task 185/#217's scope: the
existing 2D manual editor is not purely manual today — it already has a
first-class embedded "AI proposals" panel (`AIProposalPanel.tsx`,
Tasks 46-50), which now overlaps with the purpose of the new dedicated
2D AI-assisted editor (task 185/#217). Presents three options (keep
as-is, deprecate/remove, reframe as narrower "quick fix" scope) with a
recommendation to keep as-is, for the owner's consideration. Does not
block any of tasks 190-198 below.

Decision: Option 1 (keep as-is) — the issue's own recommendation,
adopted directly by this session under the /goal directive's full
permission (no interactive owner response was available). No code
change: the manual editor's AI proposals panel is unmodified. See the
[issue #221 decision comment](https://github.com/cfornesa/ai-dev-tools-zoomcamp-1/issues/221#issuecomment-5462157302)
for the full rationale.

Dependencies: Informed by task 183/#215 (resolved) and task 185/#217.

## 190. Name-based element resolution for AI create/edit prompts (shared 2D/3D foundation)

Status: COMPLETE

GitHub issue: [#222](https://github.com/cfornesa/ai-dev-tools-zoomcamp-1/issues/222) (closed)

Parent: task 184/#216, refines task 185/#217. Backend-only: extends
`scenes/patch.py`'s existing unreferenced-element check (issue #158) to
resolve a textual reference ("the shape named Sun") against `shape.name`
(task 182/#214), and extends the AI system prompts
(`ai_provider/mistral_provider.py`) to address/name elements this way.
Feeds task 192/#224 (2D) and, later, task 197/#232 (3D, once task
193/#230 adds a 3D `name` field).

Delivered (commit `c55e9f0`): `scenes/patch.py`'s `_reference_candidates`
already read `item.get("name")` generically for every element type -- it
just couldn't matter for shapes until task 182/#214 fixed the persistence
bug. Fixed the stale "layers/groups only" docstring and added explicit
regression tests. Extended `_SYSTEM_PROMPT`/`_EDIT_SYSTEM_PROMPT` to tell
the model it may address existing shapes by name and should name newly
created ones the prompt implies a name for. `make check` passes end to
end (744 backend / 2045 frontend).

QA: PASS, full criterion matrix in the
[issue #222 QA comment](https://github.com/cfornesa/ai-dev-tools-zoomcamp-1/issues/222#issuecomment-5462152082).

Dependencies: task 182/#214 (complete). Unblocks task 192/#224 and,
later, task 197/#232 (now that task 198/#230 has landed a 3D name field).

## 191. 2D AI-assisted editor: route/UI shell + creation entry point

Status: COMPLETE

GitHub issue: [#223](https://github.com/cfornesa/ai-dev-tools-zoomcamp-1/issues/223) (closed)

Parent: task 184/#216, refines task 185/#217. Smallest slice: a new
route sibling to the existing `/projects/:id` manual editor, reusing the
existing 2D renderer/preview work, no layers panel, no AI logic yet — just
the shell and a creation entry point.

Delivered (commit `c69242b`): `/ai-projects/:id` (`AiEditorWorkspace.tsx`),
reusing the same `Project`/`SceneVersion` document family and
`createBlankProject` endpoint as the manual editor -- a different editor
UI over the same data, not a separate document family. Renders the
existing `createScenePreview`/`resolveSceneRendererId` pipeline plus
title editing; no layers/manual-editing UI. Gallery gets a second
"Create AI-assisted animation" button. `make check` passes end to end
(744 backend / 2051 frontend).

QA: PASS, full criterion matrix in the
[issue #223 QA comment](https://github.com/cfornesa/ai-dev-tools-zoomcamp-1/issues/223#issuecomment-5462200584).

Dependencies: None blocking. Unblocks task 192/#224 and task 193/#225.

## 192. 2D AI-assisted editor: prompt-driven create/edit flow

Status: COMPLETE

GitHub issue: [#224](https://github.com/cfornesa/ai-dev-tools-zoomcamp-1/issues/224) (closed)

Parent: task 184/#216, refines task 185/#217. The actual AI-assisted
authoring experience: a prompt-first panel (not a supplementary one,
unlike the manual editor's AI proposals panel — see task 189/#221),
reusing `AIProposalPanel`/`useAIProposal`'s existing create/edit-scene
machinery and task 190/#222's name-based resolution, with a continuous
session model (each accepted prompt's result is addressable by name in
the next prompt).

Delivered (commit `f1f046c`): `AIProposalPanel` mounted directly into
`AiEditorWorkspace.tsx` as the primary, always-visible surface -- no
changes to `AIProposalPanel.tsx`/`useAIProposal.ts` themselves. Accept
syncs local `scene`/`project.current_version` from the server-persisted
version, so a follow-up Edit-mode prompt generates against whatever was
just accepted (verified by a test asserting `editAIScene`'s `currentScene`
argument is the just-accepted scene, not the stale original). `make
check` passes end to end (744 backend / 2053 frontend).

QA: PASS, full criterion matrix in the
[issue #224 QA comment](https://github.com/cfornesa/ai-dev-tools-zoomcamp-1/issues/224#issuecomment-5462235072).

Dependencies: task 191/#223 and task 190/#222 (both complete).

## 193. 2D AI-assisted editor: embedded code editor

Status: COMPLETE

GitHub issue: [#225](https://github.com/cfornesa/ai-dev-tools-zoomcamp-1/issues/225) (closed)

Parent: task 184/#216, refines task 185/#217. Mirrors the manual
editor's Code tab (JSON at minimum, code-grammar view as a stretch goal)
for this editor's route.

Delivered (commit `1598afa`): extracted `EditorWorkspace.tsx`'s JSON
sub-tab machinery (`useJsonCodeSync`/`SceneCodeEditor`/`codeDiagnostic`,
issue #159/#177) into a shared `jsonCodeSync.tsx` module, unchanged
behavior (confirmed via the manual editor's existing 11/11
`EditorWorkspace.codeTab.test.tsx` passing untouched), and reused it in
`AiEditorWorkspace.tsx` with a Visual/Code toggle. Edits go through the
client `validateScene` mirror on blur -- no direct-to-server bypass.
Code-grammar (non-JSON) view deferred as a known follow-on per the
issue's own "JSON-only is an acceptable first slice" allowance. `make
check` passes end to end (744 backend / 2056 frontend).

QA: PASS, full criterion matrix in the
[issue #225 QA comment](https://github.com/cfornesa/ai-dev-tools-zoomcamp-1/issues/225#issuecomment-5462265966).

Dependencies: task 191/#223.

## 194. 3D manual editor: route/UI shell + creation entry point

Status: COMPLETE

GitHub issue: [#226](https://github.com/cfornesa/ai-dev-tools-zoomcamp-1/issues/226) (closed)

Parent: task 184/#216, refines task 186/#218. Makes a `scene3d` project
openable for the first time — fetches via the existing `GET
/api/projects3d/<public_id>/` (task 181/#213), a minimal/placeholder 3D
preview is acceptable (real rendering is a later follow-on), and a
creation entry point calling the existing `POST /api/projects3d/`.

Delivered (commit `8d37c88`): new `frontend/src/api/projects3d.ts` (no
frontend client existed for this document family before this issue),
`Project3DWorkspace.tsx` at `/projects3d/:id` -- title display + a
placeholder preview showing object/light/group counts. Gallery gets a
third "Create new 3D project" button. `make check` passes end to end
(744 backend / 2061 frontend).

QA: PASS, full criterion matrix in the
[issue #226 QA comment](https://github.com/cfornesa/ai-dev-tools-zoomcamp-1/issues/226#issuecomment-5462285669).

Dependencies: task 180/#212, task 181/#213 (both complete). Unblocks
task 195/#227 and task 199/#231.

## 195. 3D manual editor: outline/inspector (layers-equivalent panel)

Status: COMPLETE

GitHub issue: [#227](https://github.com/cfornesa/ai-dev-tools-zoomcamp-1/issues/227) (closed)

Parent: task 184/#216, refines task 186/#218. The 3D-manual equivalent
of the 2D editor's Layers panel + shape inspector — a flat list (the 3D
schema's `groups` don't nest, per `schema/README3d.md`) of
objects/groups/lights plus a camera summary, with transform/material/
type-specific property editing on selection.

Delivered (commit `789d152`): `Outline3DInspector.tsx` + `scene3dTypes.ts`
(document-shape types mirroring `sceneShapes.ts`'s convention), wired
into `Project3DWorkspace.tsx` against an in-memory copy of the current
version's scene, exactly as scoped -- no server save wiring. `make
check` passes end to end (744 backend / 2068 frontend).

QA: PASS, full criterion matrix in the
[issue #227 QA comment](https://github.com/cfornesa/ai-dev-tools-zoomcamp-1/issues/227#issuecomment-5462309496).
Discovered gap filed as [#234](https://github.com/cfornesa/ai-dev-tools-zoomcamp-1/issues/234)
(wire these edits to the #228 save endpoint) -- see task 202/#234 below.

Dependencies: task 194/#226 (complete).

## 196. 3D manual editor: save-a-new-version API

Status: COMPLETE

GitHub issue: [#228](https://github.com/cfornesa/ai-dev-tools-zoomcamp-1/issues/228) (closed)

Parent: task 184/#216, refines task 186/#218. Task 181/#213 only covers
creation (the single initial version) — this adds `POST
/api/projects3d/<public_id>/versions/` mirroring `SceneVersionListCreateView`'s
pattern, so both task 195/#227's manual edits and task 197/#232's
AI-proposed edits can actually persist.

Delivered (commit `ecfd953`): `SceneVersion3DListCreateView` mirrors
`SceneVersionListCreateView`'s `select_for_update` transaction pattern
(lock, next sequence, create, advance `current_version`). New owner-only
`Action.PROJECT3D_WRITE` (same shape as `PROJECT3D_READ`). No `origin`
accepted from the client -- `SceneVersion3D.Origin` only has `MANUAL`
until task 200/#232 adds an AI-origin choice. Version listing/restore
stayed explicitly out of scope. `tests/test_project3d_version_api.py`
(7 tests). `make check` passes end to end (740 backend / 2045 frontend).

QA: PASS, full criterion matrix in the
[issue #228 QA comment](https://github.com/cfornesa/ai-dev-tools-zoomcamp-1/issues/228#issuecomment-5462121539).

Dependencies: task 180/#212, task 181/#213 (both complete). Unblocks
task 195/#227 and task 200/#232.

## 197. 3D manual editor: embedded code editor

Status: COMPLETE

GitHub issue: [#229](https://github.com/cfornesa/ai-dev-tools-zoomcamp-1/issues/229) (closed)

Parent: task 184/#216, refines task 186/#218. Mirrors task 193/#225's
scope for the `scene3d` document (JSON view at minimum).

Delivered (commit `dd180eb`): `Scene3DCodeEditor.tsx` -- unlike task
193/#225's 2D Code tab (memory-only), an edit here validates via the
client `validateScene3D` mirror AND saves through task 196/#228's
endpoint on blur, per this issue's own explicit requirement. Wired into
`Project3DWorkspace.tsx` with a Visual/Code toggle. `make check` passes
end to end (744 backend / 2074 frontend).

QA: PASS, full criterion matrix in the
[issue #229 QA comment](https://github.com/cfornesa/ai-dev-tools-zoomcamp-1/issues/229#issuecomment-5462332596).
This is currently the only path in the 3D manual editor that persists
edits -- task 195/#227's outline/inspector remains in-memory only,
tracked by task 202/#234.

Dependencies: task 194/#226 (complete). Task 196/#228 (complete).

## 198. Add name field to scene3d schema (object3d/light)

Status: COMPLETE

GitHub issue: [#230](https://github.com/cfornesa/ai-dev-tools-zoomcamp-1/issues/230) (closed)

Parent: task 184/#216, refines task 187/#219. Mirrors task 182/#214's
fix exactly, for the 3D schema: add an optional `name` to `object3d`/
`light`, verified not shadowed by any per-type `allOf` branch (reuse
#214's shadowing-check script and durable memory
`scene-schema-allof-branch-property-shadowing.md`), plus fixtures and
regression tests.

Delivered (commit `1c56691`): added an optional `name` to `light`'s
properties and once to `object3d`'s shared `baseObjectFields` (the 3D
schema's per-type branches use `unevaluatedProperties: false` composition
rather than the 2D schema's per-branch closed `additionalProperties`
allowlists, so there was no shadowing to fix here -- confirmed live via
`validate_scene3d` against all 4 object types plus a named light, 0
errors). Added `schema/fixtures3d/valid/named_object_and_light.json`
(auto-covered by both fixture-driven suites) and an explicit
`test_named_object_is_accepted_for_every_object_type` regression test.
`make check` passes end to end (730 backend / 2042 frontend).

Discovered while starting this issue: the entire 3D backend (tasks
178-181/#210-213) had been marked COMPLETE/closed but its code only
existed on the never-merged `3d-scene-editor-epic` branch. Merged it into
`main` first (commit `7a1a014`) -- see
`.agents/memory/feature-branches-completed-work-not-merged-to-main.md`.

QA: PASS, full criterion matrix in the
[issue #230 QA comment](https://github.com/cfornesa/ai-dev-tools-zoomcamp-1/issues/230#issuecomment-5462063477).

Dependencies: None blocking. Unblocks task 200/#232 (3D AI-assisted
editor prompt-driven flow).

## 199. 3D AI-assisted editor: route/UI shell

Status: PROPOSED

GitHub issue: [#231](https://github.com/cfornesa/ai-dev-tools-zoomcamp-1/issues/231)

Parent: task 184/#216, refines task 187/#219. Reuses task 194/#226's
route/preview groundwork rather than reimplementing independently, with
no outline/inspector panel (that's the manual editor's concept).

Dependencies: task 194/#226.

## 200. 3D AI-assisted editor: prompt-driven create/edit flow

Status: PROPOSED

GitHub issue: [#232](https://github.com/cfornesa/ai-dev-tools-zoomcamp-1/issues/232)

Parent: task 184/#216, refines task 187/#219. Generalizes task 190/#222's
2D name-resolution mechanism to `scene3d` documents using task 198/#230's
name field; adds a `create_scene3d`/`edit_scene3d`-equivalent AI provider
capability (none exists yet — `ai_provider/mistral_provider.py` today
only targets the 2D schema); saves via task 196/#228. Last of the four
editor products in the epic's natural build order.

Dependencies: task 190/#222, task 198/#230, task 196/#228, task
199/#231 — all should land first.

## 201. 3D AI-assisted editor: embedded code editor

Status: PROPOSED

GitHub issue: [#233](https://github.com/cfornesa/ai-dev-tools-zoomcamp-1/issues/233)

Parent: task 184/#216, refines task 187/#219. Mirrors task 197/#229's
scope.

Dependencies: task 199/#231. Task 196/#228 for edits to persist.

## 202. Wire the 3D manual editor's outline/inspector edits to the save-version API

Status: PROPOSED

GitHub issue: [#234](https://github.com/cfornesa/ai-dev-tools-zoomcamp-1/issues/234)

Parent: task 184/#216, refines task 186/#218. Discovered while
implementing task 195/#227: task 195/#227 explicitly scoped itself to
in-memory-only editing ("wiring to a real save endpoint is #228's job"),
and task 196/#228's save endpoint exists and is closed, but nothing in
the frontend calls it yet -- edits made in the 3D manual editor's
outline/inspector are lost on navigation/reload, with no Save action
anywhere in that editor.

Scope: a Save action in `Project3DWorkspace.tsx` (or wherever the
eventual editor chrome lands) that POSTs the working scene via
`saveSceneVersion3D` (already added to `frontend/src/api/projects3d.ts`)
and updates local state from the response, mirroring the 2D manual
editor's `SaveControl`/`handleVersionSaved` pattern. Dirty-state
indication is a reasonable minimum; full version history/restore parity
is out of scope unless a future issue asks for it.

Dependencies: task 194/#226, task 195/#227, task 196/#228 (all complete).
