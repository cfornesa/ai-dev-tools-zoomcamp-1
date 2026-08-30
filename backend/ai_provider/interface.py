"""The abstract, provider-neutral AI scene interface (Task 45).

`docs/plan.md`'s "AI actions" section defines exactly two structured AI
operations:

    Create scene: prompt -> complete editable scene JSON -> preview -> save/refine.
    Edit scene:   prompt + current scene JSON -> minimal structured patch
                  -> preview -> accept/reject.

`AISceneProvider` is the single interface both operations go through, so
a real provider (Mistral, Task 46/47) and `FakeAISceneProvider` (this
task) are interchangeable everywhere else in the codebase — no view or
service should ever import a concrete provider class directly.

## Result shape

`docs/plan.md`: "AI returns strict schema-constrained JSON, never
arbitrary JavaScript. Server validates output ... before preview." Every
operation therefore returns a single `AIOperationResult`: a discriminated
result carrying *either* a `scene` dict that has already passed
`scenes.validation.validate_scene` ("validated output") *or* a normalized
`error`, but never neither and never both — plus `usage` (non-sensitive
token/cost metadata), attached unconditionally, success or failure alike.

## Error taxonomy

`execute()` is the only supported way to produce an `AIOperationResult`
from raw provider output. It maps the documented failure conditions to
`AIErrorCategory` members:

- `TIMEOUT` <- `ai_provider.errors.AIProviderTimeoutError`
- `CANCELLED` <- `ai_provider.errors.AIProviderCancelledError`
- `PROVIDER_REJECTION` <- `ai_provider.errors.AIProviderRejectionError`
- `QUOTA_EXCEEDED` <- `ai_provider.errors.AIProviderQuotaError`
- `INVALID_STRUCTURED_OUTPUT` <- the provider callable returned a dict
  (no exception raised) that `scenes.validation.validate_scene` rejects.
  This is the one category `execute()` detects itself rather than one a
  provider implementation raises, which is exactly what guarantees "no
  provider output reaches a caller without going through Task 6's
  validator" — a provider implementation cannot bypass validation by
  simply not raising.

Any other exception a provider callable raises is a genuine bug and is
left to propagate uncaught, rather than being coerced into one of the
five documented categories.
"""

from __future__ import annotations

from abc import ABC, abstractmethod
from collections.abc import Callable
from dataclasses import dataclass
from enum import StrEnum
from typing import Any

from ai_provider.errors import (
    AIProviderCancelledError,
    AIProviderQuotaError,
    AIProviderRejectionError,
    AIProviderTimeoutError,
)
from scenes.validation import SUPPORTED_SCHEMA_VERSION, validate_scene


class AIOperation(StrEnum):
    """The two, and only two, structured AI operations V1 supports."""

    CREATE_SCENE = "create_scene"
    EDIT_SCENE = "edit_scene"


class AIErrorCategory(StrEnum):
    """The documented, normalized application-level error taxonomy."""

    TIMEOUT = "timeout"
    CANCELLED = "cancelled"
    PROVIDER_REJECTION = "provider_rejection"
    INVALID_STRUCTURED_OUTPUT = "invalid_structured_output"
    QUOTA_EXCEEDED = "quota_exceeded"


@dataclass(frozen=True)
class AIUsageMetadata:
    """Non-sensitive token/cost metadata, attached to every response.

    Deliberately holds nothing but counts and a derived cost estimate —
    no prompt text, no scene content, no provider request/response
    bodies, no key/credential material. Safe to log and safe to return
    to the browser in full.
    """

    prompt_tokens: int
    completion_tokens: int
    estimated_cost_usd: float

    def __post_init__(self) -> None:
        if self.prompt_tokens < 0 or self.completion_tokens < 0:
            raise ValueError("Token counts must be non-negative.")
        if self.estimated_cost_usd < 0:
            raise ValueError("estimated_cost_usd must be non-negative.")

    @property
    def total_tokens(self) -> int:
        return self.prompt_tokens + self.completion_tokens


@dataclass(frozen=True)
class AICreateSceneRequest:
    """Create scene: prompt -> complete editable scene JSON."""

    prompt: str
    schema_version: int = SUPPORTED_SCHEMA_VERSION

    def __post_init__(self) -> None:
        if not self.prompt or not self.prompt.strip():
            raise ValueError("prompt must be non-empty.")


