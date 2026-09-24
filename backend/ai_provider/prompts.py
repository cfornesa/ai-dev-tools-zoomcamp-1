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


def art_piece_2d_prompt(library: str) -> str:
    """Return the canonical 2D create prompt for a supported library."""
    return ART_PIECE_2D_CREATE_PROMPTS["c2js" if library == "c2js-interactive" else library]
