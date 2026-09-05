"""Task 46/47: the AI create-scene endpoint. Task 50 adds `AIEditSceneView`,
the sibling AI edit-scene endpoint, at the bottom of this module -- see
its own docstring for the patch-specific failure taxonomy (including
issue #158's `"unreferenced_element"` row -- a patch that touches a
shape/group/binding/layer/graph node/connection the prompt text gives no
reasonable reference to, and the prompt isn't itself bulk/global in scope
-- see `scenes/patch.py`'s docstring for the full mechanism), stale-base
detection, and quota/rate-limit choices; everything below through
`AICreateSceneView` is unchanged from Task 46/47.

`docs/plan.md`'s "AI actions" section: "Create scene: prompt -> complete
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
| `model` present but not a well-formed model id (issue #198) | 400 | `"model_invalid"` |
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
- Both counters live in Django's cache (`django.core.cache.cache`) keyed per
  user. Development and offline tests intentionally use per-process
  `LocMemCache`; production settings select the PostgreSQL-backed
  `DatabaseCache` at the `django_cache` table so every production worker
  observes the same counters without adding a service dependency. A
  production settings test and shared-cache atomicity tests guard this
  boundary.
"""

from __future__ import annotations

import re
from contextvars import ContextVar
from typing import TYPE_CHECKING, cast

from django.core.cache import cache
from django.db import IntegrityError, transaction
from django.db.models import Max
from django.http import Http404
from django.utils import timezone as django_timezone
from rest_framework import serializers, status
from rest_framework.response import Response
from rest_framework.views import APIView

from ai_provider.config import use_fake_ai_provider
from ai_provider.deepseek_provider import DeepSeekSceneProvider
from ai_provider.gemini_provider import GeminiSceneProvider
from ai_provider.interface import (
    AICreateSceneRequest,
    AIEditSceneRequest,
    AIErrorCategory,
    AIOperationResult,
    AISceneProvider,
)
from ai_provider.logging import log_operation_result
from ai_provider.mistral_provider import (
    EMPTY_PATCH_PREFIX,
    INVALID_PATCH_PREFIX,
    PATCH_APPLY_FAILED_PREFIX,
    RESPONSE_TOO_LARGE_PREFIX,
    MistralSceneProvider,
)
from ai_provider.registry import get_provider, validate_model
from scenes.api import _get_project_or_404, _require_or_404
from scenes.models import (
    AIPersona,
    MistralCredential,
    MistralCredentialDecryptionError,
    Project,
    ProviderCredential,
    SceneVersion,
)
from scenes.patch import PatchErrorReason
from scenes.permissions import Action
from scenes.serializers import SceneVersionDetailSerializer
from scenes.thumbnail_generation import maybe_schedule_thumbnail_generation
from scenes.validation import SceneValidationResult, validate_scene

if TYPE_CHECKING:
    from django.contrib.auth.models import User

# --- Bounds (this task's own documented choices; docs/plan.md requires
# "authenticated-user quotas, rate limits, prompt/request size limits ...
# " without pinning exact numbers) ---

# Prompt size. Generous enough for a detailed scene description, small
# enough to bound provider cost and this server's own request body size.
MAX_PROMPT_CHARS = 4000

# Issue #198: an optional caller-supplied Mistral model id, replacing
# `MistralSceneProvider`'s own `DEFAULT_MODEL` fallback for this request
# only. Every AI request already requires the caller's own personal
# Mistral credential (`get_ai_provider` below) -- there is no shared
# server credential a caller could run up someone else's bill on -- so
# letting a caller pick any model their own key can reach is a
# self-contained cost/quota choice for their own account, not a
# shared-resource risk. This pattern only sanity-checks the *shape* of a
# model id (Mistral's own published ids all look like
# `mistral-large-latest`, `open-mixtral-8x22b`, `codestral-2405`: a
# lowercase-alnum start, then lowercase alnum/hyphen/dot/underscore) --
# it is not an allowlist of specific models, so a new Mistral release
# never needs a code change here. An id that passes this check but names
# a model Mistral doesn't actually have, or one the caller's key can't
# reach, surfaces as the existing generic `"provider_failure"` response
# (`MistralSceneProvider._invoke`'s catch-all `AIProviderRejectionError`
# branch) -- already-handled, not a new failure mode.
MAX_MODEL_ID_CHARS = 100
_MODEL_ID_PATTERN = re.compile(r"^[a-z0-9](?:[a-z0-9._-]{0,99})$")

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

