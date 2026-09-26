# Distillation 2026-09-26 — new issues #874, #886, #892–#899

Provenance: task-distillation, Claude Sonnet 5 Medium. Scope: issues created in the prior 16 hours plus #874 (added by the owner).

| Issue | Disposition | Routing | Blocker / next action |
| --- | --- | --- | --- |
| #874 | Scope-shift; code done, data criterion → #906 | 2b (delivered) | Owner confirms shift, then close |
| #886 | Owner-decision issue, 3 options | Owner | Owner picks option; #847 depends |
| #892 | Tracking parent | none | Closes when children terminal |
| #893 | Re-scoped | 2a | Dependency-blocked on #900 |
| #894 | Implemented; verification-boundary | 4 | Run responsiveShell spec where Chromium launches |
| #895 | Tracking parent | none | Children #901–#903 |
| #896 | Implemented; dependency-blocked on #894 | 4 | Same run as #894 |
| #897 | Narrowed to backend contract | 2b | none |
| #898 | Narrowed to regular embed | 2a | none |
| #899 | Standardized | 2a | none (first in order) |
| New #900 | Owner decision: flat-engine spatial shell | Owner | Blocks #893, #902, #907 flat criteria |
| New #901/#902/#903 | Download children | 2a | #902 blocked by #900 |
| New #904/#905 | Authorship frontend / feeds+share | 2a / 2b | Depend on #897 |
| New #906 | Production data: `untitled-3d-scene` | Owner | Needs explicit authorization |
| New #907 | Immersive embed route | 2a | none |

## Implementation queue (issues #874 onward; strict order within a stream)

| Q | Issue | Stream | Waits for |
| --- | --- | --- | --- |
| 01 | #900 owner decision (flat engines / arrow pad; reference-evidence added) | A | — |
| 02 | #908 reference vs app audit (PHP + react-node, private/public) | A | — |
| 03 | #899 immersive 3D routes | A | #900, #908 |
| 04 | #898 regular embed | A | #899 |
| 05 | #907 immersive embed | A | #898 |
| 06 | #893 immersive flat routes | A | #900, #907 |
| 07 | #903 regular ZIP | A | #893 |
| 08 | #901 immersive ZIP 3D | A | #903, #900 |
| 09 | #902 immersive ZIP flat | A | #901, #900 |
| 10 | #897 backend identity contract | B | — |
| 11 | #904 frontend attribution | B | #897 |
| 12 | #905 feeds/share metadata | B | #897 |
| 13 | #894 shell theme control verification | C | — |
| 14 | #896 shell motion control verification | C | #894 run |
| 15 | #886 audio delivery decision (→ #847) | D | owner |
| 16 | #906 production record reconciliation | D | owner authorization |
| 17 | #874 close | D | owner confirms scope shift |
| 18 | #892 parent close | A | children terminal |
| 19 | #895 parent close | A | #903 #901 #902 |

Reference audit finding (2026-09-26): the parity issues were first scoped from the repo's own matrix; direct reading of `../augment-humankind` and `../augment-humankind-react-node` shows gaps not covered by #892-#907 (immersive toolbar contents, page-level embed actions, structured-piece routes, private/owner views) and a conflict on arrow pad / 3D-only gating. #900 and #908 own these.
Duplicates: none found between new issues; #891 (closed) already covers #892's regular-placement criterion.

## Stream E — microphone parity with `augment-humankind` (added 2026-09-26)

Reference for this stream is the PHP repo only. Findings: generated-piece live mic (regular, immersive, embed, ZIP) is a permission-only stub with no audio routing; no seven-effect chain anywhere; capture path differs from the reference (second `Tone.UserMedia` capture, no iOS recovery); tests prove status text, not audio.

| Q | Issue | Waits for |
| --- | --- | --- |
| 20 | #909 engine capture contract | — |
| 21 | #916 audio-flow harness + matrix + hardware checklist | #909 |
| 22 | #910 effects chain (engine) | #909 |
| 23 | #911 regular/embed generated pieces | #909 #910 #916 |
| 24 | #912 immersive/embed generated pieces | #911 |
| 25 | #913 structured 2D/3D live | #909 #910 |
| 26 | #914 generated-piece ZIPs | #910 |
| 27 | #915 structured 3D ZIP effects | #910 |

react-node counterparts: see the issues filed in `cfornesa/augment-humankind-react-node` (listed in the session summary).
