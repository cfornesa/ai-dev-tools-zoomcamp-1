"""A deterministic, network-free `AISceneProvider` for tests.

`FakeAISceneProvider` never opens a socket, never reads an environment
variable, and never accepts an API key — there is nothing in it capable
of leaking a provider credential. It exists so `ai_provider/`'s own
tests, and later Task 46/47/48's tests, can exercise every documented
success/error path without a real Mistral account, deterministically
(no randomness, no clock dependence in its output).
"""

from __future__ import annotations

import copy
from enum import StrEnum
from typing import Any

from ai_provider.errors import (
    AIProviderCancelledError,
    AIProviderQuotaError,
    AIProviderRejectionError,
    AIProviderTimeoutError,
)
from ai_provider.interface import (
    AICreateSceneRequest,
    AIEditSceneRequest,
    AIOperation,
    AIOperationResult,
    AISceneProvider,
    AIUsageMetadata,
    execute,
)

# A minimal, always-schema-valid scene (mirrors schema/fixtures/valid/blank.json).
# Deterministic and fixed: the fake provider never invents random content.
_VALID_SCENE_TEMPLATE: dict[str, Any] = {
    "schemaVersion": 1,
    "id": "scene-ai-fake",
    "canvas": {"width": 800, "height": 600, "backgroundColor": "#ffffff"},
    "renderer": {"preferred": "p5"},
    "layers": [{"id": "layer-1", "name": "Layer 1", "order": 0, "visible": True, "locked": False}],
    "shapes": [],
    "groups": [],
    "bindings": [],
    "graph": {"nodes": [], "connections": []},
    "accessibility": {"reducedMotion": "auto"},
    "randomness": {"seed": 0, "enabled": False},
}

# Deliberately fails scene validation (missing the required "canvas" field)
# so the INVALID_STRUCTURED_OUTPUT scenario exercises real validation
# rather than a hand-rolled stand-in error.
_MALFORMED_SCENE: dict[str, Any] = {
    "schemaVersion": 1,
    "id": "scene-ai-fake-malformed",
    "renderer": {"preferred": "p5"},
    "layers": [],
    "shapes": [],
    "groups": [],
    "bindings": [],
    "graph": {"nodes": [], "connections": []},
    "accessibility": {"reducedMotion": "auto"},
    "randomness": {"seed": 0, "enabled": False},
}


class FakeAIProviderScenario(StrEnum):
    """Every path `FakeAISceneProvider` can be configured to take."""

    SUCCESS = "success"
    TIMEOUT = "timeout"
    CANCELLED = "cancelled"
    PROVIDER_REJECTION = "provider_rejection"
    INVALID_STRUCTURED_OUTPUT = "invalid_structured_output"
    QUOTA_EXCEEDED = "quota_exceeded"


# Fixed, deterministic usage figures per scenario. Real providers report
# actual counts; the fake reports the same numbers every time so tests
# can assert on exact values.
_USAGE_BY_SCENARIO: dict[FakeAIProviderScenario, AIUsageMetadata] = {
    FakeAIProviderScenario.SUCCESS: AIUsageMetadata(
        prompt_tokens=42, completion_tokens=128, estimated_cost_usd=0.0034
    ),
    FakeAIProviderScenario.TIMEOUT: AIUsageMetadata(
        prompt_tokens=42, completion_tokens=0, estimated_cost_usd=0.0006
    ),
    FakeAIProviderScenario.CANCELLED: AIUsageMetadata(
        prompt_tokens=42, completion_tokens=0, estimated_cost_usd=0.0006
    ),
    FakeAIProviderScenario.PROVIDER_REJECTION: AIUsageMetadata(
        prompt_tokens=42, completion_tokens=6, estimated_cost_usd=0.0008
    ),
    FakeAIProviderScenario.INVALID_STRUCTURED_OUTPUT: AIUsageMetadata(
        prompt_tokens=42, completion_tokens=96, estimated_cost_usd=0.0026
    ),
    FakeAIProviderScenario.QUOTA_EXCEEDED: AIUsageMetadata(
        prompt_tokens=0, completion_tokens=0, estimated_cost_usd=0.0
    ),
}


class FakeAISceneProvider(AISceneProvider):
    """Deterministic fake `AISceneProvider`. No network access, ever.

    Configure `scenario` at construction (default `SUCCESS`) to control
    what `create_scene`/`edit_scene` return. Every scenario routes
    through `ai_provider.interface.execute()`, exactly like a real
    provider implementation would, so the fake proves the same
    normalization path a real provider uses rather than a separate
    shortcut.
    """

    def __init__(self, scenario: FakeAIProviderScenario = FakeAIProviderScenario.SUCCESS):
        self.scenario = scenario

    def create_scene(self, request: AICreateSceneRequest) -> AIOperationResult:
        return execute(
            AIOperation.CREATE_SCENE,
            _USAGE_BY_SCENARIO[self.scenario],
            lambda: self._produce_scene(seed_id="scene-ai-fake-create"),
        )

    def edit_scene(self, request: AIEditSceneRequest) -> AIOperationResult:
        return execute(
            AIOperation.EDIT_SCENE,
            _USAGE_BY_SCENARIO[self.scenario],
            lambda: self._produce_scene(seed_id="scene-ai-fake-edit"),
        )

    def _produce_scene(self, *, seed_id: str) -> dict[str, Any]:
        if self.scenario == FakeAIProviderScenario.TIMEOUT:
            raise AIProviderTimeoutError("The fake provider timed out (configured scenario).")
        if self.scenario == FakeAIProviderScenario.CANCELLED:
            raise AIProviderCancelledError("The operation was cancelled (configured scenario).")
        if self.scenario == FakeAIProviderScenario.PROVIDER_REJECTION:
            raise AIProviderRejectionError(
                "The fake provider declined the request (configured scenario: "
                "simulated content-policy rejection)."
            )
        if self.scenario == FakeAIProviderScenario.QUOTA_EXCEEDED:
            raise AIProviderQuotaError(
                "The fake provider's quota is exhausted (configured scenario)."
            )
        if self.scenario == FakeAIProviderScenario.INVALID_STRUCTURED_OUTPUT:
            return copy.deepcopy(_MALFORMED_SCENE)

        scene = copy.deepcopy(_VALID_SCENE_TEMPLATE)
        scene["id"] = seed_id
        return scene
