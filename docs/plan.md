# Creatrweb Animation Studio — V1 Plan

## Product definition

Build a Django web application for creating gesture-reactive web animations from simple shapes. Users start from a curated or private template, create and edit animations through a human-friendly visual editor and AI assistance, preview them with browser-local MediaPipe hand tracking, save immutable scene versions, publish public work, remix public work, and export runnable HTML.

The primary V1 creative workflow is:

1. Create a private project from a template or blank canvas.
2. Compose a scene with shapes and behavior cards/node graph logic.
3. Use browser-local hand tracking, demo input, mouse, touch, sliders, and keyboard controls to test interactions.
4. Use AI to generate a complete editable scene or propose a small revision.
5. Explicitly accept a proposed revision to create a new immutable version.
6. Save, publish, fork, or export a selected saved version.

V1 deliberately prioritizes individual ownership, reliable provenance, public sharing, forks, and export. Teams, workspaces, collaboration, and editor re-import from exported HTML are V2 features.

## Product goals

- Make expressive gesture-reactive art approachable without requiring users to code.
- Keep the visual editor as the source of truth; AI generates structured, editable scene data rather than opaque JavaScript.
- Keep live camera video and MediaPipe inference in the viewer’s browser by default.
- Make each saved creative change recoverable through immutable scene versions.
- Produce small, runnable, CDN-linked HTML exports.
- Build data and permission boundaries now that can support teams and contribution attribution later.
- Treat keyboard access, reduced motion, and non-camera interaction alternatives as first-class requirements.

## Explicit V1 exclusions

- Teams, workspaces, groups, real-time co-editing, comments, and shared-project editing.
- Arbitrary custom JavaScript written by users or generated directly by AI.
- User-configurable AI temperature controls.
- Re-importing exported HTML back into the editor.
- Fully offline/bundled HTML or ZIP dependency packaging.
- Public or unlisted private-link sharing beyond the public/private project model.
- Custom-trained gesture models.
- General-purpose visual programming, loops, recursion, or unbounded graph execution.

## Core technical direction

### Application architecture

- Backend: Django with Django REST Framework or Django-native endpoints for authenticated project APIs.
- Database: Replit-managed PostgreSQL for deployed development and production environments, configured through Replit's `DATABASE_URL`. SQLite may remain the lightweight backend for isolated offline tests and initial local bootstrap only.
- Frontend: React and TypeScript embedded alongside Django or served as a separate frontend, with a stable API boundary.
- Node editor UI: React Flow with custom typed nodes and handles.
- Default preview/export renderer: p5.js.
- Future renderer adapters: SVG and C2.js.
- Hand tracking: MediaPipe Tasks Vision / Gesture Recognizer in the browser.
- AI provider: Mistral API behind Django server endpoints.
- Auth: Google OAuth via `django-allauth`; add GitHub later only if valuable.
- Background work: use an async worker only where needed for thumbnails, cleanup, and analytics; do not require it for live animation or camera processing.

### Database deployment boundary

- Do not run a PostgreSQL server inside the application Repl. Provision Replit's managed SQL database and connect Django with the `DATABASE_URL` supplied to the applicable development or production environment.
- Keep Replit development and production data separate; do not copy development data into production by default.
- Do not persist application data in a deployed SQLite file because a published Replit application's filesystem is not the durable data boundary.
- SQLite is allowed for fast, offline unit tests whose behavior does not depend on database-specific locking, constraints, JSON behavior, or concurrency.
- Run tests for version sequencing, current-version updates, draft races, atomic project/template/fork creation, and other transaction-sensitive behavior against PostgreSQL.
- Keep Django models and migrations portable where practical, but treat PostgreSQL behavior as authoritative for deployed V1 correctness.

### Canonical scene model

Use a renderer-neutral, versioned scene JSON document as the authoritative creative representation. It should describe:

- Canvas and renderer preferences.
- Shapes, groups, styles, transforms, layers, and draw order.
- Particle systems and approved physics settings.
- Input signals and gesture bindings.
- Typed node graph and graph connections.
- Renderer-compatible behavior configuration.
- Accessible controls, demo signals, and reduced-motion behavior.
- Seeded visual-randomness configuration.

