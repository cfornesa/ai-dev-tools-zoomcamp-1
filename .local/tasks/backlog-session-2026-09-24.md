# Backlog session 2026-09-24 (this repo only; react-node owned by another agent)

Orchestrator: backlog-session / Claude Sonnet 5 (default profile) / not substituted.
Stage provenance default for this session (flagged per issue as run): scoping = Claude Sonnet 5 (substituted for Codex, at distillation); implementation = Claude Sonnet 5 (substituted for Opencode Go/Ollama Cloud); second-opinion (stage 3) = NOT RUN (no independent family); QA = Claude Sonnet 5 Medium (rostered); readiness gate = Claude (rostered tier) at session end.

## Ledger
| Issue | Status | Commit | Focused/full checks | QA | GitHub | Boundary |
|---|---|---|---|---|---|---|
| #765 | CLOSED | 145fbce | prettier check on doc | PASS (doc criteria; cross-repo posting shifted out of scope) | closed | doc only |
| #761 | CLOSED | a8a9ede | vitest export 192; make frontend-* 2826 tests; playwright exportArtifacts 10 | PASS | closed | local only; deployed under #748 |
| #762 | CLOSED | 43a014f | make check pass | PASS | closed | local; deploy under #748 |
| #763 | CLOSED | e73fb6a | make check; piece2dFill compose | PASS | closed | local; prod data #788 |
| #764 | CLOSED | 26cdf02 | vitest generative; playwright c2ZipCanvas764 | PASS | closed | local |
| #752 | CLOSED | 19e6b9f | vitest 284; playwright embedToolbarOrder, sixEngineEmbed, publicDraw | PASS | closed | local |
| #753 | CLOSED | 4a08d02 | vitest; playwright immersiveArtPieceToolset | PASS | closed | local |
| #754 | CLOSED | ae9769e | playwright immersiveEmbedFraming, embedToolbarOrder, sixEngineImmersive | PASS | closed | local; real-camera under #748 |
| #766 | CLOSED | d98bb13 | vitest 141; playwright regularToolbarMatrix + toolset specs | PASS | closed | local |
| #767 | CLOSED | 511ae34 | vitest 223; playwright regularToolbar3d767, public3dCameraOverlay728 | PASS | closed | local; drift specs to #769 |
| #768 | CLOSED | 65a784a | playwright regularToolbar2d768 | PASS | closed | local |
| #769 | CLOSED | 2758bab | playwright immersive3dToolbar769 | PASS | closed | local; drift #789 |
| #773 | CLOSED | d8faf86 | playwright privatePieceToolbar773 | PASS | closed | local; follow-up #790 |

