# Agentic editing, local storage, recovery, and 2D-to-3D distillation

Status: DISTILLATION COMPLETE — seven criterion-ready follow-ups filed as
GitHub issues #523–#529. No product source or API contract changes are made
in this phase.

## Current-state investigation

- Agentic editing is already implemented for the structured 2D and 3D editor
  routes through bounded plan/validate/revise runs (#461–#463). Runs are
  owner-scoped, target-ID scoped, explicitly accepted, cancellable, quota and
  entitlement checked, and do not execute arbitrary code or expose hidden
  reasoning. Raw generated-code ArtPieces remain a separate sandboxed domain.
- User-saved Mistral model preferences, personas, multi-vendor credentials, and
  editor model selection already exist (#257/#407 and children). There is no
  admin-maintained provider/model catalog with an agent-capability declaration.
- The local repository is `creatrart-local-projects` v1 with five stores for
  projects, scenes, media metadata, media blobs, and metadata. It requests
  persistent storage, exposes `navigator.storage.estimate()`, enforces the
  selected 50 MB/100-file per-project quota, and supports atomic checksum-
  validated JSON export/import with fresh IDs.
- A separate `motion-editor-draft-autosave` database supports temporary crash
  recovery. Server-side draft sync is temporary recovery state, not a complete
  project/media snapshot. No user-facing storage dashboard or app database
  catalog exists.
- Cloud backup protocol, entitlement gating, retention policy, and PostgreSQL
  BLOB storage are implemented in #509/#511/#522. Cloud sync is currently
  site-disabled by default and project opt-in is separate from account
  creation. The owner has now specified that the opt-in choice should be
  presented during signup, with local-only as the safe default.
- No GLTF/GLB import or 2D-to-3D conversion implementation was found in this
  repository. Structured 3D scenes and standalone 3D ZIP exports are present;
  the requested conversion is therefore a new, reviewable structured-scene
  proposal, not an assumption that arbitrary source code can become a mesh.
  No `examples/` or project examples directory exists in this checkout.

## Duplicate and already-covered-work report

- #461–#463 cover bounded agent runs and per-layer/object editing; #523 is
  limited to the missing admin model catalog and server enforcement.
- #257/#259/#262 and #407 cover user model/persona preferences, multi-vendor
  credentials, and model selection; they do not provide admin-owned model
  availability or agent-capability flags, so #523 is not a duplicate.
- #507/#512 cover the local-first architecture and repository; #525 adds the
  missing multi-database inventory/dashboard and lifecycle management.
- #200/#277/#290/#291 cover standalone 2D/3D piece exports; #512 covers one
  project's JSON recovery package. None covers complete local IndexedDB
  database ZIP archives and restore, so #526 is new.
- #41/#43/#44 cover draft autosave, server draft sync, and recovery prompts;
  they do not cover destructive local-data confirmation or a sync-before-clear
  checkpoint, so #527 is new.
- No issue covers signup-time cloud-sync consent; #524 is new and updates the
  existing project-level opt-in model without silently uploading content.
- No issue covers conversion from the canonical 2D scene family to the
  canonical 3D scene family; #528 is new. GLTF/GLB import and arbitrary
  generated-code conversion remain explicitly out of scope.

## Issue manifest and order

| Order | Issue | Capability | Dependencies | Routing | Status |
| --- | --- | --- | --- | --- | --- |
| 1 | [#523](https://github.com/cfornesa/ai-dev-tools-zoomcamp-1/issues/523) | Admin provider/model catalog and `agentic_supported` capability | #461–#463; existing provider registry | Stage 2b complex | OPEN / criterion-ready |
| 2 | [#529](https://github.com/cfornesa/ai-dev-tools-zoomcamp-1/issues/529) | Free/paid cloud-sync availability and snapshot policy | #507/#509/#511/#522 | Stage 1 decision/scoping | OPEN / owner decision required |
| 3 | [#524](https://github.com/cfornesa/ai-dev-tools-zoomcamp-1/issues/524) | Signup-time cloud-sync consent | #509/#511/#529; social-only signup | Stage 2b complex | OPEN / criterion-ready |
| 4 | [#525](https://github.com/cfornesa/ai-dev-tools-zoomcamp-1/issues/525) | Local storage dashboard and app-owned DB catalog | #512 | Stage 2b complex | OPEN / criterion-ready |
| 5 | [#526](https://github.com/cfornesa/ai-dev-tools-zoomcamp-1/issues/526) | Whole-database/project ZIP archive and atomic restore | #512/#525 | Stage 2b complex | OPEN / criterion-ready |
| 6 | [#527](https://github.com/cfornesa/ai-dev-tools-zoomcamp-1/issues/527) | In-app clear warnings and opt-in sync checkpoint | #509/#511/#525/#526 | Stage 2b complex | OPEN / criterion-ready |
| 7 | [#528](https://github.com/cfornesa/ai-dev-tools-zoomcamp-1/issues/528) | Reviewable structured 2D-to-3D conversion | #461–#463; 2D/3D schemas | Stage 2b complex | OPEN / criterion-ready |

The recommended next issue is #523 because it is independent of storage and
signup work and establishes the model-capability contract requested in the
first wishlist item. Resolve #529 before implementing signup consent so the
copy and eligibility state match the approved free/paid policy. #525 precedes
#526 and #527 because the dashboard is the lifecycle entry point. #528 is
independent of storage but should follow the existing agent workflow contract.

## Blocker triage and verification boundaries

- **Provider/model reality:** `agentic_supported` is an application capability
  declaration and cannot prove model quality. Real provider behavior remains a
  separately authorized live-provider verification boundary.
- **Signup OAuth:** real Google/GitHub callback evidence requires credentials;
  deterministic adapter/callback fixtures can verify application behavior.
- **Browser storage:** JavaScript cannot reliably detect or intercept a user
  clearing browser history/site data, and `indexedDB.databases()` is optional
  and origin-scoped. Creating another same-origin database does not evade the
  browser's origin-wide quota. These are verification/platform boundaries,
  not reasons to promise automatic protection.
- **Cloud consent:** cloud sync remains opt-in, site-admin kill-switch gated,
  and content upload remains project-level explicit. The signup preference must
  not itself create a backup or override entitlement.
- **Free/paid policy:** the current seed grants `cloud_project_sync` to the
  paid plan; whether free users receive weekly snapshots, manual snapshots, or
  no cloud sync is intentionally unresolved in [#529](https://github.com/cfornesa/ai-dev-tools-zoomcamp-1/issues/529).
- **3D conversion quality:** AI output quality and arbitrary source-to-mesh
  interpretation are research/product boundaries. The first contract is a
  validated structured 3D proposal with unsupported-layer reporting and
  explicit Accept.
- No distinct workflow/infrastructure blocker produced a new issue in this
  pass. Each actionable gap has a new criterion-ready issue; no item is left
  only in prose.

## Durable-memory reconciliation

Existing durable topics already cover the agentic editing boundary and the
local-first hybrid/cloud-sync invariant. A new memory topic is proposed for
the browser-storage limitation: same-origin database sharding is organization,
not extra quota, and external browser-data clearing cannot be intercepted.
Per repository memory governance, this proposal is pending owner confirmation;
it is not written as a memory topic in this distillation pass.

## Next transaction

Begin Stage 1 issue scoping for exactly [#523](https://github.com/cfornesa/ai-dev-tools-zoomcamp-1/issues/523).
Do not implement #524–#529 in the same transaction. Before any API or schema
write, update `docs/api.md` and present the required migration diff/rollback
plan.
