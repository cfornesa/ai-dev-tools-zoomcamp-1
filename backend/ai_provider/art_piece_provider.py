"""Issue #199 (epic #196): generates a raw, self-contained art-piece snippet
(Canvas2D, SVG, Three.js, or A-Frame) from a prompt, per #197's architecture
decision.

## Why this is a separate module, not `MistralSceneProvider`

`mistral_provider.py`'s `MistralSceneProvider` is built entirely around
Task 45's structured-scene contract: a JSON-schema-constrained response,
validated by `scenes.validation.validate_scene` before a caller ever sees
it. Issue #197 decided that non-p5.js libraries generate **raw code with
no structured scene-JSON backing** -- there is no schema to validate
against here, and forcing this through `MistralSceneProvider`'s
`response_format={"type": "json_schema", ...}` contract would be the wrong
shape of request entirely. This module mirrors `MistralSceneProvider`'s
error-handling conventions (the same four `ai_provider.errors` exception
types, the same personal-credential-only access model, the same raw-size
safety net) without inheriting its scene-specific machinery.

## Trust boundary (read before changing the system prompt)

Per #197's decision, a generated piece is a new, fully untrusted trust
boundary -- this module's job ends at producing a bounded, plausible-
looking code snippet; it is NOT what makes the result safe to execute.
Safety comes from the frontend rendering the snippet inside a sandboxed
`<iframe sandbox="allow-scripts">` (never `allow-same-origin`) wrapped in
a server-independent, deterministic CSP the frontend itself controls (see
`frontend/src/generative/artPieceSandbox.ts`) -- never from trusting this
module's system prompt to have been obeyed. The system prompt below asks
for network-free, self-contained code purely to make a well-behaved
result *likely*; it is not a security control.
"""

from __future__ import annotations

import json
import re
from dataclasses import dataclass
from typing import Any

import httpx

from ai_provider.deepseek_provider import DeepSeekHttpClient
from ai_provider.errors import (
    AIProviderCancelledError,
    AIProviderQuotaError,
    AIProviderRejectionError,
    AIProviderTimeoutError,
)
from ai_provider.gemini_provider import GeminiHttpClient
from ai_provider.interface import AIUsageMetadata
from ai_provider.prompts import (
    ART_PIECE_REFINE_SYSTEM_PROMPT,
    art_piece_2d_prompt,
    art_piece_region_rule,
)
from scenes.art_piece_contract import (
    GENERATABLE_ART_PIECE_ENGINES,
    SUPPORTED_ART_PIECE_ENGINES,
)

# Every library this endpoint supports. Kept as a real constant (not
# inlined) so `ArtPieceGenerateRequestSerializer` and any future library
# addition both read from the one place.
SUPPORTED_LIBRARIES = SUPPORTED_ART_PIECE_ENGINES

# Issue #199 (Three.js/A-Frame extension): unlike Canvas2D/SVG, these two
# libraries need their own runtime loaded via a pinned CDN `<script>` the
# frontend injects into the sandboxed document
# (`frontend/src/generative/artPieceSandbox.ts`) -- never a URL the AI
# supplies. Exposed here so the frontend and this module agree on exactly
# one version per library without duplicating the string.
THREEJS_VERSION = "0.160.0"
THREEJS_CDN_URL = f"https://cdn.jsdelivr.net/npm/three@{THREEJS_VERSION}/build/three.min.js"
# Pinned to 1.4.2, not the latest 1.5.x: jsdelivr's aframe@1.5.0 npm
# package does not publish a `dist/aframe.min.js` file at all (confirmed
# 404 live in production while investigating #236 -- its minified build
# is only available as `dist/aframe-master.min.js` under that version),
# so every 1.5.0 art piece failed to load the A-Frame runtime and
# rendered blank regardless of what the AI generated. 1.4.2 is the
# newest release confirmed to still publish the expected filename.
AFRAME_VERSION = "1.4.2"
AFRAME_CDN_URL = f"https://cdn.jsdelivr.net/npm/aframe@{AFRAME_VERSION}/dist/aframe.min.js"

DEFAULT_MODEL = "mistral-small-latest"
REQUEST_TIMEOUT_MS = 20_000

# A self-contained art-piece snippet is expected to be far smaller than a
# full scene JSON document; this is a raw pre-parse safety net (independent
# of `MAX_SNIPPET_CHARS` below, which bounds the *validated* result),
# mirroring `mistral_provider.py`'s `MAX_RAW_RESPONSE_BYTES` precedent.
MAX_RAW_RESPONSE_BYTES = 200_000
# Belt-and-suspenders cap on the actual returned snippet after stripping
# any stray markdown fence/whitespace the model might still emit despite
# being told not to.
MAX_SNIPPET_CHARS = 150_000

