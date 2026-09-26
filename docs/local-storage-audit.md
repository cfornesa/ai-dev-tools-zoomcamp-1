# Browser storage audit

Browser storage is split into two categories:

1. Visitor preferences and operational pointers may remain browser-local and
   may be reused across authored pieces when their key is intentionally global.
2. Data derived from an authored piece must be tagged with that piece/version
   before it is persisted. A stale record must never override the authored
   defaults of a newer piece version.

The current audit is below. A `keep` decision means the value is a preference
or a short-lived operational pointer, not authored piece data. The sound key is
the one piece-dependent exception and uses the versioned authored-hash record
implemented for #929.

| Key | Scope | Decision | Reason |
| --- | --- | --- | --- |
| `creatr.sound.<pieceId>` | Piece | version-tagged | Sound overrides are visitor-local but depend on the authored sonic block; #929 stores `{v, authoredHash, overrides}` and migrates legacy snapshots. |
| `augmentrart:theme-preference:v1` | Browser | keep | Light/dark/system display preference. |
| `gesture-studio:reduced-motion-override` | Browser | keep | Accessibility preference, with system preference as the default. |
| `gesture-studio:camera-overlay-settings` | Browser | keep | Camera overlay opacity/mirroring preference, explicitly not part of a scene. |
| `gesture-studio:camera-overlay-geometry` | Browser | keep | Camera overlay placement preference, explicitly not authored scene data. |
| `gesture-studio:camera-overlay-layer-order` | Browser | keep | Camera overlay ordering preference. |
| `gesture-studio:snap-settings` | Browser | keep | Editor snapping preference. |
| `gesture-studio:ai-model-preference` | Browser | keep | Visitor's selected AI model preference; never scene content. |
| `gesture-studio:ai-model-preference-3d` | Browser | keep | Visitor's selected 3D AI model preference; never scene content. |
| `gesture-studio:ai-run:<projectId>` | Project pointer | keep | Reconnection pointer to an active server-side AI run; the run itself is not stored in local storage. |
| `gesture-studio:scene-conversion:<projectId>` | Project pointer | keep | Reconnection/status pointer for a server-side conversion. |
| `augmentrart:account-settings-layout:v1:<ownerId>` | Account | keep | Account settings layout preference. |
| `creatrart:local-workspaces:<ownerId>` | Account | keep | Local workspace labels and project-id grouping; project documents remain in IndexedDB. |
| `creatrart:selected-local-workspace:<ownerId>` | Account | keep | Selected local workspace pointer. |
| `creatrart:offloaded-projects:<ownerId>` | Account | keep | Local archive/offload bookkeeping; project data remains in IndexedDB or an explicitly selected folder. |

Exported standalone runtimes are also audited separately: they receive the
authored sonic defaults in the generated source and do not read this app's
`localStorage` or `sessionStorage`. This prevents a visitor's stale local
sound record from changing a downloaded runtime.