# --- Task 50's own bounds for the edit-scene endpoint ---
#
# A separate quota/rate-limit bucket from create-scene (`operation="edit"`
# vs the default `"create"` in `_rate_limit_cache_key`/`_quota_cache_key`
# below), not a shared one. Reasoning: an edit request's Mistral output is
# a small patch document, not a full scene, so it is typically cheaper and
# faster than a create-scene call and is expected to be used more
# iteratively (propose -> reject -> refine -> propose again) within one
# editing session. Sharing one counter would let heavy edit iteration
# crowd out a user's ability to create new scenes (and vice versa) for no
# reason tied to actual cost. The edit rate limit is accordingly a little
# more generous than create-scene's; the daily quota is kept identical
# since both still ultimately bound the same account's total provider
# spend per day.
EDIT_RATE_LIMIT_MAX_ATTEMPTS = 10
EDIT_RATE_LIMIT_WINDOW_SECONDS = 60
EDIT_DAILY_QUOTA_MAX_SUCCESSES = 50


def _rate_limit_cache_key(user_id: int, *, operation: str = "create") -> str:
    return f"ai_provider:rate:{operation}:{user_id}"


def _quota_cache_key(user_id: int, *, operation: str = "create") -> str:
    # Task 71 audit: `datetime.date.today()` reads the OS/process local
    # date, which is *not* guaranteed to be UTC even though this project's
    # own `TIME_ZONE` setting is (`backend/backend/settings.py`) and every
    # quota-exceeded response tells the caller "tomorrow (UTC)". Use
    # `django.utils.timezone.localdate()` instead: with `USE_TZ = True` and
    # `TIME_ZONE = "UTC"`, it converts the current instant into Django's
    # configured timezone before taking the date, so the quota resets at
    # UTC midnight regardless of the underlying host/container's local
    # timezone -- matching the documented reset policy exactly.
    return f"ai_provider:quota:{operation}:{user_id}:{django_timezone.localdate().isoformat()}"


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


def _validate_model_id(value: str) -> str:
    """Shared `model` field validator for both AI request serializers --
    issue #198. Blank means "use the server default" (today's unchanged
    behavior); a non-blank value must at least look like a real model id
    before this view ever spends a network call on it."""
    if value and not _MODEL_ID_PATTERN.match(value):
        raise serializers.ValidationError(
            "Model id must be lowercase alphanumeric, optionally with '.', '_', or '-'."
        )
    return value


class AICreateSceneRequestSerializer(serializers.Serializer):
    prompt = serializers.CharField(
        max_length=MAX_PROMPT_CHARS, allow_blank=False, trim_whitespace=True
    )
    vendor = serializers.CharField(max_length=32, required=False, default="mistral")
    model = serializers.CharField(
        max_length=MAX_MODEL_ID_CHARS,
        allow_blank=True,
        trim_whitespace=True,
        required=False,
        default="",
    )
    # Issue #260: an optional caller-chosen Persona id, resolved to that
    # persona's owner-scoped additive prompt text below (never trusted from
    # the request body directly). A persona id that doesn't belong to the
    # requesting user is silently ignored (treated as "no persona"), not a
    # validation error -- same "don't confirm hidden data" spirit as this
    # project's other owner-scoped lookups.
    persona_id = serializers.IntegerField(required=False, allow_null=True, default=None)

    def validate_model(self, value: str) -> str:
        return _validate_model_id(value)

    def validate_vendor(self, value: str) -> str:
        return get_provider(value).vendor

    def validate(self, attrs):
        try:
            attrs["model"] = validate_model(attrs["vendor"], attrs.get("model"))
        except ValueError as exc:
            raise serializers.ValidationError({"model": str(exc)}) from exc
        return attrs


class AIEditSceneRequestSerializer(serializers.Serializer):
    """Task 50's edit-scene request body.

    `current_scene` is the caller's own in-progress scene JSON (the
    editor's working state, which may be ahead of the last saved
    `SceneVersion` -- this endpoint never reads scene content from the
    database). `base_version_id` is the id of the `SceneVersion` the
    caller believes is still `project.current_version` -- required
    (nullable, for a project with no saved version yet) so the view can
    detect a stale base (see `AIEditSceneView`'s docstring) before ever
    calling the provider. `model` is issue #198's optional caller-chosen
    Mistral model id -- see `_validate_model_id`/`MAX_MODEL_ID_CHARS`
    above.
    """

    prompt = serializers.CharField(
        max_length=MAX_PROMPT_CHARS, allow_blank=False, trim_whitespace=True
    )
    vendor = serializers.CharField(max_length=32, required=False, default="mistral")
    current_scene = serializers.JSONField()
    base_version_id = serializers.IntegerField(allow_null=True)
    model = serializers.CharField(
        max_length=MAX_MODEL_ID_CHARS,
        allow_blank=True,
        trim_whitespace=True,
        required=False,
        default="",
    )
    persona_id = serializers.IntegerField(required=False, allow_null=True, default=None)

    def validate_model(self, value: str) -> str:
        return _validate_model_id(value)

    def validate_vendor(self, value: str) -> str:
        return get_provider(value).vendor

    def validate(self, attrs):
        try:
            attrs["model"] = validate_model(attrs["vendor"], attrs.get("model"))
        except ValueError as exc:
            raise serializers.ValidationError({"model": str(exc)}) from exc
        return attrs


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


