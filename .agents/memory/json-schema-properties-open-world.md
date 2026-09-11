---
name: JSON Schema properties constraint open-world semantics
description: A bare `properties` constraint in a JSON Schema `if` block does NOT require the named property to be present; it only constrains the property's value IF it exists. This causes silently vacuous conditions.
metadata:
  type: constraint
---

Discovered during #508 (image shape schema). The issue spec's verbatim `if/then`
block used:

```json
"if": { "not": { "properties": { "decorative": { "const": true } } } }
```

This is **vacuously true** whenever `decorative` is absent (the property not being
present means the `properties` constraint places no requirement, so the `not`
wrapping around nothing-required = not(vacuously-satisfied) = false, wait—actually
`properties` only constrains keys that ARE present — so if `decorative` is absent,
`properties: { decorative: { const: true } }` is trivially satisfied (no key to
constrain), making the `not` of that = `false`... no wait.

**Correct analysis:** `{ "properties": { "decorative": { "const": true } } }` is
satisfied by any object that either (a) doesn't have the `decorative` key, OR (b)
has it with value `true`. So `{ "not": { "properties": { "decorative": { "const": true } } } }`
is ONLY true when `decorative` is present AND not `true` — meaning it fails to trigger
when `decorative` is absent (the common case). This made `altText` never required.

**Fix:** add `"required": ["decorative"]` inside the `not` block:

```json
"if": {
  "not": {
    "required": ["decorative"],
    "properties": { "decorative": { "const": true } }
  }
}
```

Now the inner schema only matches when `decorative` IS present AND is `true`. The
`not` of that = true when `decorative` is absent OR is not `true`. This correctly
requires `altText` for both "decorative absent" and "decorative: false" cases.

**General rule:** Always pair `properties` with `required` when you need a conditional
that must trigger based on a property's presence. A bare `properties` check in a
`if`/`then` is almost always wrong when the property itself can be absent.

See `schema/scene.schema.json`'s `image` type block and its `$comment`, #508.
