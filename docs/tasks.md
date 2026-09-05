Warning: truncated output (original token count: 256379)
Total output lines: 15684

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
- #100 `test_google_oauth.py`: 3 tests fail with `DisallowedHost` (400) instead of expected response; creatweb/creatrweb domain typo — Status: COMPLETE. Fixed the `creatweb`→`creatrweb` typo across `AGENTS.md`, `backend/backend/settings.py`'s error message, and `tests/test_env_config.py`/`tests/test_google_oauth.py`'s fixtures/assertions, and added the missing `ALLOWED_HOSTS` overrides the three origin tests needed. `make check` is green, the published routing smoke check passes, and the project owner confirmed a real Google OAuth sign-in round trip through the deployed `https://animate.creatrweb.com` app. Delivered on [PR #102](https://github.com/cfornesa/ai-dev-tools-zoomcamp-1/pull/102).
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
ALLOWED_HOSTS values. If those values reach the …206379 tokens truncated… otherwise use the next
independent criterion-ready open task.

### Reopened Chrome route revalidation — 2026-09-03

The reopened authenticated Chrome session now reaches the supplied owner route
and shows the current compact stage disclosure. Opening the menu exposed
Screenshot, Download, Immersive, Sound, Piece controls, Steer, Guide, editor
actions, Publication status: Draft, and Fullscreen. Opening the publication
control exposed the Draft (Private) explanation and Draft/Published choices.
At 375x812, the rendered menu and publication drawer fit the viewport without
horizontal overflow; a clean screenshot after moving the pointer away showed
no clipped required controls. The live asset observed was
`assets/index-CecM7AFX.js`.

The Chrome window could not establish the required 1280x900 viewport: its
maximum observed viewport was 962x865, even after requesting 1280x900. Because
#355 explicitly requires both fixed viewports and exact deployed revision
reconciliation, this is a verification-boundary result, not closure evidence.
The issue remains open with the next action to rerun the same matrix in a
browser session that can provide 1280x900 and then reconcile the deployed
revision. No issue was reopened and no product source/tests were changed.

The active queue position after this verification-boundary transaction is
#355, followed by the independent anonymous/fixture transaction #356. The
earlier #368 handoff text above is historical and must not be treated as the
current queue position; #368 is closed and immutable.

The 1280x900 route recheck is now possible through supported Chrome viewport
emulation, but #355 still fails its functional publication criterion: selecting
Published opens the confirmation, while the enabled final Publish action leaves
the dialog open and the status at Draft. The fixture was left Draft. This is
deployed-route evidence owned by #355, not a reason to reopen any closed issue
or create a duplicate; the next action is to diagnose the published action
against the deployed revision and rerun Draft -> Published -> Draft.

### #355 transaction reconciliation — 2026-09-03

- Replit synchronized and published commit `c4aae1c`; the exact owner route
  served `assets/index-I1VsT0b2.js`.
- At emulated 1280x900 and 375x812 viewports, the owner route loaded the saved
  scene and its compact stacked stage disclosure. Required controls were
  reachable without horizontal overflow or clipped menu rows.
- The deployed Draft -> Published -> Draft round trip passed. The fixture was
  restored to Draft after verification.
- The earlier live failure was caused by the publication confirmation being in
  normal flow below the command card; #373 corrected that local capability and
  was separately tested and closed. No closed issue was reopened.
- #355's deployed verification criteria are complete; the exact public,
  anonymous fixture, immersive, embed, and artifact boundaries remain separate
  open issues.

### Distilled follow-up #373 — compact publication confirmation reachability