# Rollback switch for the inline-script contract. The frontend sandbox remains
# the security boundary; this only controls whether the generator's shape
# validator accepts the new source form.
ART_PIECE_ALLOW_INLINE_SCRIPT = True
ART_PIECE_EXTRACT = True
ART_PIECE_RUBRIC = "structural"

_ESTIMATED_PROMPT_COST_PER_1K = 0.002
_ESTIMATED_COMPLETION_COST_PER_1K = 0.006

RESPONSE_TOO_LARGE_PREFIX = "response_too_large:"
EMPTY_OR_MALFORMED_PREFIX = "empty_or_malformed:"
ENGINE_UNAVAILABLE_PREFIX = "engine_unavailable:"

# Issue #199 (Three.js extension): the AI writes plain JavaScript, not
# markup -- the sandboxed document (`artPieceSandbox.ts`) loads Three.js
# itself from a pinned CDN URL this module names above and provides the
# container div; the AI's script never declares its own <script>/<canvas>
# tags or chooses its own Three.js version/source.
_THREEJS_SYSTEM_PROMPT = """You generate plain JavaScript (no HTML, no markup) for a single \
generative-art piece using the Three.js library. The Three.js library is already loaded as \
the global `THREE` object -- do not import it, do not reference a version, do not write a \
<script> tag. Follow these rules exactly:

- Respond with ONLY the raw JavaScript -- no prose, no explanation, no markdown code fences, \
no <script> tags, no HTML of any kind.
- A `<div id="art-piece-container">` already exists in the page; create a `THREE.WebGLRenderer` \
sized to that container's clientWidth/clientHeight and append its `.domElement` to it. Do not \
create or reference any other container.
- Build a `THREE.Scene`, a camera, and whatever meshes/lights the prompt calls for, then render \
immediately without user interaction.
- The script must be fully self-contained and network-free: never fetch/XMLHttpRequest/ \
WebSocket/EventSource, never load a texture or asset from a URL, never access \
window.top/window.parent/document.cookie/localStorage/sessionStorage, never define or call \
eval()/Function()/setTimeout with a string argument, never create another <script> element.
- Prefer requestAnimationFrame for any animation, and make sure the loop is self-terminating or \
bounded -- never an infinitely recursive synchronous call that could hang the page.
- After creating your camera, register it exactly once so the viewer can steer it with real hand \
gestures: `window.__registerArtPieceCamera({ getPose: function () { return { x: camera.position.x, \
y: camera.position.y, z: camera.position.z }; }, setPose: function (x, y, z) { \
camera.position.set(x, y, z); camera.lookAt(0, 0, 0); } });` -- replace `camera` with whatever \
variable name you gave your camera. Always include this call; omitting it leaves hand-gesture \
steering with nothing to control.
- For a sun/planet/moon orbital system, create a planet `THREE.Group` and parent the planet \
mesh to it; parent the moon to the planet group and derive the moon's world position from the \
planet's current position plus a faster local orbit. Enable the renderer's shadow map and set \
both `castShadow` and `receiveShadow` on the visible meshes and the sun light."""

# Issue #199 (A-Frame extension): like SVG, this is declarative markup
# only -- A-Frame's own built-in geometry/material/animation components
# cover most generative-art use cases without custom JavaScript. Inline
# component code is permitted where the prompt requires it; external scripts
# remain forbidden.
_AFRAME_SYSTEM_PROMPT = """You generate the markup for a single generative-art piece using \
A-Frame's \
HTML. One inline <script> is permitted for custom component lifecycle code and event listeners; \
never use a script src attribute. The A-Frame library is \
already loaded -- do not reference a version or write a <script src="..."> for it. Follow \
these rules exactly:

- Respond with ONLY the raw markup -- no prose, no explanation, no markdown code fences before \
or after it.
- Output exactly one <a-scene id="art-piece-scene" embedded> element and its children (entities, \
primitives like <a-box>/<a-sphere>/<a-cylinder>/<a-plane>, lights, camera, and at most one inline \
<script>) and nothing else: no <html>, <head>, <body>, or <!DOCTYPE>.
- Include an <a-camera> (or a camera-carrying <a-entity>) positioned so the generated geometry is \
actually visible, and any lighting needed to see the geometry -- do not rely on A-Frame's default \
lighting alone if the scene has custom materials.
- Camera placement is the most common mistake -- follow this rule exactly: A-Frame's default \
camera orientation (rotation="0 0 0") looks down the -Z axis. If your geometry is centered near \
the origin (0 0 0), the camera must sit at a POSITIVE Z offset with rotation="0 0 0" so it looks \
back toward the origin -- e.g. <a-entity position="0 1.6 4" rotation="0 0 0"><a-camera></a-camera>\
</a-entity>. A camera at a NEGATIVE Z position with rotation="0 0 0" looks away from \
origin-centered content and will render nothing visible -- never do this. If you rotate the \
camera to look in a different direction, or move the geometry away from the origin, you must \
adjust the camera's position/rotation together so it still points at the geometry.
- A flat shape (<a-circle>, <a-plane>) rotated to lie flat as a floor -- e.g. rotation="-90 0 0" \
-- has its visible face pointing straight up, not toward a horizontally-placed camera: from a \
camera at the same height looking horizontally, a flat floor-facing shape is edge-on and \
effectively invisible even though `material: side: double` is set. For a simple shape described \
without any scene/room context (e.g. "a red circle", "a blue square"), leave it at its default \
rotation="0 0 0" so its face points down the +Z axis, directly at a camera positioned on the \
positive-Z axis looking back toward the origin -- do not rotate it to lie flat unless the prompt \
actually describes a floor, ground, or table the shape sits on, and if it does, tilt the camera \
downward (e.g. rotation="-45 0 0" on the camera entity) so it looks down at the flat shape \
instead of across it.
- Any animation should use A-Frame's built-in `animation` component (e.g. \
animation="property: rotation; to: 0 360 0; loop: true; dur: 4000") unless custom inline \
JavaScript is required by the prompt.
- Never reference an external resource: no `src` pointing at a URL for any asset, texture, or \
model, no <a-assets> item loaded from a remote path. Every color/material must be defined \
inline via A-Frame's own material/color attributes.
- For a custom interaction prompt, register the custom component with lifecycle code and an event \
listener, attach it to the relevant entity, and update the named targets together on every \
trigger."""


