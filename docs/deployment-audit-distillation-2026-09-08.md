# animate.creatrweb.com deployment audit distillation — 2026-09-08

## Scope and provenance

One project: `cfornesa/ai-dev-tools-zoomcamp-1`, deployed at
`https://animate.creatrweb.com/`. This is a backlog-definition pass only; no
product source, product tests, production data, authentication state, or
deployment configuration changed.

Execution provenance: task-distillation / rostered owner portable
orchestration / actual owner Codex desktop, GPT-5, reasoning effort not
exposed / substituted: no.

Evidence sources:

- anonymous Chrome at 1280×900 and 375×812;
- `PUBLISHED_APP_URL=https://animate.creatrweb.com scripts/smoke-published.sh`;
- response headers and public API payloads captured with `curl`;
- current `main` at `adfe702` and repository source/history;
- all open GitHub issues and open pull requests (`0` open PRs at audit time);
- `docs/tasks.md`, `docs/process.md`, `docs/plan.md`, the existing distillation
  documents, and linked durable memory topics.

The working tree already contained an unrelated user change to `DISPATCH.md`.
It was preserved and is not part of this audit.

## Live evidence summary

- Published smoke passed: `/health/` returned database/cache `ok`; `/` and
  `/accounts/login/` returned 200; anonymous `/api/whoami/` returned 401.
- `/gallery` rendered one public structured 3D fixture and its thumbnail at
  both fixed viewports. The initial full-page mobile capture appeared to omit
  the thumbnail, but a focused pixel crop and image diagnostics proved the
  320×240 image was complete and visibly rendered. This is non-actionable
  capture timing, not a product defect.
- `/p3d/f3863d2f-d3a5-41ad-9883-7b8441af6217` and its immersive route rendered
  the sphere/stage and accessible stage actions. Both emitted
  `THREE.Material: parameter 'emissive' has value of undefined.` once per
  object whose valid material omitted optional `emissive`.
- `/art-pieces/gallery` rendered a valid empty state, but no anonymous desktop
  or mobile navigation exposed that route.
- `/definitely-not-a-real-route` returned the SPA document and rendered an
  entirely blank viewport at both fixed sizes; Chrome logged `No routes
  matched location`.