Do not store arbitrary executable JavaScript in the scene. Validate scene JSON in the browser before preview and on the Django server before saving, accepting AI output, publishing, or exporting.

### Tracking abstraction

Keep MediaPipe implementation details behind a normalized provider interface so pose and face tracking can be added later.

```ts
type TrackingFrame = {
  timestamp: number;
  hands: Hand[];
  events: GestureEvent[];
};

type Hand = {
  id: string;
  handedness: "left" | "right";
  landmarks: Array<{ x: number; y: number; z: number }>;
  confidence: number;
};
```

All graph bindings consume normalized signals, such as `primaryHand.indexTip.x`, `pinchStrength`, `palmOpen`, or `handDistance`, rather than invoking MediaPipe directly.

## Accounts, ownership, and gallery

### Authentication

- Require accounts for saving projects, publishing, forking, and using server-side AI generation.
- Support Google OAuth only in V1.
- Password signup is disabled in V1; new accounts are created through Google sign-in.
- Request minimal profile/email scopes.
- Use HTTPS, strict redirect URI configuration, and authorization-code flow with PKCE where applicable.

### Project ownership

- Each project belongs to an individual user in V1.
- All new projects default to `private` visibility.
- A project has current project metadata plus a current saved scene version.
- Create a centralized project-permission service rather than scattered direct owner checks.

### Future-ready collaboration boundary

Preserve room for V2 with data/model boundaries such as:

- `Project.owner`
- Future `Workspace`
- Future `ProjectMembership`
- Future roles: `owner`, `editor`, `commenter`, `viewer`

V1 does not expose these team features.

### Public publishing

- Visibility is a project-level toggle: `private` or `public`.
- Switching from private to public immediately makes the project’s current saved version available at a stable public URL and eligible for the home-page public gallery.
- Switching to public requires a one-time confirmation explaining that the animation, title, creator attribution, and public preview become accessible to anyone.
- Switching back to private immediately removes it from the gallery and disables public access.
- Public gallery cards show title, thumbnail, creator attribution, and “Made with” attribution as appropriate.
- Do not expose raw prompts, private drafts, API data, or private camera content in public listings.

### Public viewing

Public project pages provide:

- A non-camera demo mode using synthetic gesture signals.
- An explicit `Enable camera` action for browser camera permission.
- Browser-local MediaPipe hand tracking; do not upload or store camera frames by default.
- A clear privacy notice stating that camera video stays on the device and is not recorded or uploaded.
- Friendly fallbacks for denied permission, missing camera, unsupported browser, or failed tracking.

## Project metadata and versioning

### Metadata is not versioned creative state

Project metadata can change without creating a scene version:

- Title
- Short description
- Visibility
- Remix permission
- Thumbnail choice
- Tags
- Export attribution preference

Defaults:

- Title: `Untitled animation`
- Description: empty

Users can edit metadata any time. Require a meaningful title and description only for public publishing and export.

### Versioned creative state

A new immutable version is created for meaningful visual/code changes, including:

- Scene JSON changes.
- Node graph changes.
- Shape, group, style, binding, renderer, and seed changes.
- Accepted AI-generated scenes and AI edit proposals.
- Restores from a prior version.
- Fork creation.

Each version records:

- Version sequence number.
- Creation timestamp.
- `created_by` user.
- Parent version, where relevant.
- Fork source version, where relevant.
- Origin: `manual`, `ai_create`, `ai_edit`, `restore`, or `fork`.
- Optional change label.
- Full validated scene JSON snapshot.
- Optional validated JSON Patch for change presentation/history.

### Revision behavior

- AI results always begin as a draft revision, not an overwrite.
- Preview a draft visually and as a concise change summary.
- `Accept` creates the next immutable scene version.
- `Reject` discards the AI proposal.
- Restoring an old version creates a new version copied from that historical scene; it does not mutate history.
- Users can soft-delete non-active versions; protect the current active version. Permanent deletion is a later administrative/data-retention decision.

