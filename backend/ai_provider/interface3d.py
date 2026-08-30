"""The 3D counterpart of `ai_provider/interface.py` (issue #232).

Per #208's decision, `scene3d` is a genuinely separate document family
from the 2D canonical scene -- this module is a parallel interface, not
an extension of `interface.py`. `AIUsageMetadata`, `AIError`,
`AIErrorCategory`, and the four `ai_provider.errors` exceptions are
schema-agnostic and reused directly (imported, not duplicated); only the
request/result types and `execute3d()` (which validates against
`scenes.validation3d.validate_scene3d` instead of `scenes.validation.
validate_scene`) are 3D-specific.
"""

from __future__ import annotations

from abc import ABC, abstractmethod
from collections.abc import Callable
from dataclasses import dataclass
from typing import Any

from ai_provider.errors import (
    AIProviderCancelledError,
    AIProviderQuotaError,
    AIProviderRejectionError,
    AIProviderTimeoutError,
)
from ai_provider.interface import AIError, AIErrorCategory, AIOperation, AIUsageMetadata
from scenes.validation3d import SUPPORTED_SCHEMA_VERSION, validate_scene3d


@dataclass(frozen=True)
class AICreateScene3DRequest:
    """Create scene3d: prompt -> complete editable scene3d JSON."""

    prompt: str
    schema_version: int = SUPPORTED_SCHEMA_VERSION

    def __post_init__(self) -> None:
        if not self.prompt or not self.prompt.strip():
            raise ValueError("prompt must be non-empty.")


@dataclass(frozen=True)
class AIEditScene3DRequest:
    """Edit scene3d: prompt + current scene3d JSON -> a new, complete scene3d JSON."""

    prompt: str
    current_scene: dict[str, Any]
    schema_version: int = SUPPORTED_SCHEMA_VERSION

    def __post_init__(self) -> None:
        if not self.prompt or not self.prompt.strip():
            raise ValueError("prompt must be non-empty.")
        if not isinstance(self.current_scene, dict):
            raise ValueError("current_scene must be a scene3d JSON object.")


@dataclass(frozen=True)
class AIOperationResult3D:
    """The `scene3d` counterpart of `interface.AIOperationResult`."""

    operation: AIOperation
    usage: AIUsageMetadata
    scene: dict[str, Any] | None = None
    error: AIError | None = None

    def __post_init__(self) -> None:
        if (self.scene is None) == (self.error is None):
            raise ValueError("AIOperationResult3D must carry exactly one of `scene` or `error`.")

    @property
    def success(self) -> bool:
        return self.error is None


class AIScene3DProvider(ABC):
    """The provider-neutral interface every 3D AI scene provider implements."""

    @abstractmethod
    def create_scene3d(self, request: AICreateScene3DRequest) -> AIOperationResult3D: ...

    @abstractmethod
    def edit_scene3d(self, request: AIEditScene3DRequest) -> AIOperationResult3D: ...


def execute3d(
    operation: AIOperation,
    usage: AIUsageMetadata,
    produce_scene: Callable[[], dict[str, Any]],
) -> AIOperationResult3D:
    """The `scene3d` counterpart of `interface.execute()` -- validates
    against `validate_scene3d` instead of `validate_scene`. See that
    function's docstring for the full contract."""
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

    validation = validate_scene3d(raw_scene)
    if not validation.valid:
        detail = "; ".join(f"{e.path}: {e.message}" for e in validation.errors[:5])
        return _error_result(
            operation,
            usage,
            AIErrorCategory.INVALID_STRUCTURED_OUTPUT,
            detail or "Provider output failed scene3d validation.",
        )

    return AIOperationResult3D(operation=operation, usage=usage, scene=raw_scene)


def _error_result(
    operation: AIOperation,
    usage: AIUsageMetadata,
    category: AIErrorCategory,
    message: str,
) -> AIOperationResult3D:
    return AIOperationResult3D(
        operation=operation,
        usage=usage,
        error=AIError(category=category, message=message),
    )


# Mirrors interface.py's PUBLIC_DATA_TYPES -- used by the same structural
# key-safety guarantee test, extended to cover this module's own types.
PUBLIC_DATA_TYPES: tuple[type, ...] = (
    AICreateScene3DRequest,
    AIEditScene3DRequest,
    AIOperationResult3D,
)

__all__ = [
    "PUBLIC_DATA_TYPES",
    "AICreateScene3DRequest",
    "AIEditScene3DRequest",
    "AIOperationResult3D",
    "AIScene3DProvider",
    "execute3d",
]
