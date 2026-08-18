"""Provider-neutral, testable interface for structured AI scene operations.

Task 45 (`_docs/plan.md`'s "AI provider and cost control" section):
Django exposes exactly two structured AI operations — create-scene and
edit-scene (`_docs/plan.md`'s "AI actions") — through a single abstract
interface (`ai_provider.interface.AISceneProvider`) so a real provider
(Mistral, Task 46/47 — issues #47 and #50) and a deterministic offline
fake (`ai_provider.fake_provider.FakeAISceneProvider`) are
interchangeable and equally testable.

This package intentionally contains no real provider implementation and
no HTTP endpoint — those are Task 46/47 (issue #47/#50, the Mistral
client) and Task 48 (the frontend) respectively. It defines:

- `interface.py` — typed requests/responses, the error taxonomy, and the
  `execute()` wrapper every provider implementation (real or fake) must
  route its output through, which guarantees every returned scene has
  already passed `scenes.validation.validate_scene` before callers ever
  see it as "validated output".
- `errors.py` — the exceptions a provider implementation raises to
  signal timeout/cancellation/rejection/quota conditions; `execute()`
  maps each to the matching `AIErrorCategory`.
- `fake_provider.py` — `FakeAISceneProvider`, a deterministic,
  network-free provider for tests, configurable to hit every error path.
- `config.py` — where a real provider implementation reads its API key
  from a server-side environment variable (never a request parameter,
  never logged, never returned).
- `logging.py` — the minimal-metadata operation log, prompt retention
  off by default per `_docs/plan.md`: "Log minimal necessary metadata;
  avoid retaining prompts by default unless the product later adds an
  explicit user-facing history choice."

See `_docs/plan.md`'s "AI-assisted workflow" and "API-key security"
sections for the product requirements this package implements.
"""