@dataclass(frozen=True)
class ArtPieceResult:
    """Discriminated result: exactly one of `code` (a validated-shape
    snippet, never executed or schema-checked server-side) or `error`.
    Mirrors `ai_provider.interface.AIOperationResult`'s shape without its
    scene-specific fields."""

    usage: AIUsageMetadata
    code: str | None = None
    error: str | None = None
    regions: list[dict[str, int | str]] | None = None
    warnings: list[str] | None = None

    def __post_init__(self) -> None:
        if (self.code is None) == (self.error is None):
            raise ValueError("ArtPieceResult must carry exactly one of `code` or `error`.")
        if self.code is None and (self.regions or self.warnings):
            raise ValueError("ArtPieceResult errors cannot carry region metadata.")


@dataclass(frozen=True)
class ArtPieceRefineResult:
    usage: AIUsageMetadata
    edits: list[dict[str, str]] | None = None
    ink: dict[str, Any] | None = None
    error: str | None = None

    def __post_init__(self) -> None:
        if sum(value is not None for value in (self.edits, self.ink, self.error)) != 1:
            raise ValueError(
                "ArtPieceRefineResult must carry exactly one of `edits`, `ink`, or `error`."
            )


class ArtPieceProvider:
    """Issue #199: generates one raw Canvas2D snippet per call. Every
    caller already holds the requesting user's own personal Mistral
    credential (see `scenes/art_piece_api.py`'s `get_art_piece_provider`,
    mirroring `scenes/ai_api.py`'s identical `get_ai_provider` pattern) --
    there is no shared server credential this provider ever touches."""

    def __init__(
        self,
        *,
        vendor: str = "mistral",
        api_key: str | None = None,
        model: str | None = None,
        persona_prompt: str | None = None,
        client: Any | None = None,
        timeout_ms: int = REQUEST_TIMEOUT_MS,
    ) -> None:
        self.vendor = vendor.strip().lower()
        self._api_key = api_key
        self._client = client
        self.model = model or DEFAULT_MODEL
        self.persona_prompt = persona_prompt
        self.timeout_ms = timeout_ms

    @property
    def client(self):
        if self._client is None:
            if self.vendor == "gemini":
                self._client = GeminiHttpClient(self._api_key or "")
            elif self.vendor == "deepseek":
                self._client = DeepSeekHttpClient(self._api_key or "")
            else:
                from mistralai.client import Mistral

                self._client = Mistral(api_key=self._api_key)
        return self._client

    def _complete(
        self,
        *,
        system_prompt: str,
        prompt: str,
        temperature: float,
        messages: list[dict[str, str]] | None = None,
    ):
        if self.vendor == "mistral":
            return self.client.chat.complete(
                model=self.model,
                messages=messages
                or [
                    {"role": "system", "content": system_prompt},
                    {"role": "user", "content": prompt},
                ],
                temperature=temperature,
                timeout_ms=self.timeout_ms,
            )
        return self.client.generate(
            model=self.model,
            system_instruction=(
                "\n\n".join(
                    message["content"]
                    for message in (messages or [])
                    if message["role"] == "system"
                )
                or system_prompt
            ),
            prompt=prompt,
            response_schema={"type": "string"},
        )

    @staticmethod
    def _response_content(response: Any, *, unwrap_json_string: bool = False) -> str:
        if hasattr(response, "text"):
            content = str(response.text)
            if unwrap_json_string:
                try:
                    decoded = json.loads(content)
                except json.JSONDecodeError:
                    pass
                else:
                    if isinstance(decoded, str):
                        return decoded
            return content
        choice = response.choices[0]
        return (
            choice.message.content
            if isinstance(choice.message.content, str)
            else str(choice.message.content)
        )

    @staticmethod
    def _response_usage(response: Any) -> AIUsageMetadata:
        if hasattr(response, "prompt_tokens"):
            prompt_tokens = int(getattr(response, "prompt_tokens", 0) or 0)
            completion_tokens = int(getattr(response, "completion_tokens", 0) or 0)
        else:
            usage_info = getattr(response, "usage", None)
            prompt_tokens = int(getattr(usage_info, "prompt_tokens", 0) or 0)
            completion_tokens = int(getattr(usage_info, "completion_tokens", 0) or 0)
        return AIUsageMetadata(
            prompt_tokens=prompt_tokens,
            completion_tokens=completion_tokens,
            estimated_cost_usd=(
                (prompt_tokens / 1000) * _ESTIMATED_PROMPT_COST_PER_1K
                + (completion_tokens / 1000) * _ESTIMATED_COMPLETION_COST_PER_1K
            ),
        )

    def generate(self, prompt: str, library: str) -> ArtPieceResult:  # noqa: C901
        zero_usage = AIUsageMetadata(prompt_tokens=0, completion_tokens=0, estimated_cost_usd=0.0)
        if library not in SUPPORTED_LIBRARIES:
            # Defense in depth: `ArtPieceGenerateRequestSerializer` already
            # restricts `library` to `SUPPORTED_LIBRARIES` before this is
            # ever called, so this is a genuine bug (a new caller bypassing
            # the serializer), not a documented provider condition -- raise
            # rather than fold into `ArtPieceResult.error`.
            raise ValueError(f"Unsupported library: {library!r}")
        if library not in GENERATABLE_ART_PIECE_ENGINES:
            return ArtPieceResult(
                code=None,
                usage=zero_usage,
                error=f"{ENGINE_UNAVAILABLE_PREFIX}{library}",
            )

        system_prompt = (
            art_piece_2d_prompt(library)
            if library in {"canvas2d", "svg", "p5js", "c2js", "c2js-interactive"}
            else {"threejs": _THREEJS_SYSTEM_PROMPT, "aframe": _AFRAME_SYSTEM_PROMPT}[library]
        )
        if library in {"threejs", "aframe"}:
            system_prompt += "\n- " + art_piece_region_rule(library)

        messages = [{"role": "system", "content": system_prompt}]
        if self.persona_prompt:
            messages.append({"role": "system", "content": self.persona_prompt})
        messages.append({"role": "user", "content": prompt})

        try:
            response = self._complete(
                system_prompt=system_prompt,
                prompt=prompt,
                temperature=0.7,
                messages=messages,
            )
        except httpx.TimeoutException:
            return self._error_result(
                zero_usage,
                AIProviderTimeoutError(f"Mistral did not respond within {self.timeout_ms}ms."),
            )
        except httpx.HTTPError:
            return self._error_result(
                zero_usage,
                AIProviderRejectionError(
                    f"{self.vendor.title()} request failed (network/connection error)."
                ),
            )
        except (
            AIProviderTimeoutError,
            AIProviderCancelledError,
            AIProviderQuotaError,
            AIProviderRejectionError,
        ) as exc:
            return self._error_result(zero_usage, exc)
        except Exception as exc:  # Mistral SDK error types (lazy-imported below)
            if self.vendor != "mistral":
                raise
            from mistralai.client.errors import MistralError

            if not isinstance(exc, MistralError):
                raise  # a genuine bug, not a documented provider condition

            status = getattr(exc, "status_code", None)
            if status == 429:
                return self._error_result(
                    zero_usage,
                    AIProviderQuotaError(
                        "Mistral reported its account/API rate limit or quota was exceeded."
                    ),
                )
            if status in (408, 504):
                return self._error_result(
                    zero_usage,
                    AIProviderTimeoutError(
                        f"Mistral reported a request timeout (status {status})."
                    ),
                )
            return self._error_result(
                zero_usage,
                AIProviderRejectionError(f"Mistral provider request failed (status {status})."),
            )

        usage = self._response_usage(response)

        try:
            content = self._response_content(response, unwrap_json_string=self.vendor != "mistral")
        except (AttributeError, IndexError, TypeError):
            return self._error_result(
                usage, AIProviderRejectionError("Mistral response contained no message content.")
            )

        text = content if isinstance(content, str) else str(content)
        raw_bytes = len(text.encode("utf-8"))
        if raw_bytes > MAX_RAW_RESPONSE_BYTES:
            return ArtPieceResult(
                usage=usage,
                error=(
                    f"{RESPONSE_TOO_LARGE_PREFIX}Mistral's response was {raw_bytes} bytes, "
                    f"exceeding the {MAX_RAW_RESPONSE_BYTES}-byte limit."
                ),
            )

        snippet = extract_snippet(text, library)
        snippet_ok, snippet_reason = _looks_like_snippet(snippet, library, prompt)
        showcase_ok, showcase_reason = _looks_like_requested_showcase(snippet, prompt, library)
        if not snippet_ok or not showcase_ok or len(snippet) > MAX_SNIPPET_CHARS:
            reason = snippet_reason or showcase_reason
            if len(snippet) > MAX_SNIPPET_CHARS:
                reason = "snippet_too_large"
            return ArtPieceResult(
                usage=usage,
                error=(f"{EMPTY_OR_MALFORMED_PREFIX}{reason or 'invalid_snippet'}"),
            )

        regions = parse_regions(snippet, library)
        warnings = [] if regions else ["missing_layer_markers"]
        return ArtPieceResult(usage=usage, code=snippet, regions=regions, warnings=warnings)

    def refine(  # noqa: C901
        self,
        instruction: str,
        source: str,
        library: str,
        target_references: list[str],
        *,
        ink_document: dict[str, Any] | None = None,
    ) -> ArtPieceRefineResult:
        """Return bounded find/replace edits for an existing source."""
        zero_usage = AIUsageMetadata(prompt_tokens=0, completion_tokens=0, estimated_cost_usd=0.0)
        if library not in SUPPORTED_LIBRARIES:
            raise ValueError(f"Unsupported library: {library!r}")
        system_prompt = ART_PIECE_REFINE_SYSTEM_PROMPT
        prompt = json.dumps(
            {
                "instruction": instruction,
                "engine": library,
                "target_references": target_references,
                "current_source": source,
                "current_ink": ink_document,
            },
            ensure_ascii=False,
        )
        try:
            response = self._complete(
                system_prompt=system_prompt,
                prompt=prompt,
                temperature=0.4,
            )
        except httpx.TimeoutException:
            return ArtPieceRefineResult(
                usage=zero_usage, error=f"Mistral did not respond within {self.timeout_ms}ms."
            )
        except httpx.HTTPError:
            return ArtPieceRefineResult(
                usage=zero_usage, error=f"{self.vendor.title()} request failed."
            )
        except (
            AIProviderTimeoutError,
            AIProviderCancelledError,
            AIProviderQuotaError,
            AIProviderRejectionError,
        ) as exc:
            return ArtPieceRefineResult(usage=zero_usage, error=str(exc))
        except Exception as exc:
            if self.vendor != "mistral":
                raise
            from mistralai.client.errors import MistralError

            if not isinstance(exc, MistralError):
                raise
            return ArtPieceRefineResult(usage=zero_usage, error="Mistral provider request failed.")

        usage = self._response_usage(response)
        try:
            content = self._response_content(response)
            payload = json.loads(content if isinstance(content, str) else str(content))
            if "ink" in payload:
                ink = payload["ink"]
                if not isinstance(ink, dict):
                    raise ValueError
                return ArtPieceRefineResult(usage=usage, ink=ink)
            edits = payload["edits"]
            if (
                not isinstance(edits, list)
                or not edits
                or not all(
                    isinstance(edit, dict)
                    and isinstance(edit.get("search"), str)
                    and isinstance(edit.get("replace"), str)
                    for edit in edits
                )
            ):
                raise ValueError
        except (AttributeError, IndexError, TypeError, KeyError, ValueError, json.JSONDecodeError):
            return ArtPieceRefineResult(
                usage=usage, error="Provider returned invalid refinement edits."
            )
        return ArtPieceRefineResult(usage=usage, edits=edits)

    @staticmethod
    def _error_result(usage: AIUsageMetadata, exc: Exception) -> ArtPieceResult:
        return ArtPieceResult(usage=usage, error=str(exc))