# The reason token `INVALID_PATCH_PREFIX`-prefixed messages carry maps to
# its own HTTP status: PatchErrorReason.OVERSIZED is 413 (matching the
# response-too-large convention above); every other reason (protected
# field, invalid path, malformed operation) is a 422 -- the patch parsed
# but its *content* is unacceptable, distinct from a 400 (caller/request
# shape error) and from a 502 (the provider itself failed).
_PATCH_REASON_TO_RESPONSE: dict[str, tuple[int, str]] = {
    PatchErrorReason.PROTECTED_FIELD: (status.HTTP_422_UNPROCESSABLE_ENTITY, "protected_field"),
    PatchErrorReason.INVALID_PATH: (status.HTTP_422_UNPROCESSABLE_ENTITY, "invalid_patch_path"),
    PatchErrorReason.OVERSIZED: (status.HTTP_413_REQUEST_ENTITY_TOO_LARGE, "oversized_patch"),
    PatchErrorReason.MALFORMED: (status.HTTP_422_UNPROCESSABLE_ENTITY, "malformed_patch"),
    # Issue #158: the patch touches an existing shape/group/binding/layer/
    # graph node/connection the prompt text gives no reasonable reference
    # to, and the prompt isn't itself bulk/global in scope -- its own
    # distinct code/response, not folded into invalid_patch_path or any
    # other existing reason (see scenes/patch.py's docstring).
    PatchErrorReason.UNREFERENCED_ELEMENT: (
        status.HTTP_422_UNPROCESSABLE_ENTITY,
        "unreferenced_element",
    ),
}


def _edit_error_response(result: AIOperationResult) -> Response:
    """Like `_error_response`, but also unpacks `edit_scene_with_patch`'s
    patch-specific `PROVIDER_REJECTION` sub-cases (empty patch, invalid/
    protected patch content, patch-apply failure) into their own explicit
    HTTP responses, per this task's acceptance criteria distinguishing
    them from a generic provider failure and from each other.
    """
    # narrows for mypy; execute()/edit_scene_with_patch guarantee this
    assert result.error is not None
    message = result.error.message
    if result.error.category == AIErrorCategory.PROVIDER_REJECTION:
        if message.startswith(RESPONSE_TOO_LARGE_PREFIX):
            http_status, code = status.HTTP_413_REQUEST_ENTITY_TOO_LARGE, "response_too_large"
        elif message.startswith(EMPTY_PATCH_PREFIX):
            http_status, code = status.HTTP_422_UNPROCESSABLE_ENTITY, "empty_patch"
        elif message.startswith(INVALID_PATCH_PREFIX):
            reason = message[len(INVALID_PATCH_PREFIX) :].split(" ", 1)[0]
            http_status, code = _PATCH_REASON_TO_RESPONSE.get(
                reason, (status.HTTP_422_UNPROCESSABLE_ENTITY, "invalid_patch")
            )
        elif message.startswith(PATCH_APPLY_FAILED_PREFIX):
            http_status, code = status.HTTP_422_UNPROCESSABLE_ENTITY, "patch_apply_failed"
        else:
            http_status, code = status.HTTP_502_BAD_GATEWAY, "provider_failure"
    else:
        http_status, code = _CATEGORY_TO_RESPONSE[result.error.category]
    return Response({"error": code, "detail": message}, status=http_status)


def _edit_rate_limited_response() -> Response:
    return Response(
        {
            "error": "rate_limited",
            "detail": (
                f"At most {EDIT_RATE_LIMIT_MAX_ATTEMPTS} AI edit-scene requests are allowed "
                f"per {EDIT_RATE_LIMIT_WINDOW_SECONDS} seconds. Wait and try again."
            ),
        },
        status=status.HTTP_429_TOO_MANY_REQUESTS,
    )


def _edit_quota_exceeded_response() -> Response:
    return Response(
        {
            "error": "quota_exceeded",
            "detail": (
                f"The daily limit of {EDIT_DAILY_QUOTA_MAX_SUCCESSES} AI-edited scenes "
                "has been reached for this account. Try again tomorrow (UTC)."
            ),
        },
        status=status.HTTP_429_TOO_MANY_REQUESTS,
    )


def _stale_base_response(current_version_id: int | None) -> Response:
    return Response(
        {
            "error": "stale_base",
            "detail": (
                "base_version_id does not match this project's current saved version "
                f"(currently {current_version_id!r}). Reload the latest scene state and "
                "retry the edit."
            ),
        },
        status=status.HTTP_409_CONFLICT,
    )


def _invalid_current_scene_response(validation: SceneValidationResult) -> Response:
    detail = "; ".join(f"{e.path}: {e.message}" for e in validation.errors[:5])
    return Response(
        {"error": "current_scene_invalid", "detail": detail or "current_scene failed validation."},
        status=status.HTTP_400_BAD_REQUEST,
    )


