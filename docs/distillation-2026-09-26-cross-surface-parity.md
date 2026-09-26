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

## Reconciliation refresh — 2026-09-26 continuation

| Item | Disposition | Routing / owner | Evidence boundary and next action |
| --- | --- | --- | --- |
| #893 | Closed historical transaction | 2a / Codex substitution | QA PASS comment and local Compose/Chromium evidence; do not reopen. |
| #904 | Closed historical transaction | 2a / Codex substitution | Public surface matrix passed 2/2 after making the flat-engine `Gallery artwork` expectation explicit; no production claim. |
| #903 | Closed, QA PASS | 2a / Codex substitution | Source fix `8dd1954`; rebuilt Compose evidence passed; QA comment `5847461712`; no production claim. |
| #901 | Closed, QA PASS | 2a / Codex substitution | Immersive generated ZIP contract passed; QA comment `5847477905`; no production claim. |
| #902 | Closed, QA PASS | 2a / Codex substitution | Flat immersive ZIPs now use gallery presentation; native 3D retains navigation; desktop/mobile screenshots inspected; QA comment `5847703987`; no production claim. |
| #858–#861 | Independent verification queue | Chrome / Codex | Use active Chrome and local disposable fixtures; failures become new criterion-ready issues only after duplicate search. |
| #906/#788 | Owner-authorized production data actions | Owner-gated | Execute only with the previously documented snapshot/dry-run/production-shell safeguards; no local evidence substitutes for production. |
| #886/#847 | Owner decision / dependent | Owner | No implementation inferred; retain as pending decision. |
| #916→#915/#914–#911 | Dependency chain | Mechanical/complex as scoped | #916 remains partial; do not start downstream microphone routing until its harness contract is terminal. |

Duplicate audit: no new issue created. The stale generated-bundle observation
was reconciled by #903; #901/#902 are existing children and are now terminal.
The next closure-ready issue selected for the backlog loop is #858, with
#859–#861 following its explicit engine-fixture dependency order. #858 has a
fresh QA FAIL comment and remains open; do not claim the parent tree complete.

## #858 transaction refresh — 2026-09-26

The active Chrome workflow reached `VALID WITH GAPS`: editor/public/immersive
Three.js views rendered at the required desktop/mobile sizes; authored
major/C/90/Synth defaults persisted; Sound reached `running`; and 120/minor
then Reset restored 90/major. The required first-eight ambient notes and
`a s d f g h j k` pitch sequence could not be captured because the public
runtime exposes no supported inspectable telemetry hook. Duplicate audit found
no existing issue for that audio observability gap, so #918 was created and
linked from the QA FAIL comment. #858 remains open; #859–#861 stay blocked.

## #918 transaction refresh — 2026-09-26

#918 is the distilled observability gap from #858. The implementation commit
`a62313c` emits non-persistent `augmentrart:sonic-note` browser events for
ambient and keyboard notes. Focused checks and the full repository check pass,
but exact first-eight and A–K sequence capture remains open because the active
Chrome/CDP bridge did not provide a same-world page evaluator. Keep #918 open
until a real Playwright/Chrome harness captures the events, then unblock the
#858 verification chain. This is local disposable Compose evidence only; no
production claim or production data action is authorized by this transaction.

## #916 transaction refresh — 2026-09-26

#916 was verify-first: its reusable audio-flow helper, hardware checklist, and
memory boundary were already present in `ef302dc`. A disposable Compose
Chromium run exposed a real downstream gap rather than a false QA failure:
the generated regular viewer reports microphone permission as active but makes
zero native source connections. Existing downstream #911 owns that routing
implementation. Stale browser selectors were reconciled in `91d1779`; #916
remains open with QA FAIL / VALID WITH GAPS until routing and the six-case
matrix can be rerun. Comment: `5848259211`.

## #918 transaction refresh — 2026-09-26

#918 is terminal CLOSED / QA PASS. The same-world Playwright contract captured
the first eight ambient events and the exact C4–C5 A–K sequence at major/C/90.
Its first run exposed and corrected a real white-key indexing defect in the
telemetry resolver. The issue is local-only and does not establish production
sound evidence. #858 is now the next independent/dependency-unblocked
verification transaction; #911 remains blocked by #916.

## #858 transaction refresh — 2026-09-26