The live owner-route check exposed a new, independently observable gap: the
compact publication panel is in normal flow below the stacked command menu, so
the final Publish control begins below the 1280x900 viewport (observed y≈1030)
and the confirmation cannot complete from the visible overlay. This is not a
reason to reopen #347 or any other closed issue, and it is not duplicate route
verification work. It is captured as [#373](https://github.com/cfornesa/ai-dev-tools-zoomcamp-1/issues/373)
with a fixed local component/fixture boundary. #373 is now the next
closure-sized engineering transaction; #355 remains open for deployed
revision reconciliation.

### #373 transaction reconciliation — 2026-09-03

- Engineering changed only the shared publication-panel CSS and its focused
  regression/route coverage. The compact publication panel now uses its
  trigger as the positioning context and opens upward.
- Focused: `npm test -- --run src/pages/PublishControl3D.test.tsx
  src/components/StageControlsPopover.test.tsx` — 12/12 passed.
- Full frontend: `make frontend-check` — lint (existing warnings only), format,
  typecheck, and 191 files/2,404 tests passed.
- Browser QA: `BROWSER_QA_E2E_SPEC=e2e/manual3dStageChrome.spec.ts make
  browser-qa` — 3/3 passed across Chromium, Firefox, and WebKit. The scenario
  exercises Draft/Published disclosure and asserts the confirmation remains
  inside the 1280x900 route viewport.
- Shifted boundary: exact deployed revision verification remains #355; no
  closed issue was reopened.

## #339 transaction reconciliation — 2026-09-03

#339's local AI 3D stage-local publication implementation passed 55/55 focused
tests and 3/3 browser engines (Chromium, Firefox, WebKit) through
`BROWSER_QA_E2E_SPEC=e2e/ai3dStageChrome.spec.ts make browser-qa`. The local
Draft/Published disclosure and responsive stage toolbar are verified; exact
deployed verification remains #328. #339 is permanently closed. No closed
issue was reopened.

## #372 transaction reconciliation — 2026-09-03

Testing #341 exposed a new atomic defect: asynchronous sound activation could
race the Piece controls disclosure reset and leave the reopened panel hidden,
especially in Firefox. #372 owns that follow-up. Engineering now resets the
disclosure synchronously when sound toggling begins, so the later
`soundEnabled` commit cannot hide a freshly reopened panel.

- Focused Scene3DPreview/controls tests: 37/37 passed.
- `BROWSER_QA_E2E_SPEC=e2e/manual3dStageChrome.spec.ts make browser-qa`:
  3/3 passed across Chromium, Firefox, and WebKit.
- #372 is complete and must be permanently closed. No closed issue was
  reopened or modified.

## Canonical override: owner-reported parity re-audit — 2026-09-03

Use the later re-audit record above as the current state. The historical
“next issue is #368” text immediately preceding this note is retained for
traceability and is not the current handoff. Current handoff is #355, with
#356 independently ready once its intended non-empty fixture is published.
Closed issues remain immutable; PHP remains reference-only; no product source
or tests were changed during this distillation pass.

## Current owner-reported parity re-audit — 2026-09-03 (canonical)

This is the current distillation record; earlier “next issue” notes remain
history. Full parity means only the `augment-humankind` pieces
implementation/examples, translated into this repository's Django/Python
backend and React/TypeScript frontend. PHP is reference-only.

Closed issues are immutable. No issue was reopened in this audit, and none may
be reopened without explicit owner authorization naming that exact issue in
the current conversation. Distillation/grooming may be bulk; engineering and
QA are one issue at a time, followed by reconciliation and permanent closure.
New gaps are new linked issues, never additions to closed work.

| Boundary | Finding | Owner |
| --- | --- | --- |
| Authenticated manual 3D editor | Anonymous route is access-denied; owner controls and Draft/Published behavior remain unverified. | #355, open |
| Anonymous public 2D piece | Route is anonymous but renders `Blank canvas`; at 375x812 the opened menu has oversized rows, detached labels, and a detached download tooltip. | #356, open |
| Public 3D geometry | Route-specific geometry verification. | #360, open |
| Remaining routes | AI 3D: #328/#339; public/embed/immersive: #330–#335. | Existing open issues |
| Physical held-pinch evidence | Synthetic proof remains unavailable. | #344, independent blocker |
| Reconciliation | Parent containers, not implementation units. | #274/#320/#324 |
| Download artifacts | #350/#351/#368/#370/#371 are closed; deployed consumers remain owned by route verification. | Closed, immutable |

The exact live routes serve `assets/index-CecM7AFX.js`, not reviewed checkout
`a66c8965f4805e67c6aa1c78423df6c65bf6bab3`. Local React source and artifact
tests therefore cannot close deployed-route evidence. No duplicate issue is
needed: #355 owns the private boundary, #356 the public fixture/control
boundary, and #360 public 3D geometry. Closed #347–#371, including #359,
#368, #370, and #371, remain permanently closed.

Handoff: #355 is next groomed but blocked by the absent owner-authenticated
session and stale published asset. Exact unblock: authenticate the owner
session, republish the reviewed revision, then capture 1280x900 and 375x812
screenshots plus asset identity. #356 is independently groomed but needs the
intended non-empty fixture published. No product source or tests were changed
during this distillation pass.

## #370 transaction reconciliation — 2026-09-03

- Full 3D downloads now provide explicit steering lifecycle, failure recovery,
  cleanup, and a camera-free Non-Camera variant. The opened command drawer is
  bounded with scrolling confined to the drawer on short viewports.
- QA passed: browser artifact QA 57/57 across Chromium, Firefox, and WebKit;
  `make frontend-check` passed 191 files and 2,402 tests, with existing lint
  warnings only.
- Reconciliation found no new in-scope gap. #371 owns camera-view composition;
  #355/#356 own deployed-route verification. No closed issue was reopened.
- #370 is complete and must be permanently closed before #371 begins.

## #371 transaction reconciliation — 2026-09-03

- Full 3D downloads now provide independent Camera view, Camera opacity, and
  Mirror camera controls, with safe defaults and local-only presentation
  updates. Stopping steering removes the stale preview; Non-Camera omits all
  camera-view controls and camera paths.
- QA passed: browser artifact QA 57/57 across Chromium, Firefox, and WebKit;
  `make frontend-check` passed 191 files and 2,402 tests, with existing lint
  warnings only.
- Reconciliation found no new in-scope gap. #355/#356 own deployed-route
  verification. No closed issue was reopened.
- #371 is complete and must be permanently closed; future gaps are new linked
  issues, never reopenings.

### Current owner-report reconciliation — 2026-09-03

Fresh exact-route inspection found the public URL genuinely anonymous and its
hamburger functional, but rendered inspection still fails visual parity: the
opened action labels are detached from the oversized button rows. The private
editor URL is unavailable without the owner-authenticated browser session, so
editor parity and Draft/Published reversal remain unproven. Both routes serve
`assets/index-CecM7AFX.js`, not reviewed checkout `98b5301`.

These are existing deployment/fixture boundaries: #355 owns authenticated
manual-editor verification and #356 owns anonymous public fixture/control
verification. No duplicate deployment issue is needed, and no closed issue
was reopened. The next independent local engineering transaction is #370,
then #371; #369 is closed as the superseded distillation umbrella.

### #369 atomicity reconciliation — 2026-09-03

#369 was found to combine two independently testable Full-download behaviors
before engineering began. It was closed as superseded, not reopened or
partially implemented. The closure-sized replacements are #370 (opt-in
steering lifecycle and cleanup) and #371 (camera-view visibility, opacity, and
mirror composition). FIFO engineering begins with #370; each issue must finish
engineering, QA, reconciliation, and permanent closure before the next begins.