def _strip_markdown_fence(text: str) -> str:
    """Best-effort removal of a stray ```html/```/``` wrapper -- the system
    prompt asks the model not to emit one, but this is cheap defense in
    depth against a model that does anyway."""
    stripped = text.strip()
    if stripped.startswith("```"):
        first_newline = stripped.find("\n")
        if first_newline != -1:
            stripped = stripped[first_newline + 1 :]
        if stripped.endswith("```"):
            stripped = stripped[:-3]
    return stripped.strip()


def extract_snippet(text: str, library: str) -> str:
    """Recover the first plausible generated snippet from model wrapper prose."""

    if not ART_PIECE_EXTRACT:
        return _strip_markdown_fence(text)

    fenced = re.search(r"```[^\n`]*\n(.*?)```", text, flags=re.DOTALL)
    if fenced:
        return fenced.group(1).strip()

    tag_pairs = {
        "svg": (r"<svg\b", r"</svg>"),
        "aframe": (r"<a-scene\b", r"</a-scene>"),
    }
    pair = tag_pairs.get(library)
    if pair:
        match = re.search(f"({pair[0]}.*?{pair[1]})", text, flags=re.IGNORECASE | re.DOTALL)
        if match:
            return match.group(1).strip()

    if library == "canvas2d":
        match = re.search(r"(<canvas\b.*?</script>)", text, flags=re.IGNORECASE | re.DOTALL)
        if match:
            return match.group(1).strip()
    elif library in {"p5js", "c2js", "c2js-interactive"}:
        match = re.search(r"(window\.sketch\s*=.*)", text, flags=re.IGNORECASE | re.DOTALL)
        if match:
            return match.group(1).strip()

    return _strip_markdown_fence(text)


