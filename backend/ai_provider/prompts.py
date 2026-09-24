"""Shared generated-art prompt contracts.

Keeping the 2D prompt text here lets every vendor adapter use the exact same
instructions. Provider-specific request/response transport belongs in the
adapter, never in this module.
"""

from __future__ import annotations

ART_PIECE_2D_CREATE_PROMPTS = {
    "canvas2d": """You generate the inner markup for a single generative-art piece \
using ONLY the browser's native Canvas2D API (CanvasRenderingContext2D). Follow these rules \
exactly:

- Respond with ONLY the raw markup -- no prose, no explanation, no markdown code fences \
before or after it.
- Output exactly one <canvas id="art-piece-canvas"> element followed by exactly one \
<script> element that draws to it via canvas.getContext("2d"). Nothing else: no <html>, \
<head>, <body>, <!DOCTYPE>, or any other top-level element.
- The script must be fully self-contained and network-free: never fetch/XMLHttpRequest/ \
WebSocket/EventSource, never a <script src="...">, never @import, never access \
window.top/window.parent/document.cookie/localStorage/sessionStorage, never define or call \
eval()/Function()/setTimeout with a string argument.
- The canvas must size itself to its container (read canvas.clientWidth/clientHeight, or a \
fixed reasonable size like 800x600) and begin drawing immediately without user interaction.
- Prefer requestAnimationFrame for any animation, and make sure the loop is self-terminating \
or bounded -- never an infinitely recursive synchronous call that could hang the page.""",
    "svg": """You generate the markup for a single generative-art piece using ONLY \
inert SVG markup -- no JavaScript at all. Follow these rules exactly:

- Respond with ONLY the raw markup -- no prose, no explanation, no markdown code fences \
before or after it.
- Output exactly one <svg id="art-piece-svg" ...> root element and nothing else: no <html>, \
<head>, <body>, <!DOCTYPE>, <script>, <foreignObject>, or any other top-level element.
- The <svg> must declare a viewBox (e.g. viewBox="0 0 800 600") so it scales to its container, \
and must render its content immediately with no user interaction required.
- Any animation must use SVG's own native animation elements (<animate>, <animateTransform>, \
<animateMotion>) or a <style> block with CSS @keyframes/animation -- never JavaScript, never \
a <script> element of any kind.
- Never reference an external resource: no xlink:href/href to a URL, no <image> with a remote \
src, no @import, no url(...) pointing outside the document. Every color/gradient/pattern must \
be defined inline within the <svg> itself.""",
    "p5js": """You generate plain JavaScript for one p5.js generative-art piece. \
The p5.js library is already loaded globally as `p5`; do not import it or write a script tag. \
Respond with only JavaScript and assign an instance-mode sketch function to `window.sketch`. \
The function receives the p5 instance, must create its canvas in setup, draw immediately, and \
keep all state self-contained. Never fetch a URL, create another script, access cookies or \
storage, or use eval/Function. Use only the p5 API and deterministic inline values.""",
    "c2js": """You generate plain JavaScript for one C2.js generative-art piece. \
The wrapper supplies a `runtime` object with `runtime.canvas`, `runtime.c2`, and \
`runtime.startFrame(callback)`. Respond with only JavaScript and assign a function to \
`window.sketch`; the function receives `runtime`, draws through the supplied canvas context, \
and uses `runtime.startFrame` for animation or interaction. Never fetch a URL, create another \
script, access cookies or storage, or use eval/Function. Keep the source self-contained and \
preserve pointer events for the interactive variant.""",
}

ART_PIECE_REFINE_SYSTEM_PROMPT = (
    "You refine an existing generative art source. Return ONLY valid JSON with this exact "
    'shape: {"edits":[{"search":"exact source text","replace":"replacement text"}]}. '
    "Each search must be copied exactly from the source and must match once. "
    "Do not return prose, markdown, or a complete replacement source."
)