**Cluster gate (toolbar/ZIP-canvas, #752-#754,#761-#764,#766-#769,#773):** `make check`: backend green; frontend 2826/2828, two load-only timing flakes (App.embedRoute, useDraftAutosave) pass alone (3 files/21 tests); filed as a workflow defect (issue below).
| #755 | CLOSED | 35da890 | vitest 247; playwright zip specs | PASS | closed | local |
| #756 | CLOSED | 35da890 | same | PASS | closed | local |
| #757 | CLOSED | afdc93c | vitest 246; playwright artPieceZipDrawing757 | PASS | closed | local |
| #758 | CLOSED | afdc93c | same | PASS | closed | local |
| #760 | CLOSED | 38829df | vitest 54; playwright c2ZipRuntime760 + zip specs | PASS | closed | local |
| #770 | CLOSED | 38c4ef2 | backend full (1538); vitest 275 | PASS | closed | local; no migration |
| #771 | CLOSED | de85f37 | backend focused 195; vitest 37 | PASS | closed | local |
| #772 | CLOSED | c43029c | vitest 99; playwright aframeStructured772 | PASS | closed | local |
| #778 | CLOSED | 2d635c3 | backend 66; vitest 118 | PASS | closed | local; no migration |
| #779 | CLOSED | 99f07a5 | vitest 170; playwright drawingPlane3d threejs | PASS | closed | local |
| #780 | CLOSED | 5ec915a | vitest 9; playwright drawingPlane3d aframe | PASS | closed | local |
| #783 | CLOSED | afc6636 | vitest; playwright objectAnimation3d 4 | PASS | closed | local; no migration |
| #775 | CLOSED | 5c9b6c0 | vitest 2896 (1 load flake, rerun green); playwright inkLayer2d 2 | PASS | closed | local; no migration |
| #776 | CLOSED | ce0cce4 | backend full 1573; vitest 2903; playwright inkLayerGenerated2d 6 + inkLayer2d 2 | PASS | closed | local; no migration; follow-ups #793 #794 |
| #781 | CLOSED | c5e893f, f336cf4 | vitest 2904; playwright drawingPlaneDraw3d 2 + 3D regression 7 | PASS | closed | local; no migration; follow-up #795 |
| #782 | CLOSED | 6d6e17a | vitest 2922; playwright drawingPlaneTransform782 2 + 3D regression 9 | PASS | closed | local; no migration; follow-up #796 |
| #784 | CLOSED | 4afc213 | backend full 1597; vitest 2922; playwright aiDrawingPlane784 4 + 3D regression 8 | PASS | closed | local; no migration |
| #785 | CLOSED | f6e2e9e | playwright drawingPlaneViewers785 4 (both engines) + drawingPlane3d + objectAnimation3d | PASS | closed | local |
| #786 | CLOSED | f6e2e9e | playwright drawingPlaneViewers785 immersive (both engines) | PASS | closed | local |
| #787 | CLOSED | 71885a5 | vitest 2924 (1 known #791 flake); playwright drawingPlaneZip787 4 + ZIP regression 18 | PASS | closed | local; no migration; follow-up #797 |
| #790 | CLOSED | 9c58b4f | backend canonical/public 22+; vitest CanonicalPublicPiece; playwright privatePieceToolbar773 (#790) | PASS | closed | local; no migration |
| #794 | CLOSED | 87722e0, b2dcdb7 | vitest; playwright inkLayerGenerated2d 6 (thumbnail + SVG ZIP screenshot) + zip regression | PASS | closed | local |
| #795 | CLOSED | 06c6e3a | playwright manual3dStageChrome + manual3dOutlineSelection + cameraPreview3d 3 pass | PASS | closed | test-only |
| #793 | CLOSED | 21a9d2a | playwright artPieceEmbed 3 + artPieceOwnerEditing 5 + artPiece2dEditor 1 + livePreview 1 pass | PASS | closed | test-only |
| #797 | CLOSED | 6ea276f | playwright public3dCameraPlacement742 1 pass (also exercises the generated 3D ZIP variants) | PASS | closed | test-only |
| #792 | CLOSED | 393c728 | playwright artPieceFlatSpatial 4 pass | PASS | closed | test-only |
| #789 | CLOSED | bd8df15 | playwright public3dImmersiveCameraOverlay734 + public3dRouteStageChrome pass; toolbar matrix specs 8 pass | PASS | closed | test repair + 1 CSS fix |
| #791 | CLOSED | 13e44c9 | 3 consecutive full vitest runs green (2958 tests, 179s/172s/190s) | PASS | closed | test hygiene |
| #796 | CLOSED | c23882b | vitest 2963; playwright drawingPlaneAframe796 2 + 3D regression 9 | PASS | closed | local |
| #749 | CLOSED | b39eaa2 | playwright publishingAndRemix 13, responsiveShell 3, drawioPublicSurfaces 1, aiAndRecovery 7 all pass; vitest PublicProjectViewer 44 | PASS | closed | 1 product fix + test repairs |
| #750 | CLOSED | a17724d | backend full 1613; vitest 2965; playwright pieceSlugEdit750 2 | PASS | closed | local; no migration |
| #747 | CLOSED / QA PASS / production verified | d87b711, 16ceca5 | `make check`; published smoke; live view-source metadata | PASS | closed | production release verified at augmentrart.com; metadata backend forwarding confirmed; QA comment 5822183321803 |
| #748 | BLOCKED | — | local checks green; required live Chrome matrix not completed in this handoff | FAIL/INCOMPLETE | open | requires live 1280x900 and 375x812 inspection of toolbar, routes, ZIP, ink, drawing planes, slug, and private-owner view |
| #788 | QA FAIL / production blocked | 652c36ed production release; no source-update commit | rehearsal + one authorized production run + post-run live API/Chrome inspection + cleanup smoke | FAIL | open | production command ran exactly once; source rows stayed version 1 with old fixed-coordinate sources; no second run authorized |
| #798 | IMPLEMENTED / QA FAIL environment boundary | ef3d718 | focused Layout/Cosmic 21 passed; typecheck/lint/format pass; four required Playwright tests fail before launch at macOS Mach-port boundary | FAIL (browser evidence unavailable) | open | reduced-motion, low-power, and theme-token behavior implemented; signed-in Chrome and Compose still serve pre-commit bundle; QA comment 5822506902 |
| #799 | BLOCKED / dependent | — | not implemented in this transaction | not run | open | 2D runtime template parity |
| #800 | BLOCKED / dependent | — | not implemented in this transaction | not run | open | 3D runtime template parity |
| #801 | BLOCKED / dependent | — | not implemented in this transaction | not run | open | all-engine ready/error runtime template |
| #802 | BLOCKED / dependent | — | not implemented in this transaction | not run | open | 2D regular/immersive/embed presentation identity |
| #803 | IMPLEMENTED / QA FAIL environment boundary | 793f0e8, dcbdeb0, 5e65fcf, bc5cdcf | focused immersive/camera tests 15 passed; frontend 276 files / 2971 tests; full backend 1624 / 39 skipped; typecheck/lint/format pass; required Playwright Chromium launch blocked by macOS Mach-port permission | FAIL (production/browser evidence boundary) | open | local fix now restores above-stage identity, responsive 16:9 framing, and shared 32px/24px spacing; deployed revision remains old/unpublished; QA refresh comment 5823290653 |
| #804 | BLOCKED / dependent | — | not implemented in this transaction | not run | open | collection parity matrix and presentation gaps |
| #805 | BLOCKED / dependent | — | not implemented in this transaction | not run | open | profile/personalization parity matrix |
| #806 | BLOCKED / dependent | — | not implemented in this transaction | not run | open | production verification depends on #798–#803 and owner-gated live evidence |
| #807 | IMPLEMENTED / QA FAIL environment boundary | d0819d0 | focused Vitest/Layout 20 passed; `make check` backend 1615 passed / frontend 276 files 2969 tests; Compose preflight PASS; Chromium E2E blocked by macOS Mach-port launch permission | FAIL (browser evidence unavailable) | open | first-party CSS/React star field, bounded 90 nodes, cosmic-only rendering, E2E spec added; needs real browser runner screenshots and animation delta |
| #808 | CLOSED / QA PASS | 47d7827 | focused importer 9 passed; `make check` backend 1615 passed / frontend 276 files 2968 tests | PASS | closed | local-only reconciliation fix; production re-import intentionally not run; QA comment 5822184052 |
| #810 | CLOSED / QA PASS | 8e34e85 | shared provider prompts 30 passed; full backend 1619 passed / 39 skipped; mypy and ruff pass | PASS | closed | 3D create/edit/convert prompts are shared across Mistral/Gemini/DeepSeek; Gemini drawing-plane validation/proportionalization parity covered; QA comment 5822745870 |
| #812 | CLOSED / QA PASS | d53c7a0 | focused patch/API 101 passed; full backend 1622 passed / 39 skipped; frontend 276 files / 2971 tests; mypy, ruff, typecheck, format pass | PASS | closed | explicit delete intent for 2D/3D whole-element removal/replacement; QA comment 5823039527 |
| #813 | CLOSED / QA PASS | 482a30b, 1ae4ef1 | focused AI-run 29 passed / 1 skipped; full backend 1624 passed / 39 skipped; frontend 276 files / 2971 tests; make check green after #803 assertion refresh | PASS | closed | persisted plan scope and apply-time targets/layer/scene/overhaul enforcement; QA comment 5823303248 |

## Production-readiness — 2026-09-24

- Repository quality: backend 1615 passed / 39 skipped; frontend 276 files / 2969 tests passed on the completed frontend run; lint, format, typecheck, and focused #803 tests pass. Two unrelated editor-workspace timeout tests passed when isolated after a later full-gate run encountered them.
- Published evidence: #747's production release and smoke are verified; #788's single authorized production import is recorded as failed/no-op for the two changed sources and was not repeated; #803's fix is not published.
- Browser evidence: owner Chrome was available and verified the live #748 3D regular/mobile/embed surfaces and reproduced #803's immersive layout gap. Playwright Chromium remains blocked before test execution by the macOS Mach-port launch failure.
- Readiness decision: NO-GO for this batch. #748, #788, #803, #807, and dependent #798–#806 remain open; no production publish is authorized for #803 in this session.

## Session-completion — 2026-09-24

- Distilled open inventory: 14 at start; duplicate audit found no new issue for the reported immersive layout because #803 already owns that contract.
- Terminal outcomes: 2 closed (#747, #808), 1 implemented but QA-failed on browser boundary (#803), 11 open/dependent or production-gated (#748, #788, #798–#802, #804–#807).
- Routing audit: Stage 2b #808 and stage 2a #803 used Codex/GPT-5 substitutions for rostered engineering; stage 4 used Codex/GPT-5 substitutions for rostered Claude QA; no second-opinion service ran. Stage 5 readiness and completion were performed as documented Codex substitutions because the rostered service was unavailable.
- Follow-up audit: #803's user-reported layout gap is linked to the existing issue; no duplicate was created. Remaining open work and evidence boundaries are preserved in the issue list and this ledger.

## Distillation refresh — 2026-09-24 continuation

The authoritative GitHub open inventory also includes #809–#821, which were
created by the prior AI-provider/prompt distillation and were absent from the
earlier compact table. No duplicate was found: each has a distinct provider,
AI contract, generated-piece, or admin capability boundary. The dependency
order is:

1. #798 after #807 (star-field behavior hardening).
2. #809 and #810 (shared 2D/3D vendor prompts), then #811 (vendor-neutral
   generated-piece calls); #812 and #813 are independent AI safety contracts.
3. #815 is a quality/replay contract over the shared prompts; #817 precedes
   #816 because the catalog capability field is its prerequisite.
4. #818 precedes #819, which precedes #820 and #821; #812 also informs #820's
   delete-intent rule.
5. #799–#805 remain route/matrix work; #806 is the final published gate.

| Issue | Routing | Dependency/blocker | Closure boundary / next action |
|---|---|---|---|
| #809 | 2b | independent | shared 2D prompts and byte-identical provider tests |
| #810 | 2b | independent | shared 3D/drawing-plane prompts and fake Gemini validation |
| #811 | 2b | depends #809/#810 | six-library generate/refine vendor matrix |
| #812 | 2b | independent | explicit-delete patch authorization |
| #813 | 2b | independent | plan-declared scope enforcement |
| #815 | 2b | depends shared prompt work | offline corpus and preservation replay |
| #816 | 2b | depends #817 | vendor-neutral structured-output repair |
| #817 | 2b | migration-bearing | native_schema catalog capability |
| #818 | 2b | independent | marker prompts and pure region parser |
| #819 | 2b | depends #818 | bounded owner-scoped refine mentions |
| #820 | 2b | depends #819/#812 | preservation and delete-intent enforcement |
| #821 | 2a | depends #819/#818 | generated-piece refine typeahead |

### #809 transaction

- Groom: criterion-ready Stage 2b prompt-source/provider contract; no duplicate.
- Engineering: Codex / GPT-5 / current session substituted for Ollama Cloud
  Kimi K3; commit `74f6670` centralizes the 2D create/refine prompts in
  `backend/ai_provider/prompts.py` and adds focused tests.
- QA self-review: Codex / GPT-5 / current session substituted for Claude
  Sonnet 5; focused tests and provider/AI subset pass, but the current code
  has no Gemini/DeepSeek generated-art transport. That missing matrix is
  explicitly shifted to #811, so #809 is terminal QA FAIL and remains open.
- Reconciliation: QA comment `5822557535`; no closure because one acceptance
  criterion is not met.

### #798 transaction

- Groom: criterion-ready Stage 2b behavior-hardening issue after #807; no
  duplicate. Its closure requires reduced-motion, low-power, and theme-token
  behavior plus real-browser evidence.
- Engineering: Codex / GPT-5 / current session substituted for Ollama Cloud
  Kimi K3; commit `ef3d718` adds the low-power root marker, motion suppression,
  and cosmic theme tokens with focused regression coverage.
- QA self-review: Codex / GPT-5 / current session substituted for Claude
  Sonnet 5; 21 focused tests, typecheck, lint, and format checks pass. The
  required four-test Playwright command fails before execution at macOS's
  Chromium Mach-port permission boundary. Signed-in Chrome confirms production
  and Compose still serve the pre-`ef3d718` bundle, so local evidence cannot
  close the deployed criterion.
- Reconciliation: QA comment `5822506902`; terminal QA FAIL/open. No publish
  was performed because production authorization covers #747, #748, and #788,
  not this release.

### #810 transaction

- Groom: criterion-ready Stage 2b shared-provider contract after #809; no
  duplicate. The issue has three finite backend acceptance criteria and no
  production/browser boundary.
- Engineering: Codex / GPT-5 / current session substituted for Ollama Cloud
  Kimi K3; commit `8e34e85` adds shared 3D create/edit/convert prompt text,
  routes all three providers through it, and aligns Gemini's 3D patch path
  with Mistral's drawing-plane proportionalization.
- QA self-review: Codex / GPT-5 / current session substituted for Claude
  Sonnet 5; focused 30-test provider set, full backend `1619 passed, 39
  skipped`, mypy, and ruff pass. New tests capture the actual outbound system
  prompt for each vendor and exercise a fake Gemini drawingPlane patch.
- Reconciliation: QA PASS was posted on issue #810 and the issue was closed;
  stage 3 independent-family review was not run. No new dependency, migration,
  route, secret, or public API change.

### #812 transaction

- Groom: criterion-ready Stage 2b safety contract, independent of #811; no
  duplicate. Its scope includes 2D/3D patch validators, API taxonomy/docs,
  and the React proposal error message.
- Engineering: Codex / GPT-5 / current session substituted for Ollama Cloud
  Kimi K3; commit `d53c7a0` adds explicit delete verbs plus exact name/id/
  ordinal matching, class-scoped bulk deletion, the new
  `delete_intent_required` error, and regression coverage.
- QA self-review: Codex / GPT-5 / current session substituted for Claude
  Sonnet 5; focused 101-test backend set, full backend 1622/39 skipped, full
  frontend 276 files/2971 tests, typecheck, format, ruff, and mypy pass.
- Reconciliation: QA PASS comment `5823039527`; issue #812 closed. Stage 3
  independent-family review was not run. No dependency, migration, route,
  secret, or production data action changed.

Next groomed issue: #811, the remaining prerequisite chain's provider
transport matrix; #813 is the next independent safety contract if #811 is
deferred.

## Production-readiness refresh — 2026-09-24 continuation

- Local deployment/quality: PASS. `UV_CACHE_DIR=/tmp/codex-final-uv-cache make
  check` passed GitHub Action pin checks, backend ruff/format/mypy and
  1619 backend tests with 39 skips, plus frontend lint/format/typecheck and
  276 Vitest files / 2970 tests. Existing lint warnings and jsdom notices did
  not fail the gate.
- Approved-browser verification: BLOCKED for unpublished #798/#803/#807 by
  Playwright Chromium's macOS Mach-port launch permission error. Signed-in
  Chrome remains available and confirmed the published/Compose bundles predate
  those commits; it cannot substitute for the required Playwright matrix.
- Production: NO-GO. #747 is production-verified; #788's one authorized
  import was a no-op for the changed sources; #803/#798/#807 are unpublished;
  #806 and the remaining parity issues are open. No additional publish or
  production data action was authorized.
- Current open inventory: 22 issues. #810 and #812 are closed with QA PASS;
  #811, #814–#821, #798/#799–#807, #748, and #788 remain open with their recorded
  next actions. No duplicate or silently omitted issue was found.

## Production-readiness refresh 2 — 2026-09-24

- Local quality: PASS after the #813 implementation and #803 spacing refresh;
  backend 1624 passed / 39 skipped, frontend 276 files / 2971 tests, and the
  repository lint/format/type checks passed. The full `make check` was rerun;
  one stale CSS assertion was updated to the intentional new responsive tokens,
  then the final frontend suite passed.
- Production/browser evidence: #803 remains NO-GO because Chrome still shows
  the prior published bundle and no publish is authorized for #803. Playwright
  Chromium remains blocked at launch by the macOS Mach-port permission error.
- Batch readiness: NO-GO. #748, #788, #803, #807, dependent #798–#806, and
  the remaining #811/#814–#821 backlog work remain open. #813 is terminal
  CLOSED/QA PASS with local-only evidence.

## Session-completion refresh 2 — 2026-09-24

- Terminal outcomes added: #813 CLOSED/QA PASS; #803 received a local spacing
  refresh but remains OPEN/QA FAIL at the production/browser evidence boundary.
- Duplicate audit: the renewed immersive-layout request maps to existing #803;
  no new issue was created.
- Follow-up audit: #803 needs an owner-authorized publish followed by the real
  browser matrix before closure. No production mutation was performed.

## Distillation refresh 3 — 2026-09-24

- The authenticated GitHub open inventory contains 21 issues: #748, #788,
  #798–#811 excluding closed #810, #814–#821, plus open #803 and #809. The
  earlier count of 22 was stale after #813 closed.
- Duplicate audit: the renewed immersive order/spacing report remains covered
  by open #803; no new issue was created. Fresh Chrome evidence confirms the
  deployed revision still predates the local fix.
- Production/browser boundary: Chrome is available and was used directly;
  the requested tab remained at 375x812 despite the extension viewport
  override, so this pass does not claim fresh desktop evidence. Playwright
  Chromium remains a separate host-launch boundary.
- Next groomed issue remains #811 (vendor-neutral generated-piece transport),
  with #814–#821 ordered after its dependency chain. #803/#748 remain
  production-gated and no unauthorized publish or production data action was
  performed.

## Session-completion refresh — 2026-09-24 continuation

- This is a partial backlog continuation, not a complete project run:
  #810 reached terminal CLOSED/QA PASS; #798/#809 remain QA FAIL/open; the
  remaining 23 open issues are explicitly handed forward rather than falsely
  closed.
- Routing: #810 stage 2b and stage 4 were Codex/GPT-5 substitutions for
  Ollama Kimi K3 and Claude Sonnet 5; stage 3 was not run. Readiness was a
  Codex/GPT-5 substitution under the owner authorization already recorded in
  the session decisions; no independent-family review was credited.
- Follow-up audit: #811 is the next dependency-ready implementation target;
  #812/#813 are independent safety contracts; #818–#821 retain their declared
  dependency order. Browser/production blockers remain linked to #748/#788,
  #798/#803/#807/#806. No new follow-up issue was created because each finding
  matched an existing open issue.

## #811 transaction — 2026-09-24 continuation

- Groom: criterion-ready Stage 2b vendor-neutral provider contract; no
  duplicate. Scope is generated art-piece generate/refine transport selection,
  owner-scoped credentials, active catalog capability gating, and backend
  regression coverage. Production rollout is out of scope.
- Engineering: Ollama Cloud / Kimi K3 / medium rostered; Codex / GPT-5 /
  medium substituted. Commit `c37c00f` adds Mistral/Gemini/DeepSeek transport
  selection, vendor/model request fields, catalog `art_piece` capability and
  seed migration limited to the five seeded models, selected-vendor credential
  isolation, Gemini scalar JSON-string normalization, API docs, and matrix
  tests.
- QA self-review: Claude / Sonnet 5 / medium rostered; Codex / GPT-5 / medium
  substituted. Stage 3 independent-family review not run. Intake
  ACCEPTED-WITH-FIXES: QA corrected and retested Gemini JSON-string handling.
  `UV_CACHE_DIR=/tmp/codex-final-uv-cache uv run pytest tests -k art_piece -q`
  passed 136 with 1554 deselected. `UV_CACHE_DIR=/tmp/codex-final-uv-cache
  make backend-check` passed Ruff, format, mypy, and 1651 tests with 39
  skips.
- Reconciliation: QA PASS comment
  `https://github.com/cfornesa/ai-dev-tools-zoomcamp-1/issues/811#issuecomment-5823540495`;
  issue #811 closed. Evidence is local automated only; no production
  provider calls, publish, or production database action was performed.

## Distillation refresh 4 — 2026-09-24 continuation

- #811 is terminal CLOSED/QA PASS. The authenticated open inventory is now
  20 issues: #748, #788, #798–#809 (with #810 and #811 closed), and #814–#821.
- Duplicate audit: no new issue emerged from #811 QA. Production/browser
  boundaries remain attached to existing #748/#788/#803/#807 work; no new
  issue was created.
- Next dependency-ready issue: #809, whose prior QA boundary should be
  rechecked now that #810 and #811 provider contracts are closed. The local
  vendor-neutral capability does not authorize production rollout.

## #809 transaction — 2026-09-24 continuation

- Groom: criterion-ready Stage 2b structured 2D prompt-source contract; prior
  QA failure was re-derived as a generated-art transport concern outside this
  issue and mapped to #811, now closed. No duplicate.
- Engineering: Ollama Cloud / Kimi K3 / medium rostered; Codex / GPT-5 /
  medium substituted. Commit `ead0312` moves the detailed 2D create/edit
  prompts into `backend/ai_provider/prompts.py`, routes Mistral, Gemini, and
  DeepSeek through the canonical constants, and adds an actual transport
  capture matrix.
- QA self-review: Claude / Sonnet 5 / medium rostered; Codex / GPT-5 / medium
  substituted. Stage 3 independent-family review not run. Focused matrix and
  3D regression checks passed 41 tests. The exact issue command
  `UV_CACHE_DIR=/tmp/codex-final-uv-cache uv run pytest tests -k 'provider or
  ai' -q` passed 585 with 13 skips. Full `make backend-check` passed Ruff,
  format, mypy, and 1652 tests with 39 skips.
- Reconciliation: QA PASS comment
  `https://github.com/cfornesa/ai-dev-tools-zoomcamp-1/issues/809#issuecomment-5823654751`;
  issue #809 closed. Evidence is local automated only; no production action.

## Distillation refresh 5 — 2026-09-24 continuation

- #809 and #811 are terminal CLOSED/QA PASS. The authenticated open inventory
  is now 19 issues: #748, #788, #798, #799, #800, #801, #802, #803, #804,
  #805, #806, #807, #808, and #814–#821.
- Duplicate/follow-up audit: no new actionable gap emerged from #809. Its
  earlier generated-art boundary is represented by closed #811; the remaining
  live immersive/browser and production work remains on existing issues.
- Next dependency-ready target: #808, then #814–#821 in dependency order.

## #817 transaction — 2026-09-24 continuation

- Groom: criterion-ready Stage 2b additive catalog capability contract; #814
  and #808 were already closed on authenticated inspection, so no duplicate
  work was absorbed. #817 is the prerequisite for #816.
- Engineering: Ollama Cloud / Kimi K3 / medium rostered; Codex / GPT-5 /
  medium substituted. Commit `6919593` adds additive `native_schema` defaulting
  true, migration `0093`, catalog service/API revision-aware round-trip,
  `docs/api.md`, typed admin API fields, and labelled create/edit UI checkboxes.
- QA self-review: Claude / Sonnet 5 / medium rostered; Codex / GPT-5 / medium
  substituted. Stage 3 independent-family review not run. Catalog tests: 25
  passed. AdminSettings: 4 passed. Final frontend: 276 files / 2972 tests,
  lint, format, and typecheck passed. Final backend/full repository gate:
  1652 passed / 39 skipped; `makemigrations --check --dry-run` reported no
  changes.
- Reconciliation: QA PASS comment
  `https://github.com/cfornesa/ai-dev-tools-zoomcamp-1/issues/817#issuecomment-5823874711`;
  issue #817 closed. Evidence is local automated only; migration-bearing
  production verification remains a separate owner-authorized release step.

## Distillation refresh 6 — 2026-09-24 continuation

- Terminal closures since refresh 5: #809 and #817 CLOSED/QA PASS. Authenticated
  open inventory is now 17 issues: #748, #788, #798–#807, and #815, #816,
  #818–#821.
- Dependency audit: #816 is now dependency-ready after #817 and is the next
  implementation target. #818 precedes #819, which precedes #820/#821.
- Production audit: #803/#806/#807 remain production/browser gated; no
  unauthorized publish or schema/data action was performed.

## Distillation refresh 7 — 2026-09-24 continuation

- Current authoritative GitHub open inventory is 17 issues: #748, #788,
  #798–#807, #815, #816, and #818–#821. #808, #809, #810, #811, #812,
  #813, #814, and #817 are closed and remain immutable history.
- Duplicate audit: the owner’s renewed immersive layout report remains the
  existing #803 production/browser contract; no duplicate issue was created.
  Chrome is confirmed running with the production piece tab and Replit tab
  available. The prior browser limitation was viewport/Playwright evidence,
  not Chrome absence.
- Dependency/order rationale: #817 is CLOSED, so #816 (native-schema-aware
  structured extraction/repair) is the next dependency-ready implementation.
  #818 then precedes #819, which precedes #820 and #821. #815 is independent
  but its replay fixtures should follow the provider capability work.
