# Local workspace opening, selective retention, and folder access distillation

Status: DISTILLATION COMPLETE — owner-selected browser-local hybrid direction;
four criterion-ready follow-ups are proposed. No product source or API
contract changes are made in this phase.

## Current-state investigation

- #512 stores projects, scenes, media metadata, and media blobs in IndexedDB.
- #525 catalogs app-owned databases and states that another same-origin
  database is organization only, not extra browser quota.
- #526 exports/restores complete local databases and supports one inactive
  project export, but does not define named switchable archive workspaces or
  selective restore into a chosen workspace.
- #527 explains that external browser site-data clearing cannot be detected or
  prevented reliably and provides in-app recovery safeguards.
- No issue defines explicit folder handles, permission/revocation behavior,
  a folder-backed archive bridge, or opening a selected local file/folder as
  project context.

## Owner-selected direction

The workspace remains browser-local and IndexedDB-authoritative. Explicit user
file/folder picker actions may import, export, archive, or rehydrate data, but
the app does not silently upload, watch, or bind to arbitrary filesystem paths.
ZIP archives are the cross-browser baseline. File System Access API support is
an enhancement with explicit capability and permission states; it must not be
required for the local workspace to function.

## Duplicate and already-covered-work report

- #512 covers local persistence and JSON project recovery, not named archive
  workspaces or external-folder binding.
- #525 covers storage inventory/lifecycle visibility, not workspace switching.
- #526 covers ZIP integrity and atomic restore, but not opening an archive as a
  workspace or selective multi-project restore sessions.
- #527 covers clear-data warnings and sync-before-clear, not archive browsing,
  offload, or directory handles.
- Standalone piece exports and account export are different artifact contracts.
- No open GitHub issue currently covers the three capability boundaries below.

## Issue manifest and order

| Order | Issue | Capability | Dependencies | Routing | Status |
| --- | --- | --- | --- | --- | --- |
| 1 | [#532](https://github.com/cfornesa/ai-dev-tools-zoomcamp-1/issues/532) | Open a selected ZIP as an isolated browser-local workspace with selective project restore | #526; owner-selected hybrid contract | Stage 2b complex | OPEN / criterion-ready |
| 2 | [#533](https://github.com/cfornesa/ai-dev-tools-zoomcamp-1/issues/533) | Archive/offload inactive local projects and rehydrate them safely | #525/#526/#532 | Stage 2b complex | OPEN / dependency-blocked on #532 |
| 3 | [#534](https://github.com/cfornesa/ai-dev-tools-zoomcamp-1/issues/534) | Add an optional folder-backed archive bridge with permission and compatibility states | #512/#532; owner-selected hybrid contract | Stage 2b complex | OPEN / criterion-ready, platform-bound |
| 4 | [#535](https://github.com/cfornesa/ai-dev-tools-zoomcamp-1/issues/535) | Open a selected local file/folder as project context with explicit copy-in semantics | #526/#532; owner-selected hybrid contract | Stage 2b complex | OPEN / dependency-blocked on #532 |

## Criterion-ready issue contracts

### Selected ZIP workspace

Entry point: local storage dashboard. Fixture: two app-owned local projects
with ordered scenes and mixed media in one database plus a ZIP containing two
different projects. The user can choose an archive, inspect its manifest and
project list without mutating IndexedDB, select one or more projects, and
restore them atomically as fresh local IDs into a named workspace. The UI must
allow switching back to the active browser-local workspace, reject corrupt or
foreign archives without mutation, and make credentials/keys absent from the
archive. Focused ZIP/fake-IndexedDB tests, Chromium download/upload evidence at
1280x900 and 375x812, and `make check` are required. Do not execute archived
HTML/JS; “open” means inspect/restore data into the local editor.

### Selective archive/offload lifecycle

Entry point: local storage dashboard. Fixture: three projects with one active,
one selected for archive, and one already archived. The user can export a
selected project, mark it archived/offloaded only after integrity verification,
see its metadata without claiming its blobs remain local, and rehydrate it
from a selected archive with collision-safe IDs and no partial deletion. Near
quota, missing archive, cancelled confirmation, checksum failure, and quota
failure must preserve the last known-good local state. Require explicit counts,
bytes, archive path/name, and confirmation. Verify with fake IndexedDB,
Chromium, and `make check`; Safari/Firefox API differences are a documented
boundary.

### Optional folder-backed archive bridge

Entry point: local storage dashboard. Fixture: a user-selected directory with
one valid workspace archive and an unrelated file. Where
`showDirectoryPicker` is supported and permission is granted, the user can
choose a folder, list only safe app archive files, import/export an archive,
and see the handle permission state after reload. Denied, revoked, unsupported,
read-only, unrelated-file, traversal, and interrupted-write cases are
actionable and non-destructive. The browser-local IndexedDB workspace remains
usable when the folder is unavailable. Do not promise live folder watching,
arbitrary file execution, universal browser support, or native desktop
semantics. Verify Chromium behavior and document the Firefox/Safari boundary.

## Blocker triage and next action

- Issue 1 is the next independent implementation transaction.
- Issue 2 depends on issue 1's workspace identity and archive-selection
  semantics; it must not invent a second archive format.
- Issue 3 is independent of issue 2 but browser-platform-bound; unsupported
  APIs are a verification boundary, not an implementation failure.
- No new vendor dependency is required.

## Next transaction

Create and groom [#532](https://github.com/cfornesa/ai-dev-tools-zoomcamp-1/issues/532)
only: selected ZIP workspace opening and selective restore. Do not implement
product behavior during distillation.
