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
Status: ACTIVE
GitHub issue: #97
Progress (external local track, verified this session — no Replit console access, so the Replit
track remains unverified): confirmed all committed migrations are applied against a real local
PostgreSQL database (`manage.py migrate --check`), the full backend (580 passed) and frontend (1500
passed) suites are green, and `manage.py check --deploy` passes cleanly against a scratch env file
carrying production-security settings (`DJANGO_DEBUG=False`, HTTPS redirect, secure session/CSRF
cookies, a real 100-char `SECRET_KEY`, positive HSTS, a real SMTP `EMAIL_BACKEND`) without touching
the real working `.env` (which stays dev-configured for ongoing local work). Ran the documented
`make smoke-local` authenticated path for real against a locally running Django+Vite+PostgreSQL
stack — health, anonymous `/api/whoami/` 401, login form, and authenticated `/api/whoami/` 200 all
passed — which surfaced and fixed a real bug (issue #120, closed): `scripts/smoke-local.sh` failed
on macOS's stock bash 3.2 (an empty-array-under-`set -u` unbound-variable pitfall CI's modern-bash
runners never hit). Remaining for this task: the Replit-side track (applying migrations in Replit
development/production, verifying `manage.py check --deploy` and the health/smoke checks against
the actual published URL) needs Replit console access this environment doesn't have.

Re-verification (2026-08-23, `/production-readiness` review): re-ran `make check` clean (580 backend
tests; frontend lint/format-check/typecheck; 1522 frontend tests, up from 1500 in prior evidence),
`manage.py migrate --check` clean, and `manage.py check --deploy` clean against a freshly generated
scratch production-like env (same method as before). `make backend-typecheck` (`uv run mypy .`) is
also clean — confirms issue #106 (previously misfiled as `PROPOSED` in this backlog; corrected
below) stays fixed. Ran the full local Playwright suite (`npx playwright test`, no `E2E_BASE_URL`
override, per AGENTS.md's documented steps) against a live `AI_PROVIDER=fake` Django + Vite stack on
:5000: 105 passed, 2 skipped, 2 failed — both failures (`aiAndRecovery.spec.ts:266`,
`responsiveShell.spec.ts:134`) are the exact pre-existing parallel-run-only flakes already documented
in task 92/issue #123 and task 93; re-ran both with `--workers=1` and both passed, confirming no
regression. Found and fixed one doc-accuracy bug directly in this task's scope: AGENTS.md's
"Deployment tracks and preflight" section claimed the Replit deployment build runs "all migrations
before building the frontend," but `.replit`'s actual `[deployment].build` command
(`uv sync --locked && npm --prefix frontend ci && uv run python manage.py check --deploy && npm
--prefix frontend run build`) never runs `manage.py migrate` — migrations instead run through
`scripts/post-merge.sh` (development flow) or optionally at startup via `RUN_MIGRATIONS_ON_START=true`
in `scripts/start.sh`, matching the existing durable lesson in
`.agents/memory/replit-production-schema-publishing.md`. Corrected the AGENTS.md wording to describe
the actual build/runtime/post-merge split accurately. `scripts/smoke-published.sh` and
`scripts/smoke-local.sh` both pass `bash -n` syntax checks. Still blocked on the same gap: this
environment has no Replit console/deployment access, so the Replit-side track (schema-diff publish,
`manage.py check --deploy` and health/smoke checks against the actual `https://animate.creatrweb.com`
published URL) remains unverified here and needs the project owner or an environment with Replit
access to confirm.

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