### Version history UI

Show:

- Latest version, clearly marked.
- Version number, time, change label, creator, and origin.
- Small thumbnail/preview where feasible.
- Restore and soft-delete actions according to ownership rules.

## Active-session autosave and recovery

Autosave is active-session crash protection, not a second history system.

### Edit session lifecycle

- Open or create a project: start an `EditSession`.
- Save a draft locally in IndexedDB after a short idle debounce, approximately 1–2 seconds after the last edit.
- Synchronize the latest private session draft to Django approximately every 20–30 seconds and after meaningful actions such as accepting an AI revision.
- On page hide/navigation, attempt a final small update using `sendBeacon()` or `fetch(..., { keepalive: true })`.
- On explicit Save: save the actual creative state as a normal version, then delete the active session draft.
- On explicit Exit without saving: delete the active session draft, then leave.
- On close/crash/forced browser termination: retain the draft temporarily because cleanup cannot be guaranteed.
- Clean up abandoned session drafts after a short expiry window, such as 24 hours.

### Leaving with unsaved work

- When unsaved edits exist, use `beforeunload` to request the browser’s native leave-page confirmation on close, reload, or navigation.
- Browser-controlled wording is expected; custom dialog text is not reliable.
- Do not depend on this event for cleanup; it is only a safeguard.

### Recovery prompt

If an active draft exists when reopening a project, show a compact prompt before loading the editor:

- `Recover draft`: opens the autosaved state as unsaved work; the saved version remains unchanged.
- `Discard draft`: deletes the session draft and opens the last saved version.
- `Cancel`: returns to the project gallery without changing anything.

Display last autosave time and a concise change summary, such as “3 shapes changed · 1 gesture binding added.”

## Templates

### Template sources

Use one conceptual template model with two source classes:

- Built-in templates: platform-managed, read-only, categorized, and versioned.
- Private templates: users save a project/version as a reusable private template; visible only to the owner.

Creating from a template always clones its scene into a new private project. The original template is never modified by use.

### Launch template gallery

Offer a concise, balanced gallery:

- Blank canvas
- Hand follower
- Pinch particle burst
- Open-palm bloom
- Motion trails
- Gesture color field
- Physics orbit
- SVG kinetic poster

Each template demonstrates one central visual/interaction concept and remains fully editable.

### Template onboarding

Templates include optional, short, dismissible, plain-language preview hints, for example:

- “Enable your camera, then raise one hand.”
- “Pinch your thumb and index finger to create particles.”
- “Move your hand to guide the orbit.”
- “Press H to replay these hints.”

Hints should fade after the interaction succeeds. Every template also supports demo mode with synthetic tracking signals.

## Animation editor

### Primary layout

Use a three-panel editing workspace:

- Left: tools, assets, scene hierarchy, templates, and layers.
- Center: live canvas preview and direct manipulation.
- Right: selected-item properties, behavior/binding controls, accessibility settings, and inspector details.

The default interaction should feel like composing an animation recipe, not programming a graph from scratch.

### Progressive disclosure

- Start from a template or blank canvas.
- Let users place and manipulate simple shapes directly: drag, resize, recolor, layer, group, and delete.
- Present common interactions as behavior cards: “Follow hand,” “React to pinch,” “Pulse,” and “Emit particles.”
- `Show logic` reveals behavior cards as typed connected nodes.
- Advanced graph mode exposes transforms, conditions, timing, and bounded math nodes.

### Shape and scene scope

V1 visual primitives:

- Circle
- Rectangle
- Line
- Basic path/polygon where supported
- Groups
- Particle emitter

V1 visual properties:

- Position X/Y
- Scale X/Y
- Rotation
- Opacity
- Fill and stroke color
- Stroke width
- Particle rate, size, lifespan, speed, and palette
- Trail length
- Approved physics force parameters
- Scene background and palette

## Accessibility and alternate controls

Accessibility is a V1 requirement.

### Keyboard access