def _legacy_looks_like_snippet(snippet: str, library: str, prompt: str = "") -> bool:
    if not snippet:
        return False
    lowered = snippet.lower()
    if library == "canvas2d":
        return "<canvas" in lowered and "<script" in lowered
    if library == "svg":
        return "<svg" in lowered and _allows_inline_script(lowered, prompt)
    if library == "threejs":
        # Plain JavaScript expected -- reject anything that looks like the
        # model wrapped its own markup/script tag around the code (the
        # sandboxed document supplies the <script> tag and the THREE
        # global itself; see `artPieceSandbox.ts`), or referenced a THREE
        # CDN/version of its own rather than using the one already loaded.
        has_markup = "<script" in lowered or "<html" in lowered or "<canvas" in lowered
        return "three." in lowered and not has_markup
    if library == "p5js":
        return "window.sketch" in lowered and "p.setup" in lowered
    if library in {"c2js", "c2js-interactive"}:
        return "window.sketch" in lowered and "startframe" in lowered
    if "<a-scene" not in lowered:
        return False
    # Inline component code is allowed for every A-Frame prompt. The sandbox's
    # opaque origin and CSP still contain that code; external script URLs
    # remain rejected here.
    if "<script" not in lowered:
        return True
    return _allows_inline_script(lowered, prompt)


