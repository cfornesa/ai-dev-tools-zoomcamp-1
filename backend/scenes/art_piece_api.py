"""Issue #199 (epic #196): POST /api/ai/art-pieces/generate/ -- the first
library slice (Canvas2D) of the multi-library AI art generation epic.

Deliberately NOT project-scoped, unlike `scenes/ai_api.py`'s create/edit
endpoints: per #197's architecture decision, a generated art piece here
has no structured scene-JSON backing and no relationship to a `Project` --
it is a standalone prompt-in, sandboxed-preview-out, download flow. Every
request still requires the caller's own personal Mistral credential,
exactly like `scenes/ai_api.py`'s `get_ai_provider` -- there is no shared
server credential a caller could run up someone else's bill on, the same
reasoning issue #198 already established for the existing scene endpoints.

## Response is a raw, unvalidated snippet -- not vetted for safety here

Unlike `AICreateSceneView`, this view's success response is never
schema-validated (there is no schema for raw Canvas2D code) and is never
inspected for safety. The generated snippet only ever becomes "safe to
look at" once the frontend renders it inside a sandboxed iframe with no
`allow-same-origin` and a strict CSP the frontend itself controls (see
`frontend/src/generative/artPieceSandbox.ts`) -- this view's only
responsibility is bounding size/shape and surfacing the same provider
failure taxonomy `scenes/ai_api.py` already established.
"""

from __future__ import annotations

import re
from contextvars import ContextVar
from typing import TYPE_CHECKING, cast

from django.core.cache import cache
from rest_framework import serializers, status
from rest_framework.response import Response
from rest_framework.views import APIView

from ai_provider.art_piece_provider import (
    EMPTY_OR_MALFORMED_PREFIX,
    RESPONSE_TOO_LARGE_PREFIX,
    SUPPORTED_LIBRARIES,
    ArtPieceProvider,
)
from ai_provider.config import use_fake_ai_provider
from scenes.entitlements import get_effective_cap
from scenes.models import MistralCredential, MistralCredentialDecryptionError

if TYPE_CHECKING:
    from django.contrib.auth.models import User

MAX_PROMPT_CHARS = 4000
MAX_MODEL_ID_CHARS = 100
# Same shape check as `scenes/ai_api.py`'s `_MODEL_ID_PATTERN` -- kept as
# its own copy rather than a shared import: the two call sites already
# didn't share a module, and this endpoint intentionally has no other
# dependency on `scenes/ai_api.py`'s scene-specific machinery.
_MODEL_ID_PATTERN = re.compile(r"^[a-z0-9](?:[a-z0-9._-]{0,99})$")

# A fresh, small, isolated rate/quota budget -- deliberately not shared
# with `scenes/ai_api.py`'s scene create/edit counters, since this is a
# distinct feature with its own cost profile.
RATE_LIMIT_MAX_ATTEMPTS = 5
RATE_LIMIT_WINDOW_SECONDS = 60
# The actual per-request cap comes from `scenes.entitlements
# .get_effective_cap` (issues #423/#422); this is only the seeded "free"
# plan's fallback value, kept so this response-formatting helper's
# default parameter documents a concrete number. Issue #422 consolidates
# every feature (including ai_art_generate) onto one admin-editable
# `daily_ai_requests` number per plan, replacing this endpoint's
# previously-separate 20/day default.
DAILY_QUOTA_MAX_SUCCESSES = 50


def _rate_limit_cache_key(user_id: int) -> str:
    return f"art-piece-rate:{user_id}"


def _quota_cache_key(user_id: int) -> str:
    from django.utils import timezone as django_timezone

    today = django_timezone.now().strftime("%Y-%m-%d")
    return f"art-piece-quota:{user_id}:{today}"


def _increment_and_check(cache_key: str, *, limit: int, window_seconds: int) -> bool:
    try:
        count = cache.incr(cache_key)
    except ValueError:
        cache.set(cache_key, 1, timeout=window_seconds)
        count = 1
    return count <= limit