_current_ai_user: ContextVar[object | None] = ContextVar("current_ai_user", default=None)
# Issue #198: the caller-chosen Mistral model id for this request, or
# `None` for "use `MistralSceneProvider`'s own `DEFAULT_MODEL`" (today's
# unchanged behavior). A second contextvar, not a `get_ai_provider`
# parameter, for the exact same reason `_current_ai_user` is one -- see
# `get_ai_provider`'s own docstring.
_current_ai_model: ContextVar[str | None] = ContextVar("current_ai_model", default=None)
_current_ai_vendor: ContextVar[str] = ContextVar("current_ai_vendor", default="mistral")
# Issue #260: the resolved, owner-scoped text of the caller's selected
# Persona (or `None` for "no persona selected"), threaded through the same
# contextvar pattern as `_current_ai_model` and for the same reason.
_current_ai_persona_prompt: ContextVar[str | None] = ContextVar(
    "current_ai_persona_prompt", default=None
)


class MissingPersonalMistralCredential(Exception):
    """Raised before any provider call when the owner has no usable key."""


class UnsupportedProvider(Exception):
    """Raised when a catalogued provider has no live adapter yet."""


def get_ai_provider() -> AISceneProvider:
    """The single place this view constructs its provider. A real
    The request user is carried through a context variable so existing tests
    that monkeypatch this zero-argument factory remain compatible.

    Task 66/issue #66: when (and only when) `AI_PROVIDER=fake` is set in
    the server process's environment --
    `ai_provider.config.use_fake_ai_provider()` -- this returns a
    deterministic, network-free `ai_provider.e2e_provider.E2ETestProvider`
    instead, selecting a scenario from the current request's
    `X-E2E-AI-Scenario` header via `ai_provider.e2e_scenario` (populated by
    `E2EScenarioMiddleware`, registered unconditionally but a no-op
    without `AI_PROVIDER=fake`). This is what lets
    `frontend/e2e/aiAndRecovery.spec.ts` drive every documented AI
    success/error path through the real browser UI, over a real HTTP
    server, without a real Mistral account or any network access -- see
    `ai_provider/e2e_provider.py`'s own docstring for the full mapping.
    This function's signature deliberately stays zero-argument (no
    `request` parameter) so every existing `monkeypatch.setattr(ai_api,
    "get_ai_provider", lambda: provider)` in
    `tests/test_ai_create_scene_api.py`/`tests/test_ai_edit_scene_api.py`
    keeps working unchanged -- the request-scoped scenario is threaded in
    via a contextvar instead (see `ai_provider/e2e_scenario.py`).
    """
    if use_fake_ai_provider():
        from ai_provider.e2e_provider import build_e2e_provider
        from ai_provider.e2e_scenario import get_current_scenario

        return build_e2e_provider(
            get_current_scenario(),
            vendor=_current_ai_vendor.get(),
            model=_current_ai_model.get(),
        )
    user = _current_ai_user.get()
    if user is None or not getattr(user, "is_authenticated", False):
        raise MissingPersonalMistralCredential
    vendor = _current_ai_vendor.get()
    definition = get_provider(vendor)
    if not definition.implemented:
        raise UnsupportedProvider
    owner = cast("User", user)
    generic = ProviderCredential.objects.filter(owner=owner, vendor=vendor).first()
    credential = (
        MistralCredential.objects.filter(user=owner).first() if vendor == "mistral" else None
    )
    if generic is None and credential is None:
        raise MissingPersonalMistralCredential
    try:
        if generic is not None:
            key = generic.get_key()
        else:
            assert credential is not None
            key = credential.get_key()
    except MistralCredentialDecryptionError as exc:
        raise MissingPersonalMistralCredential from exc
    if vendor == "gemini":
        return GeminiSceneProvider(
            api_key=key,
            model=_current_ai_model.get() or "gemini-2.5-flash",
        )
    if vendor == "deepseek":
        return DeepSeekSceneProvider(
            api_key=key,
            model=_current_ai_model.get() or "deepseek-chat",
        )
    return MistralSceneProvider(
        api_key=key,
        model=_current_ai_model.get() or None,
        persona_prompt=_current_ai_persona_prompt.get() or None,
    )


def _resolve_persona_prompt(user, persona_id: int | None) -> str | None:
    """Issue #260: resolves a caller-supplied persona id to that persona's
    `prompt_text`, scoped strictly to `user`. A missing id, or one that
    doesn't belong to `user`, resolves to `None` (no persona applied) --
    never an error, matching this field's optional, best-effort nature."""
    if persona_id is None:
        return None
    persona = AIPersona.objects.filter(owner=user, pk=persona_id).first()
    return persona.prompt_text if persona else None