- Blocker triage: #748/#788/#803/#806/#807 require production or browser
  evidence; #798–#802 and #799–#801 are dependent release/browser work. The
  owner authorization currently covers only #747/#748/#788, not publishing
  #803/#798/#807 or running other production writes. No new follow-up issue is
  needed; each blocker has an existing issue and concrete next action.

## #816 transaction — 2026-09-24 continuation

- Groom: criterion-ready Stage 2b vendor-neutral structured-output contract;
  #817 was the completed additive catalog prerequisite. No duplicate or new
  follow-up was needed.
- Engineering: Ollama Cloud / Kimi K3 / medium rostered; Codex / GPT-5 /
  medium substituted. Commit `25f2a63` adds fenced/prose JSON extraction,
  one bounded repair callback with attempt accounting, catalog capability
  routing, and non-native handling across Gemini, DeepSeek, and Mistral.
- QA self-review: Claude / Sonnet 5 / medium rostered; Codex / GPT-5 / medium
  substituted. Stage 3 independent-family review not run. QA intake returned
  the first diff to engineering for two scoped fixes (DeepSeek still forcing
  JSON mode; Mistral 3D conversion using strict parsing), then re-entered QA.
  Focused provider matrix passed 61 tests. Final `make check` passed: backend
  1658 passed / 39 skipped; frontend 276 files / 2972 tests.
