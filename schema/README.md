# Canonical scene schema

`scene.schema.json` is the single, renderer-neutral source of truth for a
valid V1 scene document. It is a plain [JSON Schema draft
2020-12](https://json-schema.org/draft/2020-12) file with no
language-specific extensions, so it can be loaded as-is by both the
frontend (ajv, `frontend/src/validation/`) and the backend (`jsonschema`,
`config/scenes/validation.py`) — see Task 6. Neither side maintains its
own copy of the field definitions.

## No executable code

The schema contains no field capable of holding arbitrary executable
JavaScript, formulas, or code. Node `params` (`$defs.graphNode.params`)
accept only number/string/boolean/null leaf values — never nested
objects, arrays, or anything a runtime could `eval`. This is a permanent
design constraint, not a V1-only limitation.

## Schema versioning

- `schemaVersion` is a required top-level field and is currently pinned
  to the literal value `1` (`const: 1`).
- Any other value — a different version number, a string, a missing
  field — is rejected. Validators check `schemaVersion` first and report
  it as an "unsupported schema version" error before evaluating anything
  else in the document, so a version mismatch never gets confused with
  an unrelated structural error.
- A future V2 format would introduce `schemaVersion: 2` as a new
  document shape (a new schema file or a versioned union), plus an
  explicit migration path; it would not silently reinterpret V1
  documents.
- An **additive, optional** field — one no existing document has, that
  isn't added to its parent object's `required` list, and whose absence
  every reader (both validators and every renderer) treats identically to
  a documented default — does not need a `schemaVersion` bump. Every
  pre-existing document stays valid and renders unchanged; only newly
  authored/edited documents ever carry the new field. `onboardingHints`
  (Task 82) and `canvas.opacity` (Task 138, issue #170 — see that field's
  own schema description) both follow this rule. A bump is reserved for a
  change that would otherwise make an existing valid V1 document invalid,
  or reinterpret an existing field's meaning.

## Two kinds of limits

- **Field-level value ranges** (opacity 0–1, canvas 16–4096px, rotation
  ±360°, etc.) are structural and live directly in `scene.schema.json`.
- **Scene-wide complexity and payload limits** (max shapes, max graph
  nodes, the exactly-3 conditional-node cap, max payload bytes, etc.)
  live in `limits.json` and are enforced by the validators after schema
  validation passes, not by JSON Schema `maxItems`/`maxLength`. This
  keeps limit-violation errors specific and consistent ("42 shapes
  exceeds the limit of 200") in a way plain JSON Schema errors aren't,
  and keeps the numbers in one place. See Task 7.

## Fixtures

- `fixtures/valid/` — documents every validator must accept.
- `fixtures/invalid/` — documents every validator must reject (unknown
  field, missing required field, wrong type, dangling reference,
  unsupported schema version).
- `fixtures/malicious/` — Task 72's adversarial scene documents: oversized
  payloads, deep group nesting, duplicate/dangling ids, graph node
  connection cycles, forbidden graph node types, combined resource-limit
  abuse, numeric edge cases (overflow, negative-forbidden, boundary
  bypass), and object-key edge cases (prototype-like keys, unknown
  fields). Three of these (`nan_opacity.json.txt`,
  `infinity_unbounded_field.json.txt`, `negative_infinity_rotation.json.txt`)
  are deliberately named `.json.txt`, not `.json`: they carry literal
  `NaN`/`Infinity`/`-Infinity` tokens, a non-standard extension Python's
  `json` module accepts but strict JSON (and TypeScript's build-time
  `resolveJsonModule` checking, and JS's `JSON.parse`) rejects outright,
  so they're excluded from `expectations.json`'s generic loop and tested
  directly in each language's test file instead (`tests/test_scene_validation.py`,
  `frontend/src/validation/scene.test.ts`).
- (`limits/` boundary cases live in `tests/test_scene_limits.py`/
  `frontend/src/validation/limits.test.ts` instead, generated
  programmatically from `limits.json` rather than as static fixture files
  — see Task 7.)
- `fixtures/expectations.json` — the single source of truth for what
  each fixture should do: `{"path": {"valid": bool, "rule": "..."}}`.
  Both the TypeScript and Python test suites load this file and assert
  their validator's outcome against it for every fixture, so the two
  validators are checked for agreement indirectly (through the shared
  expectations) rather than by running one language's validator from the
  other's test process.
- `node_types.json` — the single source of truth for which graph node
  `type` strings are allowlisted per `family` (Task 37/38/40's node
  registries). `scenes/validation.py` and `frontend/src/validation/scene.ts`
  both load it to reject a forbidden/unknown node type as part of the
  authoritative `validate_scene`/`validateScene` pipeline;
  `frontend/src/runtime/behaviorRuntime.ts`'s own execution-time
  `ALLOWED_NODE_TYPES_BY_FAMILY` derives from the same file rather than
  keeping a second hand-written copy (Task 72). The `output` family is
  deliberately left with an empty allowed-types array and unenforced at
  the `validateScene` layer — see the file's own `$emptyFamilyMeansUnenforced`.

## Onboarding hints (Task 82)

`onboardingHints` is an optional top-level array of short, plain-language
strings (e.g. `"Enable your camera, then raise one hand."`), rendered by
`frontend/src/pages/OnboardingHints.tsx` as dismissible, non-modal text
when a scene is opened in the editor. It is scene-document metadata, not
executable content — nothing in `validate_scene`/`validateScene`,
`behaviorRuntime.ts`, or the exported-HTML runtime ever reads it.

This field lives in the canonical scene schema itself, not on the
`Template` catalog row (`scenes/models.py`'s `name`/`category`/
`description` fields, seeded from `scenes/builtin_templates.py`), even
though the latter looks like the closer precedent for "template
authoring metadata." The two aren't interchangeable in practice:
`Template.description` never travels past the clone step — Task 20's
`templates/<id>/clone/` endpoint deep-copies only `scene_json` into the
new project (`scenes/api.py`'s `clone_template`), so a hint stored on the
`Template` row would be unreachable by the time the cloned scene is
actually open in `EditorWorkspace.tsx`. Putting `onboardingHints` inside
`scene_json` instead means it survives cloning, duplication, forking,
save, and export like any other scene field, and (unlike `Template`
metadata) it's available even for onboarding hints on non-template
scenes in the future if ever needed.

## Runtime capabilities

`runtimeCapabilities` is an optional, declarative contract for stage-local
controls. It is intentionally separate from renderer data and defaults to
all capabilities disabled when absent. The structured 2D sound foundation
uses `sound`, `voiceInput`, and `microphone`; consumers must render only the
controls explicitly enabled by this object and must activate audio or input
from a visitor gesture.

## Referential integrity

JSON Schema validates document *shape*, not cross-references within a
document (e.g. a binding's `targetId` pointing at a shape that doesn't
exist, or a group listing a non-existent child id). Structural schema
validation runs first; each validator then walks the document to confirm
every id reference resolves to a real object of the expected kind. Both
checks must pass for a scene to be considered valid.
