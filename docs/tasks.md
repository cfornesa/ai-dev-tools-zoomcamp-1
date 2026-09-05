Warning: truncated output (original token count: 256351)
Total output lines: 15682

# Creatrweb Animation Studio Backlog

## 2026-09-05 backlog implementation continuation

The earlier 2026-09-04 report was an audit snapshot. This continuation is
implementation work: #414, #415, #416, #404, and the #409 foundation now have
code and focused tests in the working tree.

- #414: production selects Django's shared database cache and migration
  `0026_create_django_cache_table`; development/tests retain isolated locmem.
- #415: production exports `BACKEND_SERVE_MODE=asgi` and launches pinned
  Uvicorn; local startup remains Django `runserver`.
- #416: local password signup is closed with an explicit Google-only policy;
  verified first-time Google social signup remains enabled.
- #404: finite Mistral/Gemini/DeepSeek registry and encrypted owner/vendor
  credential metadata endpoint were added without exposing plaintext.
- #409: the canonical schema now carries a versioned bounded draw.io subset,
  with mirrored client/server duplicate-ID and reference validation.
- #405/#406: Gemini and DeepSeek now have dependency-free server adapters for
  validated 2D/3D create/edit operations, with deterministic fake-client
  contract tests and owner credential routing.
- #407: account settings now expose named vendor credential cards, and 2D/3D
  AI proposal panels send a selected validated vendor/model pair.

Focused evidence: backend provider/auth/draw.io/cache tests pass; backend
scene validation tests pass (52); frontend scene validation tests pass (48)
and frontend typecheck passes. Full `make check` remains unavailable in this
managed host because its first target invokes an unavailable `python` binary;
startup subprocess/socket tests remain host-boundary failures documented in
the readiness report.

Status convention: Each completed item is marked `Status: COMPLETE` only after
its acceptance evidence is reconciled and the corresponding GitHub issue is
closed. Passing implementation or QA alone is not completion. Work that is
underway is marked `Status: ACTIVE`, and not-yet-started work is marked
`Status: PROPOSED`; blocked or handed-off work remains open with its owner,
blocker, and next action recorded.

Blocked-work continuation: a blocked issue does not stop the backlog session
or goal. After reconciling its blocker class, owner/context, exact next action,
and dependency edge, continue with the next independent closure-ready issue;
skip only issues that depend on the blocker. Halt the goal only when no
independent actionable work remains or all remaining work requires the same
unavailable external state. Engineering and testing remain strictly
per-issue, and completion still means GitHub closure.
For a dependency or environment blocker unrelated to the user's judgment or
decision, perform and record a fresh task-distillation reconciliation when that
issue ends, before selecting the next issue. Recheck duplicates, dependency
order, closure criteria, ownership, and follow-up issue coverage.

Closed-issue rule: completed issues stay closed. A current owner report that a
feature is absent or visually unusable is a new distillation signal, not an
automatic reopen. Create or reuse a criterion-ready follow-up linked to the
closed issue, preserving the original closure record. Reopening is permitted
only when the owner explicitly authorizes reopening that specific issue in the
current conversation. A closed GitHub state, DOM-role/bounds assertion, source
match, or shared-component QA comment is not sufficient to claim broader
parity; it is evidence only for the original issue's recorded scope.

CMS pieces parity boundary: the overarching goal is parity with the PHP
repository's pieces implementation as a behavioral/design reference, translated
into this Django/Python backend and React/TypeScript frontend. PHP is not
implemented here. The app must eventually create, render, publish, embed,
immerse, and package pieces like the maintained examples/fixtures. It does not
include unrelated augment-humankind CMS features such as blog, collections,
site administration, or other content types. Each issue must name its single
pieces surface or workflow.

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
Description: Enforce a discovery gate across exploration, implementation, QA, and review. Search the canonical backlog, local task plans, and existing GitHub issues for duplicates; create a PROPOSED entry in `docs/tasks.md` and a matching GitHub issue when the work is new; link both records; explicitly record any unavailable issue linkage; and reconcile all discovered work before the current task is marked complete. Keep ordinary pending work out of long-term memory while preserving durable blockers and lessons in `.agents/memory/`.
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
Description: `publishingAndRemix.spec.ts`'s `saveMeaningfulMetadata` and `exportConfigDialog.spec.ts`'s `fillMetadata` both still navigated to `/projects/:id/settings` and filled `#projec…226351 tokens truncated…3d/:id?embed=1&cms=1`. Its focused browser transaction
passed 3/3 in Chromium, Firefox, and WebKit against disposable
PostgreSQL/Django/Vite services, verifying the chrome-less CMS wrapper,
stage-local hamburger/stacked overlay, named controls and downloads, and
responsive behavior. The QA setup opens the hamburger before inspecting
hidden actions. No closed issue was reopened.

Latest distillation note (2026-09-04): prior scoped closures remain valid and
immutable. The current Chrome re-audit did not reproduce the reported bulky
outside-canvas editor rail, missing Draft/Published control, or absent public
controls at the exact routes and 375×812 viewport. #344 remains open only for
physical-camera evidence after steering activation produced no camera stream
or permission prompt; no new actionable defect or duplicate issue was found.

## #344 steering lifecycle distillation — 2026-09-04

The live authenticated editor exposed a concrete in-scope lifecycle gap. The
`Steer the piece` action alone changes to `Stop steering with gestures` but
does not start or claim a camera stream. Opening `Piece controls` and selecting
`Enable camera` is separately required; that action produced an active 640×480
stream and the local-hand-tracking status. #344 remains open and was groomed
with this finite lifecycle criterion, without reopening any closed issue.

Classification: `implementation-defect` for the steering activation contract,
plus `verification-boundary` for physical movement. Next action is to resolve
or explicitly justify the activation lifecycle, then use the active Chrome
camera session for real held-pinch forward/back/strafe, release, hand-loss,
disable, and stop-camera evidence.

The remaining open work is #344's physical-camera verification boundary and
the parent reconciliation containers; no parent is engineered directly.

## #344 engineering and paired QA handoff — 2026-09-04

Implemented the finite lifecycle defect discovered during the #344
transaction. `CameraControl` now supports an opt-in `startOnMount` path that
is used only after the user explicitly activates `Steer the piece`; ordinary
camera controls retain their permission-safe idle-on-mount behavior. The
gesture provider is started exactly once, its existing status/error/stream
callbacks remain authoritative, and disabling steering still unmounts the
control and stops the provider.

Evidence:

- Focused paired QA: `CameraControl.test.tsx` and
  `Scene3DPreview.gestureControl.test.tsx` — 2 files, 25/25 passed.
- Regression QA: camera overlay and sound suites — 4 files, 58/58 passed.
- Frontend lint, typecheck, production build, and `git diff --check` passed.
  Lint retains only pre-existing warnings; the build retains its existing
  large-chunk advisory.
- Physical held-pinch, release, hand-loss, disable, and camera denial remain
  manual Chrome evidence gates and are not claimed by synthetic tests.

#344 remains open and is not reopened: its implementation lifecycle gap is
resolved in this branch, while its remaining physical-input acceptance gate
is handed back to the authorized Chrome session. No next issue is started
until this issue's engineering and testing transaction is reconciled.

Post-engineering task-distillation: the remaining physical-camera criteria are
still the same finite #344 acceptance boundary, with no duplicate or smaller
independent issue identified. The pushed branch must be synced and published
before the owner performs the authorized Chrome gesture transaction. This
handoff does not reopen or invalidate any prior scoped closure.

## Fresh owner parity report: atomic distillation — 2026-09-03