### #368 transaction reconciliation — 2026-09-03

- Engineering completed the immersive export option through
  `ImmersiveProject3DViewer`, the 3D ZIP generator, and the standalone runtime.
  Immersive artifacts carry explicit surface metadata and README guidance;
  regular artifacts remain explicitly marked regular.
- QA passed: `BROWSER_QA_E2E_SPEC=e2e/exportArtifacts.spec.ts make browser-qa`
  (57 scenarios across Chromium, Firefox, and WebKit), followed by
  `make frontend-check` (191 files, 2,402 tests; existing lint warnings only).
- Reconciliation found no new in-scope gap. Extracted Full-artifact camera
  steering remains #369. Stale published-bundle verification remains #355/#356.
- #368 is ready for permanent completion closure. Do not reopen it for #369,
  deployment publication, or any later parity work.

## Current canonical pieces-parity distillation — 2026-09-03 (superseded by the owner re-audit below)

This section supersedes earlier historical notes that describe issues as
reopened. Closed issues are immutable under the current owner rule: no issue
may be reopened unless the owner explicitly authorizes reopening that exact
issue in the current conversation. The current audit made no reopen request
and performed no reopening. Any later gap is a new linked issue.

Full CMS parity here means only the `augment-humankind` pieces
implementation/examples, translated into this repository's Django/Python
backend and React/TypeScript frontend. PHP and unrelated CMS features are
out of scope.

The complete manifest, duplicate report, blocker triage, and handoff are in
`.local/tasks/authored-piece-parity-distillation-2026-09-03.md`.

Fresh exact-route browser evidence found both supplied routes serving the
legacy `assets/index-CecM7AFX.js`. The authenticated editor route exposed a
hamburger and legacy opened controls with detached/missing visible labels;
the public route was authenticated and rendered the `Blank canvas` 2D
fixture. This does not prove anonymous privacy or the intended 3D fixture.
Existing #355 and #356 own those deployment/fixture boundaries. No closed
issue was reopened.