def _provider_for_user(
    user, model: str | None = None, persona_prompt: str | None = None, vendor: str = "mistral"
):
    """Issue #198: `model` is the caller's validated, optional request-body
    value (blank/`None` means "server default", see `get_ai_provider`).
    Issue #260 adds `persona_prompt`, the already-resolved, owner-scoped
    text of the caller's selected Persona (or `None`). Both are threaded
    through the same contextvar pattern as `user` so `get_ai_provider`'s
    zero-argument signature -- and every existing
    `monkeypatch.setattr(ai_api, "get_ai_provider", ...)` test -- keeps
    working unchanged.
    """
    user_token = _current_ai_user.set(user)
    model_token = _current_ai_model.set(model or None)
    persona_token = _current_ai_persona_prompt.set(persona_prompt or None)
    vendor_token = _current_ai_vendor.set(vendor)
    try:
        return get_ai_provider()
    finally:
        _current_ai_user.reset(user_token)
        _current_ai_model.reset(model_token)
        _current_ai_persona_prompt.reset(persona_token)
        _current_ai_vendor.reset(vendor_token)


def _request_invalid_response(errors: dict) -> Response:
    """Issue #198: `AICreateSceneRequestSerializer`/`AIEditSceneRequestSerializer`
    validation failures used to always report `"prompt_invalid"`, which was
    accurate before `model` existed (the only field that could fail) but
    would mislabel a bad `model` id as a bad prompt. Reports `"model_invalid"`
    only when `model` failed and `prompt` didn't, so an existing bad-prompt
    response is completely unchanged."""
    error = "model_invalid" if "model" in errors and "prompt" not in errors else "prompt_invalid"
    return Response({"error": error, "detail": errors}, status=status.HTTP_400_BAD_REQUEST)


def _missing_key_response(vendor: str = "mistral") -> Response:
    label = get_provider(vendor).label
    return Response(
        {
            "error": "personal_key_required",
            "detail": (
                f"Configure your personal {label} API key in Account settings "
                "before generating AI scenes."
            ),
        },
        status=status.HTTP_424_FAILED_DEPENDENCY,
    )


def _unsupported_provider_response() -> Response:
    return Response(
        {"error": "provider_unavailable", "detail": "That AI provider is not enabled yet."},
        status=status.HTTP_501_NOT_IMPLEMENTED,
    )


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
            return _request_invalid_response(input_serializer.errors)
        prompt = input_serializer.validated_data["prompt"]
        model = input_serializer.validated_data.get("model") or None
        vendor = input_serializer.validated_data.get("vendor", "mistral")
        persona_prompt = _resolve_persona_prompt(
            request.user, input_serializer.validated_data.get("persona_id")
        )

        user_id = request.user.id
        if not _increment_and_check(
            _rate_limit_cache_key(user_id),
            limit=RATE_LIMIT_MAX_ATTEMPTS,
            window_seconds=RATE_LIMIT_WINDOW_SECONDS,
        ):
            return _rate_limited_response()

        if _current_count(_quota_cache_key(user_id)) >= DAILY_QUOTA_MAX_SUCCESSES:
            return _quota_exceeded_response()

        try:
            provider = _provider_for_user(request.user, model, persona_prompt, vendor)
        except MissingPersonalMistralCredential:
            return _missing_key_response(vendor)
        except UnsupportedProvider:
            return _unsupported_provider_response()
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


