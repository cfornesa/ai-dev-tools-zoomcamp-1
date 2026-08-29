# 3D scene schema

`schema/scene3d.schema.json` is the canonical, renderer-neutral document
format for the 3D scene editor epic ([issue #209](https://github.com/cfornesa/ai-dev-tools-zoomcamp-1/issues/209)).
It is a genuinely separate document family from the 2D canonical scene
(`schema/scene.schema.json`) per the [#208 decision](https://github.com/cfornesa/ai-dev-tools-zoomcamp-1/issues/208) —
not an extension of it, and never valid input to the 2D validators, models,
or renderers. `documentType: "scene3d"` is a required literal marker so no
code path that only checks `schemaVersion` (a plain integer both schemas
happen to start at 1) can ever mistake one document family for the other.

This file, its `$defs`, and its fixtures are scoped to
[issue #210](https://github.com/cfornesa/ai-dev-tools-zoomcamp-1/issues/210).
Independent Python/TypeScript validators, Django models, editor UI,
renderers, and AI integration are separate, later sub-issues of #209 — see
that issue for the full phased roadmap. This document does not describe
work those later issues own.

## Document shape

- `camera`: a look-at camera (`position`, `target`, `fov`, `near`, `far`).
- `lights`: `directional` | `point` | `ambient`, each requiring the fields
  that make sense for its type (`direction` for directional, `position` for
  point) via the schema's `if`/`then` branches.
- `groups`: purely structural, hierarchical grouping mirroring the 2D
  schema's `groups`/`groupId` convention — a group's own `transform3D`
  composes with each member object's transform.
- `objects`: one of `box`, `sphere`, `cylinder`, `plane`, distinguished with
  `oneOf` + a `const` discriminator on `type`, matching the 2D schema's
  shape-union pattern.
- `transform3D`: `position`/`rotation`/`scale` in x/y/z, plus `opacity`
  (0-1). `rotation` is Euler angles in degrees, applied in a fixed
  X-then-Y-then-Z order by every future renderer — it is not a
  general-purpose rotation representation (no quaternions in V1).
- `randomness`: `seed`/`enabled`, mirroring the 2D schema's identical field
  (reserved for future seeded placement/material variation; no effect on
  its own in this initial schema).

No `bindings`, `graph`, or `accessibility` fields exist in this V1 3D
schema — interaction/binding support for 3D scenes is an explicitly
out-of-scope, later phase of #209, not part of #210.

## `$defs` conventions

The primitive `$defs` (`id`, `color`, `unitInterval`) are copied verbatim
from `schema/scene.schema.json`'s conventions so the two schemas stay easy
to reason about side by side:

- `id`: `^[A-Za-z0-9_-]{1,64}$`
- `color`: 3/6/8-digit `#RRGGBB[AA]` hex
- `unitInterval`: a number in `[0, 1]`

`vec3`, `eulerRotation`, and `scale3` are new 3D-specific primitives with
explicit numeric ranges (never unbounded numbers), following the same
"every numeric field has an explicit min/max" discipline the 2D schema
uses for its own `transform2D`.

## Complexity/payload limits

`schema/limits3d.json` mirrors `schema/limits.json`'s role for the 2D
schema: scene-wide counts (`maxObjects`, `maxGroups`, `maxLights`) and
`maxScenePayloadBytes`, none of which plain JSON Schema can express.
Unlike the 2D schema, there is no `maxGroupNestingDepth`: V1 `group3d` has
no `childIds`/`parentGroupId` — groups are flat, only objects reference a
group via their own `groupId` — so there is no group-of-groups nesting to
cap. It is not enforced by
`scene3d.schema.json` itself — #211's validators are expected to load it
and enforce it the same way `scenes/validation.py` and
`frontend/src/validation/scene.ts` already do for `schema/limits.json`.

## Fixtures and the schema/validator split

`schema/fixtures3d/` mirrors `schema/fixtures/`'s `valid/`, `invalid/`, and
`malicious/` split, with its own `expectations3d.json`. Three
`malicious/` fixtures are **deliberately schema-valid** in
`expectations3d.json`:

- `malicious/duplicate_ids.json` — two objects share an `id`.
- `malicious/dangling_group_reference.json` — an object's `groupId`
  references a group that doesn't exist.
- `malicious/oversized_document.json` — 6,000 objects, no size limit.

Plain JSON Schema (Draft 2020-12) cannot express cross-array uniqueness of
an arbitrary field, cross-reference existence checks, or a
total-document/object-count limit — the 2D schema has exactly the same gap,
which `scenes/validation.py` and `frontend/src/validation/scene.ts` close
at the validator layer (`duplicateId`, `danglingReference`, and
`limitExceeded` rules). [Issue #211](https://github.com/cfornesa/ai-dev-tools-zoomcamp-1/issues/211)
is expected to add the equivalent 3D validators and, at that point, these
three fixtures should be re-verified against the validators (not the raw
schema) and `expectations3d.json` updated to note validator-level
rejection, matching `schema/fixtures/expectations.json`'s own precedent for
its `duplicateId`/`danglingReference`/`limitExceeded` rows.

The other two `malicious/` fixtures (`negative_forbidden_dimensions.json`,
`boundary_bypass_opacity.json`) exercise per-field numeric bounds the
schema itself enforces (`exclusiveMinimum`, `maximum`), so they are
schema-invalid, same as the 2D schema's equivalent boundary fixtures.

## Verifying the schema

```bash
uv run python -c "
import json, glob
from jsonschema import Draft202012Validator
schema = json.load(open('schema/scene3d.schema.json'))
Draft202012Validator.check_schema(schema)
validator = Draft202012Validator(schema)
for f in sorted(glob.glob('schema/fixtures3d/**/*.json', recursive=True)):
    doc = json.load(open(f))
    errors = list(validator.iter_errors(doc))
    print(f, 'VALID' if not errors else 'INVALID')
"
```