The audit identified two distinct criterion-ready local artifact gaps and
created new issues [#368](https://github.com/cfornesa/ai-dev-tools-zoomcamp-1/issues/368)
and [#369](https://github.com/cfornesa/ai-dev-tools-zoomcamp-1/issues/369).
#368 owns immersive navigation in downloaded 3D artifacts. #369 owns the
Full artifact's missing user-facing camera steering/camera-view contract and
the corresponding Non-Camera omission. Closed #364 remains closed.

Historical handoff was #368. Engineering and QA were required as one issue
transaction before #369 or any other issue began.

## Current owner-reported parity distillation — latest 2026-09-03

This latest audit supersedes the historical text above. Full CMS parity is
limited to the augment-humankind pieces implementation/examples, translated
into this repository's Django/Python backend and React/TypeScript frontend;
PHP and unrelated CMS features remain reference-only and out of scope.

The owner reports missing or unusable editor controls, bulky controls outside
the canvas, no understandable Draft/Published workflow, and absent public
controls. Exact deployed inspection found stage entry points in the current
bundle, but prior closures relied on DOM/source/local evidence that did not
establish consistent rendered parity. No closed issue was reopened.

New corrective issues, each with a single route/workflow contract:

- #376: deployed manual 3D Draft/Published lifecycle.
- #377: deployed manual 3D canvas-associated controls and layout.
- #378: deployed anonymous public 2D control discoverability.

#331 has local embed fix commit `6d1e38e`, but published QA still showed the
pre-fix metadata/Preview shell, so it remains deployment-blocked. #360 remains
blocked on the intended public 3D fixture; #344 remains blocked by physical
held-pinch evidence. Existing AI, public 3D, embed, immersive, and downloaded
route issues remain separate transactions.

Closed #347–#375 remain immutable. Any later failure or broader parity gap is
a new linked criterion-ready issue, never a reopening. The next handoff is
exactly #377 after grooming; engineering, QA, reconciliation, and closure
must finish for it before #376 or #378 engineering begins.
## Post-#378 queue distillation — 2026-09-03

Fresh GitHub/backlog reconciliation after permanently closing #378 leaves
parent containers #274, #320, and #324 outside the FIFO engineering queue.
#331 is the next oldest closure-sized route transaction, but its exact
deployed anonymous embed route still shows the public metadata banner and
`Preview` heading; the local fix is already in `6d1e38e`, making this a
deployment synchronization blocker rather than a reason to reopen or broaden
the issue. #344 remains blocked on physical held-pinch evidence and #360 on
the intended published 3D fixture. The next independent groomed candidate is
#328 (AI-assisted 3D owner editor route), to be handled through engineering,
QA, reconciliation, and permanent closure as one transaction.
## #328 closure and next-queue distillation — 2026-09-03

#328 is permanently closed as `completed` for the authenticated AI-assisted
3D owner route. Deployed asset `assets/index-CQvhOwx-.js` exposed the scoped
shared stage controls, AI action, opt-in camera controls, and Draft/Published
status. `BROWSER_QA_E2E_SPEC=e2e/ai3dStageChrome.spec.ts make browser-qa`
passed 3/3 in Chromium, Firefox, and WebKit against disposable
PostgreSQL/Django/Vite services; existing focused AI/editor checks were
already reconciled. The historical re-audit text was not treated as a reopen.

Fresh queue distillation leaves #331 deployment-blocked on its stale exact
embed route; #330 is the next independent closure-sized candidate for
anonymous public 3D route parity. #360 remains its distinct sphere-proportion
child and #344 remains blocked on physical held-pinch evidence. The next
transaction is groom #330, then engineering and QA together, reconciliation,
and permanent closure before advancing.
## Owner re-audit distillation follow-up — 2026-09-03

The owner reports that the compact controls are absent, the editor still has
the legacy bulky functional row, and publication cannot be toggled. Fresh
connected-browser screenshots of the current deployed bundle
`assets/index-CQvhOwx-.js` instead show the authenticated editor's hamburger
inside the canvas and the anonymous public route's hamburger plus a stacked
Screenshot/Download/Piece controls/Fullscreen overlay when opened. This is a
real unresolved revision/cache/session discrepancy, not evidence that any
closed issue should be reopened.

New issue #379, “Pieces parity: reconcile owner-visible deployment with compact
stage controls,” captures the exact editor and public URLs, fixed viewports,
asset identity, rendered screenshot requirements, publication workflow, and
the no-reopen boundary. It is the next groomed transaction. No product code
will be changed until the failing owner-visible revision or reproducible
implementation defect is identified.
## #379 current rendered comparison — 2026-09-04

Fresh exact-route inspection against deployed `assets/index-CQvhOwx-.js`
shows the authenticated editor's 44x44 hamburger inside the Preview canvas,
without a functional row outside the canvas; opening it reveals named actions
and `Publication status: Draft`. A fresh anonymous public route shows the
stage-local hamburger; opening it reveals Screenshot, Download, Piece
controls, and Fullscreen in the translucent stacked overlay, without
owner-only controls.

The owner-visible contradiction remains unresolved and is tracked by open
#379 as a verification-boundary/deployment-session reconciliation task. No
closed issue was reopened and no product source change was made from this
comparison alone.
## #379 deployment blocker escalation — 2026-09-03

Authenticated Replit inspection reproduced the deployment cause: its Git panel
reports `MERGE_CONFLICT`, an unexpected merge conflict, failed remote
authentication, 16 incoming/1 outgoing changes, and incomplete Pull. The
published `index-CQvhOwx-.js` differs from a fresh local build's hashed chunk
graph. This is a workflow/infrastructure defect, not product parity evidence
and not permission to reopen closed issues.

New criterion-ready [#380](https://github.com/cfornesa/ai-dev-tools-zoomcamp-1/issues/380)
owns Replit remote authentication, branch reconciliation, and intentional
republishing. #379 remains open and dependency-blocked on #380.
## #380/#379 final deployment reconciliation — 2026-09-03

Replit Git synchronization was repaired and `main` reconciled to
`origin/main` at `cfd16d1`. The reviewed revision was republished; the custom
domain now serves `assets/index-xwmMEBBo.js`, byte-identical to the fresh local
build. Exact editor verification confirmed the stage-local controls and
Draft/Published panel, including a live Published → Draft restoration. Exact
anonymous public verification confirmed the hamburger and permitted
Screenshot, Download, Piece controls, and Fullscreen overlay. Fixed-viewport
QA for the same build covered 1280x900 and 375x812. #380 (workflow) and #379
(owner-visible reconciliation) are permanently closed as `completed`. No
closed issue was reopened; later gaps require new linked criterion-ready
issues.

## #330 final closure and post-blocker distillation — 2026-09-03

#330 is permanently closed as `completed` for its scoped anonymous public
3D `/p3d/:id` route contract. The exact owner fixture was temporarily
published, verified anonymously against `assets/index-xwmMEBBo.js` (byte-
identical to the local build), and restored to Draft. The public route
rendered the authored artwork and exposed the privacy boundary, hamburger
overlay, Screenshot, Download with Full/Non-Camera ZIP, Immersive, Sound,
Piece controls, Steer, Guide, and Fullscreen. The local browser-QA attempt
was blocked only because Docker was unavailable; this does not reopen or
leave #330 open. Post-blocker distillation found no new product defect.

The next FIFO candidate is #331, bounded to the anonymous embed route and
deployment synchronization of local fix `6d1e38e`. #344 remains evidence-
blocked on physical held-pinch behavior and #360 remains the separate
sphere-proportion route task. Closed issues remain immutable.

## #331 final closure and next-queue distillation — 2026-09-03

#331 is permanently closed as `completed` for the anonymous chrome-less
2D `/embed/p/:id` route. Fresh deployed inspection confirmed only the
Preview/Scene canvas and Piece actions toolbar, the permitted Live camera and
Demo signal disclosures, and Full/Non-Camera download variants; no site shell,
owner controls, or sibling demo panel appeared. The local browser-QA retry was
Docker-blocked, while the issue retains its prior 1/1 pass and exact deployed
evidence. Post-closure distillation leaves #332 as the next FIFO task. No
closed issue may be reopened; later contradictions require new linked issues.

## #332 final closure and next-queue distillation — 2026-09-03

#332 is permanently closed as `completed` for the anonymous chrome-less 3D
`/embed/p3d/:id` route. Fresh deployed verification after temporary fixture
publication showed only the expected title/author/embed link and Preview
stage, with no site shell or owner controls; the hamburger exposed Screenshot,
Download, Immersive, Sound, Piece controls, Steer, Guide, and Fullscreen. The
fixture was restored to Draft. Local browser-QA remained Docker-blocked, while
the issue retains its prior 1/1 pass. The next FIFO task is #333; closed
issues remain immutable.

## #381 blocked transaction and fresh distillation — 2026-09-03

#381 was processed as one route transaction. Current authenticated evidence
at 962×921 shows the stage-local hamburger, stacked named controls, 3D
authoring disclosure, and a successful Draft → Published → Draft round trip.
It remains open because the required fixed 1280×900 and 375×812 rendered
evidence was unavailable, and `BROWSER_QA_E2E_SPEC=e2e/manual3dStageChrome.spec.ts
make browser-qa` failed before startup with Docker unavailable.

Blocker classification is `verification-boundary` plus
`workflow/infrastructure-defect`; no product defect was reproduced. Fresh
distillation rechecked duplicates and dependencies: no closed issue is being
reopened, and #381 owns this exact owner route. The independent next FIFO
candidate is #382, the anonymous public 2D route; #381 remains queued for its
documented fixed-viewport/browser-harness retry.

## Fresh owner contradiction distillation — 2026-09-03

The owner reports that the exact manual 3D editor still has the legacy bulky
functional row, that Draft/Published switching is unavailable, and that the
public 2D piece has no controls. This is actionable evidence, but it does not
authorize reopening #347–#359 or any other closed issue.

Current source audit found `PieceStageToolbar` mounted in the manual 3D,
public 2D, regular embed, 3D embed, and immersive consumers. Current exact
deployed inspection found the manual 3D hamburger and opened overlay with
named actions plus `Publication status: Draft`, and the public 2D hamburger
and opened overlay with Screenshot, Download, Piece controls, and Fullscreen.
Therefore the discrepancy is classified as `verification-boundary` pending
revision/asset, cache/session, viewport, or reproducible implementation
reconciliation—not as permission to claim parity or to erase the owner's
report.

Duplicate/coverage report: the underlying implementation slices are already
covered by permanently closed #347/#348 and their route children #352/#353/
#354/#355/#356/#358/#359; #330–#332 cover different public/embed surfaces and
are also permanently closed. No existing open issue owns this fresh
owner-visible contradiction at the exact two reported boundaries. Two new
criterion-ready issues were created: #381 for authenticated manual 3D editor
state and #382 for anonymous public 2D stage controls. Each has one route,
fixed viewports, finite rendered criteria, exact evidence boundaries, and a
no-reopen rule.

The next handoff is #381 only. Engineering must not begin until its rendered
revision/session discrepancy is groomed; #382 follows as its own transaction.
The report also confirms that broad parent #320 remains a reconciliation
container, not an implementation unit. The root `examples/` directory is not
present in this checkout; the maintained behavioral reference is
`../augment-humankind/docs/piece-surface-parity.md` and its source helpers.

## #382 blocked transaction and fresh distillation — 2026-09-03

#382 was processed as one anonymous public 2D route transaction. Current
deployed evidence shows the closed in-canvas hamburger and opened translucent
overlay with Screenshot, Download, Piece controls, and Fullscreen; nested
camera/demo controls and Full/Non-Camera downloads are present, with no owner
or legacy sibling panel. It remains open because fixed 1280×900 and 375×812
rendered evidence could not be produced, and the focused browser command
failed before startup with Docker unavailable.

Blocker classification is `verification-boundary` plus
`workflow/infrastructure-defect`; no product defect was reproduced. Fresh
distillation confirms #382 is not a duplicate of closed #353/#356 and must
not reopen them. #381 and #382 remain the two new route-specific owner-report
reconciliations; #381 is the next retry candidate once the fixed-viewport
harness exists, while the broader queue proceeds only with independent work.

## #333 blocked transaction and fresh distillation — 2026-09-03

#333 was processed as one regular immersive 3D route transaction. Current
deployed evidence shows the authored stage, immersive instructions, Custom/
CMS entry points, touch d-pad, stage hamburger, Screenshot, Download, Sound,
Piece controls, Steer, Guide, Fullscreen, and five-step guide; no load-time
camera prompt occurred, and the fixture was restored to Draft. It remains
open because fixed 1280×900/375×812 proof and the focused browser command
were blocked before startup by unavailable Docker.

Classification is `verification-boundary` plus `workflow/infrastructure-defect`;
no product defect was reproduced. Fresh distillation confirms #333 is
independent of closed route issues and remains the sole next retry once the
harness is available; no closed issue was reopened.

## Replit revision identity recheck — 2026-09-03

The authenticated Replit workspace reports its reconciled `main` at
`cfd16d1`, while local/GitHub `main` is `d27e291`. A direct source diff for
`frontend`, `backend`, `schema`, `.replit`, and `scripts` is empty between
those revisions; the divergence contains only documentation/memory/task
records. The published site loads `assets/index-xwmMEBBo.js`, and exact
editor/public route inspection renders the requested hamburger/overlay flow.
This explains deployment-history noise but does not dismiss the owner's
contradictory visible report. Keep #381/#382 open for fixed-viewport/session
reconciliation; do not create a duplicate product implementation issue or
reopen closed issues.

## Additional 2D editor audit — 2026-09-03

The authenticated existing 2D editor was inspected separately from #381's
manual 3D boundary. Its Preview contains the in-canvas hamburger and no
page-level duplicate functional rail. The opened overlay contains Screenshot,
Download, Piece controls, Edit scene, Fullscreen, and a visible Publication
status: Published disclosure with Draft available. This is covered behavior,
not a new implementation defect or a reason to reopen closed #354/#356;
fixed-viewport proof remains in the route-specific verification queue.

## #344 blocker reconciliation and fresh distillation — 2026-09-04

#344's implementation-level checks remain green: `npm --prefix frontend test
-- --run src/pages/Scene3DPreview.gestureControl.test.tsx
src/tracking/handSignals.test.ts` passed 2 files and 26 tests. The only
unmet criterion is physical held-pinch camera evidence; the available browser
automation cannot synthesize a real camera gesture stream. This is a
verification-boundary blocker, not a reproduced product defect.

Fresh task distillation found no duplicate or separable implementation task.
The next queue candidate is #360, but it remains dependency-blocked until an
intended published 3D fixture exists at its exact public route. The session
therefore proceeds to #360's dependency review rather than looping on #344.

## #381 closure reconciliation — 2026-09-04

#381 is permanently closed as `completed` for its exact authenticated manual
3D owner-route verification boundary. The focused browser transaction passed
in Chromium, Firefox, and WebKit (`BROWSER_QA_E2E_SPEC=e2e/manual3dStageChrome.spec.ts
make browser-qa`) against disposable PostgreSQL/Django/Vite services. The
scenario exercised both 1280×900 and 375×812 viewports, the stage-local
hamburger and stacked overlay, named runtime and authoring actions, responsive
canvas aspect geometry, and Draft → Published → Draft with final state Draft.
No closed issue was reopened. Remaining public/immersive/deployment gaps are
separate open route or verification tasks.

The next FIFO candidate is #382, the anonymous public 2D route audit. It must
be completed, reconciled, and closed before any later issue is engineered.

## #333 closure reconciliation — 2026-09-04

#333 is permanently closed as `completed` for the anonymous regular immersive
3D route. `BROWSER_QA_E2E_SPEC=e2e/immersive3dStageChrome.spec.ts make
browser-qa` passed 3/3 in Chromium, Firefox, and WebKit against disposable
PostgreSQL/Django/Vite services, exercising 1280×900 and 375×812. The test
verified the published route, stage-local hamburger/stacked overlay, named
Screenshot/Download/Sound/Piece controls/Steer/Guide/Fullscreen actions,
Full/Non-Camera downloads, guide behavior, and no load-time camera prompt.
Its setup/assertions were corrected to open the hamburger before inspecting
hidden actions and to assert the current flexible row sizing rather than the
deprecated icon-only fixed width. No closed issue was reopened.

The next FIFO work remains the independently blocked physical-camera #344 and
the fixture/deployment-dependent #360; no later issue is engineered until an
independent criterion-ready transaction is available.

## #382 closure reconciliation — 2026-09-04

#382 is permanently closed as `completed` for its exact anonymous public 2D
route verification boundary. `BROWSER_QA_E2E_SPEC=e2e/public2dStageChrome.spec.ts
make browser-qa` passed in Chromium, Firefox, and WebKit against disposable
PostgreSQL/Django/Vite services. The scenario exercised 1280×900 and 375×812,
the in-canvas hamburger and translucent stacked overlay, named Screenshot,
Download, Piece controls, and Fullscreen actions, nested Live camera/Demo
signal disclosures, Full/Non-Camera downloads, and the public-only privacy
boundary with no legacy sibling panel. No closed issue was reopened.

The next FIFO candidate is #333, the anonymous regular immersive 3D route.
Its fixed-viewport browser transaction must finish, reconcile, and close
before another issue is engineered.

## #360 closure reconciliation — 2026-09-04

#360 is permanently closed as `completed` for the corrected anonymous public
3D route boundary. The dedicated `e2e/public3dProportions.spec.ts` transaction
passed 3/3 in Chromium, Firefox, and WebKit against disposable
PostgreSQL/Django/Vite services. It exercised 1280×900 and 375×812, confirmed
the sphere frame and backing canvas remain proportional, asserted no
page-level horizontal overflow, and verified the public hamburger and named
stage controls. The fixed route is `/p3d/f3863d2f-d3a5-41ad-9883-7b8441af6217`;
the earlier 2D `/p/...` reference was corrected during grooming. The fixture
was temporarily published for anonymous verification and restored to Draft.
No closed issue was reopened.

## Parent reconciliation closure — 2026-09-04

The remaining open parent containers were reconciled after all scoped child
transactions became terminal. #274's capability children and #320/#324's
authored-piece route/artifact children are complete; #344 is complete for
owner-verified desktop hand steering, and #391 is explicitly `not_planned`.
The parent manifests and closure comments were updated, then #274, #320, and
#324 were closed as `completed`. No closed child issue was reopened. Mobile
gesture behavior remains assumed and becomes work only if the owner reports a
specific defect through a new issue.

Parent #320/#324/#274 remain reconciliation containers, not engineering tasks.

## Production-readiness reconciliation — 2026-09-04

The documented production-like `make deploy-check` passed with explicit
non-secret production settings and zero Django warnings. The frontend
production build passed, and the full `make check` passed: backend `888
passed, 22 skipped`, frontend Vitest `2405 passed`, plus lint, formatting,
and type-check gates. Fixed-viewport browser transactions passed in
Chromium, Firefox, and WebKit for all six authored-piece route boundaries.
The published 3D fixture was temporarily verified anonymously and restored
to Draft. Production readiness remains open only at #344's physical-camera
verification boundary; no closed route issue was reopened. Parent
#274/#320/#324 remain reconciliation containers.

## Canonical latest distillation override — 2026-09-04

This section is the latest state after the Chrome re-audit. Earlier notes are
historical transaction records and remain unchanged. Prior scoped closures are
valid; they are not retroactively invalidated by the current owner report.

The exact authenticated 3D editor at 375×812 currently renders the requested
stage-local hamburger and stacked overlay, named controls, and a visible
Draft/Published disclosure. The exact anonymous 2D URL currently renders its
stage-local hamburger and, after activation, compact labeled
Screenshot/Download/Piece controls/Fullscreen rows without a page-level
control rail. These observations do not prove every authored-piece surface or
downloaded artifact, but they do not reproduce the specific editor/public
defects reported in this pass. No new implementation issue was filed.

The exact immersive 3D route was temporarily published for #344, rendered the
fixture, and was restored to Draft. Steering activation produced no camera
stream and no browser permission prompt, so #344 remains an open
`verification-boundary` transaction. Its next action is owner camera
permission, followed by physical held-pinch, release, hand-loss, and disable
evidence. No closed issue was reopened; #274/#320/#324 remain reconciliation
containers.

## Current owner-report distillation and Chrome re-audit — 2026-09-04

Historical scoped closures remain valid for the contracts and evidence of
their transactions. The current owner report is retained as new evidence and
was not used to reopen any issue.

| Boundary | Current evidence | Distillation result |
| --- | --- | --- |
| Authenticated `/projects3d/f3863d2f-d3a5-41ad-9883-7b8441af6217` | Chrome owner session at 375×812 showed the sphere inside the Preview stage, a stage-local hamburger, a translucent stacked overlay, named controls, and an in-overlay `Publication status: Draft` control. | The reported outside-canvas bulky row and missing status control were not reproduced in this session; no new implementation issue created. |
| Anonymous `/p/7b2ecd2b-0a46-4031-b4a2-bb6b9cd74df2` | Chrome at 375×812 showed a stage-local hamburger. Opening it showed compact stacked Screenshot, Download, Piece controls, and Fullscreen actions with readable labels and no page-level control rail. | The reported absence of public controls was not reproduced; no new implementation issue created. |
| Exact immersive 3D route | The route was unavailable while the fixture was Draft. Under the previously authorized temporary publish cycle it rendered the 3D scene and exposed the gesture controls; the fixture was restored to Draft. | Deployment/publication state is verified as reversible, but this does not close the physical-camera boundary. |
| Physical hand steering (#344) | Steering activation on the published immersive route produced no camera stream or Chrome permission prompt. | `verification-boundary`; #344 remains open. Exact next action: owner enables camera permission for `animate.creatrweb.com`, then repeat held-pinch/release/hand-loss/disable evidence. |
| Downloads and other consumers | No new contradictory evidence was produced in this pass; prior scoped closure records remain historical and immutable. | Already covered or requires its existing route/artifact transaction; no duplicate issue created. |

Duplicate/coverage report: the open GitHub set remains #274, #320, #324,
and #344. #274/#320/#324 are reconciliation containers. The current Chrome
evidence does not establish a new actionable product defect distinct from
those containers or #344, so no new issue was filed. The reported visual
discrepancy remains a session/revision-sensitive follow-up signal and must be
rechecked if it recurs; it does not invalidate or reopen any closed issue.

Handoff: #344 is the only active closure-sized transaction. It remains
terminally handed off on the browser-permission boundary; no independent
implementation task was identified by this distillation pass.

## #334 closure reconciliation — 2026-09-04

#334 is permanently closed as `completed` for the anonymous custom immersive
3D route `/immersive/p3d/:id?embed=1`. Its focused browser transaction passed
3/3 in Chromium, Firefox, and WebKit against disposable PostgreSQL/Django/Vite
services. It verified the chrome-less route, stage-local hamburger/stacked
overlay, named controls and Full/Non-Camera downloads, and responsive 16:9
stage geometry. The QA setup now opens the hamburger before inspecting hidden
actions, and the obsolete fixed `360px` height assertion is replaced by the
responsive aspect contract. No closed issue was reopened.

The next FIFO candidate is #335, the CMS immersive query variant.

## #335 closure reconciliation — 2026-09-04

#335 is permanently closed as `completed` for the anonymous CMS immersive 3D
route `/immersive/p3d/:id?embed=1&cms=1`. Its focused browser transaction
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
content is not interpreted. The standalone HTML export path now packages the
validated draw.io source with a dependency-free runtime using the same bounded
object semantics. Focused draw.io renderer/export tests and frontend
typecheck/format/lint checks pass. Public/embed deployment verification and
thumbnail parity remain part of #412.
