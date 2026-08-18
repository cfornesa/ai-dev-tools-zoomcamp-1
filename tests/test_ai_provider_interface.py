"""Task 45: create-scene/edit-scene success paths and result invariants.

Covers: the interface defines distinct create-scene and edit-scene
operations with typed requests/responses; a successful response carries
validated output (checked against `scenes.validation.validate_scene`)
plus non-sensitive token/cost metadata.
"""

import pytest

from ai_provider.fake_provider import FakeAIProviderScenario, FakeAISceneProvider
from ai_provider.interface import (
    AICreateSceneRequest,
    AIEditSceneRequest,
    AIOperation,
    AIOperationResult,
    AIUsageMetadata,
)
from scenes.validation import validate_scene


def test_create_scene_success_returns_validated_scene_and_usage():
    provider = FakeAISceneProvider(scenario=FakeAIProviderScenario.SUCCESS)

    result = provider.create_scene(AICreateSceneRequest(prompt="a calming field of teal circles"))

    assert result.success is True
    assert result.operation == AIOperation.CREATE_SCENE
    assert result.error is None
    assert result.scene is not None
    assert validate_scene(result.scene).valid

    assert result.usage.prompt_tokens > 0
    assert result.usage.completion_tokens > 0
    assert result.usage.total_tokens == result.usage.prompt_tokens + result.usage.completion_tokens
    assert result.usage.estimated_cost_usd >= 0


def test_edit_scene_success_returns_validated_scene_and_usage():
    provider = FakeAISceneProvider(scenario=FakeAIProviderScenario.SUCCESS)
    current_scene = {"schemaVersion": 1, "id": "scene-current"}

    result = provider.edit_scene(
        AIEditSceneRequest(prompt="make it ripple on pinch", current_scene=current_scene)
    )

    assert result.success is True
    assert result.operation == AIOperation.EDIT_SCENE
    assert result.error is None
    assert result.scene is not None
    assert validate_scene(result.scene).valid
    assert result.usage.total_tokens > 0


def test_create_and_edit_are_distinct_operations_with_distinct_request_types():
    assert AICreateSceneRequest is not AIEditSceneRequest
    assert AIOperation.CREATE_SCENE != AIOperation.EDIT_SCENE

    # Edit requires current_scene; create does not accept it at all.
    with pytest.raises(TypeError):
        AICreateSceneRequest(prompt="x", current_scene={})


def test_create_scene_rejects_empty_prompt():
    with pytest.raises(ValueError):
        AICreateSceneRequest(prompt="   ")


def test_edit_scene_rejects_non_dict_current_scene():
    with pytest.raises(ValueError):
        AIEditSceneRequest(prompt="x", current_scene="not-a-dict")


def test_result_is_a_discriminated_union_exactly_one_of_scene_or_error():
    usage = AIUsageMetadata(prompt_tokens=1, completion_tokens=1, estimated_cost_usd=0.0)

    with pytest.raises(ValueError):
        AIOperationResult(operation=AIOperation.CREATE_SCENE, usage=usage)  # neither set

    # Scene only (no error) is the valid success shape -- should not raise.
    ok = AIOperationResult(operation=AIOperation.CREATE_SCENE, usage=usage, scene={"a": 1})
    assert ok.success is True


def test_result_rejects_both_scene_and_error_present():
    usage = AIUsageMetadata(prompt_tokens=1, completion_tokens=1, estimated_cost_usd=0.0)
    from ai_provider.interface import AIError, AIErrorCategory

    with pytest.raises(ValueError):
        AIOperationResult(
            operation=AIOperation.CREATE_SCENE,
            usage=usage,
            scene={"a": 1},
            error=AIError(category=AIErrorCategory.TIMEOUT, message="x"),
        )


def test_usage_metadata_rejects_negative_values():
    with pytest.raises(ValueError):
        AIUsageMetadata(prompt_tokens=-1, completion_tokens=0, estimated_cost_usd=0.0)
    with pytest.raises(ValueError):
        AIUsageMetadata(prompt_tokens=0, completion_tokens=0, estimated_cost_usd=-0.01)
