"""Task 45: every documented error category, triggered via the fake provider.

Covers: timeout, cancellation, provider rejection, invalid structured
output, and quota errors each map to the correct normalized
`AIErrorCategory` -- and that invalid/malformed structured output is
rejected (never passed through unvalidated) rather than returned as a
usable scene.
"""

import pytest

from ai_provider.fake_provider import FakeAIProviderScenario, FakeAISceneProvider
from ai_provider.interface import AICreateSceneRequest, AIEditSceneRequest, AIErrorCategory
from scenes.validation import validate_scene

SCENARIO_TO_CATEGORY = {
    FakeAIProviderScenario.TIMEOUT: AIErrorCategory.TIMEOUT,
    FakeAIProviderScenario.CANCELLED: AIErrorCategory.CANCELLED,
    FakeAIProviderScenario.PROVIDER_REJECTION: AIErrorCategory.PROVIDER_REJECTION,
    FakeAIProviderScenario.INVALID_STRUCTURED_OUTPUT: AIErrorCategory.INVALID_STRUCTURED_OUTPUT,
    FakeAIProviderScenario.QUOTA_EXCEEDED: AIErrorCategory.QUOTA_EXCEEDED,
}


@pytest.mark.parametrize("scenario,category", sorted(SCENARIO_TO_CATEGORY.items(), key=str))
def test_create_scene_error_scenarios_map_to_documented_category(scenario, category):
    provider = FakeAISceneProvider(scenario=scenario)

    result = provider.create_scene(AICreateSceneRequest(prompt="anything"))

    assert result.success is False
    assert result.scene is None
    assert result.error is not None
    assert result.error.category == category
    # Usage metadata is present regardless of success/failure.
    assert result.usage.total_tokens >= 0
    assert result.usage.estimated_cost_usd >= 0


@pytest.mark.parametrize("scenario,category", sorted(SCENARIO_TO_CATEGORY.items(), key=str))
def test_edit_scene_error_scenarios_map_to_documented_category(scenario, category):
    provider = FakeAISceneProvider(scenario=scenario)

    result = provider.edit_scene(
        AIEditSceneRequest(prompt="anything", current_scene={"schemaVersion": 1})
    )

    assert result.success is False
    assert result.scene is None
    assert result.error is not None
    assert result.error.category == category


def test_invalid_structured_output_is_never_passed_through_unvalidated():
    """The fake's malformed-output scenario must fail scenes.validation itself,
    not just be labeled invalid by convention -- proves execute() actually
    revalidates rather than trusting a scenario flag."""
    provider = FakeAISceneProvider(scenario=FakeAIProviderScenario.INVALID_STRUCTURED_OUTPUT)

    result = provider.create_scene(AICreateSceneRequest(prompt="anything"))

    assert result.error.category == AIErrorCategory.INVALID_STRUCTURED_OUTPUT
    assert result.scene is None
    # And double check: the raw malformed fixture really does fail validate_scene.
    from ai_provider.fake_provider import _MALFORMED_SCENE

    assert not validate_scene(_MALFORMED_SCENE).valid


def test_error_scenarios_never_return_a_scene_even_if_caller_ignores_success_flag():
    for scenario in SCENARIO_TO_CATEGORY:
        provider = FakeAISceneProvider(scenario=scenario)
        result = provider.create_scene(AICreateSceneRequest(prompt="anything"))
        assert result.scene is None, f"{scenario} unexpectedly returned a scene"
