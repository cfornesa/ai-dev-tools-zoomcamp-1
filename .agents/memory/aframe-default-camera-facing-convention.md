---
name: aframe-default-camera-facing-convention
description: A-Frame's default camera (rotation "0 0 0") looks down -Z; a camera placed at negative Z with no rotation faces away from origin-centered content, not toward it — vague "position the camera to frame the scene" prompt guidance isn't enough for Mistral to get this right reliably.
metadata:
  type: project
---

`ai_provider/art_piece_provider.py`'s `_AFRAME_SYSTEM_PROMPT` told the
model to "Include an `<a-camera>` ... positioned to frame the scene" with
no concrete coordinate guidance. For prompt "A red circle", Mistral
produced:

```html
<a-entity position="0 1.6 -3" rotation="0 0 0"><a-camera></a-camera></a-entity>
...
<a-circle radius="1" ...></a-circle>  <!-- no position -> defaults to origin -->
```

A-Frame's default camera look direction with `rotation="0 0 0"` is down
the **-Z axis**. A camera at `z=-3` facing further -Z looks *away* from
origin-centered content (at `z=0`), not toward it — the circle rendered
successfully (no error, `ready` postMessage fired) but was never visible,
since it sat entirely outside the camera's view frustum. Confirmed by
reading the live sandboxed iframe's `srcdoc` directly from the parent
frame (a normal DOM attribute, readable despite the `allow-scripts`-only
sandbox with no `allow-same-origin`) — see [#236](https://github.com/cfornesa/ai-dev-tools-zoomcamp-1/issues/236).

**Why:** this is the same class of problem
[[mistral-non-strict-schema-mode]] documents for #204's binding-enum
fix, but for spatial/geometric reasoning rather than an enum constraint:
a vague natural-language instruction ("position the camera to frame the
scene") is not enough to make Mistral reliably reason through a specific
library's default-orientation convention. Canvas2D/SVG/Three.js were
independently confirmed still rendering correctly on the same retest
(an earlier report that all four were blank was a false alarm caused by
screenshotting before the async generation+render had actually
completed, not a real defect in those three).

**How to apply:** when writing or auditing an AI system prompt for any
declarative/spatial output (camera placement, coordinate systems, default
orientations for any 3D/spatial library), give a concrete worked example
or an explicit positive/negative-axis rule rather than trusting a vague
qualitative instruction like "position X to frame Y" — the model needs to
be told the actual convention, not just the goal. Applies to any future
system prompt targeting a spatial/3D output format (A-Frame, Three.js
free-form generation, or the 3D canonical-scene AI provider in
`ai_provider/mistral_provider.py`'s `create_scene3d`/`edit_scene3d`,
which currently only says objects/camera should "frame" a scene without
a concrete coordinate template either — worth auditing if similar
invisible-content reports surface there).