The owner-reported gaps were audited against the current checkout, GitHub
state, the maintained `augment-humankind` pieces contract, and the exact
published URLs. The current Chrome session served `assets/index-xwmMEBBo.js`,
which differs from the current pushed local build. Both supplied URLs did
show a stage hamburger; opening the public route exposed Screenshot,
Download, Piece controls, and Fullscreen, while opening the owner route
exposed the editor actions and `Publication status: Draft`. Therefore the
report is retained as actionable revision-sensitive evidence, but the audit
does not claim that the current published asset is the reviewed local
revision, and it does not retroactively invalidate any closed issue.

### Atomic issue manifest

| Issue | Boundary | Status and next action |
| --- | --- | --- |
| #383 | Authenticated manual 3D editor route | PROPOSED; sync/publish reviewed revision, then inspect 1280x900 and 375x812 rendered controls and Draft round trip. |
| #384 | Anonymous public 2D route | PROPOSED; publish one fixture, inspect stage controls/privacy at both fixed viewports, restore Draft. |
| #385 | Anonymous public 3D route | PROPOSED; inspect proportional stage, controls/privacy at both fixed viewports, restore Draft. |
| #386 | Anonymous regular 2D embed route | PROPOSED; inspect chrome-less stage controls and private fallback at both fixed viewports. |
| #387 | Anonymous regular 3D embed route | PROPOSED; inspect chrome-less proportional stage controls and private fallback at both fixed viewports. |
| #388 | Anonymous regular immersive 3D route | PROPOSED; inspect immersive controls, no load-time camera prompt, and private fallback at both fixed viewports. |
| #389 | Anonymous CMS immersive 3D route | PROPOSED; inspect CMS wrapper/control parity, no load-time camera prompt, and private fallback at both fixed viewports. |
| #390 | Extracted Full and Non-Camera downloads | PROPOSED; extract both deployed artifacts and exercise their independent control/privacy contracts at both fixed viewports. |
| #344 | Physical immersive hand steering | OPEN; implementation lifecycle is tested, but real held-pinch/release/hand-loss/denial evidence remains owner-camera-bound. |
| #320/#324 | Reconciliation containers | OPEN; do not engineer or close until every atomic child is terminal and reconciled. |

### Duplicate and coverage report

The closed #347, #376–#382, and other historical issues remain closed and
valid for their own scoped transactions. They are not reopened. #383–#390
are new revision-sensitive route/artifact transactions because the current
owner report concerns exact deployed parity and the published asset differs
from the pushed build. #344 remains the existing independent gesture
capability issue; no duplicate was filed for it. #320 and #324 were rewritten
as parent/roll-up containers with the atomic child links above.

### Order, blockers, and closure boundary

After deployment synchronization, process #383 first, then #384 through #390
FIFO, one issue at a time with engineering and QA paired. The current blocker
is a deployment/verification boundary, not a user-judgment blocker: the
published asset identity must be reconciled before live claims. Physical
camera behavior remains a separate owner-controlled verification boundary on
#344. No actionable gap remains only in prose; every fresh route/artifact gap
has a criterion-ready issue and exact next action.

### #383 deployment precondition recheck — 2026-09-03

The exact authenticated owner route remains available in Chrome and renders
the stage hamburger, opened named action overlay, and `Publication status:
Draft`. It still serves `assets/index-xwmMEBBo.js`, not the current pushed
build, so #383 remains open at its deployment-revision boundary. Docker status
shows the intended services healthy, but multiple similarly named project
stacks are running; local service output is therefore not a substitute for
the exact published route. Next action remains sync/publish, then run #383's
fixed-viewport rendered transaction.

### #384 QA handoff — 2026-09-03

The republished public 2D URL serves `assets/index-CREpJGbM.js` and, in the
connected Chrome session, renders the artwork, stage hamburger, named
Screenshot/Download/Piece controls/Fullscreen, and no publication control.
The fixed-viewport local transaction
`BROWSER_QA_E2E_SPEC=e2e/public2dStageChrome.spec.ts make browser-qa` passed
3/3 across Chromium, Firefox, and WebKit at 1280x900 and 375x812. Exact
deployed anonymous privacy/restoration and fixed-viewport screenshots could
not be established because the Chrome session remains authenticated and
cannot emulate fixed viewports. QA result: FAIL / verification-boundary;
GitHub comment 5532894342 records the matrix. #384 remains open and
terminally handed off; #385 is the next independent transaction.

### #383 QA handoff — 2026-09-03

The reviewed revision is now published as `assets/index-CREpJGbM.js`. The
exact authenticated route renders the stage-local hamburger, named stacked
actions, and `Publication status: Draft` in the connected Chrome session.
The repository-owned fixed-viewport transaction
`BROWSER_QA_E2E_SPEC=e2e/manual3dStageChrome.spec.ts make browser-qa` passed
3/3 in Chromium, Firefox, and WebKit at 1280x900 and 375x812. However, the
connected Chrome surface cannot set those fixed viewports, so exact deployed
rendered screenshots and the deployed Draft round trip at both sizes remain
unverified. QA result: FAIL / verification-boundary; GitHub comment 5532864370
records the criterion matrix and exact next action. #383 remains open and
terminally handed off; #384 is the next independent transaction.

### #385 QA handoff — 2026-09-03

The republished asset is `assets/index-CREpJGbM.js`. The fixed-viewport local
3D public transaction `BROWSER_QA_E2E_SPEC=e2e/public3dProportions.spec.ts
make browser-qa` passed 3/3 across Chromium, Firefox, and WebKit at 1280x900
and 375x812. The exact supplied public 3D URL currently returns the
unavailable state because its fixture is Draft/private; exact anonymous
deployed screenshots and privacy restoration are therefore unverified. QA
result: FAIL / verification-boundary; GitHub comment 5532913000 records the
matrix. #385 remains open and terminally handed off; #386 is next.

### #387 engineering and QA handoff — 2026-09-03

Added `frontend/e2e/public3dEmbedStageChrome.spec.ts` for the regular 3D
embed's independent fixed-viewport transaction. After correcting the owner
viewport setup and the rendered Draft capitalization, the command
`BROWSER_QA_E2E_SPEC=e2e/public3dEmbedStageChrome.spec.ts make browser-qa`
passed 3/3 in Chromium, Firefox, and WebKit at 1280x900 and 375x812. It
covers chrome-less controls, proportional geometry, screenshot attachments,
and Draft restoration on a disposable fixture. The exact republished
`/embed/p3d/...` URL serves `assets/index-CREpJGbM.js` but currently returns
the unavailable state because the shared fixture is Draft/private. Exact
deployed anonymous/fixed-viewport evidence remains unverified. QA result:
FAIL / verification-boundary; GitHub comment 5533024956 records the matrix.
#387 remains open and terminally handed off; #388 is next.

### #386 engineering and QA handoff — 2026-09-03

Added `frontend/e2e/public2dEmbedStageChrome.spec.ts` as the missing
route-specific automation for the regular 2D embed. It creates one disposable
fixture, publishes it, verifies only `/embed/p/:id` anonymously at 1280x900 and
375x812, attaches rendered screenshots, checks named controls and download
variants, then restores Draft and verifies the private fallback. The command
`BROWSER_QA_E2E_SPEC=e2e/public2dEmbedStageChrome.spec.ts make browser-qa`
passed 3/3 in Chromium, Firefox, and WebKit. The exact republished URL serves
`assets/index-CREpJGbM.js` and is chrome-less with the expected controls, but
the connected Chrome surface cannot emulate fixed viewports or provide a
separate anonymous profile. QA result: FAIL / verification-boundary;
GitHub comment 5532948496 records the matrix. #386 remains open and
terminally handed off; #387 is next.