def _current_count(cache_key: str) -> int:
    return cache.get(cache_key, 0)


def _increment_quota(cache_key: str, *, timeout: int) -> int:
    """Atomically record one successful art-piece result in shared cache state."""
    cache.add(cache_key, 0, timeout=timeout)
    try:
        return cache.incr(cache_key)
    except ValueError:
        cache.add(cache_key, 0, timeout=timeout)
        return cache.incr(cache_key)


def _validate_model_id(value: str) -> str:
    if value and not _MODEL_ID_PATTERN.match(value):
        raise serializers.ValidationError(
            "Model id must be lowercase alphanumeric, optionally with '.', '_', or '-'."
        )
    return value


class ArtPieceGenerateRequestSerializer(serializers.Serializer):
    library = serializers.ChoiceField(choices=list(SUPPORTED_LIBRARIES))
    prompt = serializers.CharField(
        max_length=MAX_PROMPT_CHARS, allow_blank=False, trim_whitespace=True
    )
    model = serializers.CharField(
        max_length=MAX_MODEL_ID_CHARS,
        allow_blank=True,
        trim_whitespace=True,
        required=False,
        default="",
    )

    def validate_model(self, value: str) -> str:
        return _validate_model_id(value)


_current_ai_user: ContextVar[object | None] = ContextVar("current_art_piece_user", default=None)
_current_ai_model: ContextVar[str | None] = ContextVar("current_art_piece_model", default=None)


class MissingPersonalMistralCredential(Exception):
    """Raised before any provider call when the owner has no usable key."""


def get_art_piece_provider() -> ArtPieceProvider:
    """Mirrors `scenes.ai_api.get_ai_provider`'s exact shape (including the
    fake-provider short-circuit for `AI_PROVIDER=fake`, and the
    zero-argument/contextvar pattern so tests can monkeypatch this the
    same way) -- kept as its own function rather than a shared import
    since the two providers construct genuinely different classes."""
    if use_fake_ai_provider():
        from ai_provider.art_piece_provider import ArtPieceResult
        from ai_provider.interface import AIUsageMetadata

        # Issue #428: distinct, library-shaped fake code per requested
        # library -- rather than always returning the same Canvas2D
        # snippet regardless of `library` -- so `make e2e`'s
        # AI_PROVIDER=fake path can drive the real Studio generate flow
        # for a spatial engine (Three.js/A-Frame) and reach a live
        # `window.__registerArtPieceCamera` registration, exactly like a
        # real Mistral response would for that library. Each snippet
        # matches the shape `artPieceSandbox.ts`'s `buildArtPieceSandboxDocument`
        # expects for that library (self-contained markup for
        # canvas2d/svg/aframe; plain JS for threejs).
        _FAKE_CODE_BY_LIBRARY = {
            "canvas2d": (
                '<canvas id="art-piece-canvas" width="800" height="600"></canvas>'
                "<script>const c=document.getElementById('art-piece-canvas');"
                "const ctx=c.getContext('2d');ctx.fillStyle='teal';"
                "ctx.fillRect(0,0,800,600);</script>"
            ),
            "svg": (
                '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 800 600">'
                '<rect width="800" height="600" fill="teal" /></svg>'
            ),
            "threejs": (
                "var scene = new THREE.Scene();"
                "var camera = new THREE.PerspectiveCamera(50, 1, 0.1, 100);"
                "camera.position.set(0, 0, 5);camera.lookAt(0, 0, 0);"
                "var renderer = new THREE.WebGLRenderer();"
                "var container = document.getElementById('art-piece-container');"
                "renderer.setSize(container.clientWidth || 320, container.clientHeight || 240);"
                "container.appendChild(renderer.domElement);"
                "var geometry = new THREE.BoxGeometry(1, 1, 1);"
                "var material = new THREE.MeshBasicMaterial({ color: 0x2a9d8f });"
                "var cube = new THREE.Mesh(geometry, material);scene.add(cube);"
                "window.__registerArtPieceCamera({"
                "getPose: function () { return { x: camera.position.x,"
                " y: camera.position.y, z: camera.position.z }; },"
                "setPose: function (x, y, z) { camera.position.set(x, y, z);"
                " camera.lookAt(0, 0, 0); },"
                "reset: function () { camera.position.set(0, 0, 5);"
                " camera.lookAt(0, 0, 0); } });"
                "function animate() { requestAnimationFrame(animate);"
                " cube.rotation.y += 0.01; renderer.render(scene, camera); }animate();"
            ),
            "aframe": (
                '<a-scene><a-box position="0 1 -3" rotation="0 45 0" color="#2a9d8f">'
                "</a-box><a-camera></a-camera></a-scene>"
            ),
        }

        class _FakeArtPieceProvider:
            def generate(self, prompt: str, library: str) -> ArtPieceResult:
                return ArtPieceResult(
                    usage=AIUsageMetadata(
                        prompt_tokens=10, completion_tokens=20, estimated_cost_usd=0.0001
                    ),
                    code=_FAKE_CODE_BY_LIBRARY.get(library, _FAKE_CODE_BY_LIBRARY["canvas2d"]),
                )

        return _FakeArtPieceProvider()  # type: ignore[return-value]

    user = _current_ai_user.get()
    if user is None or not getattr(user, "is_authenticated", False):
        raise MissingPersonalMistralCredential
    credential = MistralCredential.objects.filter(user=cast("User", user)).first()
    if credential is None:
        raise MissingPersonalMistralCredential
    try:
        key = credential.get_key()
    except MistralCredentialDecryptionError as exc:
        raise MissingPersonalMistralCredential from exc
    return ArtPieceProvider(api_key=key, model=_current_ai_model.get() or None)


