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

**Second confirmed instance:** the same class of gap existed for 2D
shape *required fields*, not just enums — `_SYSTEM_PROMPT_3D` restates
each object type's required geometry (`box: width/height/depth; sphere:
radius; ...`) but the 2D `_SYSTEM_PROMPT` never restated the equivalent
per-`shapes[]`-type requirements (`circle` -> `radius`; `rect` ->
`width`/`height`/`cornerRadius`; `line` -> `x2`/`y2`; `path` ->
`points`/`closed`; `particleEmitter` -> `rate`/`size`/`lifespan`/`speed`/
`palette`). Confirmed live against production on 2026-08-31: three
separate real `mistral-small-latest` calls for simple prompts ("a red
circle and a blue square", "one blue square") each produced a
schema-invalid shape missing its type's required fields, reproducibly.
Filed as task 224/[#256](https://github.com/cfornesa/ai-dev-tools-zoomcamp-1/issues/256),
fixed same repo session (2026-08-31), commit `70487f3`: `_SYSTEM_PROMPT`
now restates each shape type's required fields, with a drift-proof
regression test mirroring #204's. Manual verification against the real
Mistral API is a recorded verification boundary (no credentials/
production access in that sandbox) — pending the repository owner's
confirmation. When auditing this class of gap, check *every* AI-facing
structural constraint the schema encodes (enums, required-field sets,
conditional `if`/`then` branches) — not just enums — for each
`response_format`/`strict: False` code path.

**Verification transparency:** when manually re-verifying a fix in this
class against the real Mistral API (the "retried at least 3 times"
style acceptance criterion #256/#264/#265 all use), always report the
exact attempt count and per-attempt outcome in the QA comment/task
entry — not just a pass/fail summary. The repository owner asked for
this explicitly (2026-08-31) after this session's live verification
needed several manual re-submissions with no attempt-count visibility,
which also prompted task 233/[#266](https://github.com/cfornesa/ai-dev-tools-zoomcamp-1/issues/266)
(a user-facing configurable auto-retry feature, with the same
transparency requirement extended to end users, not just verification
agents). Report format: "N/M attempts succeeded" or "failed on attempt
K of N with <error>", not "reproduced" or "confirmed" alone.

**Fifth instance — the 3D system prompt has the same gap, for lights:**
confirmed live in production (2026-08-31, same Claude in Chrome
session as the fourth instance below) while verifying #262's 3D AI
editor dropdowns work (they do). The prompt "a bare stage with a
single sphere" reproduced `$.lights[0]: 0 is not of type 'object'`
twice identically. `_SYSTEM_PROMPT_3D` restates each light type's
conditional `position`/`direction` requirement but never states that
every light is an object requiring `id`/`type`/`color`/`intensity`
unconditionally — the same asymmetry #256 fixed for 2D `shapes[]`,
just never applied to 3D `lights[]` even though `objects[]` in the
same prompt already gets full geometry restatement. Filed as task
232/[#265](https://github.com/cfornesa/ai-dev-tools-zoomcamp-1/issues/265).
This confirms the 3D prompt is not automatically exempt from this
lesson just because it restates *some* structural constraints (the
enum-mapping sentence for `objects[]` masked the gap for `lights[]`)
— audit every array-of-typed-object field in a system prompt
individually, not just the ones already partially covered.

**Fourth instance — layerId uniqueness (not schema-expressible at all)
and demoSignals' closed key set:** confirmed live in production
(2026-08-31, via Claude in Chrome) while verifying #256's fix worked:
the same reproducing-prompt family ("A red circle and a blue square
side by side on a white background") still fails, just on two
*different* constraints #256 never covered. `$.demoSignals: Additional
properties are not allowed ('handPresence' was unexpected)` and
`$.shapes[N].layerId: layerId '...' is assigned to 2 shapes; each
shape must have its own layer.` — the latter reproduced twice with "No
persona" selected, ruling out #260's persona composition as the cause.
The layerId-uniqueness rule (task 111/#142) is the first confirmed
instance of this whole lesson where the constraint is **not
expressible in JSON Schema at all** (a cross-item check in
`scenes/validation.py`, not the schema file) — `response_format`'s
structured-output mode literally cannot help here regardless of
`strict` setting; the natural-language system prompt is the *only*
possible mitigation. Filed as task 231/[#264](https://github.com/cfornesa/ai-dev-tools-zoomcamp-1/issues/264).
When auditing this class of gap going forward, also check
cross-item/relational constraints enforced only in `validation.py`
(uniqueness, referential integrity) — not just single-field schema
constraints (enums, required, additionalProperties) covered by the
first three instances above.

**Third instance — additive Personas must never weaken this:** issue
[#260](https://github.com/cfornesa/ai-dev-tools-zoomcamp-1/issues/260)
added per-user "Persona" system-prompt add-ons
(`backend/scenes/models.py`'s `AIPersona`). Because a Persona's text is
appended as a *second*, separate system message after the mandatory
technical prompt (`MistralSceneProvider._system_messages()`) rather than
merged into or replacing it, a Persona can never dilute or crowd out the
restated enum/required-field reinforcement this lesson is about — a
regression test asserts the mandatory prompt's content is byte-identical
whether or not a persona is selected. Preserve this separation if the
Persona feature is ever extended.