### #388 engineering and QA handoff — 2026-09-03

Added `frontend/e2e/public3dImmersiveStageChrome.spec.ts` for the anonymous
regular immersive 3D route. The isolated fixed-viewport transaction passed
3/3 in Chromium, Firefox, and WebKit at 1280x900 and 375x812. It verifies the
route-local stage and hamburger controls, no duplicate application chrome,
proportional geometry, no horizontal overflow or unjustified scrollbar,
no camera request on load, screenshot evidence, and Draft restoration.
The exact republished route serves `assets/index-CREpJGbM.js`, but the supplied
shared fixture is currently Draft/private and therefore returns the deployed
unavailable state; exact anonymous deployed rendered evidence remains
unverified. QA result: FAIL / verification-boundary; GitHub comment
5533080734 records the matrix. #388 remains open and terminally handed off;
#389 is next.

### #390 engineering, QA, reconciliation, and closure — 2026-09-03

Expanded `frontend/e2e/exportArtifacts.spec.ts` with explicit Full and
Non-Camera ZIP filename and extracted-manifest assertions. The complete
command `BROWSER_QA_E2E_SPEC=e2e/exportArtifacts.spec.ts make browser-qa`
passed 57/57 across Chromium, Firefox, and WebKit. The target transaction
verified regular and immersive extracted entry points, camera asset/control
separation, opt-in camera lifecycle, screenshot/Fullscreen/Sound/Piece/Guide/
Steer behavior, responsive 1280x900 and 375x812 containment, and no
unjustified scrollbar. QA comment 5533150553 records PASS. This issue excludes
live-route verification, so its finite criteria are complete; #390 is closed
as completed. No closed issue was reopened.

### #389 engineering and QA handoff — 2026-09-03

Added `frontend/e2e/public3dImmersiveCmsStageChrome.spec.ts` for the
anonymous CMS immersive route. The isolated fixed-viewport transaction passed
3/3 in Chromium, Firefox, and WebKit at 1280x900 and 375x812. It verifies the
CMS chrome-less wrapper, stage-local controls, proportional containment, no
horizontal overflow or unjustified scrollbar, no camera request on load,
screenshot evidence, and Draft restoration. The exact republished route
serves `assets/index-CREpJGbM.js`, but the supplied shared fixture is currently
Draft/private and returns the unavailable state; exact deployed anonymous
rendered evidence remains unverified. QA result: FAIL /
verification-boundary; GitHub comment 5533098204 records the matrix. #389
remains open and terminally handed off; #390 is next.
### #344 physical-input QA handoff — 2026-09-03

The authorized Chrome session reached the exact owner 3D route and activated
`Steer the piece`; the rendered status confirmed that camera tracking is
active locally. The remaining criteria require the owner to perform a real
held pinch, release, hand loss, disable/stop, and denial/unavailable check.
Automation cannot synthesize those physical camera signals. QA comment
5533168795 records the blocked gate. End-of-blocker task distillation found no
new duplicate or independently actionable product defect, so no follow-up
issue was created. #344 remains open and terminally blocked; no closed issue
was reopened.
### Fresh task-distillation reconciliation — 2026-09-03

This audit preserves every prior issue closure as valid for its recorded
scope. The latest owner report is new evidence about the requested end state,
not permission to reopen #347, #348, #349, #325–#337, or any other closed
issue.

The current authenticated owner 3D route renders the stage-local hamburger,
named action overlay, and interactive Draft/Published disclosure from the
synchronized build. The public 2D route also renders its hamburger and named
permitted actions. These reports were not reproduced in the current browser
context, while fixed 1280x900/375x812 deployed screenshots remain a browser
verification boundary. One actionable rendered observation remains: the owner
route's nested publication card intrudes on the preceding authoring row at the
inspected desktop size; this belongs to open #383's exact route transaction.

Source inspection found structured-2D capability derivation and sound controls
with no production consumer import, while the ordinary 2D capability constant
remains sound-disabled. This is held for grooming until an enabled 2D fixture
and exact consumer surface are identified; no speculative or duplicate issue
was filed. #346 remains permanently closed for its shared-foundation scope.

The deployment queue is #383 authenticated manual 3D, #384 anonymous public
2D, #385 anonymous public 3D, #386 anonymous 2D embed, #387 anonymous 3D
embed, #388 immersive 3D, and #389 CMS immersive 3D. #344 is an independent
physical-input blocker; #320/#324/#274 are parent/reconciliation containers;
#390 remains permanently closed. #383 is the sole groomed next issue. After
its reconciliation, process #384–#389 in FIFO order, one issue at a time,
completing engineering and QA together, then reconciliation and permanent
closure before advancing. A dependency blocker receives best-effort checks
plus end-of-blocker distillation, then the next independent issue proceeds;
no historical issue is reopened.
### Deployment queue progress — 2026-09-03

#383 received QA evidence comment 5533279486. Its local fixed-viewport
transaction passed 3/3; exact deployed fixed-viewport screenshots remain
blocked by the connected Chrome limitation, and the publication-card overlap
is recorded inside the route transaction. It was not falsely closed, and the
independent FIFO queue advanced to #384.

#384 received QA evidence comment 5533279950. Its local public-2D fixed-
viewport transaction passed 3/3 across Chromium, Firefox, and WebKit at
1280x900 and 375x812. The current deployed route shows the named controls in
the authorized browser, but exact deployed anonymous fixed-viewport captures
remain blocked by the same Chrome limitation. #384 remains open at that
verification boundary; #385 is next.
#385 local public-3D fixed-viewport QA passed 3/3 across Chromium, Firefox,
and WebKit at 1280x900 and 375x812, including proportional sphere framing and
reachable controls; GitHub comment 5533293398 records the handoff. #385 stays
open for the exact deployed anonymous transaction.

#386 local regular-2D-embed fixed-viewport QA passed 3/3 across Chromium,
Firefox, and WebKit with chrome-less containment and public-only controls;
GitHub comment 5533301188 records the handoff. #386 stays open for deployed
evidence.

#387 local regular-3D-embed fixed-viewport QA passed 3/3 across Chromium,
Firefox, and WebKit with proportional geometry and public controls; GitHub
comment 5533310824 records the handoff. #387 stays open for deployed evidence.

#388 local regular-immersive-3D fixed-viewport QA passed 3/3 across Chromium,
Firefox, and WebKit at 1280x900 and 375x812, including compact stage-local
controls and no camera request on load; GitHub comment 5533332273 records the
handoff. #388 stays open for deployed evidence.

#389 local CMS-immersive-3D fixed-viewport QA passed 3/3 across Chromium,
Firefox, and WebKit at 1280x900 and 375x812, including the chrome-less wrapper
and no camera request on load; GitHub comment 5533332709 records the handoff.
#389 stays open for deployed evidence.

### Fresh live Chrome recheck — 2026-09-03

The exact authenticated owner route and public 2D route were reopened in the
current signed-in Chrome session. Both intentionally show only the
stage-associated hamburger while closed; opening the menu exposes the named
controls. The owner route exposes an interactive Draft (Private) / Published
switch. The reported complete absence of controls or publication transition
was not reproduced in this current route/context.

One concrete defect was confirmed on #383: the open publication panel measures
320×136px, uses visible overflow, and overlaps the underlying authoring rows
at the available desktop viewport. It is recorded on #383 as a route-scoped
follow-up. No closed issue was reopened and no duplicate issue was created.

### #383 engineering reconciliation — 2026-09-03

The confirmed publication-panel overlap was fixed in pushed commit `9766c1c`.
The panel now stays in normal stacked flow below its trigger; only the open
fullscreen overlay may scroll when expanded content exceeds the viewport. A
CSS contract test and route-level non-overlap assertion were added.

