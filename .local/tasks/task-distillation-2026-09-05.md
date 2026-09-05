# Task distillation — 2026-09-05

## Scope and evidence

This pass follows the browser-test throughput implementation on PR #417. The
workflow change is pushed as `a7abbc1accd1de1abf9f8ed3b0aff75350905eba`.
The authenticated GitHub audit found one pre-existing open issue, #415, and
newly created criterion-ready issues #418–#426. Closed issues remain immutable.

The prior full run #496 was cancelled before terminal completion, but its log
recorded repeated 30-second failures in public 3D, publishing/remix,
responsive-gallery, and sound-engine scenarios, plus PostgreSQL duplicate-key
errors for `django_cache` and `unique_draft_scope`. This is classified as a
new workflow/fixture investigation under #419, not a reopening of closed #193.

## Manifest and dependency order

| Issue | Goal | Dependencies | Status / blocker | Next action |
|---|---|---|---|---|
| [#418](https://github.com/cfornesa/ai-dev-tools-zoomcamp-1/issues/418) | Fast PR Chromium smoke plus scheduled/manual full browser matrix | none | open; implementation pushed, CI pending | Verify PR smoke, cancellation, artifacts, and full-run dispatch contract |
| [#419](https://github.com/cfornesa/ai-dev-tools-zoomcamp-1/issues/419) | Stabilize current-revision full E2E fixtures, cache/draft races, and timeouts | #418 | dependency-blocked | Reproduce named failures after #418 has terminal evidence |
| [#420](https://github.com/cfornesa/ai-dev-tools-zoomcamp-1/issues/420) | Extensible Google/GitHub OAuth and safe identity linking | #416 closed; #75 credential boundary | open | Groom provider registry and callback security transaction |
| [#425](https://github.com/cfornesa/ai-dev-tools-zoomcamp-1/issues/425) | Evaluate and optionally add LinkedIn/Bluesky providers | #420 | dependency-blocked | Verify current provider protocols and email/linking feasibility |
| [#421](https://github.com/cfornesa/ai-dev-tools-zoomcamp-1/issues/421) | Environment-configured admin identities | none; shared by #422/#423 | open | Define exact parsing, reconciliation, and fail-closed authorization |
| [#423](https://github.com/cfornesa/ai-dev-tools-zoomcamp-1/issues/423) | Atomic tiers, feature entitlements, overrides, and quota enforcement | #421 | dependency-blocked | Design transactional entitlement service and PostgreSQL boundary |
| [#422](https://github.com/cfornesa/ai-dev-tools-zoomcamp-1/issues/422) | Protected admin console for site title and quota policies | #421/#423 | dependency-blocked | Implement after authorization and entitlement contracts close |
| [#424](https://github.com/cfornesa/ai-dev-tools-zoomcamp-1/issues/424) | PayPal plan/subscription synchronization | #422/#423 | dependency-blocked | Define sandbox webhook/signature/idempotency transaction |
| [#426](https://github.com/cfornesa/ai-dev-tools-zoomcamp-1/issues/426) | Account self-service, linked identities, sessions, deletion/export, audit | #420/#421/#425; billing references #424 | dependency-blocked | Groom retention and identity-safety contract |
| [#415](https://github.com/cfornesa/ai-dev-tools-zoomcamp-1/issues/415) | Published Uvicorn routing and process lifecycle | independent | open; deployment verification boundary | Verify exact published Replit process after user deploys |

## Duplicate and already-covered report

- #193 is closed historical full-browser reconciliation; it is not reopened.
  Its old failure list does not cover the current cache/draft duplicate-key
  evidence or the current revision's timeout pattern, so #419 is new work.
- #416 is closed with Google-only signup policy; #420 extends provider login
  and explicitly excludes password signup.
- Existing auth shell, CSRF, OAuth dependency, encrypted credential, shared
  quota, and production server topics remain covered by #400/#401/#75/#414/#415
  and the linked memory pages.
- No existing issue covered GitHub/LinkedIn/Bluesky expansion, configured admin
  identities, an entitlement model, PayPal synchronization, or account
  self-service; #420–#426 capture those boundaries without creating a parent
  epic as an implementation unit.

## Blocker triage and verification boundaries

- #418: workflow/infrastructure concern addressed by the pushed fast smoke/full
  split; CI run #497 is the authoritative terminal evidence still pending.
- #419: workflow/infrastructure-defect until fresh reproductions distinguish
  fixture/harness races from product defects. Required evidence is a fresh
  PostgreSQL run, named specs, and the full CI matrix.
- #415: verification-boundary; exact published routing, signal handling, and
  branch parity require the user's Replit deployment and Chrome verification.
- #420/#425: verification-boundary for real provider accounts and credentials;
  deterministic callback tests can run without secrets.
- #424: verification-boundary for PayPal sandbox credentials/webhooks; signed
  fixtures cover local implementation but do not prove merchant behavior.
- No issue is closed or reopened in this pass. No actionable item remains only
  in prose; every follow-up has a GitHub issue, owner context, dependency, and
  exact next action.

## Handoff

Exactly one next groomed issue: **#418 — Stratify browser acceptance into a
fast PR gate and a complete scheduled matrix.** Its closure contract is the
issue body: verify the pushed workflow on PR/ordinary push, verify manual or
scheduled full-matrix behavior, prove superseded-run cancellation and failure
artifacts, and record the bounded smoke test list. Do not begin #419 until
#418 has a terminal QA/reconciliation result.
