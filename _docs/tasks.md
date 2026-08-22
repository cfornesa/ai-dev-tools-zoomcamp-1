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
Status: PROPOSED
GitHub issue: #97

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
- #99 `scripts/start.sh` uses bash-4.3+ `wait -n`, which fails on macOS's stock bash 3.2 — Status: LOCAL TRACK COMPLETE, Replit track pending. Replaced `wait -n "$django_pid" "$frontend_pid"` with a portable polling loop matching the existing health-check loop's style; `tests/test_startup_configuration.py` updated to assert the new implementation. Verified live on macOS's stock `/bin/bash` 3.2.57 against a real PostgreSQL-backed Django + Vite pair (health check passes, Vite starts) and confirmed killing the Vite child brings Django down via the `cleanup` trap within 2s with no orphaned processes. Still needed: run on an actual Replit dev Repl shell to confirm its bash version and reproduce the kill-triggers-fail-fast behavior there, per the issue's Replit-track acceptance criteria. Delivered on [PR #102](https://github.com/cfornesa/ai-dev-tools-zoomcamp-1/pull/102).
- #100 `test_google_oauth.py`: 3 tests fail with `DisallowedHost` (400) instead of expected response; creatweb/creatrweb domain typo — Status: LOCAL TRACK COMPLETE, Replit track pending. Fixed the `creatweb`→`creatrweb` typo across `AGENTS.md`, `config/settings.py`'s error message, and `tests/test_env_config.py`/`tests/test_google_oauth.py`'s fixtures/assertions, and added the missing `ALLOWED_HOSTS` overrides the three origin tests needed. `make check` is green. Still needed: a real Google OAuth sign-in round trip against the published `https://animate.creatrweb.com` app (blocked on #75 provisioning real credentials), and confirming the Replit dev/production environments' `ALLOWED_HOSTS`/`CSRF_TRUSTED_ORIGINS` actually include the right hosts and aren't overridden at the environment-secrets level. Delivered on [PR #102](https://github.com/cfornesa/ai-dev-tools-zoomcamp-1/pull/102).
- #103 Responsive shell E2E job fails: Playwright defaults to :5173 but CI starts Vite on :5000 — Status: COMPLETE. Root cause part 1: the job's `Start Django and Vite`/`Wait for both servers` steps correctly use port 5000, but the job never set `E2E_BASE_URL`, so `frontend/playwright.config.ts` and `frontend/e2e/support/global-setup.ts` both fell back to their default of `http://localhost:5173`, where nothing listens — explaining both the direct `net::ERR_CONNECTION_REFUSED` failures and the self-skipped signed-in tests (global-setup's own reachability probe against the wrong port marked the server unreachable). Fixed by adding `env: E2E_BASE_URL: http://localhost:5000` to the "Run responsive shell checks at 375px" step in `.github/workflows/ci.yml`. Root cause part 2, found only once the base-URL fix let the job actually connect: because this job had never successfully run against a live server, three later header refactors (hamburger mobile nav behind a toggle per issue #90, a new "Home" nav link, and removal of the `.app-shell-auth` wrapper class) had silently drifted out of sync with `frontend/e2e/responsiveShell.spec.ts`, which predates all three. Updated the spec to match the shipped, intentional behavior: open the hamburger ("Open menu" button) before asserting nav visibility/tab order below the 768px mobile-header breakpoint, added "Home" to every expected tab-order sequence, and replaced the dead `.app-shell-auth` locator with the individual "Account settings" link / "Logout" button locators the tablet-width test already used. Verified locally end-to-end against a real PostgreSQL-backed Django + Vite pair (`AI_PROVIDER=fake`, `E2E_BASE_URL=http://localhost:5000 npx playwright test e2e/responsiveShell.spec.ts`): all 7 scenarios pass. `make frontend-lint`/`typecheck`/`format-check` all green. Local `make e2e` was unaffected by the CI-side base-URL fix since it always runs on the fixed :5000 Vite port already, but does now exercise the corrected spec.