- All editor functions must be keyboard-operable.
- Use visible focus indicators, logical tab order, skip links, and no keyboard traps.
- Provide keyboard operations for selecting, adding, duplicating, deleting, moving, resizing, connecting nodes, and editing properties.
- Provide an accessible scene-outline/list view that can fully substitute for canvas drag-and-drop and graph manipulation.

### Reduced motion

- Include a global Reduce motion control with manual override.
- Default behavior follows the system `prefers-reduced-motion` preference.
- Reduced mode replaces or reduces non-essential motion: continuous movement can become static state, slow fade, or stepped updates while preserving the interaction’s meaning.

### Input alternatives

Camera gestures are never the only way to operate or test a piece. Provide:

- Mouse and touch alternatives.
- Keyboard controls.
- Slider/button control panel for gesture signals.
- Demo playback with synthetic hand signals.

## Gesture-to-visual binding system

### Design sentence

Bindings should read as a sentence:

> When this hand signal happens, change this visual property.

### Hand modes

Use a compact segmented control: `Hands: One | Two`.

- Default: One hand.
- Selecting Two gives a short explanation: “Use left and right hand signals independently.”
- Two-hand mode activates automatically when users add a two-hand binding.
- Preserve existing one-hand bindings as `Primary hand` when switching modes.
- Bindings can target `Primary hand`, `Left hand`, `Right hand`, or `Either hand`.
- Make the selected control state keyboard-accessible and programmatically exposed to assistive technology.

### Supported signals

Continuous signals:

- Index-tip X/Y
- Palm center X/Y
- Hand depth
- Hand movement speed
- Pinch strength/distance
- Gesture confidence
- Hand presence

Gesture states:

- Open palm
- Closed fist
- Pointing up
- Thumbs up
- Victory
- None

Events:

- Pinch start/end
- Gesture enter/exit
- Hand appears/disappears

Two-hand signals:

- Continuous hand distance, normalized 0–1.
- `handsClose` / `handsFar` states.
- `handsBecameClose` / `handsBecameFar` events.
- Two-hand midpoint as a later extension within the same provider model.
- Same-gesture checks as a later extension within the same provider model.

### Two-hand distance

Implement two-hand distance first because it is intuitive and straightforward:

- Compute distance between left/right palm centers or wrists.
- Smooth and normalize it.
- Map it to scale, particle intensity, opacity, or force.
- Expose threshold states/events as well as a continuous signal.

Give bindings simple configuration controls:

- Close threshold
- Far threshold
- Smoothing
- Hold time
- Release threshold

Use hysteresis for threshold events so values near a threshold do not flicker.

### Binding targets and safety

Use a layered target scope:

| Scope | V1 examples | Guardrails |
|---|---|---|
| Shape | position, scale, rotation, opacity, fill, stroke | One binding per target channel by default; capped transforms |
| Group | shared movement, scale, color, trail behavior | Bounded group size and nesting |
| Scene | background, palette, global emitter, global physics force | Small allowlist only |
| Interaction | trigger preset, toggle layer, emit particles, reset scene | Cooldowns and events-per-second caps |

### Binding collision rule

Allow one active binding per target channel, not one binding per whole shape. This allows coherent combinations:

- Hand X → position X
- Hand Y → position Y
- Pinch strength → scale
- Open palm → color
- Hands far apart → particle emission

Do not allow two continuous bindings to compete for the same target channel by default. Use `replace` as the standard composition mode; add advanced additive composition only for tightly controlled supported properties.

### Runtime guardrails

- Clamp every output to permitted ranges.
- Smooth continuous tracking signals.
- Enforce event cooldowns and per-second caps.
- Cap particles, graph complexity, node execution cost, and work per animation frame.
- Validate every saved or AI-proposed scene against strict schema rules.
- Never allow unrestricted code execution.

## Node graph vocabulary

The graph is a typed, constrained behavior system—not a general-purpose programming language.

### Node families

- Input: Hand signal, Gesture event, Timer, Demo control
- Transform: Map range, Smooth, Threshold, Clamp, Math
- Visual: Shape property, Group property, Scene property, Particle emitter
- Flow: Trigger, Delay, Cooldown
- Output: Preview/render target