Focused PublishControl3D tests passed 10/10, frontend typecheck passed,
changed-file Prettier passed, and
`BROWSER_QA_E2E_SPEC=e2e/manual3dStageChrome.spec.ts make browser-qa` passed
3/3 in Chromium, Firefox, and WebKit at 1280x900 and 375x812. GitHub comment
5533390457 records the evidence. #383 remains open pending republish and
exact deployed-route recheck; no closed issue was reopened.

### #383 deployment recheck — 2026-09-03

The exact owner route still serves `assets/index-CREpJGbM.js`, the pre-fix
bundle, and its live publication panel still overlaps the authoring group.
The reviewed fix is pushed as `9766c1c` and passes the local route
transaction. This is a confirmed stale-deployment boundary: republish
`origin/main`, verify the asset changes, then repeat the live overlap and
Draft/Published checks.

The FIFO deployment QA pass is complete through #389, but none of these issues
was closed because exact deployed rendered gates remain unavailable through
connected Chrome. #390 remains permanently closed. Obtain deployed
anonymous/fixed-viewport evidence, then reconcile and close each issue
individually in FIFO order.
#383 is now permanently closed as completed after asset
`assets/index-UmUBnruG.js` was verified live, the publication overlap fix was
confirmed, and the authorized Draft → Published → Draft round trip restored
the fixture.

#384 was rechecked against the same deployed asset: the public 2D overlay is
visible, stacked, and contained; its anonymous-profile gate remains open.
#385 was temporarily published and rechecked against the same asset; its
public 3D overlay rendered the expected controls and the fixture was restored
to Draft. Its anonymous-profile gate remains open. GitHub comments 5533485457
and 5533492806 record the route evidence. No closed issue was reopened.

### Fresh republish continuation — 2026-09-03

The exact #384 public 2D route was rechecked after republish. Its single
stage-local hamburger opened the expected Screenshot, Download, Piece
controls, and Fullscreen actions; the available rendered viewport reported no
horizontal overflow. This remains an authenticated-session observation, so
#384 stays open for its explicit anonymous privacy/restoration gate. GitHub
comment 5533540348 records the result.

The exact #385 public 3D route was then transactionally changed from Draft to
Published, verified against `assets/index-UmUBnruG.js`, and restored to Draft.
The published route rendered the artwork and the expected stage-local control
set with no horizontal overflow in the available session. #385 remains open
only for anonymous fixed-viewport evidence; GitHub comment 5533560098 records
the result. The next FIFO candidate is #386. Closed issues remain immutable.

The same republished asset was then checked route-by-route for #386 through
#389. The regular 2D embed, regular 3D embed, regular immersive 3D, and CMS
immersive 3D routes each rendered their scoped chrome-less/stage-local menu
and applicable named controls without horizontal overflow in the available
session. The 3D fixture was restored to Draft after the checks. Issues #386–
#389 remain open only for their explicit anonymous fixed-viewport privacy and
restoration gates (plus camera opt-in checks where applicable); comments
5533570144, 5533578464, 5533578988, and 5533579589 record the evidence.

## Fresh owner-report distillation — 2026-09-04

The current published bundle `assets/index-UmUBnruG` was inspected against
the exact supplied owner and public routes and the route-specific deployment
children. The reported missing editor/public controls and missing
Draft/Published disclosure were not reproduced: the editor has one
stage-local hamburger with a stacked labeled overlay and publication switch,
and the public route has its hamburger with Screenshot, Download, Piece
controls, and Fullscreen. The regular 2D/3D embeds and regular/CMS immersive
routes likewise exposed their scoped controls during temporary publication;
the 3D fixture was restored to Draft.

This is a revision/session-sensitive `not reproduced` result, not a claim of
anonymous parity. Chrome remains authenticated, so #384–#389 stay open for
their exact anonymous fixed-viewport and privacy/restoration gates. No new
implementation defect or duplicate issue was found. #274/#324 remain open
reconciliation containers from prior history; this pass does not reopen or
rewrite any issue. Closed #347–#349 and #390 remain immutable. The next FIFO
handoff is #384.

## #384 closure reconciliation — 2026-09-04

#384 is permanently closed as `completed` for the exact anonymous public 2D
route. Deployed asset `assets/index-UmUBnruG` passed the 1280×900 and 375×812
rendered transactions with the stage-local hamburger, named controls,
download entries, containment, and no owner metadata. The fixture was restored
to Draft through the authenticated editor, and the anonymous route returned
the unavailable/private state. GitHub comment 5533662175 records the complete
criterion matrix. The next FIFO issue is #385; no closed issue was reopened.

## #385 closure reconciliation — 2026-09-04

#385 is permanently closed as `completed` for the exact anonymous public 3D
route. Deployed asset `assets/index-UmUBnruG` passed the 1280×900 and 375×812
rendered transactions with proportional sphere geometry, the stage-local
hamburger, all named public controls, containment, and no owner metadata. The
fixture was restored to Draft and the anonymous route returned the
unavailable/private state. GitHub comment 5533685789 records the complete
criterion matrix. The next FIFO issue is #386; no closed issue was reopened.

## #386 closure reconciliation — 2026-09-04

#386 is permanently closed as `completed` for the exact anonymous regular 2D
embed route. Deployed asset `assets/index-UmUBnruG` passed 1280×900 and
375×812 rendered checks for the chrome-less stage-local hamburger, named
controls, containment, and absence of site chrome. The fixture was restored to
Draft and the anonymous embed returned the unavailable/private state. GitHub
comment 5533699601 records the complete criterion matrix. The next FIFO issue
is #387; no closed issue was reopened.

## #387 closure reconciliation — 2026-09-04

#387 is permanently closed as `completed` for the exact anonymous regular 3D
embed route. Deployed asset `assets/index-UmUBnruG` passed 1280×900 and
375×812 rendered checks for the chrome-less stage-local hamburger, named
controls, proportional 16:9 geometry, containment, and absence of site chrome.
The fixture was restored to Draft and the anonymous embed returned the
unavailable/private state. GitHub comment 5533727630 records the complete
criterion matrix. The next FIFO issue is #388; no closed issue was reopened.

## #388 closure reconciliation — 2026-09-04

#388 is permanently closed as `completed` for the exact anonymous regular
immersive 3D route. Deployed asset `assets/index-UmUBnruG` passed 1280×900
and 375×812 rendered checks for the chrome-less stage-local hamburger, named
controls, containment, and no load-time camera prompt. The fixture was
restored to Draft and the anonymous route returned the unavailable/private
state. GitHub comment 5533742788 records the complete criterion matrix. The
next FIFO issue is #389; no closed issue was reopened.

## #389 closure reconciliation — 2026-09-04

#389 is permanently closed as `completed` for the exact anonymous CMS
immersive 3D route. The deployed `assets/index-UmUBnruG` revision passed
1280×900 and 375×812 rendered checks for the chrome-less stage-local
hamburger, Screenshot/Download/Sound/Piece controls/Steer/Guide/Fullscreen,
containment, no duplicate CMS chrome, and no load-time camera prompt. The
fixture was restored from Published to Draft, and the anonymous CMS route
returned its unavailable/private state. GitHub comment 5533801021 records the
criterion matrix. The next independent FIFO boundary is #344; no closed issue
was reopened.

## Fresh owner-report reconciliation — 2026-09-04

The exact current deployed bundle is `assets/index-UmUBnruG`. A fresh
authenticated inspection of the supplied 3D editor route showed the hamburger
inside the Preview canvas; opening it displayed the stacked Screenshot,
Download, Immersive, Sound, Piece controls, Steer, Guide, 3D authoring, Save
scene, AI, Publication status, and Fullscreen actions. The publication
disclosure exposed Draft/Published switching.