def _allows_inline_script(lowered: str, prompt: str) -> bool:
    if re.search(r"<script\b[^>]*\bsrc\s*=", lowered) is not None:
        return False
    if ART_PIECE_ALLOW_INLINE_SCRIPT:
        return True
    return "light-switch" in prompt.casefold() and "aframe.registercomponent" in lowered


def _looks_like_snippet(  # noqa: C901
    snippet: str, library: str, prompt: str = ""
) -> tuple[bool, str | None]:
    if ART_PIECE_RUBRIC == "legacy":
        legacy_ok = _legacy_looks_like_snippet(snippet, library, prompt)
        return (legacy_ok, None) if legacy_ok else (False, "invalid_snippet")
    if not snippet:
        return False, "empty_snippet"
    lowered = snippet.lower()
    if library == "canvas2d":
        if "<canvas" not in lowered:
            return False, "missing_canvas_root"
        if "<script" not in lowered:
            return False, "missing_canvas_script"
        return True, None
    if library == "svg":
        if "<svg" not in lowered:
            return False, "missing_svg_root"
        if re.search(r"<script\b[^>]*\bsrc\s*=", lowered):
            return False, "script_src_external"
        return True, None
    if library == "threejs":
        if "three." not in lowered:
            return False, "missing_threejs_marker"
        if any(marker in lowered for marker in ("<script", "<html", "<canvas")):
            return False, "threejs_wrapped_markup"
        return True, None
    if library == "p5js":
        if "window.sketch" not in lowered:
            return False, "missing_p5_sketch"
        if "p.setup" not in lowered:
            return False, "missing_p5_setup"
        return True, None
    if library in {"c2js", "c2js-interactive"}:
        if "window.sketch" not in lowered:
            return False, "missing_c2_sketch"
        if "startframe" not in lowered:
            return False, "missing_start_frame"
        return True, None
    if "<a-scene" not in lowered:
        return False, "missing_aframe_root"
    if "<script" in lowered and not _allows_inline_script(lowered, prompt):
        return False, "script_src_external"
    return True, None


