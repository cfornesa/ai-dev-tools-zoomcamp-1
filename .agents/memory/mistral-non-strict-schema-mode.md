---
name: mistral-non-strict-schema-mode
description: ai_provider/mistral_provider.py's response_format uses json_schema mode with strict False, so schema-constrained AI output can still violate enums; restate constrained enums in the natural-language system prompt too.
metadata:
  type: project
---

`ai_provider/mistral_provider.py`'s `MistralSceneProvider` (`create_scene`
and `edit_scene`) sets Mistral's chat-completion `response_format` to
`json_schema` mode with `"strict": False`. The module's own doc comment
already calls this out: `response_format` is "a strong hint, not a
guarantee (a model can still violate `strict` schemas in edge cases...)".
`strict: False` was likely chosen because `_RESPONSE_JSON_SCHEMA` is the
full canonical scene schema including `$ref`s to `$defs` — many providers'
*strict* structured-output modes require a fully inlined schema (no
`$ref`, `additionalProperties: false` everywhere, every property
`required`), which this schema probably doesn't satisfy. This has not been
independently verified against Mistral's actual strict-mode constraints.

**Why:** a real Mistral call for a plain-language prompt ("Render the
scene of a happy face.") produced binding `targetProperty: 'width'`/
`'height'` — neither is a valid enum value (the schema models size via
`scaleX`/`scaleY`). `scenes.validation.validate_scene` correctly rejected
it with a clean (if raw) schema-path error rather than crashing or
corrupting anything — the two-layer "provider-side constraint +
server-side re-validation" design (see that module's own doc comment)
worked as intended. But the *natural-language* system prompt
(`_SYSTEM_PROMPT`) only said the response "must conform to the provided
JSON Schema" without restating which enum values are actually valid,
relying entirely on the non-strict schema-mode hint. Fixed in
[#204](https://github.com/cfornesa/ai-dev-tools-zoomcamp-1/issues/204),
commit `7117d14`: the prompt now explicitly lists every `targetProperty`
and `signal` enum value, as redundant reinforcement — a standard mitigation
for non-strict structured output, backed by a regression test
(`test_create_scene_system_prompt_lists_every_binding_targetproperty_and_signal`
in `tests/test_mistral_provider.py`) asserting the prompt's restated lists
never drift from the schema's own enums.

**How to apply:** if a future schema change adds/renames/removes an enum
value used by an AI-facing constrained field (`targetProperty`, `signal`,
or any new one), the regression test above will fail until
`_SYSTEM_PROMPT`'s restated list is updated to match — update both
together. If a *new* AI-generation code path is added that also uses
`response_format` with `strict: False` (or any non-strict/best-effort
schema constraint from any provider), apply the same mitigation
proactively: restate the field's valid enum in the natural-language prompt
too, don't rely on schema-mode alone. `art_piece_provider.py`'s art-piece
generation does not use `response_format`/`json_schema` mode at all (it
generates raw code strings, validated by a different per-library snippet
validator) — this specific lesson does not apply there, but the general
principle (LLM structured-output constraints are hints, not guarantees;
reinforce redundantly where it matters) does.