The supplied public 2D route was private while its fixture was Draft, which
explains the absence of public controls in that state. After a temporary
Published transition, the same exact route exposed its stage-local hamburger
and Screenshot, Download, Piece controls, and Fullscreen actions at both
1280×900 and 375×812. The open mobile dialog filled the viewport without
horizontal overflow; its own scroll area was exactly viewport-sized and the
page body overflow was hidden. Screenshots were inspected at both fixed
viewports.

Distillation result: the reported missing controls/status are not reproduced
on the current deployed revision. The public-route observation is a
publication-state boundary, not a product defect. The visible editor outline
and inspector are authoring surfaces behind the stage overlay, not duplicate
piece-runtime controls. No new issue is filed; closed #384–#390 remain valid
for their own transactions and immutable. #344 is the next independent FIFO
item, with only owner-controlled physical camera evidence remaining.

## #344 non-human verification completion — 2026-09-04

The non-human portion of #344 is complete on the current pushed revision:
focused lifecycle QA passed 25/25, the four-file regression set passed 35/35,
frontend typecheck passed, lint passed with only pre-existing warnings, and
the production build passed with only the existing large-chunk advisory.
The published immersive route was prepared in the authorized Chrome session
with steering activated. #344 remains open only for owner-controlled physical
held-pinch movement, release/hand-loss safe-stop, disable/stop-camera, and
denial/unavailable evidence. No closed issue was reopened or closed on
synthetic evidence.

## #344 owner acceptance and closure — 2026-09-04

The owner manually verified desktop Chrome held-pinch forward/back and
left/right movement, mouse dragging concurrently with pinch steering, and
safe stop on hand removal. Pinch release alone did not stop movement; the
owner explicitly accepted that additive behavior because the PHP reference
does not provide pinch-to-move. #344 is permanently closed as `completed` for
its desktop hand-steering scope. Mobile behavior is assumed, not a required
criterion; issue #391 was closed as `not_planned` and must not be pursued
unless the owner explicitly reports a mobile defect. No closed issue was
reopened.

## 272. List published 2D and 3D authored pieces in the public gallery

Status: IMPLEMENTED LOCALLY — BROWSER QA BLOCKED

