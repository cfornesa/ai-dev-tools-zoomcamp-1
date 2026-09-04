# Vendor support distillation — 2026-09-04

## Request

Investigate whether the application can add Mistral Vibe, Google Gemini, and
DeepSeek, and turn any genuinely missing work into a reconciled backlog.

This was a distillation-only pass. No product source or product tests were
changed.

## Current architecture

- `backend/ai_provider/interface.py` defines the provider-neutral 2D scene
  contract; `interface3d.py` defines the 3D contract.
- `backend/ai_provider/mistral_provider.py` is the only real provider. It
  implements 2D create/edit, 3D create/edit, structured output, patch
  handling, validation, error mapping, and usage metadata.
- `backend/scenes/ai_api.py` hard-codes provider construction to Mistral,
  apart from the deterministic fake provider used by E2E scenarios.
- Credential persistence is one encrypted per-user `MistralCredential` record
  in `backend/scenes/models.py`; the API and frontend settings flow are
  Mistral-specific.
- Model preferences and the model slug validator are also Mistral-specific.
- `backend/pyproject.toml` contains `mistralai>=2.9.3`; no Gemini or DeepSeek
  SDK/transport is present.
- Existing Google support is login OAuth, not Gemini model access.

## Requested vendor classification

| Request | Finding | Backlog decision |
| --- | --- | --- |
| Mistral Vibe | Already covered by `docs/plan.md` as a developer workflow tool, not an end-user hosted model provider. Mistral API models are already supported through the current Mistral path. | Non-actionable for this provider-expansion request. Do not create a Vibe adapter unless the owner explicitly changes product scope to developer-tool integration. |
| Google Gemini | Genuinely missing: no adapter, credential storage/API/UI, provider routing, model selection, or tests. | Create #405, dependency-blocked by #404. |
| DeepSeek | Genuinely missing: no adapter, credential storage/API/UI, provider routing, model selection, or tests. | Create #406, dependency-blocked by #404. |

## Duplicate and already-covered report

- Before this pass, the authenticated GitHub issue list had zero open issues.
- Closed #403 covers encrypted owner-scoped Mistral credentials only and is
  immutable; it explicitly excludes other providers and must not be reopened.
- #257 and #259–#262 cover Mistral model preferences and Personas, not
  cross-vendor routing or credentials.
- `.local/tasks/per-user-mistral-credentials.md` explicitly excludes
  supporting providers other than Mistral and multiple vendor keys.
- No local task or memory topic covered Gemini, DeepSeek, or an end-user
  multi-vendor provider workflow.
- Mistral Vibe is a scope decision already present in `docs/plan.md`, not a
  duplicate implementation issue.

## Criterion-ready issue manifest

| Issue | URL | Goal | Dependencies / order | Status | Next action |
| --- | --- | --- | --- | --- | --- |
| #404 | [provider and credential foundation](https://github.com/cfornesa/ai-dev-tools-zoomcamp-1/issues/404) | Generalize vendor registry, owner credential routing, validation, redaction, and Mistral compatibility | First; no implementation dependency | open | Engineer the shared model/API contract |
| #405 | [Google Gemini provider](https://github.com/cfornesa/ai-dev-tools-zoomcamp-1/issues/405) | Add Gemini 2D/3D scene create/edit adapter with normalized failures | Depends on #404 | open; dependency-blocked | After #404, select/pin Gemini SDK/API mode and implement |
| #406 | [DeepSeek provider](https://github.com/cfornesa/ai-dev-tools-zoomcamp-1/issues/406) | Add DeepSeek 2D/3D scene create/edit adapter with normalized failures | Depends on #404; independent of #405 after foundation | open; dependency-blocked | After #404, select/pin DeepSeek SDK or OpenAI-compatible transport and implement |
| #407 | [multi-vendor settings and model selection](https://github.com/cfornesa/ai-dev-tools-zoomcamp-1/issues/407) | Give users per-vendor credential cards and an accessible provider/model selector | Depends on #404, #405, #406 | open; dependency-blocked | Implement after both adapters stabilize |
| #408 | [cross-vendor regression matrix](https://github.com/cfornesa/ai-dev-tools-zoomcamp-1/issues/408) | Prove vendor isolation and consistent create/edit/recovery behavior | Depends on #405, #406, #407 | open; dependency-blocked | Add after the three vendor paths are integrated |

Each issue body contains a named entry point, finite observable criteria,
focused and full verification commands, explicit out-of-scope items, and a
live-credential evidence boundary.

## Blocker triage and verification boundaries

- #404 is closure-ready and is the single next issue for engineering.
- #405 and #406 are `dependency-blocked` only by #404; live Gemini/DeepSeek
  credentials are `verification-boundary` evidence, not prerequisites for
  deterministic adapter tests.
- #407 is `dependency-blocked` by the foundation and both adapters.
- #408 is `dependency-blocked` by the integrated workflow.
- Mistral Vibe is `non-actionable` under the current product scope.
- No workflow/infrastructure defect was discovered during distillation.
- The prior project baseline was `make check` green with 944 backend tests
  (22 skipped) and 2,417 frontend tests; this pass did not rerun product
  tests because distillation is read-only.

## Next queue item

Process exactly #404 first. After its terminal result, reconcile dependencies
and select #405 or #406 as the next independent closure-ready adapter issue.
Do not begin #405–#408 implementation while #404 lacks a terminal result.

## Durable context

The durable vendor/credential architecture rule is recorded in
`.agents/memory/multi-vendor-ai-provider-credentials.md`.