- Reconciliation: QA PASS comment
  `https://github.com/cfornesa/ai-dev-tools-zoomcamp-1/issues/816#issuecomment-5824092639`;
  issue #816 closed. Evidence is local automated only; no production action.

## Distillation refresh 8 — 2026-09-24 continuation

- #816 is terminal CLOSED/QA PASS. The authenticated open inventory is 17
  issues: #748, #788, #798–#807, #815, and #818–#821.
- Duplicate/follow-up audit: #816 QA found no new actionable issue; the two
  implementation defects were in-scope and fixed before closure. The renewed
  immersive presentation report remains existing #803, not a duplicate.
- Dependency/order rationale: #818 is the next dependency-ready AI issue,
  followed by #819, then #820/#821; #815 is independent. Production/browser
  boundaries remain on #748/#788/#803/#806/#807. No unauthorized publish or
  production data action is planned.

## #818 transaction — 2026-09-24 continuation

- Groom: criterion-ready Stage 2b generated-art prompt/parser contract. The
  public response addition was documented in `docs/api.md` before code edits;
  no duplicate or out-of-scope refine work was absorbed.
- Engineering: Ollama Cloud / Kimi K3 / medium rostered; Codex / GPT-5 /
  medium substituted. Commit `034e447` adds per-library marker instructions,
  pure ordered region parsing, additive response metadata, and tests.
