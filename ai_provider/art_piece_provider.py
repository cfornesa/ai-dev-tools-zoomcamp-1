"""Issue #199 (epic #196): generates a raw, self-contained Canvas2D art
piece snippet from a prompt -- the first library slice of the multi-library
generation epic, per #197's architecture decision.

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

from dataclasses import dataclass
from typing import Any

import httpx

from ai_provider.errors import (
    AIProviderQuotaError,
    AIProviderRejectionError,
    AIProviderTimeoutError,
)
from ai_provider.interface import AIUsageMetadata

# The only library this slice supports -- see #199's grooming comment for
# the follow-up path (three.js, a-frame, svg). Kept as a real constant
# (not inlined) so `ArtPieceGenerateRequestSerializer` and any future
# library addition both read from the one place.
SUPPORTED_LIBRARIES = ("canvas2d",)

DEFAULT_MODEL = "mistral-large-latest"
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

_ESTIMATED_PROMPT_COST_PER_1K = 0.002
_ESTIMATED_COMPLETION_COST_PER_1K = 0.006

RESPONSE_TOO_LARGE_PREFIX = "response_too_large:"
EMPTY_OR_MALFORMED_PREFIX = "empty_or_malformed:"

_SYSTEM_PROMPT = """You generate the inner markup for a single generative-art piece using \
ONLY the browser's native Canvas2D API (CanvasRenderingContext2D). Follow these rules exactly:

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
or bounded -- never an infinitely recursive synchronous call that could hang the page."""


@dataclass(frozen=True)
class ArtPieceResult:
    """Discriminated result: exactly one of `code` (a validated-shape
    snippet, never executed or schema-checked server-side) or `error`.
    Mirrors `ai_provider.interface.AIOperationResult`'s shape without its
    scene-specific fields."""

    usage: AIUsageMetadata
    code: str | None = None
    error: str | None = None

    def __post_init__(self) -> None:
        if (self.code is None) == (self.error is None):
            raise ValueError("ArtPieceResult must carry exactly one of `code` or `error`.")


class ArtPieceProvider:
    """Issue #199: generates one raw Canvas2D snippet per call. Every
    caller already holds the requesting user's own personal Mistral
    credential (see `scenes/art_piece_api.py`'s `get_art_piece_provider`,
    mirroring `scenes/ai_api.py`'s identical `get_ai_provider` pattern) --
    there is no shared server credential this provider ever touches."""

    def __init__(
        self,
        *,
        api_key: str | None = None,
        model: str | None = None,
        client: Any | None = None,
        timeout_ms: int = REQUEST_TIMEOUT_MS,
    ) -> None:
        self._api_key = api_key
        self._client = client
        self.model = model or DEFAULT_MODEL
        self.timeout_ms = timeout_ms

    @property
    def client(self):
        if self._client is None:
            from mistralai import Mistral

            self._client = Mistral(api_key=self._api_key)
        return self._client

    def generate(self, prompt: str, library: str) -> ArtPieceResult:
        zero_usage = AIUsageMetadata(prompt_tokens=0, completion_tokens=0, estimated_cost_usd=0.0)
        if library not in SUPPORTED_LIBRARIES:
            # Defense in depth: `ArtPieceGenerateRequestSerializer` already
            # restricts `library` to `SUPPORTED_LIBRARIES` before this is
            # ever called, so this is a genuine bug (a new caller bypassing
            # the serializer), not a documented provider condition -- raise
            # rather than fold into `ArtPieceResult.error`.
            raise ValueError(f"Unsupported library: {library!r}")

        try:
            response = self.client.chat.complete(
                model=self.model,
                messages=[
                    {"role": "system", "content": _SYSTEM_PROMPT},
                    {"role": "user", "content": prompt},
                ],
                temperature=0.7,
                timeout_ms=self.timeout_ms,
            )
        except httpx.TimeoutException:
            return self._error_result(
                zero_usage,
                AIProviderTimeoutError(f"Mistral did not respond within {self.timeout_ms}ms."),
            )
        except httpx.HTTPError:
            return self._error_result(
                zero_usage,
                AIProviderRejectionError("Mistral request failed (network/connection error)."),
            )
        except Exception as exc:  # Mistral SDK error types (lazy-imported below)
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

        usage_info = getattr(response, "usage", None)
        prompt_tokens = int(getattr(usage_info, "prompt_tokens", 0) or 0)
        completion_tokens = int(getattr(usage_info, "completion_tokens", 0) or 0)
        usage = AIUsageMetadata(
            prompt_tokens=prompt_tokens,
            completion_tokens=completion_tokens,
            estimated_cost_usd=(
                (prompt_tokens / 1000) * _ESTIMATED_PROMPT_COST_PER_1K
                + (completion_tokens / 1000) * _ESTIMATED_COMPLETION_COST_PER_1K
            ),
        )

        try:
            choice = response.choices[0]
            content = choice.message.content
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

        snippet = _strip_markdown_fence(text).strip()
        if not _looks_like_canvas_snippet(snippet) or len(snippet) > MAX_SNIPPET_CHARS:
            return ArtPieceResult(
                usage=usage,
                error=(
                    f"{EMPTY_OR_MALFORMED_PREFIX}The generated output was empty or did not "
                    "look like a canvas/script snippet. Try rephrasing the prompt."
                ),
            )

        return ArtPieceResult(usage=usage, code=snippet)

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


def _looks_like_canvas_snippet(snippet: str) -> bool:
    lowered = snippet.lower()
    return bool(snippet) and "<canvas" in lowered and "<script" in lowered
