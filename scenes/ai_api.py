"""Task 46/47: the AI create-scene endpoint.

`_docs/plan.md`'s "AI actions" section: "Create scene: prompt -> complete
editable scene JSON -> preview -> save/refine ... AI changes are always
non-destructive draft revisions until explicitly accepted." This module
is exactly that first step and nothing more: an authenticated project
owner submits a bounded prompt, `ai_provider.interface.execute()` (via
`ai_provider.mistral_provider.MistralSceneProvider`) returns either a
validated scene or a normalized error, and the response is always an
unsaved draft proposal -- **no `SceneVersion` is ever created and
`Project.current_version` is never touched**, success or failure alike.
Turning an accepted draft into a saved version is
`SceneVersionListCreateView` (Task 14, `scenes/api.py`) with
`origin=SceneVersion.Origin.AI_CREATE` -- a separate, later, explicit
save request the frontend issues (Task 48, issue #48), not this endpoint.

## Failure taxonomy -> HTTP response

`ai_provider.interface.AIErrorCategory` only has five members, and two
failure modes this task must expose (per-user request-rate limiting and
prompt size) happen entirely before a provider is ever called. The full,
explicit mapping this view produces:

| Condition                                   | HTTP  | `error` body value          |
|----------------------------------------------|-------|------------------------------|
| Not authenticated                             | 404   | (no body -- see below)       |
| Not the project's owner                       | 404   | (no body -- see below)       |
| Prompt missing / blank / over `MAX_PROMPT_CHARS` | 400 | `"prompt_invalid"`            |
| Per-user request-rate limit exceeded          | 429   | `"rate_limited"`              |
| Per-user daily creation quota exhausted       | 429   | `"quota_exceeded"`            |
| Mistral reported its own quota/rate limit     | 429   | `"provider_quota_exceeded"`   |
| Mistral did not respond in time               | 504   | `"timeout"`                   |
| Operation was cancelled                       | 400   | `"cancelled"`                 |
| Raw response exceeded the size safety net     | 413   | `"response_too_large"`        |
| Any other provider/SDK/network failure        | 502   | `"provider_failure"`          |
| Output failed schema/limits validation        | 422   | `"invalid_structured_output"` |
| Success                                       | 200   | (no `error` key; `draft: true`) |

A denied/nonexistent project 404s with no body distinguishing "doesn't
exist" from "not yours", matching every other project-scoped endpoint in
`scenes/api.py` (see that module's own docstring).

## Retry-safety

- This endpoint never writes a `SceneVersion` or touches
  `Project.current_version`/`updated_at` in any branch -- there is no
  application data for a retried request to duplicate or corrupt.
- The per-user **request-rate** counter increments on every attempt,
  success or failure -- it exists to bound request *rate*, so a client
  retrying after a failure is expected to consume another slot.
- The per-user **daily creation quota** counter increments only after a
  successful, schema-validated result. A timeout, provider failure, or
  invalid-output rejection never consumes it, so retrying a failed
  request is always safe and never erodes the day's allowance.
- Both counters live in Django's cache (`django.core.cache.cache`; the
  default backend is per-process `LocMemCache` unless a shared cache is
  configured) keyed per user. This is sufficient for a single-process
  deployment/test run; a multi-process production deployment should
  point `CACHES` at a shared backend (e.g. the database or Redis) for
  the limits to hold across workers -- tracked as a future
  infrastructure concern, not something this task adds a new dependency
  for.
"""

from __future__ import annotations

from datetime import date

from django.core.cache import cache
from rest_framework import serializers, status
from rest_framework.response import Response
from rest_framework.views import APIView

from ai_provider.interface import AICreateSceneRequest, AIErrorCategory, AIOperationResult
from ai_provider.logging import log_operation_result
from ai_provider.mistral_provider import RESPONSE_TOO_LARGE_PREFIX, MistralSceneProvider
from scenes.api import _get_project_or_404, _require_or_404
from scenes.permissions import Action

