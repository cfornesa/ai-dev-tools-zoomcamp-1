---
name: Draw.io layer integration
description: Architectural boundary for adding editable draw.io content alongside native scene layers.
---

Treat draw.io content as a separately versioned, validated document layer
inside the project’s native outer layer stack. Keep its internal object model
and object-level undo/selection separate from the native one-shape-per-layer
scene representation. Reuse outer layer ordering, visibility, locking, save,
viewer, embed, and download contracts only through explicit adapters.

**Why:** Native layers and draw.io layers have different object models. Flattening
draw.io objects into native primitives would lose interoperability and make
object-level erasing, transforms, and editable downloads unsafe or ambiguous.

**How to apply:** Establish a bounded supported draw.io format and security
contract before editor work; implement object-level tools before outer-layer
parity; use one renderer/export adapter across public, embed, thumbnail, and
download surfaces; require deterministic fixtures plus fixed-viewport browser
evidence for interaction and visual order. Treat unsupported draw.io features
and official-editor interoperability as explicit boundaries rather than silent
fallbacks.