- QA self-review: Claude / Sonnet 5 / medium rostered; Codex / GPT-5 / medium
  substituted. Stage 3 independent-family review not run. QA initially found
  a prompt-registry import defect during focused intake; engineering corrected
  it before the issue commit. Focused tests passed 57; `make backend-check`
  passed with 1668 tests / 39 skips.
- Reconciliation: QA PASS comment
  `https://github.com/cfornesa/ai-dev-tools-zoomcamp-1/issues/818#issuecomment-5824189357`;
  issue #818 closed. Evidence is local automated only; no production action.

## Distillation refresh 9 — 2026-09-24 continuation

- #818 is terminal CLOSED/QA PASS. The authenticated open inventory is 16
  issues: #748, #788, #798–#807, #815, and #819–#821.
- Duplicate/follow-up audit: no new issue emerged from #818 QA. Marker
  warnings are intentionally non-blocking and refine/@ targeting remain the
  existing #819+ contracts.
- Dependency/order rationale: #819 is the next dependency-ready issue,
  followed by #820/#821; #815 remains independent. Production/browser work
  stays on #748/#788/#803/#806/#807 with no unauthorized rollout.

## #819 transaction — 2026-09-24 continuation

- Groom: criterion-ready Stage 2b refine mention-resolution contract; #818
  supplied the region parser prerequisite. Preservation enforcement remains
  explicitly shifted to #820, with no new issue needed.