### Conditional logic

Prioritize a simple If / Else node.

V1 behavior:

- One condition per node.
- True and false outputs only.
- Gesture/state checks and numeric comparisons.
- No loops, recursion, arbitrary script, or nested condition trees.
- Maximum three conditional nodes per scene.
- Hold-time/debounce configuration for noisy tracking input.

Supported comparisons:

- Is greater than
- Is less than
- Is between
- Is approximately

Supported comparison values:

- Pinch strength
- Hand X/Y
- Hand speed
- Hand distance
- Gesture confidence
- Shape scale
- Opacity
- Timer value

Show permissible ranges beside controls and identify invalid input in text, not only by color.

### Math and time nodes

V1 nodes:

- Map range
- Clamp
- Smooth
- Invert
- Add
- Multiply
- Lerp
- Oscillator
- Timer: elapsed time, looped phase, countdown
- Delay
- Cooldown

All time calculations use elapsed timestamps from `requestAnimationFrame`, never frame counts.

V1 does not include division, custom formulas, random code, loops, recursion, or user-written JavaScript.

### Visual randomness

Include limited, explicit, deterministic visual randomness:

- Random value within a declared range
- Random choice from a small declared list
- Random on event
- Bounded noise/wobble

Rules:

- Editor or AI generates seeds; users do not manually re-roll seeds in V1.
- Every scene using random behavior stores a read-only seed.
- Show a “Randomness enabled” badge in the inspector.
- Duplicating, forking, restoring, and exporting preserve the seed.
- Export code includes a transparency comment such as `// Seeded visual randomness: seed 483920`.
- p5.js exports use compatible deterministic seeding where applicable.

## AI-assisted workflow

### AI actions

Support two distinct structured AI operations:

- Create scene: prompt → complete editable scene JSON → preview → save/refine.
- Edit scene: prompt + current scene JSON → minimal structured patch → preview → accept/reject.

Examples:

- “Create a calming hand-controlled field of teal circles that ripple on pinch.”
- “Make pinch gestures emit teal particles, but keep all existing shapes and timing.”

### AI output rules

- AI returns strict schema-constrained JSON, never arbitrary JavaScript.
- Server validates output, patch operations, resource limits, and renderer compatibility before preview.
- The UI presents a human-readable change summary and visual diff.
- AI changes are always non-destructive draft revisions until explicitly accepted.

### AI provider and cost control

- Use Mistral API through Django server-side endpoints as the initial hosted provider.
- Define a provider interface for future provider/model routing or local options.
- Treat OpenCode and Mistral Vibe as developer workflow tools, not embedded end-user product dependencies.
- Enforce authenticated-user quotas, rate limits, prompt/request size limits, and token/cost metadata logging.
- Log minimal necessary metadata; avoid retaining prompts by default unless the product later adds an explicit user-facing history choice.

### API-key security

- Keep provider API keys only in Django deployment secrets/environment variables.
- Never expose keys to the browser, scene JSON, public pages, or exported HTML.
- Implement key rotation and server-side auditing.
- Do not store user-supplied provider keys in V1.

## Public remixing and provenance

### Remix setting

- Public projects have `allow_public_remix = true` by default.
- Creators can turn remixing off per project.
- A public project can be viewed regardless of remix setting; the setting controls fork availability.

### Fork behavior

- Require an account to fork.
- Forking copies the selected public version into a new private project in the visitor’s gallery.
- Never modify the original project or its history.
- Preserve immutable provenance:
  - `forked_from_project`
  - `forked_from_version`
  - Original creator
  - Original public URL
- Public forks/remixes display “Remixed from [creator]” and link to the source.
- Create the project, scene copy, first version, and provenance records in one atomic Django transaction.

## HTML export workflow

### V1 export decision

Exports are runnable-only. V1 does not support importing an exported HTML file back into the editor.

V2 may later embed a versioned project manifest for safe re-import, but V1 intentionally excludes editor graph layout, AI prompts, account data, drafts, provenance, and collaboration data from exports.