@dataclass(frozen=True)
class AIEditSceneRequest:
    """Edit scene: prompt + current scene JSON -> a new, complete scene JSON.

    `current_scene` is the caller's already-validated scene document. The
    provider is asked to return the complete edited scene (not a raw
    patch DSL); `execute()` validates that returned document exactly as
    it does for `create_scene`, which is what lets both operations share
    one result/error shape. Turning the validated result into a
    minimal, human-reviewable diff for preview (`docs/plan.md`: "The UI
    presents a human-readable change summary and visual diff") is a
    presentation-layer concern for the endpoint/frontend (Task 46-48),
    not this interface.
    """

    prompt: str
    current_scene: dict[str, Any]
    schema_version: int = SUPPORTED_SCHEMA_VERSION

    def __post_init__(self) -> None:
        if not self.prompt or not self.prompt.strip():
            raise ValueError("prompt must be non-empty.")
        if not isinstance(self.current_scene, dict):
            raise ValueError("current_scene must be a scene JSON object.")


@dataclass(frozen=True)
class AIError:
    """A normalized, non-sensitive error. Never carries raw provider payloads."""

    category: AIErrorCategory
    message: str


@dataclass(frozen=True)
class AIOperationResult:
    """Discriminated result: exactly one of `scene` (validated) or `error`.

    `usage` is always present, success or failure, per
    `docs/plan.md`'s "token/cost metadata logging" requirement.
    """

    operation: AIOperation
    usage: AIUsageMetadata
    scene: dict[str, Any] | None = None
    error: AIError | None = None

    def __post_init__(self) -> None:
        if (self.scene is None) == (self.error is None):
            raise ValueError("AIOperationResult must carry exactly one of `scene` or `error`.")

    @property
    def success(self) -> bool:
        return self.error is None


class AISceneProvider(ABC):
    """The provider-neutral interface every AI scene provider implements.

    A real provider (Mistral, Task 46/47) and `FakeAISceneProvider`
    (this task) both implement this ABC and are otherwise
    interchangeable to any caller.
    """

    @abstractmethod
    def create_scene(self, request: AICreateSceneRequest) -> AIOperationResult:
        """Prompt -> a complete, validated scene JSON (or a normalized error)."""

    @abstractmethod
    def edit_scene(self, request: AIEditSceneRequest) -> AIOperationResult:
        """Prompt + current scene -> a complete, validated scene JSON (or a normalized error)."""


def execute(
    operation: AIOperation,
    usage: AIUsageMetadata,
    produce_scene: Callable[[], dict[str, Any]],
) -> AIOperationResult:
    """Run a provider's raw call and normalize it into an `AIOperationResult`.

    Every `AISceneProvider` implementation (real or fake) should build
    its `create_scene`/`edit_scene` return value through this function
    rather than constructing `AIOperationResult` by hand: it is what
    guarantees (a) the five documented error categories are the only
    ones a caller ever sees, and (b) a successful `scene` has always
    already passed `scenes.validation.validate_scene` — a provider
    cannot return unvalidated structured output just by not raising.

    `produce_scene` should return the raw scene dict the provider
    proposed, or raise one of `ai_provider.errors`' four exceptions to
    signal timeout/cancellation/rejection/quota. Any other exception
    propagates uncaught (not a documented provider condition).
    """
    try:
        raw_scene = produce_scene()
    except AIProviderTimeoutError as exc:
        return _error_result(operation, usage, AIErrorCategory.TIMEOUT, str(exc))
    except AIProviderCancelledError as exc:
        return _error_result(operation, usage, AIErrorCategory.CANCELLED, str(exc))
    except AIProviderRejectionError as exc:
        return _error_result(operation, usage, AIErrorCategory.PROVIDER_REJECTION, str(exc))
    except AIProviderQuotaError as exc:
        return _error_result(operation, usage, AIErrorCategory.QUOTA_EXCEEDED, str(exc))

    validation = validate_scene(raw_scene)
    if not validation.valid:
        detail = "; ".join(f"{e.path}: {e.message}" for e in validation.errors[:5])
        return _error_result(
            operation,
            usage,
            AIErrorCategory.INVALID_STRUCTURED_OUTPUT,
            detail or "Provider output failed scene validation.",
        )

    return AIOperationResult(operation=operation, usage=usage, scene=raw_scene)


def _error_result(
    operation: AIOperation,
    usage: AIUsageMetadata,
    category: AIErrorCategory,
    message: str,
) -> AIOperationResult:
    return AIOperationResult(
        operation=operation,
        usage=usage,
        error=AIError(category=category, message=message),
    )


# Every dataclass a caller can construct or receive from this interface.
# Used by tests/test_ai_provider_key_and_logging_safety.py's structural
# guarantee that no request/response type can carry a raw provider key.
PUBLIC_DATA_TYPES: tuple[type, ...] = (
    AIUsageMetadata,
    AICreateSceneRequest,
    AIEditSceneRequest,
    AIError,
    AIOperationResult,
)

__all__ = [
    "PUBLIC_DATA_TYPES",
    "AICreateSceneRequest",
    "AIEditSceneRequest",
    "AIError",
    "AIErrorCategory",
    "AIOperation",
    "AIOperationResult",
    "AISceneProvider",
    "AIUsageMetadata",
    "execute",
]