Active Chrome resumed #858 after #918 closed. A new disposable generator flow
saved a Three.js fixture with sound/keyboard/fullscreen capabilities. The
regular route exposed the shared controls, a real sound gesture changed the
control to pressed mute, fullscreen entered and exited on the same route, and
the 375x667 viewport was exercised then reset. This does not replace the
required hand-authored source-editor fixture, fixture-specific ambient/A–K
trace, or decoded motion percentage. QA comment: `5848508644`; #858 remains
open and #859–#861 remain blocked. Local Compose/Chrome only; no production
claim.

## Stream F — AI layer targeting and media-asset tests (added 2026-09-26)

Finding: no open issue and no issue closed in the prior 24 hours covers either test. Older closed work (#661 #662 #663 #813 #815 #819 #821) built the typeahead, scope enforcement and an offline corpus; browser coverage is UI-only (`aiMention2d`) or fake-provider on an AI-created piece (`aiAgent2d`). The media-asset-as-layer feature does not exist: the AI backend has no awareness of `mediaAssetId`, and `aiTargeting.ts` offers only assets already placed in the scene.

| Q | Issue | Waits for |
| --- | --- | --- |
| 28 | #920 existing structured 2D piece: layer-only AI edit test | — |
| 29 | #921 existing generated piece: region/ink/element edit test | #920 |
| 30 | #922 AI contract: media asset as new image layer | — |
| 31 | #923 editor: full library in @ list + insert as layer | #922 |
| 32 | #924 new-piece asset test | #923 |
| 33 | #925 existing-piece asset test | #924 |
| 34 | #926 live-model demonstration in Chrome (bounded runs) | #920 #924 #925 |

### Follow-ups distilled during #920 active-Chrome QA (2026-09-26)

The live Chrome check confirmed target selection, but did not erase two
evidence/contract gaps: the required Playwright Chromium process cannot launch
on this macOS host, and the fixture wording asks for multiple shapes per layer
even though the canonical scene contract gives each shape its own layer. The
user also reported a visible separator problem in target labels and a semantic
mismatch between the Sky/Hills/Sun fixture names and its generic rectangles.
Duplicate audits found no existing owners, so these gaps were captured as new
issues rather than folded into #920.

| Q | Issue | Waits for |
| --- | --- | --- |
| 54 | #947 approved Playwright-capable Chromium path for macOS E2E | #920 |
| 55 | #948 reconcile #920 fixture with one-shape-per-layer contract | #920 |
| 56 | #949 target suggestion/chip name-kind spacing | — |
| 57 | #950 structured 2D background semantics and meaningful QA fixtures | #948 |
| 58 | #951 editor shell toolbar/control placement and responsive tools access | #920 |
| 59 | #952 Canvas color-picker affordance and mobile heading legibility | — |

## Stream G — local-first storage, sync, and public transfer (added 2026-09-26)

Owner decisions: local-first default with opt-in sync (account-level toggle plus per-piece choice); public pieces and their media must live in PostgreSQL; warnings and secure transfer for sync and publish; existing pieces stay synced and a Codex-written, owner-run script makes free accounts' pieces public and enables account sync for admin/paid; unpublish follows retention; no hard-coded size cap; existing local pieces offered for upload; per-piece ZIP export/import and account export stay functional.

| Q | Issue | Waits for |
| --- | --- | --- |
| 35 | #928 contract (docs) | — |
| 36 | #929 version-tagged visitor-local storage | — |
| 37 | #930 portable piece package v1 | #928 |
| 38 | #931 plan quotas, estimate, usage report | #928 |
| 39 | #932 hardened server package intake | #930 #931 |
| 40 | #933 local repository v5 (3D, generated) | #928 #930 |
| 41 | #934 local-first create (2D) | #933 |
| 42 | #935 per-piece export | #930 #934 |
| 43 | #936 per-piece import | #935 #933 |
| 44 | #937 local-first 3D | #933 #934 #936 |
| 45 | #938 local-first generated | #937 |
| 46 | #939 off-browser transfer disclosure | #938 |
| 47 | #940 account-level sync setting | #939 #932 |
| 48 | #941 public media delivery (resolves #886) | #932 |
| 49 | #942 publish as transfer | #941 |
| 50 | #943 upload offer for existing local pieces | #940 #932 #931 #934 |
| 51 | #944 unpublish retention | #942 |
| 52 | #945 account data export ZIP | #935 #936 |
| 53 | #946 one-time script (owner-run) | #940 #942 #931, site sync on |

Known gaps recorded rather than hidden: cloud backup covers only 2D today (3D and generated have no sync path until #932); public media has no server home until #941; the signup consent (#524) is inert until #940.