def _provider_for_user(user, model: str | None = None) -> ArtPieceProvider:
    user_token = _current_ai_user.set(user)
    model_token = _current_ai_model.set(model or None)
    try:
        return get_art_piece_provider()
    finally:
        _current_ai_user.reset(user_token)
        _current_ai_model.reset(model_token)


def _missing_key_response() -> Response:
    return Response(
        {
            "error": "personal_key_required",
            "detail": (
                "Configure your personal Mistral API key in Account settings "
                "before generating an art piece."
            ),
        },
        status=status.HTTP_424_FAILED_DEPENDENCY,
    )


def _request_invalid_response(errors: dict) -> Response:
    error = "model_invalid" if "model" in errors and "prompt" not in errors else "prompt_invalid"
    return Response({"error": error, "detail": errors}, status=status.HTTP_400_BAD_REQUEST)


def _rate_limited_response() -> Response:
    return Response(
        {
            "error": "rate_limited",
            "detail": (
                f"No more than {RATE_LIMIT_MAX_ATTEMPTS} art-piece generation attempts per "
                f"{RATE_LIMIT_WINDOW_SECONDS} seconds. Wait a moment and try again."
            ),
        },
        status=status.HTTP_429_TOO_MANY_REQUESTS,
    )


def _quota_exceeded_response(limit: int = DAILY_QUOTA_MAX_SUCCESSES) -> Response:
    return Response(
        {
            "error": "quota_exceeded",
            "detail": (
                f"The daily limit of {limit} generated art pieces has "
                "been reached for this account. Try again tomorrow (UTC)."
            ),
        },
        status=status.HTTP_429_TOO_MANY_REQUESTS,
    )