class AIEditSceneView(APIView):
    """POST /api/projects/<public_id>/ai/edit-scene/ (Task 50)

    Authenticated project owner only (`Action.AI_EDIT_SCENE`, 404 for
    anyone else, same policy as `AICreateSceneView`). Sends the bounded
    prompt and the caller's current validated scene through
    `MistralSceneProvider.edit_scene_with_patch` (`ai_provider.mistral_provider`),
    which asks Mistral for an allowlisted JSON Patch, applies it to a
    *copy* of the current scene, and validates both the patch operations
    and the resulting scene. Like `AICreateSceneView`, this endpoint
    **never creates a `SceneVersion` and never touches
    `Project.current_version`** in any branch -- the response is always
    an unsaved draft (patch + resulting scene + change summary) for the
    frontend to preview and explicitly Accept/Reject (Task 48).

    ## Stale-base detection

    The request body's `base_version_id` must equal
    `project.current_version_id` (both `None` for a project with no saved
    version yet). If another save landed since the caller fetched its
    working scene -- a concurrent tab, or an accepted AI proposal --
    `current_version_id` will have moved and this comparison fails,
    rejecting the request with `409 stale_base` *before* any provider
    call. This is intentionally a simple, cheap, purely
    server-authoritative check: it does not (and cannot, at this layer)
    know whether `current_scene`'s *content* actually reflects that
    version -- it only proves the version the edit was proposed against
    is still the project's current one.

    ## Failure taxonomy -> HTTP response (in addition to
    `AICreateSceneView`'s create-scene table, which this endpoint's
    shared categories reuse identically)

    | Condition                                       | HTTP | `error` body value      |
    |---------------------------------------------------|------|-----------------------|
    | `current_scene` fails schema/limits validation  | 400  | `"current_scene_invalid"` |
    | `base_version_id` != `project.current_version_id` | 409 | `"stale_base"`          |
    | Empty patch (documented policy: rejected, not a no-op success) | 422 | `"empty_patch"` |
    | Patch touches a protected field (identity/version/seed/id)    | 422  | `"protected_field"`  |
    | Patch touches an element the prompt never names (#158) | 422 | `"unreferenced_element"` |
    | Patch targets a path outside the documented allowlist | 422 | `"invalid_patch_path"` |
    | Patch is malformed (bad op/shape/missing value) | 422  | `"malformed_patch"`      |
    | Patch exceeds the operation-count/byte-size bound | 413 | `"oversized_patch"`     |
    | Patch failed to mechanically apply (bad index/path) | 422 | `"patch_apply_failed"` |
    | Resulting patched scene fails schema/limits validation | 422 | `"invalid_structured_output"` |
    | Success                                         | 200  | (no `error` key; `draft: true`) |

    Every rejected/errored branch above leaves `current_scene` and every
    other piece of caller/server state completely unchanged -- this view
    has no database write path at all (see module-level docstring).
    """

    def post(self, request, public_id):
        project = _get_project_or_404(public_id)
        _require_or_404(request.user, Action.AI_EDIT_SCENE, project)

        input_serializer = AIEditSceneRequestSerializer(data=request.data)
        if not input_serializer.is_valid():
            return _request_invalid_response(input_serializer.errors)
        prompt = input_serializer.validated_data["prompt"]
        current_scene = input_serializer.validated_data["current_scene"]
        base_version_id = input_serializer.validated_data["base_version_id"]
        model = input_serializer.validated_data.get("model") or None
        vendor = input_serializer.validated_data.get("vendor", "mistral")
        persona_prompt = _resolve_persona_prompt(
            request.user, input_serializer.validated_data.get("persona_id")
        )

        if not isinstance(current_scene, dict):
            return Response(
                {
                    "error": "current_scene_invalid",
                    "detail": "current_scene must be a JSON object.",
                },
                status=status.HTTP_400_BAD_REQUEST,
            )

        current_scene_validation = validate_scene(current_scene)
        if not current_scene_validation.valid:
            return _invalid_current_scene_response(current_scene_validation)

        if base_version_id != project.current_version_id:
            return _stale_base_response(project.current_version_id)

        user_id = request.user.id
        if not _increment_and_check(
            _rate_limit_cache_key(user_id, operation="edit"),
            limit=EDIT_RATE_LIMIT_MAX_ATTEMPTS,
            window_seconds=EDIT_RATE_LIMIT_WINDOW_SECONDS,
        ):
            return _edit_rate_limited_response()

        edit_quota_key = _quota_cache_key(user_id, operation="edit")
        if _current_count(edit_quota_key) >= EDIT_DAILY_QUOTA_MAX_SUCCESSES:
            return _edit_quota_exceeded_response()

        try:
            provider = _provider_for_user(request.user, model, persona_prompt, vendor)
        except MissingPersonalMistralCredential:
            return _missing_key_response(vendor)
        except UnsupportedProvider:
            return _unsupported_provider_response()
        outcome = provider.edit_scene_with_patch(
            AIEditSceneRequest(prompt=prompt, current_scene=current_scene)
        )
        result = outcome.result

        # Minimal metadata only -- no prompt text, no scene/patch content,
        # no provider key -- per ai_provider.logging's documented default.
        log_operation_result(result)

        if not result.success:
            return _edit_error_response(result)

        cache.set(
            _quota_cache_key(user_id, operation="edit"),
            _current_count(_quota_cache_key(user_id, operation="edit")) + 1,
            timeout=DAILY_QUOTA_RESET_TIMEOUT_SECONDS,
        )

        return Response(
            {
                "draft": True,
                "operation": result.operation.value,
                "patch": outcome.patch,
                "scene": result.scene,
                "change_summary": outcome.change_summary,
                "usage": {
                    "prompt_tokens": result.usage.prompt_tokens,
                    "completion_tokens": result.usage.completion_tokens,
                    "total_tokens": result.usage.total_tokens,
                    "estimated_cost_usd": result.usage.estimated_cost_usd,
                },
            },
            status=status.HTTP_200_OK,
        )


# --- Task 48: the Accept endpoint that turns an AI create/edit draft into
# a real, immutable SceneVersion. Neither AICreateSceneView nor
# AIEditSceneView above ever writes one -- see this module's own docstring
# -- so this is the *only* code path that can produce a
# SceneVersion.Origin.AI_CREATE/AI_EDIT row.

