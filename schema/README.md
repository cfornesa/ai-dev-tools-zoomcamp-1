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

## Referential integrity

JSON Schema validates document *shape*, not cross-references within a
document (e.g. a binding's `targetId` pointing at a shape that doesn't
exist, or a group listing a non-existent child id). Structural schema
validation runs first; each validator then walks the document to confirm
every id reference resolves to a real object of the expected kind. Both
checks must pass for a scene to be considered valid.
