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
Status: ACTIVE
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
Status: PROPOSED — full groomed write-up filed as
[#159](https://github.com/cfornesa/ai-dev-tools-zoomcamp-1/issues/159).

## 128. Mobile-responsiveness audit: close remaining gaps outside the editor workspace and header

Goal: Close mobile-responsive gaps in surfaces the prior header (#89/#90)
and editor-workspace (#95, task 79/#109) passes never touched — export
dialog, AI proposal panel, version history, behavior cards/graph view,
demo controls, Layers panel (including its touch-incompatible native
HTML5 drag-reorder), Shape Inspector, Account Settings, template gallery
polish, and the public gallery/viewer chrome (the public gallery has no
CSS at all, at any width).
Status: PROPOSED — full groomed write-up filed as
[#160](https://github.com/cfornesa/ai-dev-tools-zoomcamp-1/issues/160).