# Origins this endpoint is willing to persist -- deliberately not the full
# SceneVersion.Origin enum (manual/restore/fork all have their own
# dedicated, differently-authorized creation paths; see
# scenes/serializers.py's ALLOWED_MANUAL_SAVE_ORIGINS for the same
# per-endpoint narrowing policy applied to the manual-save endpoint).
_ACCEPTABLE_AI_ORIGINS = (SceneVersion.Origin.AI_CREATE, SceneVersion.Origin.AI_EDIT)


class AIAcceptProposalRequestSerializer(serializers.Serializer):
    """Task 48's Accept request body.

    The client re-sends the full proposal (the exact `scene` it already
    received back from create-scene/edit-scene) rather than the server
    trying to recall or re-derive it -- `AICreateSceneView`/
    `AIEditSceneView` are stateless and never persist a draft server-side
    (see this module's top docstring), so there is nothing to look back
    up. This is the same "never trust the client blindly" policy as
    `SceneVersionListCreateView.post` (Task 14): `scene_json` here is
    re-validated from scratch by `AIAcceptProposalView`, exactly like a
    manual save, regardless of the fact that a provider produced it.

    `base_version_id` is the id of the `SceneVersion` that was
    `project.current_version` when the proposal was generated (the same
    field `AIEditSceneRequestSerializer` already requires, reused here for
    identical stale-base detection -- see `AIAcceptProposalView`). For an
    `ai_create` proposal on a project that had no saved version yet, this
    is `null`; for `ai_edit` it is whatever `current_scene`'s base was.

    `client_request_id` is a client-generated UUID, unique per proposal
    (not per Accept click) -- the frontend generates it once when a
    proposal is first shown and reuses the *same* value for every Accept
    attempt against that same proposal (including an automatic retry after
    a network error), so a duplicated/replayed request is recognized as
    "the same accept" rather than a new one. Omitting it disables
    idempotency deduplication for that request (each such request always
    attempts to create a new version).
    """

    operation = serializers.ChoiceField(
        choices=[(o.value, o.label) for o in _ACCEPTABLE_AI_ORIGINS]
    )
    scene_json = serializers.JSONField()
    base_version_id = serializers.IntegerField(allow_null=True)
    change_label = serializers.CharField(required=False, allow_blank=True, default="")
    client_request_id = serializers.UUIDField(required=False, allow_null=True, default=None)


class _StaleBase(Exception):
    """Raised inside the accept transaction to abort without creating a version."""


def _accept_invalid_scene_response(result: SceneValidationResult) -> Response:
    return Response(
        {
            "error": "invalid_structured_output",
            "detail": "; ".join(f"{e.path}: {e.message}" for e in result.errors[:5])
            or "scene_json failed validation.",
        },
        status=status.HTTP_422_UNPROCESSABLE_ENTITY,
    )