class ArtPieceGenerateView(APIView):
    """POST /api/ai/art-pieces/generate/

    Authenticated users only (401 if not) -- there is no project/ownership
    concept here, so this doesn't use `scenes.api._require_or_404`'s
    "don't confirm hidden data" 404 convention; there is no hidden data to
    protect, only a personal-credential-gated feature.
    """

    def post(self, request):
        if not request.user.is_authenticated:
            return Response(
                {"detail": "Authentication required."}, status=status.HTTP_401_UNAUTHORIZED
            )

        input_serializer = ArtPieceGenerateRequestSerializer(data=request.data)
        if not input_serializer.is_valid():
            return _request_invalid_response(input_serializer.errors)
        library = input_serializer.validated_data["library"]
        prompt = input_serializer.validated_data["prompt"]
        model = input_serializer.validated_data.get("model") or None

        user_id = request.user.id
        if not _increment_and_check(
            _rate_limit_cache_key(user_id),
            limit=RATE_LIMIT_MAX_ATTEMPTS,
            window_seconds=RATE_LIMIT_WINDOW_SECONDS,
        ):
            return _rate_limited_response()

        art_generate_cap = get_effective_cap(request.user, "ai_art_generate")
        if _current_count(_quota_cache_key(user_id)) >= art_generate_cap:
            return _quota_exceeded_response(art_generate_cap)

        try:
            provider = _provider_for_user(request.user, model)
        except MissingPersonalMistralCredential:
            return _missing_key_response()

        result = provider.generate(prompt, library)

        if result.error is not None:
            error_text = result.error
            if error_text.startswith(RESPONSE_TOO_LARGE_PREFIX):
                return Response(
                    {
                        "error": "response_too_large",
                        "detail": error_text[len(RESPONSE_TOO_LARGE_PREFIX) :],
                    },
                    status=status.HTTP_413_REQUEST_ENTITY_TOO_LARGE,
                )
            if error_text.startswith(EMPTY_OR_MALFORMED_PREFIX):
                return Response(
                    {
                        "error": "invalid_structured_output",
                        "detail": error_text[len(EMPTY_OR_MALFORMED_PREFIX) :],
                    },
                    status=status.HTTP_422_UNPROCESSABLE_ENTITY,
                )
            # AIProviderTimeoutError/AIProviderQuotaError/AIProviderRejectionError
            # are all raised as plain exceptions inside the provider and
            # converted to `result.error` strings there -- reconstruct the
            # right HTTP mapping by exception type would require threading
            # the type through `ArtPieceResult`, which isn't worth it for a
            # single-provider slice; classify by the same message text
            # `mistral_provider.py` already produces for each case.
            is_timeout = (
                "did not respond within" in error_text or "reported a request timeout" in error_text
            )
            if is_timeout:
                return Response(
                    {"error": "timeout", "detail": error_text},
                    status=status.HTTP_504_GATEWAY_TIMEOUT,
                )
            if "rate limit or quota" in error_text:
                return Response(
                    {"error": "provider_quota_exceeded", "detail": error_text},
                    status=status.HTTP_429_TOO_MANY_REQUESTS,
                )
            return Response(
                {"error": "provider_failure", "detail": error_text},
                status=status.HTTP_502_BAD_GATEWAY,
            )

        quota_count = _increment_quota(_quota_cache_key(user_id), timeout=60 * 60 * 26)
        if quota_count > art_generate_cap:
            return _quota_exceeded_response(art_generate_cap)

        return Response(
            {
                "library": library,
                "code": result.code,
                "usage": {
                    "prompt_tokens": result.usage.prompt_tokens,
                    "completion_tokens": result.usage.completion_tokens,
                    "total_tokens": result.usage.prompt_tokens + result.usage.completion_tokens,
                    "estimated_cost_usd": result.usage.estimated_cost_usd,
                },
            },
            status=status.HTTP_200_OK,
        )


__all__ = [
    "DAILY_QUOTA_MAX_SUCCESSES",
    "MAX_MODEL_ID_CHARS",
    "MAX_PROMPT_CHARS",
    "RATE_LIMIT_MAX_ATTEMPTS",
    "RATE_LIMIT_WINDOW_SECONDS",
    "ArtPieceGenerateRequestSerializer",
    "ArtPieceGenerateView",
    "get_art_piece_provider",
]