### Default export artifact

Default export is one small CDN-linked `index.html`:

- Standalone runnable page without Django.
- Pinned dependency versions.
- Embedded runtime scene configuration required to run the selected version.
- Compact selected renderer runtime/adapter.
- p5.js as the default renderer.
- MediaPipe imports only when the selected export uses live hand tracking.
- Local demo mode and optional live camera mode.
- Keyboard controls, non-camera alternatives, and reduced-motion support.
- Local-only camera privacy notice and permission-denied fallback.
- Current project title and description.
- Optional attribution only if selected.

The page is self-contained in project code/configuration but CDN-linked for external library dependencies. It requires network access for those dependencies on first load.

### Renderer selection

- p5.js is fully supported in V1.
- SVG and C2.js export options appear only when the selected scene uses features supported by that renderer.
- Validate selected renderer compatibility before export.
- Avoid normal export warnings by constraining scene/node features to known renderer capabilities. If an impossible mismatch still exists, block export and identify the exact unsupported feature.

### Camera/device handling

Camera behavior is necessarily browser/device dependent, particularly on mobile Safari/iPhone/iPad environments.

Exported camera behavior:

- Never open the camera automatically.
- Provide explicit `Enable camera` control.
- Require secure HTTPS context when hosted, except approved local-development contexts.
- Keep video and MediaPipe processing in the viewer’s browser.
- Fall back to demo controls if permission is denied, camera is unavailable, or tracking fails.

### Export dialog

Default selections:

- Version: latest saved version.
- Renderer: p5.js when compatible.
- Dependency mode: CDN-linked HTML.
- Attribution: off.
- Thumbnail ZIP: off.

The dialog lets users:

- Select any saved version from history; selecting an older version does not alter the current project/version.
- Choose renderer only among compatible options.
- Choose demo-only, camera-only, or demo + camera interaction mode.
- Toggle optional attribution.
- Toggle optional social-thumbnail ZIP.

### Optional attribution

`Include attribution` is off by default.

When enabled:

- Add a small visible footer: “Created with [product name]” linked to the app.
- Add a matching HTML comment and export version marker.

When disabled:

- Include no product branding or attribution comment.

### Metadata in export

Use current project metadata, regardless of which saved version is selected:

- `<title>` from project title.
- `<meta name="description">` from project description.
- Visible accessible `<h1>` and optional description panel.
- Open Graph title/description metadata for use if later hosted.

Do not include version numbers, version creation dates, internal IDs, prompts, creator identity, or project history in the export.

### Optional social-thumbnail ZIP

V1 default is HTML only. Add an optional `Include social thumbnail (ZIP)` choice.

When selected, download a ZIP containing:

- `index.html`
- `thumbnail.png`

Thumbnail rules:

- 1200 × 630 PNG social-card landscape.
- Artwork only: no title, creator name, logo, watermark, UI, or controls.
- Render from stable demo mode only; never capture raw camera content.
- Generate at export from the renderer canvas.

## Data model sketch

### User and identity

- `User`
- OAuth/social account records managed through authentication integration

### Creative domain

- `Project`
  - owner
  - title
  - description
  - visibility
  - allow_public_remix
  - current_version
  - public slug/URL
  - timestamps

- `SceneVersion`
  - project
  - sequence number
  - scene JSON snapshot
  - JSON Patch summary/patch, optional
  - created_by
  - parent_version
  - fork_source_version
  - origin
  - change label
  - soft-delete state
  - timestamps

- `EditSessionDraft`
  - project
  - user
  - session identifier
  - latest draft JSON
  - last autosaved timestamp
  - expiry timestamp

- `Template`
  - owner nullable for built-in templates
  - template type: built-in/private
  - source version
  - name, category, description
  - scene JSON snapshot
  - timestamps

- `ProjectActivity`
  - project
  - actor
  - action type
  - metadata
  - timestamp

- Future `ProjectMembership` boundary, not active in V1

## Validation and performance limits

Apply strict scene schema validation in browser and server.

Suggested initial operational limits, to tune through testing:

