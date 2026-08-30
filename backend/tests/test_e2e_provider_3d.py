"""Tests for issue #235: E2ETestProvider's AIScene3DProvider support.

No prior test file exercised ai_provider/e2e_provider.py at all (it was
only reachable through the Playwright aiAndRecovery.spec.ts suite,
AI_PROVIDER=fake) -- these are the first backend unit tests for it,
scoped to the newly added 3D methods.
"""

from __future__ import annotations

from ai_provider.e2e_provider import build_e2e_provider
from ai_provider.interface import AICreateSceneRequest, AIErrorCategory
from ai_provider.interface3d import AICreateScene3DRequest, AIEditScene3DRequest
from scenes.validation3d import validate_scene3d


def test_success_scenario_create_scene3d_returns_a_valid_scene():
    provider = build_e2e_provider("success")

    result = provider.create_scene3d(AICreateScene3DRequest(prompt="a bare stage"))

    assert result.success
    assert validate_scene3d(result.scene).valid


def test_success_scenario_edit_scene3d_returns_an_applied_patch():
    provider = build_e2e_provider("success")
    base = provider.create_scene3d(AICreateScene3DRequest(prompt="a bare stage")).scene

    outcome = provider.edit_scene3d_with_patch(
        AIEditScene3DRequest(prompt="zoom out", current_scene=base)
    )

    assert outcome.result.success
    assert outcome.patch == [{"op": "replace", "path": "/camera/fov", "value": 65}]
    assert outcome.result.scene["camera"]["fov"] == 65


def test_invalid_structured_output_scenario_rejects_create_scene3d():
    provider = build_e2e_provider("invalid_structured_output")

    result = provider.create_scene3d(AICreateScene3DRequest(prompt="anything"))

    assert not result.success
    assert result.error.category == AIErrorCategory.INVALID_STRUCTURED_OUTPUT


def test_invalid_structured_output_scenario_rejects_edit_scene3d():
    provider = build_e2e_provider("invalid_structured_output")
    base = (
        build_e2e_provider("success").create_scene3d(AICreateScene3DRequest(prompt="a stage")).scene
    )

    outcome = provider.edit_scene3d_with_patch(
        AIEditScene3DRequest(prompt="zoom out", current_scene=base)
    )

    assert not outcome.result.success


def test_forbidden_patch_scenario_rejects_edit_scene3d():
    provider = build_e2e_provider("forbidden_patch")
    base = (
        build_e2e_provider("success").create_scene3d(AICreateScene3DRequest(prompt="a stage")).scene
    )

    outcome = provider.edit_scene3d_with_patch(
        AIEditScene3DRequest(prompt="anything", current_scene=base)
    )

    assert not outcome.result.success
    assert outcome.result.error.category == AIErrorCategory.PROVIDER_REJECTION


def test_quota_exceeded_scenario_raises_for_create_scene3d():
    provider = build_e2e_provider("quota_exceeded")

    result = provider.create_scene3d(AICreateScene3DRequest(prompt="anything"))

    assert not result.success
    assert result.error.category == AIErrorCategory.QUOTA_EXCEEDED


def test_timeout_scenario_raises_for_create_scene3d():
    provider = build_e2e_provider("timeout")

    result = provider.create_scene3d(AICreateScene3DRequest(prompt="anything"))

    assert not result.success
    assert result.error.category == AIErrorCategory.TIMEOUT


def test_unrecognized_scenario_defaults_to_success():
    provider = build_e2e_provider("not-a-real-scenario")

    result = provider.create_scene3d(AICreateScene3DRequest(prompt="anything"))

    assert result.success


def test_edit_scene3d_abc_method_returns_only_the_operation_result():
    provider = build_e2e_provider("success")
    base = provider.create_scene3d(AICreateScene3DRequest(prompt="a stage")).scene

    result = provider.edit_scene3d(AIEditScene3DRequest(prompt="zoom out", current_scene=base))

    assert result.success
    assert result.scene["camera"]["fov"] == 65


def test_2d_and_3d_scenarios_are_independent_on_the_same_provider_instance():
    """The same E2ETestProvider instance handles both document families --
    confirms the 3D addition didn't disturb the existing 2D create/edit
    paths (still covered end-to-end by the Playwright suite, not
    duplicated here)."""
    provider = build_e2e_provider("success")

    result_2d = provider.create_scene(AICreateSceneRequest(prompt="anything"))
    result_3d = provider.create_scene3d(AICreateScene3DRequest(prompt="anything"))

    assert result_2d.success
    assert result_3d.success