- Engineering: Ollama Cloud / Kimi K3 / medium rostered; Codex / GPT-5 /
  medium substituted. Commit `371b0a7` adds bounded mention validation,
  owner-local resolution for ink/assets/SVG elements/regions, structured prompt
  targeting, and 422 preflight failure behavior.
- QA self-review: Claude / Sonnet 5 / medium rostered; Codex / GPT-5 / medium
  substituted. Stage 3 independent-family review not run. QA found and fixed
  two in-scope defects before final verification: unresolved mentions created a
  run before failing, and mypy required local current-version narrowing.
  Focused refine tests passed 7; `pytest tests -k art_piece` passed 148;
  `make backend-check` passed 1670 tests / 39 skips.
- Reconciliation: QA PASS comment
  `https://github.com/cfornesa/ai-dev-tools-zoomcamp-1/issues/819#issuecomment-5824253548`;
  issue #819 closed. Evidence is local automated only; no production action.

## Distillation refresh 10 — 2026-09-24 continuation

- #819 is terminal CLOSED/QA PASS. The authenticated open inventory is 15
  issues: #748, #788, #798–#807, #815, and #820–#821.
- Duplicate/follow-up audit: no new issue emerged from #819; preservation is
  correctly deferred to #820 and frontend typeahead is out of scope.