GitHub issue: [#392](https://github.com/cfornesa/ai-dev-tools-zoomcamp-1/issues/392)

The owner reported that published pieces do not appear in the public gallery
while checking the mobile gesture surface. Investigation found that the
header's `/gallery` route calls only `GET /api/public/projects/`, the 2D
`Project` gallery endpoint. Published `Project3D` records have public detail
and publish endpoints from #296 but no gallery-list endpoint or frontend list
adapter. Generated `ArtPiece` records remain a separate `/art-pieces/gallery`
surface covered by #315/#319 and are not folded into this route.

This is a new route/data-contract issue. Closed #46/#50, #296, #315, #320,
and #324 remain immutable historical scopes and are not reopened.

Closure contract: anonymous `/gallery`; one eligible published, non-deleted,
versioned 2D fixture and one 3D fixture; mixed deterministic pagination;
safe public card fields only; correct `/p/:id` and `/p3d/:id` links; immediate
removal after unpublish; accessible loading/empty/error/thumbnail/pagination
states; fixed 1280x900 and 375x812 browser evidence; focused backend/frontend
checks plus `make check`. Generated `ArtPiece` routes, viewer controls,
gesture behavior, embeds, immersive routes, and downloaded artifacts are out
of scope.

Implementation commit: `c2cc1c8`.

Focused backend (33 passed), focused frontend/accessibility (18 passed),
frontend full suite (2,407 passed), backend lint/typecheck, frontend
typecheck/lint, and production build passed. The required disposable browser
runner was invoked but is blocked because the Docker daemon is unavailable;
#392 remains open pending browser QA at 1280x900 and 375x812.

Next action: rerun
`BROWSER_QA_E2E_SPEC=e2e/publicGalleryMixedPieces.spec.ts make browser-qa`
with Docker available, inspect the retained screenshots, then reconcile the
GitHub issue.

## 273. Owner-reported authored-piece parity audit — 2026-09-03

Status: #392 IMPLEMENTED LOCALLY — BROWSER QA BLOCKED; FOLLOW-UPS QUEUED

The owner's new screenshots and report identify six independently observable
boundaries. The audit found existing implementation or historical coverage in
each area, but also found owner-visible gaps or contradictions that cannot
reopen closed issues. New criterion-ready GitHub issues were filed:

- [#392](https://github.com/cfornesa/ai-dev-tools-zoomcamp-1): anonymous
  `/gallery` must list published structured 2D and 3D authored pieces.
- [#393](https://github.com/cfornesa/ai-dev-tools-zoomcamp-1): owner 3D
  thumbnails must reflect the current saved scene rather than a fallback.
- [#394](https://github.com/cfornesa/ai-dev-tools-zoomcamp-1): 3D
  private/public state and controls must be visibly discoverable.
- [#395](https://github.com/cfornesa/ai-dev-tools-zoomcamp-1): 2D layer
  selection must have an explicit, clearable deselection path.
- [#396](https://github.com/cfornesa/ai-dev-tools-zoomcamp-1): 3D outline
  selection must have a clearable layer-equivalent interaction contract.
- [#397](https://github.com/cfornesa/ai-dev-tools-zoomcamp-1): 2D Preview
  canvas and overlays must remain inside the designated panel box.
- [#398](https://github.com/cfornesa/ai-dev-tools-zoomcamp-1): manual 3D
  Preview/outline/inspector/editor layout must be non-overlapping and
  responsive with documented 2D parity differences.

Duplicate/coverage decisions: closed #46/#50 and #134 cover the original 2D
gallery and thumbnail backfill; closed #243 covers the original 3D thumbnail
pipeline; closed #296/#376 cover 3D publication mechanics; closed #152/#183
cover prior 2D bidirectional layer selection; closed #195/#304/#358 cover
prior 3D outline/editor work; and closed #325/#338/#377 cover earlier route
and layout transactions. All remain immutable. Generated `ArtPiece` routes
remain under #315/#319 and are not mixed with structured authored pieces.

Order rationale: #392 is the next independent public-gallery workflow and
establishes the discoverability/data boundary. #393 and #394 can follow as
owner-card/editor capability transactions. #395/#396 are independent editor
selection transactions. #397 precedes #398 conceptually because the 2D
Preview panel is the stated layout reference, but each has its own route and
can be verified independently. Engineering must process one issue at a time.

The complete evidence, fixed fixtures/viewports, finite closure criteria,
commands, blockers, and handoff are recorded in
`.local/tasks/public-gallery-published-pieces-distillation-2026-09-04.md`.

## 274. Recover renderable current-scene 3D project thumbnails

Status: IMPLEMENTED LOCALLY — BROWSER QA/FULL GATE BLOCKED

GitHub issue: [#393](https://github.com/cfornesa/ai-dev-tools-zoomcamp-1/issues/393)

The owner-facing 3D card now distinguishes a stored fallback render, retries
fallback generation on owner detail/thumbnail access, provides a visible
retry and retry-error path, and uses a 4:3 thumbnail frame matching the
320x240 server artifact contract. Saving already creates a new version-keyed
thumbnail; the endpoint now also recovers stale fallback rows.

Commits: `85c39d4`, `41acbc5`.

Focused thumbnail/API tests pass (28), the focused 3D card suite passes (11),
frontend typecheck/lint pass, and targeted formatting passes. `make check`
reached 888 passed and 22 skipped but retains the same five unrelated macOS
sandbox failures in git socket binding and startup subprocess tests. The
required `BROWSER_QA_E2E_SPEC=e2e/project3dThumbnailCard.spec.ts make
browser-qa` remains unavailable because Docker is not running. #393 remains
open pending browser inspection of the owner card at 1280x900 and 375x812.

## 275. Make 3D publication state and controls visibly discoverable

Status: IMPLEMENTED LOCALLY — BROWSER QA/FULL GATE BLOCKED

GitHub issue: [#394](https://github.com/cfornesa/ai-dev-tools-zoomcamp-1/issues/394)

The manual 3D editor now exposes the current Private/Public state and its
publish/unpublish action in the editor header, matching the 2D editor's
owner-facing entry point. The stage-local duplicate disclosure was removed,
and owner 3D cards now show a visibility badge that mirrors the API state.
The new browser scenario covers private → confirmation → public → private,
card state, and the anonymous unpublished boundary at both required viewport
sizes.

Focused backend tests (29), focused frontend publication/card tests (22),
frontend typecheck, and Playwright test discovery pass. `make check` reached
888 passed and 22 skipped but retains the same five unrelated macOS sandbox
failures in git socket binding and startup subprocess tests. The required
`BROWSER_QA_E2E_SPEC=e2e/project3dPublicationDiscoverability.spec.ts make
browser-qa` is blocked before setup because Docker is unavailable. #394
remains open pending browser screenshots and interaction evidence.

## 276. Explicit and clearable 2D layer selection — closure

Status: COMPLETE

GitHub issue: [#395](https://github.com/cfornesa/ai-dev-tools-zoomcamp-1/issues/395)

Engineering for this issue was already present, uncommitted, in the working
tree at session start. A same-target layer-row click now toggles the
selection off, `LayersPanel.tsx`'s layer-name field and visible/locked
checkboxes select without toggling (their own click handlers stay in
control), and `SelectionHud.tsx` gained an explicit "Clear selection" action
next to the collapse toggle for a layer selection. Four drifted e2e spec
files were reformatted with Prettier as a required-gate fix, unrelated to
this issue's own scope.

Focused frontend tests (89), typecheck, lint, and `make check` (893 backend
passed/22 skipped; 2412/2412 frontend passed — one `useDraftAutosave` timing
flake reproduced once in the full run and passed clean on immediate rerun,
confirmed pre-existing and unrelated) all passed. Commit `381a69f`.

Browser QA ran against a fixture project (5 layers, two non-empty) signed in
as the `e2e_owner` fixture user, using Claude in Chrome. All closure
checklist criteria passed: layer-row toggle-off, the new "Clear selection"
button, bidirectional layer/shape highlighting, and safe empty-layer
selection. GitHub comment
[5535193888](https://github.com/cfornesa/ai-dev-tools-zoomcamp-1/issues/395#issuecomment-5535193888)
records the full criterion matrix. #395 is closed as `completed`.

Environment note superseding the "Docker unavailable" blocker recorded
against #392/#393/#394 above: Docker is now running in this environment.
However, the long-lived Compose frontend container
(`ai-dev-tools-zoomcamp-1-frontend-1`) has no source volume mount and was
serving a stale pre-session image; `docker compose build frontend` failed on
a registry timeout pulling `node:22-bookworm-slim` in this sandbox. QA
instead used a local `npm run dev` with `BROWSER_QA_BACKEND_URL` pointed at
the same Compose backend/Postgres (`http://127.0.0.1:8001`), which is a
documented-equivalent local path per `AGENTS.md`. The stale container was
restored (not rebuilt) afterward. The next FIFO/independent candidates
(#392, #393, #394) should retry `make browser-qa` directly — if the
disposable stack it builds hits the same registry timeout, prefer this
`npm run dev` proxy path over reporting Docker itself as unavailable.

Correction after actually running it: `make browser-qa` (`scripts/browser-qa.sh`)
does not use Docker Compose or the long-lived containers at all — it starts
its own disposable Postgres container, Django, and Vite directly, and worked
without the registry-timeout issue described above (that issue was specific
to rebuilding the separate, long-lived `ai-dev-tools-zoomcamp-1-frontend-1`
Compose container). `make browser-qa` is therefore the correct path for
#393/#394's own required verification commands, not the `npm run dev` proxy
workaround.

## 277. Public gallery mixed-pieces closure

Status: COMPLETE

GitHub issue: [#392](https://github.com/cfornesa/ai-dev-tools-zoomcamp-1/issues/392)

`BROWSER_QA_E2E_SPEC=e2e/publicGalleryMixedPieces.spec.ts make browser-qa`
had never actually passed, independent of Docker availability: `publishFrom3D`
still drove the stage-local toolbar publish control #394's already-merged
`b590e0f` replaced with a header-level Draft/Published switch, and the spec's
hardcoded fixture titles collided across the suite's three sequential
Playwright browser projects (one shared disposable database per
`browser-qa.sh` run), producing a Playwright strict-mode ambiguous-match
failure once more than one browser project had run. Both were fixed in the
spec itself (commit `a44e701`): the 3D publish helper now targets the header
group directly, and fixture titles/gallery assertions are per-run-unique and
id-scoped.

`bash scripts/browser-qa.sh` (chromium/firefox/webkit) passed 3/3 at
1280x900 and 375x812; retained screenshots show correctly contained mixed
2D/3D cards, safe public fields, and the pagination end state. `make check`
passed (893 backend/22 skipped, 2412/2412 frontend). GitHub comment
[5535275453](https://github.com/cfornesa/ai-dev-tools-zoomcamp-1/issues/392#issuecomment-5535275453)
records the full criterion matrix. #392 is closed as `completed`.

A related but out-of-scope regression was found and left for #394 to fix
under its own transaction: `manual3dPublicationLifecycle.spec.ts`,
`manual3dStageChrome.spec.ts`, and `project3dLifecycle.spec.ts` still
reference the same removed stage-local `Publication status: Draft` toolbar
button for the manual 3D editor route that `publishFrom3D` above had to stop
using.

## 278. Recover renderable current-scene 3D project thumbnails — closure

Status: COMPLETE

GitHub issue: [#393](https://github.com/cfornesa/ai-dev-tools-zoomcamp-1/issues/393)

The issue's own "Exact verification" named
`BROWSER_QA_E2E_SPEC=e2e/project3dThumbnailCard.spec.ts make browser-qa`, but
that spec file had never been written — engineering (`85c39d4`, `41acbc5`)
landed with zero browser-level closure evidence, independent of Docker
availability. Added `frontend/e2e/project3dThumbnailCard.spec.ts` (commit
`a855dc7`): a sphere+plane scene must produce a real, correctly-sized
(320x240) thumbnail; a schema-valid but geometrically degenerate scene
(camera at its own target, reusing the exact input
`tests/test_thumbnails3d.py`'s `test_camera_at_its_own_target_raises_render_error_not_a_crash`
already exercises server-side) must show the explicit fallback with a
working, non-crashing retry; and a changed current version must regenerate a
non-stale thumbnail.

`bash scripts/browser-qa.sh` passed 6/6 (chromium/firefox/webkit ×2 tests)
at 1280x900 and 375x812. Focused backend (28) and frontend (12) tests and
`make check` (893 backend/22 skipped, 2412/2412 frontend) all passed. GitHub
comment
[5535357544](https://github.com/cfornesa/ai-dev-tools-zoomcamp-1/issues/393#issuecomment-5535357544)
records the full criterion matrix. #393 is closed as `completed`.

## 279. Make 3D publication state and controls visibly discoverable — closure

Status: COMPLETE

GitHub issue: [#394](https://github.com/cfornesa/ai-dev-tools-zoomcamp-1/issues/394)

#394's own required spec (`project3dPublicationDiscoverability.spec.ts`) had
two independent pre-existing bugs: an anonymous-view assertion for `not
available` that never matched the actual `isn't available` copy, and an
owner-card lookup via `.last()` that breaks once more than one 3D project
exists in the shared disposable database this suite's three sequential
browser projects populate. Both fixed directly in the spec.

The broader regression flagged in item 277/#392's closure was confirmed and
fixed here, as committed to: commit `b590e0f` moved the manual 3D editor's
Draft/Published disclosure from the stage-local toolbar popover into the
editor header, by design (removing the duplicate control this issue's own
closure checklist named as a defect), but left `manual3dPublicationLifecycle.spec.ts`
(#376), `manual3dStageChrome.spec.ts` (#341), and `project3dLifecycle.spec.ts`
(#239) still driving the removed toolbar control. All three were repaired —
the first rewritten to the header flow, the second trimmed of its now-invalid
publication-toggle assertions while keeping its still-valid authoring/sound
coverage, and the third's shared stage-chrome helper parameterized since the
AI-assisted editor (`/ai-projects3d/:id`) still renders `PublishControl3D
compact` and keeps the toolbar control while the manual editor does not. No
closed issue (#296, #376, #341, #239) was reopened; only their e2e coverage,
which had drifted from an intentional, already-landed UI change, was
repaired.

All four specs passed via `bash scripts/browser-qa.sh`
(chromium/firefox/webkit): #394's own spec (3/3), plus the three repaired
regression specs (3/3, 3/3, 12/12). Focused backend (29) and frontend (22)
tests and `make check` (893 backend/22 skipped, 2412/2412 frontend) passed.
GitHub comment
[5535474768](https://github.com/cfornesa/ai-dev-tools-zoomcamp-1/issues/394#issuecomment-5535474768)
records the full criterion matrix. #394 is closed as `completed`.

With #394 closed, the full owner-reported authored-piece parity audit batch
from item 273 (#392-#398) has five of seven issues closed. #396 (3D outline
selection parity with #395) and #397/#398 (2D/3D Preview panel layout
containment) remain open and independent.

## 280. Provide clearable 3D outline selection — implementation and closure

Status: COMPLETE

GitHub issue: [#396](https://github.com/cfornesa/ai-dev-tools-zoomcamp-1/issues/396)

No engineering existed for this issue yet; its own "Exact verification"
named `e2e/manual3dOutlineSelection.spec.ts`, which did not exist either.
Implemented in `Outline3DInspector.tsx`, mirroring #395's 2D layer-selection
contract: a row click (camera/group/object/light) now toggles the
same-target selection off instead of re-selecting it; the Inspector section
gained an explicit "Clear selection" action, visible whenever something is
selected; and a new effect clears the internal selection whenever it points
at a group/object/light no longer present in `scene` -- previously, deleting
the selected item left the Inspector panel broken (neither the deleted
item's own panel nor the "no selection" placeholder rendered, since the
component's local selection state was never derived from scene content).

`bash scripts/browser-qa.sh` passed 3/3 (chromium/firefox/webkit) at
1280x900 and 375x812. 5 new focused unit tests (25 total in the file) and
`make check` (893 backend/22 skipped, 2417/2417 frontend) passed. GitHub
comment
[5535581616](https://github.com/cfornesa/ai-dev-tools-zoomcamp-1/issues/396#issuecomment-5535581616)
records the full criterion matrix. #396 is closed as `completed`.

With #396 closed, item 273's audit batch has six of seven issues closed.
#397 and #398 (2D/3D Preview panel layout containment) remain open and
independent; #397 is next in FIFO order per item 273's stated ordering
rationale.

## 281. Contain the 2D editor canvas inside the Preview panel — closure

Status: COMPLETE

GitHub issue: [#397](https://github.com/cfornesa/ai-dev-tools-zoomcamp-1/issues/397)

Root cause: `.editor-scene-canvas` centered itself with `left/top: 50%` plus
matching negative pixel margins -- a technique that only resolves correctly
when the containing block has a *definite* height. Its immediate parent is a
plain wrapper div with `height: auto`, sized by its own content (this very
canvas) -- an indeterminate/circular case each browser resolves
inconsistently, producing the reported symptom exactly: the canvas rendering
with an arbitrary vertical offset, escaping its `.editor-scene-canvas-viewport`
box and covering the tabs/Preview heading/description above it. Reproduced
live via Claude in Chrome against a project already created earlier this
session for #395's QA, using `getBoundingClientRect()` comparisons to
pinpoint the exact offending style pair. Fixed by switching to flexbox
centering (`align-items`/`justify-content: center`) on the viewport
container, which has no percentage-resolution race.

The issue's own "Exact verification" named
`e2e/manual2dCanvasContainment.spec.ts`, which did not exist; added it
(commit `3a2eef3`). `bash scripts/browser-qa.sh` passed 3/3 twice in a row
(chromium/firefox/webkit) at 1280x900 and 375x812. Focused
`EditorWorkspace` tests (38) and `make check` (893 backend/22 skipped,
2417/2417 frontend) passed. GitHub comment
[5535799186](https://github.com/cfornesa/ai-dev-tools-zoomcamp-1/issues/397#issuecomment-5535799186)
records the full criterion matrix. #397 is closed as `completed`.

With #397 closed, item 273's audit batch has all but #398 closed. #398 (3D
Preview/outline/inspector/editor layout containment) is the last remaining
open issue.

## 282. Restore 3D editor layout parity — closure (batch complete)

Status: COMPLETE

GitHub issue: [#398](https://github.com/cfornesa/ai-dev-tools-zoomcamp-1/issues/398)

No engineering defect was found. The 3D editor's canvas frame
(`.scene3d-preview-canvas-frame`) is sized with `aspect-ratio: 16/9;
width: 100%; height: auto`, not the percentage `left/top: 50%` plus
negative-margin centering trick item 281/#397 found and fixed as the actual
root cause on the 2D side -- so it was never exposed to that class of bug.
Live inspection via Claude in Chrome at desktop width, and the issue's own
missing required spec (`e2e/manual3dLayoutParity.spec.ts`, added in commit
`219ae89`) exercising both required viewports, confirmed the
Preview/outline/inspector regions stay consistently non-overlapping with no
page-level horizontal overflow, the clearable outline selection (#396) and
publication disclosure (#394) both work, and the editor's lack of a 2D-style
Code view is documented as an intentional 3D-only difference rather than a
gap.

`bash scripts/browser-qa.sh` passed 3/3 twice in a row (chromium/firefox/
webkit) at 1280x900 and 375x812. Focused `Project3DWorkspace`/
`Outline3DInspector` tests (30) and `make check` (893 backend/22 skipped,
2417/2417 frontend) passed. GitHub comment
[5535855414](https://github.com/cfornesa/ai-dev-tools-zoomcamp-1/issues/398#issuecomment-5535855414)
records the full criterion matrix. #398 is closed as `completed`.

**Batch complete.** All seven issues from item 273's owner-reported
authored-piece parity audit (#392-#398) are now closed as `completed`:
#392 (public gallery mixed-pieces listing), #393 (3D thumbnail recovery),
#394 (3D publication discoverability, plus its downstream e2e regression
fixes), #395 (2D clearable layer selection), #396 (3D clearable outline
selection, newly implemented), #397 (2D canvas containment fix), and #398
(3D layout parity verification). No closed issue was reopened or rewritten;
each transaction's evidence, commits, and GitHub comment stand as its own
immutable record.

## 283. Reconcile every local backlog record to a groomed GitHub issue — closure

Status: COMPLETE

The 2026-09-04 backlog session audited all 21 `.local/tasks/` records against
this canonical ledger, repository history, and the complete GitHub issue set.
Four genuinely unmapped implementation specifications were converted into
criterion-ready issues #400–#403 and processed to closure:

- [#400](https://github.com/cfornesa/ai-dev-tools-zoomcamp-1/issues/400)
  — auth shell, branded account pages, and signup reCAPTCHA.
- [#401](https://github.com/cfornesa/ai-dev-tools-zoomcamp-1/issues/401)
  — environment-driven Google OAuth CSRF trusted origins.
- [#402](https://github.com/cfornesa/ai-dev-tools-zoomcamp-1/issues/402)
  — safe defaults for omitted AI-created 3D primitive dimensions.
- [#403](https://github.com/cfornesa/ai-dev-tools-zoomcamp-1/issues/403)
  — encrypted owner-scoped Mistral credentials.

Existing issue ownership was reused for all other actionable records; no closed
issue was reopened and no duplicate issue was created. The local
`reset-main-to-origin.md` record is terminal operational recovery, not current
product work. The complete manifest, duplicate report, dependency order,
criterion matrices, verification results, and the Docker verification boundary
are recorded in
`.local/tasks/backlog-session-2026-09-04.md`.

`make check` passed with 944 backend tests (22 skipped) and 2,417 frontend
tests. Direct local Playwright auth checks passed 5/5 at 375×812, and the
credential build scan passed 3/3. GitHub has no open issues; `main` and
`origin/main` are synchronized and the worktree is clean.

## 284. Distill additional end-user AI providers — open

Status: DISTILLED; #404 is the next issue.

The 2026-09-04 investigation confirmed that the application currently has a
Mistral-only hosted scene provider, encrypted Mistral-only credentials, and
Mistral-only model preferences. Existing Google OAuth is login support, not
Gemini model access. Mistral Vibe is already documented as developer tooling
and is non-actionable for this end-user provider request.

Five criterion-ready issues were created in dependency order:

- [#404](https://github.com/cfornesa/ai-dev-tools-zoomcamp-1/issues/404) —
  generalize provider selection and encrypted owner credentials.
- [#405](https://github.com/cfornesa/ai-dev-tools-zoomcamp-1/issues/405) —
  add the Google Gemini scene provider; depends on #404.
- [#406](https://github.com/cfornesa/ai-dev-tools-zoomcamp-1/issues/406) —
  add the DeepSeek scene provider; depends on #404.
- [#407](https://github.com/cfornesa/ai-dev-tools-zoomcamp-1/issues/407) —
  add multi-vendor account settings and model selection; depends on #404–#406.
- [#408](https://github.com/cfornesa/ai-dev-tools-zoomcamp-1/issues/408) —
  add the cross-vendor API/browser regression matrix; depends on #405–#407.

The complete issue manifest, duplicate report, blocker triage, verification
boundary, and next-issue handoff are recorded in
`.local/tasks/vendor-support-distillation-2026-09-04.md`. Durable architecture
guidance is recorded in
`.agents/memory/multi-vendor-ai-provider-credentials.md`.

## 285. Distill editable draw.io layers and cross-surface support — open

Status: DISTILLED; #409 is the next issue.

The 2026-09-04 investigation confirmed that the application has a complete
native layer system, but no draw.io/diagrams.net/mxGraph document model,
dependency, editor adapter, object-level eraser, draw.io export, or draw.io
viewer runtime. Native layer issues remain already-covered references and were
not reopened.

Five closure-sized issues were created:

- [#409](https://github.com/cfornesa/ai-dev-tools-zoomcamp-1/issues/409) —
  define and persist a safe versioned draw.io document layer.
- [#410](https://github.com/cfornesa/ai-dev-tools-zoomcamp-1/issues/410) —
  add draw.io editor tools and individual object interaction.
- [#411](https://github.com/cfornesa/ai-dev-tools-zoomcamp-1/issues/411) —
  connect draw.io layers to outer layer controls.
- [#412](https://github.com/cfornesa/ai-dev-tools-zoomcamp-1/issues/412) —
  render and package draw.io layers across public and download surfaces.
- [#413](https://github.com/cfornesa/ai-dev-tools-zoomcamp-1/issues/413) —
  close compatibility, accessibility, and regression coverage.

The complete manifest, duplicate report, blocker triage, dependency rationale,
and verification boundaries are recorded in
`.local/tasks/drawio-layer-distillation-2026-09-04.md`. The durable rule is
recorded in `.agents/memory/drawio-layer-integration.md`.

## 286. Explore additional project-goal gaps — open

Status: DISTILLED; #414 is the next issue in this new gap queue.

The 2026-09-04 exploratory audit found three actionable gaps beyond the
existing multi-vendor (#404–#408) and draw.io (#409–#413) queues:

- [#414](https://github.com/cfornesa/ai-dev-tools-zoomcamp-1/issues/414) —
  use shared production storage for AI quotas and rate limits.
- [#415](https://github.com/cfornesa/ai-dev-tools-zoomcamp-1/issues/415) —
  run a supported production WSGI or ASGI server instead of Django
  `runserver`.
- [#416](https://github.com/cfornesa/ai-dev-tools-zoomcamp-1/issues/416) —
  choose and enforce an explicit signup authentication policy.

## Current backlog-session status — 2026-09-04

The authenticated backlog-session reconciliation discovered all 13 issues
#404–#416 open on GitHub and processed them in dependency order. #404 and #409
are `BLOCKED` on missing implementations; #405–#408 and #410–#413 are
`DEPENDENCY-BLOCKED` on those foundations; #414 is blocked on the shared
production-state infrastructure choice; #415 is blocked on the production
WSGI/ASGI and signal-contract choice; and #416 is blocked on the owner’s
signup-policy decision. Required QA comments were posted to every issue.
See `.local/tasks/backlog-session-2026-09-04.md` for the complete manifest,
transaction ledger, commands, evidence boundaries, and next actions.

Existing project creation, AI recovery, native 2D/3D, publishing, export,
authentication, responsive, provider, and draw.io contracts were classified
as already covered or separately queued. Deployed parity, real-camera
behavior, live-provider calls, and an unproven transitive advisory were
classified as verification or maintenance boundaries rather than new product
issues.

The complete manifest, duplicate report, blocker triage, dependency rationale,
and evidence boundaries are recorded in
`.local/tasks/gap-audit-2026-09-04.md`. Durable operational guidance is
recorded in `.agents/memory/production-readiness-gaps.md`.

## Implementation continuation — 2026-09-05

The earlier audit wording above is historical and is superseded by the active
implementation transaction. Provider selection now has live Gemini and
DeepSeek adapters, owner-scoped encrypted credentials, provider-specific model
validation, 2D/3D routing, and actionable missing-key responses. The settings
and AI proposal panels expose the three providers and use the matching model
catalog. Deterministic routing/isolation coverage was added in
`backend/tests/test_ai_provider_matrix.py`.

Focused verification: 34 backend provider/matrix/3D tests passed, 58 frontend
provider-hook/panel tests passed, frontend typecheck and format checks passed,
and backend Ruff passed. Cross-vendor matrix issue #408 remains open until
all create/edit failure modes and browser evidence are covered.

The draw.io foundation now also has a dedicated, schema-bounded Canvas2D
adapter selected by `documentType: "drawio"`. It renders only the approved
rect/ellipse/line/text object types and visible layers; unsupported XML-like
content is not interpreted. The standalone HTML export path explicitly
reports draw.io as unavailable until issue #412's packaging contract exists.
Focused draw.io renderer tests and frontend typecheck/format/lint checks pass.