class AIAcceptProposalView(APIView):
    """POST /api/projects/<public_id>/ai/accept-proposal/ (Task 48)

    Authenticated project owner only (`Action.VERSION_CREATE`, 404 for
    anyone else -- the same action/policy `SceneVersionListCreateView.post`
    uses for a manual save, since accepting an AI proposal is exactly that:
    creating the next immutable version). Turns an already-generated,
    client-held AI draft (from `AICreateSceneView`/`AIEditSceneView`) into
    exactly one new `SceneVersion` with `origin="ai_create"`/`"ai_edit"`
    and advances `project.current_version` to it -- reusing
    `SceneVersionListCreateView.post`'s exact transaction shape
    (`select_for_update()` the project row, compute the next sequence
    *inside* that lock, create the version, advance `current_version`, all
    in one atomic block) rather than reinventing it.

    ## Never trusts the client's scene

    `scene_json` is re-validated here from scratch (`validate_scene`),
    exactly like a manual save -- the fact that a provider produced this
    scene earlier proves nothing about the exact bytes now arriving in
    this request.

    ## Stale-base handling

    `base_version_id` must equal `project.current_version_id` (both
    possibly `None`), checked *after* acquiring the row lock inside the
    transaction -- not before -- so this is race-proof: if a concurrent
    save/accept/restore landed between when the proposal was generated and
    when this request's lock is granted, `current_version_id` will have
    already moved and the request is rejected with `409 stale_base`,
    identical in shape to `AIEditSceneView`'s own stale-base response. No
    version is created and `current_version` is left untouched.

    ## Idempotency / duplicate-accept guard

    If `client_request_id` is supplied, this project is first checked
    (inside the same lock) for an existing `SceneVersion` already carrying
    that id (`SceneVersion.ai_request_id`, unique per project at the
    database level -- see `scenes/models.py`). If one exists, it is
    returned unchanged with `200 OK` -- no second version is created, and
    the stale-base check is skipped entirely for this case (a replay of an
    *already-accepted* proposal is a no-op success, not a conflict, even
    though `current_version` has since moved past `base_version_id` --
    that "move" is this very accept having already happened). This makes
    a repeated click, a browser retry after a dropped response, or a
    literal replayed HTTP request all resolve to exactly one version,
    because:

    - `select_for_update()` serializes any two requests racing on the same
      project row -- only one can hold the lock at a time.
    - Whichever commits first creates the row and its unique
      `(project, ai_request_id)` index entry.
    - The second (whether it re-checks before its own insert, or loses an
      `IntegrityError` race on that same insert) always ends up returning
      the first one's version instead of creating a second.

    Without a `client_request_id`, no such deduplication is possible (each
    request is treated as independent) -- the frontend accordingly always
    generates one per proposal and disables its Accept control while a
    request is in flight, per this task's UI requirements.
    """

    def post(self, request, public_id):
        project = _get_project_or_404(public_id)
        _require_or_404(request.user, Action.VERSION_CREATE, project)

        input_serializer = AIAcceptProposalRequestSerializer(data=request.data)
        if not input_serializer.is_valid():
            return Response(
                {"error": "request_invalid", "detail": input_serializer.errors},
                status=status.HTTP_400_BAD_REQUEST,
            )
        operation = input_serializer.validated_data["operation"]
        scene_json = input_serializer.validated_data["scene_json"]
        base_version_id = input_serializer.validated_data["base_version_id"]
        change_label = input_serializer.validated_data.get("change_label", "")
        client_request_id = input_serializer.validated_data.get("client_request_id")

        if not isinstance(scene_json, dict):
            return Response(
                {
                    "error": "invalid_structured_output",
                    "detail": "scene_json must be a JSON object.",
                },
                status=status.HTTP_400_BAD_REQUEST,
            )

        # Authoritative server-side validation, independent of the fact
        # that a provider produced this scene -- same policy as a manual
        # save (Task 14) and as AIEditSceneView's current_scene check.
        validation = validate_scene(scene_json)
        if not validation.valid:
            return _accept_invalid_scene_response(validation)

        try:
            with transaction.atomic():
                locked_project = Project.objects.select_for_update().get(pk=project.pk)

                if client_request_id is not None:
                    existing = locked_project.versions.filter(
                        ai_request_id=client_request_id
                    ).first()
                    if existing is not None:
                        return Response(
                            SceneVersionDetailSerializer(existing).data, status=status.HTTP_200_OK
                        )

                if base_version_id != locked_project.current_version_id:
                    raise _StaleBase

                next_sequence = (
                    locked_project.versions.aggregate(Max("sequence"))["sequence__max"] or 0
                ) + 1
                version = SceneVersion.objects.create(
                    project=locked_project,
                    sequence=next_sequence,
                    scene_json=scene_json,
                    created_by=request.user if request.user.is_authenticated else None,
                    parent=locked_project.current_version,
                    origin=operation,
                    change_label=change_label,
                    ai_request_id=client_request_id,
                )
                locked_project.current_version = version
                locked_project.save(update_fields=["current_version", "updated_at"])
                # Task 54: no-op unless the project is already public.
                maybe_schedule_thumbnail_generation(locked_project)
        except _StaleBase:
            return _stale_base_response(project.current_version_id)
        except IntegrityError:
            # A concurrent duplicate Accept (same client_request_id) won
            # the race on the unique (project, ai_request_id) constraint
            # between our pre-check above and this insert -- return the
            # winner's version instead of erroring, same fallback pattern
            # as BlankProjectCreateView's creation_request_id handling.
            if client_request_id is not None:
                existing = SceneVersion.objects.filter(
                    project=project, ai_request_id=client_request_id
                ).first()
                if existing is not None:
                    return Response(
                        SceneVersionDetailSerializer(existing).data, status=status.HTTP_200_OK
                    )
            raise
        except Project.DoesNotExist as exc:
            # Soft-deleted concurrently, between the initial fetch above and
            # the locked re-fetch: no version is created, current_version is
            # untouched (the whole atomic block rolled back).
            raise Http404 from exc

        return Response(SceneVersionDetailSerializer(version).data, status=status.HTTP_201_CREATED)


__all__ = [
    "DAILY_QUOTA_MAX_SUCCESSES",
    "EDIT_DAILY_QUOTA_MAX_SUCCESSES",
    "EDIT_RATE_LIMIT_MAX_ATTEMPTS",
    "EDIT_RATE_LIMIT_WINDOW_SECONDS",
    "MAX_MODEL_ID_CHARS",
    "MAX_PROMPT_CHARS",
    "RATE_LIMIT_MAX_ATTEMPTS",
    "RATE_LIMIT_WINDOW_SECONDS",
    "AIAcceptProposalRequestSerializer",
    "AIAcceptProposalView",
    "AICreateSceneRequestSerializer",
    "AICreateSceneView",
    "AIEditSceneRequestSerializer",
    "AIEditSceneView",
    "get_ai_provider",
]