- Dependency/order rationale: #820 is next and #821 follows it; #815 remains
  independent. Production/browser work remains authorization-gated on
  #748/#788/#803/#806/#807.

## #820 transaction — 2026-09-24 continuation

- Groom: criterion-ready Stage 2b preservation contract; #819 is closed and
  supplied mention resolution. Frontend and marker generation remain out of
  scope; no duplicate or new follow-up was needed.
- Engineering: Ollama Cloud / Kimi K3 / medium rostered; Codex / GPT-5 /
  medium substituted. Commit `1c615eb` adds post-edit named-region/element
  comparison, explicit deletion-intent handling, broad-edit support without
  silent removals, and six-engine regression coverage.
- QA self-review: Claude / Sonnet 5 / medium rostered; Codex / GPT-5 / medium
  substituted. Stage 3 independent-family review not run. QA corrected final
  region wrapper-span handling and expanded the engine-family matrix before
  final verification. Focused refine tests passed 15; `pytest tests -k
  art_piece` passed 156; `make backend-check` passed 1678 tests / 39 skips.
- Reconciliation: QA PASS comment
  `https://github.com/cfornesa/ai-dev-tools-zoomcamp-1/issues/820#issuecomment-5824317795`;
  issue #820 closed. Evidence is local automated only; no production action.