# --- Bounds (this task's own documented choices; _docs/plan.md requires
# "authenticated-user quotas, rate limits, prompt/request size limits ...
# " without pinning exact numbers) ---

# Prompt size. Generous enough for a detailed scene description, small
# enough to bound provider cost and this server's own request body size.
MAX_PROMPT_CHARS = 4000

# Request rate: at most this many create-scene attempts (success or
# failure) per user per rolling window. Guards against retry storms and
# accidental double-submits, independent of the daily creation quota.
RATE_LIMIT_MAX_ATTEMPTS = 5
RATE_LIMIT_WINDOW_SECONDS = 60

# Daily quota: at most this many *successful* creations per user per UTC
# day. Deliberately generous relative to the rate limit -- it exists to
# bound provider cost over a day, not to police short bursts (the rate
# limit already does that).
DAILY_QUOTA_MAX_SUCCESSES = 50

# Seconds until midnight UTC is recomputed per-request (see
# _quota_cache_key's date-stamped key); this timeout just bounds how long
# an unused counter lingers in cache, generously covering the worst case
# (a request made at 00:00:00 UTC) plus margin.
DAILY_QUOTA_RESET_TIMEOUT_SECONDS = 25 * 60 * 60


def _rate_limit_cache_key(user_id: int) -> str:
    return f"ai_provider:rate:{user_id}"


def _quota_cache_key(user_id: int) -> str:
    return f"ai_provider:quota:{user_id}:{date.today().isoformat()}"


def _increment_and_check(cache_key: str, *, limit: int, window_seconds: int) -> bool:
    """Increment a fixed-window counter and return whether it's still within `limit`.

    `cache.add` only sets the key if absent (starts the window on first
    use); `cache.incr` then atomically bumps it on this and every
    subsequent call within the window. Returns False once the
    post-increment count exceeds `limit`.
    """
    cache.add(cache_key, 0, timeout=window_seconds)
    try:
        count = cache.incr(cache_key)
    except ValueError:
        # The key expired between add() and incr() (a benign race at a
        # window boundary) -- restart the window for this attempt.
        cache.add(cache_key, 0, timeout=window_seconds)
        count = cache.incr(cache_key)
    return count <= limit


def _current_count(cache_key: str) -> int:
    return cache.get(cache_key, 0)


class AICreateSceneRequestSerializer(serializers.Serializer):
    prompt = serializers.CharField(
        max_length=MAX_PROMPT_CHARS, allow_blank=False, trim_whitespace=True
    )


# category -> (http status, error code). PROVIDER_REJECTION is handled
# separately below because it splits into two distinct HTTP responses
# (response_too_large vs. a generic provider_failure) based on the
# message ai_provider.mistral_provider attaches -- AIErrorCategory itself
# has no separate "response too large" member (see that module's
# docstring for why).
_CATEGORY_TO_RESPONSE: dict[AIErrorCategory, tuple[int, str]] = {
    AIErrorCategory.TIMEOUT: (status.HTTP_504_GATEWAY_TIMEOUT, "timeout"),
    AIErrorCategory.CANCELLED: (status.HTTP_400_BAD_REQUEST, "cancelled"),
    AIErrorCategory.QUOTA_EXCEEDED: (status.HTTP_429_TOO_MANY_REQUESTS, "provider_quota_exceeded"),
    AIErrorCategory.INVALID_STRUCTURED_OUTPUT: (
        status.HTTP_422_UNPROCESSABLE_ENTITY,
        "invalid_structured_output",
    ),
}


def _error_response(result: AIOperationResult) -> Response:
    assert result.error is not None  # narrows for mypy; execute() guarantees this
    if result.error.category == AIErrorCategory.PROVIDER_REJECTION:
        if result.error.message.startswith(RESPONSE_TOO_LARGE_PREFIX):
            http_status, code = status.HTTP_413_REQUEST_ENTITY_TOO_LARGE, "response_too_large"
        else:
            http_status, code = status.HTTP_502_BAD_GATEWAY, "provider_failure"
    else:
        http_status, code = _CATEGORY_TO_RESPONSE[result.error.category]
    return Response({"error": code, "detail": result.error.message}, status=http_status)