def _legacy_looks_like_requested_showcase(snippet: str, prompt: str, library: str) -> bool:
    """Reject generic fallbacks for the two fixed showcase prompts only."""

    prompt_words = prompt.casefold()
    lowered = snippet.casefold()
    if library == "threejs" and all(word in prompt_words for word in ("sun", "planet", "moon")):
        required_groups = "three.group" in lowered or "new three.group" in lowered
        required_hierarchy = "planet" in lowered and "moon" in lowered
        required_world_position = "getworldposition" in lowered or (
            "planet.position" in lowered and "moon.position" in lowered
        )
        required_shadows = all(
            marker in lowered for marker in ("shadowmap", "castshadow", "receiveshadow")
        )
        return (
            required_groups and required_hierarchy and required_world_position and required_shadows
        )
    if library == "aframe" and "light-switch" in prompt_words:
        return (
            all(
                marker in lowered
                for marker in (
                    "aframe.registercomponent",
                    "addeventlistener",
                    "light-switch",
                    "lamp",
                    "emissive",
                )
            )
            and lowered.count("lamp") >= 2
        )
    if library == "p5js" and all(
        word in prompt_words for word in ("particles", "gravity", "collision")
    ):
        required_state = all(
            marker in lowered for marker in ("particles", "mass", "radius", "velocity")
        )
        required_loop = "p.draw" in lowered and lowered.count("for") >= 2
        required_physics = any(marker in lowered for marker in ("dist(", "distance", "gravity"))
        required_stability = any(marker in lowered for marker in ("constrain", "clamp", "limit"))
        return required_state and required_loop and required_physics and required_stability
    if library in {"c2js", "c2js-interactive"} and all(
        word in prompt_words for word in ("recursive", "fractal", "tree")
    ):
        required_recursion = "function" in lowered and lowered.count("function") >= 1
        required_self_call = any(
            marker in lowered for marker in ("drawtree(", "branch(", "fractal(", "recursive(")
        )
        required_base_case = any(
            marker in lowered for marker in ("depth <=", "depth<", "level <=", "level<")
        )
        required_render = "startframe" in lowered and any(
            marker in lowered for marker in ("lineto", "stroke", "fill", "drawtree", "branch")
        )
        return required_recursion and required_self_call and required_base_case and required_render
    if library == "c2js-interactive" and all(
        word in prompt_words for word in ("paint", "stroke", "undo", "redo")
    ):
        required_state = all(marker in lowered for marker in ("strokes", "points", "color"))
        required_input = any(
            marker in lowered for marker in ("pointerdown", "pointermove", "touchstart")
        )
        required_history = "undo" in lowered and "redo" in lowered
        required_blending = any(
            marker in lowered for marker in ("globalcompositeoperation", "globalalpha", "alpha")
        )
        return required_state and required_input and required_history and required_blending
    if library == "svg" and (
        "animated gauge" in prompt_words
        or "progress-ring" in prompt_words
        or "progress ring" in prompt_words
    ):
        required_structure = all(
            marker in lowered
            for marker in (
                "<svg",
                "viewbox",
                "<circle",
                "<clippath",
                "<lineargradient",
                "stroke-dasharray",
                "stroke-dashoffset",
            )
        )
        required_references = "clip-path" in lowered and "url(#" in lowered
        required_animation = any(
            marker in lowered for marker in ("<animate", "@keyframes", "animation:")
        )
        required_circumference = any(
            marker in lowered for marker in ("circumference", "2π", "2*pi", "2 * pi", "2 * π")
        )
        return (
            required_structure
            and required_references
            and required_animation
            and required_circumference
        )
    return True