## Distillation refresh 11 — 2026-09-24 continuation

- #820 is terminal CLOSED/QA PASS. The authenticated open inventory is 14
  issues: #748, #788, #798–#807, #815, and #821.
- Duplicate/follow-up audit: no new issue emerged from #820; broad edits,
  delete intent, and preservation are covered in the existing contract.
- Dependency/order rationale: #821 is the next dependency-ready issue; #815
  remains independent. Production/browser work remains authorization-gated on
  #748/#788/#803/#806/#807.

## #821 transaction — 2026-09-24 continuation

- Groom: criterion-ready Stage 2a frontend issue; #818/#819/#820 provide the
  region parser, mention contract, and preservation gate. No duplicate or
  newly discovered issue was created.
- Engineering: Opencode Go / Kimi K3 / medium rostered; Codex / GPT-5 /
  medium substituted. Commit `e848834` adds typed mention payloads, ink/asset/
  SVG-element/region discovery, and kind badges; commit `cd4ab57` adds the
  focused Playwright region scenario and corrects its disposable fixtures.
- QA self-review: Claude / Sonnet 5 / medium rostered; Codex / GPT-5 / medium
  substituted. Stage 3 independent-family review not run. Vitest focused
  tests passed (6), typecheck and lint passed with existing warnings. The
  Chromium run passed both existing 1280x900 and 375x812 scenarios, but the
  new region scenario received `No matches` from the already-running Compose
  frontend revision even though the API returned the labelled source; this is
  a stale-stack verification boundary, not a product verdict.
- Reconciliation update: the disposable Compose stack was rebuilt from the
  current checkout. The focused Chromium run passed all 3 scenarios, including
  both viewport cases and the labelled-region preservation case; screenshots
  were inspected. QA found and fixed the legacy Canvas `@augmentr-part`
  compatibility defect in commit `4562bc2` before the final pass.
- Final reconciliation: QA PASS comment
  `https://github.com/cfornesa/ai-dev-tools-zoomcamp-1/issues/821#issuecomment-5824611634`;
  issue #821 is CLOSED. No production action was taken.

## Distillation refresh 12 — 2026-09-24 continuation

- #821 is terminal CLOSED/QA PASS. Authenticated open inventory is 13
  issues: #748, #788, #798–#807, and #815.
- Duplicate/follow-up audit: the stale Compose revision produced no new issue;
  the only product defect found was in-scope legacy-part compatibility and was
  fixed before closure. No closed issue was reopened.
- Dependency/order rationale: #815 is independent and next for local
  implementation; production/browser issues remain authorization-gated on
  #748/#788/#803/#806/#807.

## Production-readiness — 2026-09-24 continuation

- Local deployment: PASS for the current checkout. `UV_CACHE_DIR=/tmp/codex-final-uv-cache NPM_CONFIG_CACHE=/tmp/codex-npm-cache make check` passed action pins, Ruff, format, mypy, backend `1678 passed / 39 skipped`, frontend lint, format, typecheck, and `277 files / 2975 tests`.
- Approved-browser/CI: BLOCKED for the remaining production/browser criteria.
  Playwright Chromium launched with host permission; the existing #821
  viewport scenarios passed, but the new region scenario requires a rebuilt
  Compose frontend. Chrome owner-route inspection remains anonymous locally,
  so no owner-only editor evidence was claimed.
- Intended functionality: OPEN FOLLOW-UP for #815 (not yet engineered),
  #821 (verification boundary), and the remaining production/browser issues.
- Replit publication/production: NO-GO. No unauthorized publish or production
  data action was taken. #788 was already run once earlier and remains open
  with unchanged sources; #748/#803/#806/#807 still require their authorized
  live evidence or owner-authorized deployment path.
- Readiness result: NOT PRODUCTION-READY. Every open item and exact next action
  remains in the authenticated GitHub inventory; no issue was silently omitted
  or duplicated.
- Routing audit: implementation and QA service/model/effort substitutions are
  recorded per transaction; Stage 3 independent review was not run for these
  substitutions. This readiness gate ran as Codex/GPT-5/medium substitution;
  it is flagged because the rostered Sonnet 5 tier was unavailable in this
  session.

## Session-completion — 2026-09-24 continuation

- Manifest rollup: 14 open issues remain; zero missing-status records in the
  ledger. Terminal completed issues include #816, #818, #819, and #820. #821
  is handed back as verification-boundary/open; #815 is not yet engineered;
  #748, #788, and #798–#807 remain open production/browser work.
- Follow-up audit: #821's stale Compose revision is classified as an
  environment/evidence boundary and linked to the existing issue; no new
  actionable duplicate was created. #815 remains the next independent local
  transaction.
- Final verification boundary: production URLs, owner-only editor routes,
  and any Replit publish/database action are not closed by local evidence.
  Owner authorization remains limited to #747/#748/#788.
- Handoff: next action is to implement #815 through its full loop, rebuild the
  disposable Compose stack from `cd4ab57` for #821, then process the authorized
  production/browser items without publishing unrelated commits.