def _rate_limited_response() -> Response:
    return Response(
        {
            "error": "rate_limited",
            "detail": (
                f"At most {RATE_LIMIT_MAX_ATTEMPTS} AI create-scene requests are allowed "
                f"per {RATE_LIMIT_WINDOW_SECONDS} seconds. Wait and try again."
            ),
        },
        status=status.HTTP_429_TOO_MANY_REQUESTS,
    )


def _quota_exceeded_response() -> Response:
    return Response(
        {
            "error": "quota_exceeded",
            "detail": (
                f"The daily limit of {DAILY_QUOTA_MAX_SUCCESSES} AI-generated scenes "
                "has been reached for this account. Try again tomorrow (UTC)."
            ),
        },
        status=status.HTTP_429_TOO_MANY_REQUESTS,
    )


def get_ai_provider() -> MistralSceneProvider:
    """The single place this view constructs its provider. A real
    `MistralSceneProvider()` reads `MISTRAL_API_KEY` lazily, on first
    actual use (see that class's `client` property) -- never here, and
    never at import time -- so importing/routing this module never
    requires a real key. Tests monkeypatch this function to inject a
    provider backed by a mock Mistral client instead.
    """
    return MistralSceneProvider()


class AICreateSceneView(APIView):
    """POST /api/projects/<public_id>/ai/create-scene/

    Authenticated project owner only (`Action.AI_CREATE_SCENE`, 404 for
    anyone else -- same "don't confirm hidden data" policy as every other
    project-scoped endpoint in `scenes/api.py`). Never creates a
    `SceneVersion`; the response is always an unsaved draft.
    """

    def post(self, request, public_id):
        project = _get_project_or_404(public_id)
        _require_or_404(request.user, Action.AI_CREATE_SCENE, project)

        input_serializer = AICreateSceneRequestSerializer(data=request.data)
        if not input_serializer.is_valid():
            return Response(
                {"error": "prompt_invalid", "detail": input_serializer.errors},
                status=status.HTTP_400_BAD_REQUEST,
            )
        prompt = input_serializer.validated_data["prompt"]

        user_id = request.user.id
        if not _increment_and_check(
            _rate_limit_cache_key(user_id),
            limit=RATE_LIMIT_MAX_ATTEMPTS,
            window_seconds=RATE_LIMIT_WINDOW_SECONDS,
        ):
            return _rate_limited_response()

        if _current_count(_quota_cache_key(user_id)) >= DAILY_QUOTA_MAX_SUCCESSES:
            return _quota_exceeded_response()

        provider = get_ai_provider()
        result = provider.create_scene(AICreateSceneRequest(prompt=prompt))

        # Minimal metadata only -- no prompt text, no scene content, no
        # provider key -- per ai_provider.logging's documented default.
        log_operation_result(result)

        if not result.success:
            return _error_response(result)

        cache.set(
            _quota_cache_key(user_id),
            _current_count(_quota_cache_key(user_id)) + 1,
            timeout=DAILY_QUOTA_RESET_TIMEOUT_SECONDS,
        )

        return Response(
            {
                "draft": True,
                "operation": result.operation.value,
                "scene": result.scene,
                "usage": {
                    "prompt_tokens": result.usage.prompt_tokens,
                    "completion_tokens": result.usage.completion_tokens,
                    "total_tokens": result.usage.total_tokens,
                    "estimated_cost_usd": result.usage.estimated_cost_usd,
                },
            },
            status=status.HTTP_200_OK,
        )


__all__ = [
    "DAILY_QUOTA_MAX_SUCCESSES",
    "MAX_PROMPT_CHARS",
    "RATE_LIMIT_MAX_ATTEMPTS",
    "RATE_LIMIT_WINDOW_SECONDS",
    "AICreateSceneRequestSerializer",
    "AICreateSceneView",
    "get_ai_provider",
]