# Shared scene3d instructions.  These are deliberately transport-neutral: the
# Mistral adapter puts them in system messages while Gemini/DeepSeek pass them
# through their compatible structured-output request.  Keep the vocabulary in
# one place so provider behavior cannot silently diverge.
SCENE3D_DRAWING_PLANE_RULES = (
    '\n- A "drawingPlane" is a FLAT PLANE holding a 2D vector drawing. It requires positive '
    "world-unit width and height and a drawing object with integer width and height, a hex "
    "background or null, and shapes. Unless the prompt says otherwise use width 4, height 3 "
    "and a 1024x768 drawing with a white background."
    '\n- Drawing shapes have unique ids and exactly one of "rect", "ellipse", "line", or "path". '
    "Coordinates are pixels in the drawing (origin top-left, y downward); keep within the "
    "drawing dimensions, with at most 500 shapes and 2000 path points."
    '\n- Place and move a "drawingPlane" with its transform. Rotate it horizontally with '
    "rotation.x = -90 and vertically with rotation.x = 0."
    '\n- Resizing a "drawingPlane" changes width and height by the SAME factor. Change them by '
    "different factors only when the prompt explicitly asks to elongate, stretch, widen, or "
    "make it taller."
    '\n- Any object may have animation with kind "rotate", "orbit", "oscillate", or "pulse"; '
    'axis x, y, '
    "or z; speed; amplitude; and center for orbit. Remove animation to stop it.\n"
)

SCENE3D_CREATE_PROMPT = (
    "You generate one canonical 3D scene document for a gesture-reactive animation editor.\n"
    "\n- Respond with ONLY one JSON object matching the supplied scene3d schema; never return "
    "prose, markdown, code, or XML."
    "\n- schemaVersion is 1 and documentType is scene3d. Objects are box, sphere, cylinder, "
    "plane, or drawingPlane and always include their type-specific dimensions. If size is "
    'unspecified, use box {"width": 1, "height": 1, "depth": 1}; sphere {"radius": 1}; '
    'cylinder {"radiusTop": 1, "radiusBottom": 1, "height": 1}; plane {"width": 1, '
    '"height": 1}. Lights are directional, point, or ambient objects with "id", "type", '
    '"color", and "intensity".'
    "\n- Every object's groupId is an existing group id or null. When the prompt implies a "
    "name for an object or light, preserve it in name. Keep the scene to a few dozen "
    "objects, groups, and lights.\n" + SCENE3D_DRAWING_PLANE_RULES
)

SCENE3D_CONVERT_PROMPT = (
    "You convert a 2D canonical scene into a new complete 3D scene document.\n"
    "\n- Respond with ONLY one JSON object matching the supplied scene3d schema; never return "
    "prose, markdown, code, or XML."
    "\n- Convert every circle to a sphere and every rect to a box, preserving relative position, "
    "size, and name. Skip line, path, particleEmitter, and image entirely; never approximate "
    "them."
    "\n- Include a reasonable camera and at least one directional or ambient light. Objects are "
    "box, sphere, cylinder, or plane with all type-specific dimensions and the scene stays "
    "within a few dozen objects.\n" + SCENE3D_DRAWING_PLANE_RULES
)

SCENE3D_EDIT_PROMPT = (
    "You propose a minimal JSON Patch editing an existing canonical 3D scene.\n"
    "\n- Respond with ONLY a JSON Patch array using add, replace, or remove. Include value for "
    "add/replace and omit it for remove. Return [] when the edit is not expressible."
    "\n- Change only element/property paths under /objects, /groups, /lights, /camera, "
    "/scene/backgroundColor, or /randomness/enabled; never change schemaVersion, documentType, "
    "the scene id, randomness.seed, or an existing item's id."
    "\n- Address existing objects, groups, or lights by their name when the prompt provides one. "
    "Drawing planes and animations are edited only under /objects; never emit code or markup "
    "as a value.\n" + SCENE3D_DRAWING_PLANE_RULES
)


def art_piece_2d_prompt(library: str) -> str:
    """Return the canonical 2D create prompt for a supported library."""
    return ART_PIECE_2D_CREATE_PROMPTS["c2js" if library == "c2js-interactive" else library]
