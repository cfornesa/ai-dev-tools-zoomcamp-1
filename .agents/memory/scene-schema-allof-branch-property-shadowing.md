---
name: scene-schema-allof-branch-property-shadowing
description: A property declared on the base shape schema can be silently rejected by every type-specific allOf branch if that branch's own closed additionalProperties/properties doesn't also list it — caused #214's AI create-scene 422s.
metadata:
  type: project
---

`schema/scene.schema.json`'s `shape` `$defs` entry declares its own base
`properties` (e.g. `name`), then layers 5 type-specific `allOf` branches
(circle/rect/line/path/particleEmitter) on top, each with its own
`"additionalProperties": false` and closed `properties` allowlist. Per
JSON Schema `if/then` semantics, the matched branch's own
`additionalProperties`/`properties` governs the instance — a base-level
property NOT re-listed in every branch's allowlist is silently rejected
for every shape, even though the schema visually declares it as legal.

**Why:** `shape.name` was declared at the base level (optional
display/addressing name) but never added to any of the 5 per-type
branches' allowlists — likely never kept in sync when it was added.
Mistral's `json_schema` structured-output mode
(`ai_provider/mistral_provider.py`) honors the base declaration and
routinely emits `name` on shapes, and `scenes.validation.validate_scene`
(the same schema both Python and TypeScript compile) then rejects every
such response with `additionalProperties` errors — a 100%-reproducible AI
create-scene failure (issue #214), invisible from reading only the base
`properties` block.

**How to apply:** Whenever adding or auditing a property on `shape` (or
any other `$defs` entry using this closed-branch-per-`allOf`-arm pattern —
check `schema/scene.schema.json` for others), verify it's listed in every
reachable branch's own allowlist, not just the base `properties` block. A
property that "looks declared" but isn't in every branch is dead on
arrival: nothing (AI, manual editor, a hand-built fixture) can ever
successfully persist it, and `scenes/validation.py`/
`frontend/src/validation/scene.ts` will reject it identically on both
sides. See [#214](https://github.com/cfornesa/ai-dev-tools-zoomcamp-1/issues/214)
for the fix and [#215](https://github.com/cfornesa/ai-dev-tools-zoomcamp-1/issues/215)
for the related product decision this bug blocked (AI-driven
addressing/editing by shape/layer name).