- Fixed maximum shape/group/node counts.
- Maximum three conditional nodes per scene.
- Fixed maximum particle count and particle emission rate.
- Fixed maximum binding count per scope/target channel.
- Maximum graph connection count.
- Maximum scene JSON payload size.
- Maximum AI prompt, AI output, and patch sizes.
- Event cooldowns and trigger-rate limits.
- Bounded numeric property ranges.
- Per-frame execution budget with graceful quality reduction when exceeded.

Validate all AI JSON patches, scene imports/templates, and save/export requests server-side even if browser validation already succeeded.

## Suggested delivery phases

### Phase 0: Product foundation

- Django project, Replit-managed PostgreSQL integration, authentication, user gallery shell.
- Canonical scene schema and validation implementation.
- Project/version/draft data model.
- Basic private project CRUD and metadata editing.

### Phase 1: Core editor

- p5.js preview renderer.
- Shapes, groups, properties, direct manipulation, scene outline.
- Curated template gallery and blank canvas.
- Keyboard-accessible editor and reduced-motion foundation.
- Local demo-control inputs.

### Phase 2: Hand interaction

- MediaPipe browser-local hand tracking.
- One-hand signals, gesture states/events, and binding cards.
- Two-hand opt-in mode, independent hand control, and hand-distance continuous/threshold signals.
- Camera permission UX, privacy notices, demo fallback.

### Phase 3: Graph and generative behavior

- React Flow graph view with typed nodes.
- Conditions, map/clamp/smooth, timing, cooldown, and bounded math.
- Particle system and deterministic visual randomness.
- Runtime guards, graph validation, and performance caps.

### Phase 4: AI and version safety

- Mistral provider integration through Django.
- Structured scene creation and patch-based edit proposals.
- AI draft preview, acceptance/rejection, history labels.
- Session autosave, leave-page warning, and recovery prompt.

### Phase 5: Publishing and remixing

- Public/private toggle and immediate gallery visibility.
- Public project pages with demo and opt-in camera mode.
- Remix opt-out toggle and provenance-preserving forks.
- Gallery thumbnails and social metadata for hosted pages.

### Phase 6: Export

- Version selector and p5.js runnable-only CDN-linked `index.html` generation.
- Accessibility/demo/camera export controls.
- Optional attribution.
- Optional artwork-only 1200 × 630 thumbnail ZIP.
- Renderer compatibility checks; later enable SVG/C2.js adapters where supported.

## V2 roadmap candidates

- Workspaces/groups, project memberships, and role-based authorization.
- Shared project updating, contribution attribution, activity feeds, comments, and conflict resolution.
- Optimistic concurrency checks and merge/refresh workflow for collaborators.
- Re-importable HTML exports with a safe embedded, versioned project manifest.
- Fully offline/bundled exports and optional ZIP with local dependencies.
- SVG and C2.js parity/expanded renderer support.
- Pose and face trackers implemented through the normalized tracking provider interface.
- Custom gesture training or curated gesture extensions.
- Public template marketplace/community curation.
- Expanded export formats and hosting integrations.

## Acceptance criteria for a coherent V1

A signed-in user can:

1. Create a private project from a blank canvas or built-in/private template.
2. Edit shapes and scene properties with mouse and keyboard.
3. Use demo controls or browser-local one- and two-hand tracking to test gesture bindings.
4. Create valid interactions using behavior cards and the constrained node graph.
5. Use an AI prompt to create a complete editable scene or propose a reversible scene edit.
6. Save meaningful creative changes as immutable versions, restore prior versions, and delete allowed historical versions.
7. Recover an unfinished active-session draft after an interruption, or discard it.
8. Publish a project immediately via the public toggle, with a functioning public demo and opt-in local camera mode.
9. Disable remixing or let authenticated visitors fork a public project with preserved provenance.
10. Export the latest or a selected historical saved version as a small runnable CDN-linked HTML page.
11. Optionally export an artwork-only social-card thumbnail in a ZIP with the HTML.
12. Operate the product with keyboard alternatives and reduced-motion settings.