def _looks_like_requested_showcase(  # noqa: C901
    snippet: str, prompt: str, library: str
) -> tuple[bool, str | None]:
    if ART_PIECE_RUBRIC == "legacy":
        legacy_ok = _legacy_looks_like_requested_showcase(snippet, prompt, library)
        return (legacy_ok, None) if legacy_ok else (False, "showcase_structure_mismatch")

    prompt_words = prompt.casefold()
    lowered = snippet.casefold()
    checks: tuple[tuple[bool, str], ...]
    if library == "threejs" and all(word in prompt_words for word in ("sun", "planet", "moon")):
        checks = (
            ("three.group" in lowered or "new three.group" in lowered, "missing_group_hierarchy"),
            ("planet" in lowered and "moon" in lowered, "missing_orbital_entities"),
            (
                "getworldposition" in lowered or "planet.position" in lowered,
                "missing_relative_orbit",
            ),
            (
                all(marker in lowered for marker in ("shadowmap", "castshadow", "receiveshadow")),
                "missing_shadows",
            ),
        )
        return next(((False, reason) for ok, reason in checks if not ok), (True, None))
    if library == "aframe" and any(word in prompt_words for word in ("click", "gaze", "switch")):
        checks = (
            ("aframe.registercomponent" in lowered, "missing_registerComponent"),
            ("addeventlistener" in lowered, "missing_event_listener"),
            (
                any(
                    marker in lowered
                    for marker in ("emissive", "setattribute", "intensity", "material")
                ),
                "missing_light_mutation",
            ),
        )
        return next(((False, reason) for ok, reason in checks if not ok), (True, None))
    if (
        library == "p5js"
        and any(word in prompt_words for word in ("gravity", "attract"))
        and any(word in prompt_words for word in ("collision", "bounce"))
    ):
        checks = (
            (
                all(marker in lowered for marker in ("particles", "mass", "radius", "velocity")),
                "missing_particle_state",
            ),
            ("p.draw" in lowered and lowered.count("for") >= 2, "missing_particle_loop"),
            (
                any(marker in lowered for marker in ("dist(", "distance", "gravity")),
                "missing_gravity",
            ),
            (
                any(marker in lowered for marker in ("constrain", "clamp", "limit")),
                "missing_stability_guard",
            ),
        )
        return next(((False, reason) for ok, reason in checks if not ok), (True, None))
    if library == "c2js" and "fractal" in prompt_words and "tree" in prompt_words:
        checks = (
            ("function" in lowered, "missing_recursive_function"),
            (
                any(marker in lowered for marker in ("drawtree(", "branch(", "fractal(")),
                "missing_recursive_call",
            ),
            (
                any(marker in lowered for marker in ("depth<", "depth <=", "level<", "level <=")),
                "missing_recursion_base_case",
            ),
            (
                "startframe" in lowered
                and any(marker in lowered for marker in ("lineto", "stroke", "fill")),
                "missing_fractal_render",
            ),
        )
        return next(((False, reason) for ok, reason in checks if not ok), (True, None))
    if library == "c2js-interactive" and all(
        word in prompt_words for word in ("paint", "stroke", "undo", "redo")
    ):
        checks = (
            (
                all(marker in lowered for marker in ("strokes", "points", "color")),
                "missing_stroke_state",
            ),
            (
                any(marker in lowered for marker in ("pointerdown", "pointermove", "touchstart")),
                "missing_paint_input",
            ),
            ("undo" in lowered and "redo" in lowered, "missing_history_controls"),
            (
                any(
                    marker in lowered
                    for marker in ("globalcompositeoperation", "globalalpha", "alpha")
                ),
                "missing_blending",
            ),
        )
        return next(((False, reason) for ok, reason in checks if not ok), (True, None))
    if library == "svg" and any(
        word in prompt_words for word in ("gauge", "speedometer", "progress-ring", "progress ring")
    ):
        if "lineargradient" not in lowered and "radialgradient" not in lowered:
            return False, "missing_gradient"
        if "<clippath" not in lowered or "clip-path" not in lowered:
            return False, "missing_clip_path"
        if not any(marker in lowered for marker in ("<animate", "@keyframes", "animation:")):
            return False, "missing_animation"
        script_math = re.search(
            r"<script\b.*?(getattribute\s*\(.*?['\"]r|gettotallength|2\s*\*\s*(?:math\.)?pi\s*\*)",
            lowered,
            flags=re.DOTALL,
        )
        if not script_math:
            return False, "missing_runtime_circumference"
        if re.search(r"stroke-dasharray\s*=\s*['\"]\s*\d+(?:\.\d+)?\s*['\"]", lowered):
            return False, "hardcoded_dash_value"
    return True, None


def parse_regions(code: str, library: str) -> list[dict[str, int | str]]:
    """Parse ordered named regions with one-based inclusive line boundaries."""
    lines = code.splitlines()
    normalized = library.strip().lower()
    marker_pattern = re.compile(r"^\s*//\s*@layer\s+(.+?)\s*$")
    html_marker_pattern = re.compile(r"^\s*<!--\s*@layer\s+(.+?)\s*-->\s*$")
    svg_open_pattern = re.compile(r"<g\b[^>]*\bid=[\"']([^\"']+)[\"'][^>]*>", re.I)
    svg_close_pattern = re.compile(r"</g\s*>", re.I)
    occurrences: list[tuple[int, str, int | None]] = []
    stack: list[int] = []
    for index, line in enumerate(lines):
        match = svg_open_pattern.search(line) if normalized == "svg" else None
        if match:
            occurrence_index = len(occurrences)
            occurrences.append((index, match.group(1).strip(), None))
            stack.append(occurrence_index)
            continue
        if normalized == "svg" and svg_close_pattern.search(line) and stack:
            occurrence_index = stack.pop()
            start, name, _ = occurrences[occurrence_index]
            occurrences[occurrence_index] = (start, name, index)
            continue
        match = marker_pattern.match(line) or html_marker_pattern.match(line)
        if match:
            occurrences.append((index, match.group(1).strip(), None))
    if not occurrences:
        return []
    counts: dict[str, int] = {}
    regions: list[dict[str, int | str]] = []
    for occurrence_index, (start, raw_name, explicit_end) in enumerate(occurrences):
        counts[raw_name] = counts.get(raw_name, 0) + 1
        suffix = counts[raw_name]
        name = raw_name if suffix == 1 else f"{raw_name} {suffix}"
        next_start = (
            occurrences[occurrence_index + 1][0] - 1
            if occurrence_index + 1 < len(occurrences)
            else len(lines) - 1
        )
        end = explicit_end if explicit_end is not None else next_start
        regions.append({"name": name, "start": start + 1, "end": max(start + 1, end + 1)})
    return regions
