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
- `fixtures/limits/` — at-limit (accepted) and over-limit (rejected)
  documents for each `limits.json` cap (Task 7).
- `fixtures/expectations.json` — the single source of truth for what
  each fixture should do: `{"path": {"valid": bool, "rule": "..."}}`.
  Both the TypeScript and Python test suites load this file and assert
  their validator's outcome against it for every fixture, so the two
  validators are checked for agreement indirectly (through the shared
  expectations) rather than by running one language's validator from the
  other's test process.

## Referential integrity

JSON Schema validates document *shape*, not cross-references within a
document (e.g. a binding's `targetId` pointing at a shape that doesn't
exist, or a group listing a non-existent child id). Structural schema
validation runs first; each validator then walks the document to confirm
every id reference resolves to a real object of the expected kind. Both
checks must pass for a scene to be considered valid.