- The current content-hashed JS asset returned `Cache-Control: no-cache`.
- Django-backed HTTPS responses returned two HSTS fields. Per
  [RFC 6797 §8.1](https://datatracker.ietf.org/doc/html/rfc6797#section-8.1),
  user agents process only the first, so the later Django `preload` directive
  is ineffective.
- Chrome had no authenticated site session. Authenticated owner/admin/editor
  behavior was not inferred from anonymous state and remains a release
  verification boundary under #445.

## Complete open-issue manifest

GitHub is authoritative for state. Sixteen issues are open after the owner's
gallery decision: the original pass created #485–#490, #486 is now resolved,
and its one selected-direction implementation record is #491.

| Order | Issue | Goal / scope | Dependencies | Status and blocker | Routing hint / exact next action |
| --- | --- | --- | --- | --- | --- |
| 1 | [#419](https://github.com/cfornesa/ai-dev-tools-zoomcamp-1/issues/419) | Reconcile the complete browser matrix | Current-revision disposable stack | OPEN verification container | QA/CI, not engineering: run the complete matrix and create/reuse atomic children for reproduced failures. |
| 2 | [#440](https://github.com/cfornesa/ai-dev-tools-zoomcamp-1/issues/440) | PayPal sandbox subscription workflow | Real sandbox app credentials | DEPENDENCY-BLOCKED / external credential | Stage 2b complex billing/data work after owner provisions sandbox credentials. |
| 3 | [#445](https://github.com/cfornesa/ai-dev-tools-zoomcamp-1/issues/445) | Reconcile one exact release candidate | Every required child and exact release identity | DEPENDENCY-BLOCKED parent container | Release QA only; never select for implementation. Reconcile #485 and #487–#491 in the current child evidence set. |
| 4 | [#460](https://github.com/cfornesa/ai-dev-tools-zoomcamp-1/issues/460) | Optional LinkedIn OIDC login | Real LinkedIn OAuth app | DEPENDENCY-BLOCKED / external credential | Stage 2b auth implementation after owner provisions the app. |
| 5 | [#465](https://github.com/cfornesa/ai-dev-tools-zoomcamp-1/issues/465) | Stabilize/classify the `/p/:id` synthetic-camera FPS failure | Fresh #419 evidence | DEPENDENCY-BLOCKED / runner-capacity classification | Stage 2a browser/runtime work only after the owning failure reproduces on the current matrix. |
| 6 | [#467](https://github.com/cfornesa/ai-dev-tools-zoomcamp-1/issues/467) | Verify post-publish schema using health/direct tables | Next migration-bearing Publish | OPEN verification boundary | Stage 2a docs/ops; run the published health/table check after the next qualifying publish. |
| 7 | [#474](https://github.com/cfornesa/ai-dev-tools-zoomcamp-1/issues/474) | Fix macOS Firefox `context.request` authentication after UI login | Local Firefox reproduction | PROPOSED/GROOMED workflow defect | Stage 2a test-harness work; reproduce the named `drawioEditor.spec.ts` command, then isolate cookie/storage behavior. |
| 8 | [#479](https://github.com/cfornesa/ai-dev-tools-zoomcamp-1/issues/479) | Move real generated-piece camera/mic/hand tracking out of opaque iframe | Owner architecture decision recorded; real devices for closure | OPEN implementation defect / hardware evidence boundary | Stage 2a frontend runtime per repo routing; implement the decided trusted-parent pipeline, then run real device evidence. |
| 9 | [#482](https://github.com/cfornesa/ai-dev-tools-zoomcamp-1/issues/482) | Apply the trusted camera pipeline to Full ZIP | Ordered after #479 | DEPENDENCY-BLOCKED by implementation order | Stage 2a export runtime after #479; execute the extracted artifact independently. |
| 10 | [#483](https://github.com/cfornesa/ai-dev-tools-zoomcamp-1/issues/483) | Apply the trusted camera pipeline to Immersive ZIP | Ordered after #479/#482 | DEPENDENCY-BLOCKED by implementation order | Stage 2a export runtime after the preceding surfaces; execute its artifact independently. |
| 11 | [#485](https://github.com/cfornesa/ai-dev-tools-zoomcamp-1/issues/485) | Render an accessible unknown-route recovery page | None | PROPOSED/GROOMED implementation defect | **Exactly one next issue.** Stage 2a mechanical frontend; implement the catch-all and its fixed-viewport/browser contract. |
| 12 | [#487](https://github.com/cfornesa/ai-dev-tools-zoomcamp-1/issues/487) | Omit absent `emissive` from live Three.js materials | None | PROPOSED/GROOMED implementation defect | Stage 2a mechanical frontend after #485; unit + public-route console/render evidence. |
| 13 | [#488](https://github.com/cfornesa/ai-dev-tools-zoomcamp-1/issues/488) | Omit absent `emissive` from standalone 3D ZIP runtime | #487 for pattern/order, not evidence | DEPENDENCY-BLOCKED by implementation order | Stage 2a export work; execute the extracted artifact independently. |
| 14 | [#489](https://github.com/cfornesa/ai-dev-tools-zoomcamp-1/issues/489) | Give hashed assets immutable caching without stale HTML/dynamic leaks | None; published proof coordinated with #445 | PROPOSED/GROOMED workflow/deployment defect | Stage 2a if current config suffices; re-distill before any new dependency/vendor/core server replacement. |
| 15 | [#490](https://github.com/cfornesa/ai-dev-tools-zoomcamp-1/issues/490) | Reconcile upstream/Django HSTS to one effective policy | Published upstream route; #445 for release proof | PROPOSED/GROOMED security/config defect with possible platform boundary | Stage 2a configuration; identify header owner, then implement or hand off exact vendor action. |
| 16 | [#491](https://github.com/cfornesa/ai-dev-tools-zoomcamp-1/issues/491) | Unify authored 2D/3D and generated work at `/gallery` with a visible type filter | #486 owner decision (resolved) | PROPOSED/GROOMED implementation gap | Stage 2b complex cross-model query/API work; preserve legacy routes/APIs and verify the fixed three-kind fixture. |

## New criterion-ready issue definitions

The complete self-contained contracts, fixtures, commands, out-of-scope
boundaries, and routing hints are authoritative in the seven GitHub bodies
(including the now-resolved decision record):

- [#485 — unknown-route blank page](https://github.com/cfornesa/ai-dev-tools-zoomcamp-1/issues/485)
- [#486 — generated-gallery discoverability decision](https://github.com/cfornesa/ai-dev-tools-zoomcamp-1/issues/486)
- [#487 — live structured-3D emissive warning](https://github.com/cfornesa/ai-dev-tools-zoomcamp-1/issues/487)
- [#488 — extracted structured-3D emissive warning](https://github.com/cfornesa/ai-dev-tools-zoomcamp-1/issues/488)
- [#489 — hashed production asset cache policy](https://github.com/cfornesa/ai-dev-tools-zoomcamp-1/issues/489)
- [#490 — duplicate published HSTS policies](https://github.com/cfornesa/ai-dev-tools-zoomcamp-1/issues/490)
- [#491 — unified public catalog with visible type filtering](https://github.com/cfornesa/ai-dev-tools-zoomcamp-1/issues/491)

Each issue body was verified non-empty after creation. #485/#487/#488/#489/
#490 have unconditional stage 2a routing under current evidence. The owner
selected #486's Unified direction on 2026-09-08, producing exactly one
unconditional stage 2b implementation issue, #491; #486 is now resolved.

## Duplicate and already-covered report

- Closed #400 already owns and passed rendered QA for the branded responsive
  login template. Its light account-page palette is not refiled as a theme
  mismatch.
- Closed #392 owns the structured 2D/3D contents of `/gallery`; #486/#491 do
  not reopen it or merge persistence models. #491 additively extends the
  public catalog while preserving legacy routes and API contracts.
- Closed #393/#394 and the earlier authored-piece parity issues remain valid
  historical closures. The live console warning is new evidence with its own
  narrow #487 contract.
- #487 and #488 are deliberately not duplicates: the live preview builder and
  downloaded ZIP runtime are independently implemented and require different
  entry points and evidence.
- #489 is cache-policy behavior, not a duplicate of closed #133/#139, which
  replaced Vite dev/HMR with Preview. It does not re-litigate that closure.
- #490 is header ownership/order, not a duplicate of the existing Django
  production-settings checks or #467's schema verification practice.
- Existing #419/#445 remain reconciliation containers. No new broad browser or
  release epic was created.
- Search across all GitHub issues, `docs/tasks.md`, and memory found no prior
  catch-all/blank-route, undefined-emissive, generated-gallery navigation,
  immutable-asset cache, or duplicate-HSTS contract.

## Blocker triage and follow-up decisions

| Finding / boundary | Classification | Coverage decision | Owner and exact next action |
| --- | --- | --- | --- |
| Unknown URLs render blank | implementation-defect | New #485 | Frontend engineer implements the fixed catch-all contract. |
| Live valid 3D scenes emit undefined-emissive warnings | implementation-defect | New #487 | Frontend engineer omits absent constructor property and verifies the public fixture. |
| Standalone 3D runtime repeats the constructor defect | implementation-defect | New #488, separate artifact | Export engineer executes extracted Full ZIP after #487 pattern lands. |
| Generated public gallery has no anonymous navigation path | implementation gap; owner decision resolved | #486 selected Unified; new #491 implementation issue | Stage 2b engineer implements the additive cross-model API and one filtered `/gallery` surface without merging persistence models. |
| Hashed assets are `no-cache` | workflow/deployment defect | New #489 | Deployment/frontend engineer selects an existing-config solution or stops at the dependency/vendor gate. |
| Duplicate HSTS fields suppress the later policy | workflow/deployment security defect | New #490 | Deployment engineer determines header ownership and proves one effective published field. |
| Chrome session is signed out | verification-boundary | Existing #445; no login issue | Owner/authenticated release QA verifies protected routes separately; no credentials entered here. |
| Camera action would request browser permission | verification-boundary | Existing #479; no duplicate | Perform only in #479's real-device transaction with action-time authorization. |
| Generated gallery contains no public cards | verification-boundary for card visuals, not a defect | #491 implementation contract | Use its deterministic public generated-piece fixture for rendered closure evidence. |
| Initial mobile gallery capture appeared blank | non-actionable capture timing | No issue | Focused crop proved the loaded image renders; no next action. |
| Browser-extension message-channel/sentence-player logs | non-actionable third-party noise | No issue | Excluded from app console criteria; no repository work. |
| #440/#460 credentials missing | dependency-blocked | Existing issues | Owner provisions non-production provider apps before those transactions. |
| #419/#445 are broad containers | verification-boundary / reconciliation | Existing issues | Never implement containers; distill atomic reproduced children. |

## Dependency and order rationale

Containers (#419/#445) collect evidence but are never engineering selections.
Credential- and hardware-bound work remains open without blocking independent
issues. #482/#483 follow #479 because they reuse its accepted security shape;
#488 follows #487 for the material-option pattern while retaining independent
artifact QA. #491 is now unblocked by the resolved #486 decision but follows
#485 in the deterministic engineering order. #489 and #490 are independent but
require exact published proof.

The first independent, fully provisioned, closure-sized issue is #485. It has
one entry point, no external credential/hardware/deployment dependency, and a
finite local plus rendered contract. Therefore exactly one handoff is:

**Next groomed issue: #485 — Unknown SPA routes render a blank page instead
of an accessible not-found view.**

Do not start #487 or any other engineering transaction until #485 is closed or
terminally handed off and reconciled.

## Unresolved blockers and verification boundaries

- PayPal and LinkedIn sandbox credentials for #440/#460.
- Real camera/microphone/hand evidence for #479 and later #482/#483.
- Current full cross-browser disposable-stack result for #419/#465.
- Next migration-bearing Replit Publish for #467.
- Exact republished asset/release identity for #445 and the published checks
  in #485/#487/#489/#490/#491.
- Upstream ability to configure or suppress the first HSTS field for #490.

No actionable finding is left only in prose. Every item is linked to a new or
existing issue, classified as already covered, or recorded as non-actionable.

## Memory disposition

Existing linked topics remain applicable:

- [Replit production frontend serving](../.agents/memory/replit-production-frontend-serving.md)
  records why production uses Vite Preview instead of the dev/HMR server and
  is the durable prerequisite for #489.
- [Replit userenv scope](../.agents/memory/replit-userenv-scope.md) and
  [Critical operational decisions](../.agents/memory/critical-actions.md)
  retain the production-security/settings boundary relevant to #490.
- [Parity closure evidence gap](../.agents/memory/parity-closure-evidence-gap.md)
  remains the rule separating local fixes from exact republished evidence in
  #485/#487/#489/#490/#491.

Two durable updates are proposed, not silently written, per repository
ownership rules:

1. Extend `.agents/memory/replit-production-frontend-serving.md` with the rule
   that switching from Vite dev to Vite Preview removes HMR but does not prove
   production-grade immutable cache headers; verify shell and hashed assets
   separately (#489).
2. Add a deployment-header ownership topic explaining that upstream and
   Django HSTS fields can compete and browsers process only the first; verify
   the exact published header order (#490).

The repository owner must approve these memory writes before they are made.
