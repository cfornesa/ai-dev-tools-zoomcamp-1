"""Opt-in smoke checks for real Mistral 3D scene generation.

These tests are intentionally separate from the offline provider tests and
are never part of the default suite. Run them only when a real Mistral key is
configured for the process:

    (cd backend && RUN_LIVE_MISTRAL_3D_SMOKE=1 MISTRAL_API_KEY=... \
        uv run pytest tests/test_live_provider_3d.py -q)

The key is consumed lazily by ``MistralSceneProvider`` and is never printed,
included in an assertion, or sent to the browser. Each prompt is attempted
once; a provider failure or quota response is reported as a test failure
without an aggressive retry loop.
"""

from __future__ import annotations

import os

import pytest

from ai_provider.interface import AIErrorCategory
from ai_provider.interface3d import AICreateScene3DRequest
from ai_provider.mistral_provider import MistralSceneProvider
from scenes.validation3d import validate_scene3d

_RUN_LIVE_SMOKE = "RUN_LIVE_MISTRAL_3D_SMOKE"
_LIVE_SMOKE_ENABLED = os.environ.get(_RUN_LIVE_SMOKE) == "1"
_MISTRAL_KEY_CONFIGURED = bool(os.environ.get("MISTRAL_API_KEY"))

pytestmark = pytest.mark.skipif(
    not (_LIVE_SMOKE_ENABLED and _MISTRAL_KEY_CONFIGURED),
    reason=(
        "Opt-in real-provider smoke check disabled. Set "
        f"{_RUN_LIVE_SMOKE}=1 and configure MISTRAL_API_KEY to run it."
    ),
)

_EXPLICIT_DIMENSION_PROMPT = (
    "Create exactly one box with width 2, height 3, and depth 4; exactly one "
    "sphere with radius 1.5; exactly one cylinder with radiusTop 0.75, "
    "radiusBottom 1.25, and height 2.5; and exactly one plane with width 6 "
    "and height 5. Include exactly one ambient light. Do not create any other "
    "objects."
)

_DEFAULT_DIMENSION_PROMPT = (
    "Create exactly one box, exactly one sphere, exactly one cylinder, and "
    "exactly one plane. Do not specify dimensions for any object; use the "
    "required unit defaults. Include exactly one ambient light. Do not create "
    "any other objects."
)

_EXPECTED_EXPLICIT_DIMENSIONS = {
    "box": {"width": 2, "height": 3, "depth": 4},
    "sphere": {"radius": 1.5},
    "cylinder": {"radiusTop": 0.75, "radiusBottom": 1.25, "height": 2.5},
    "plane": {"width": 6, "height": 5},
}

_EXPECTED_DEFAULT_DIMENSIONS = {
    "box": {"width": 1, "height": 1, "depth": 1},
    "sphere": {"radius": 1},
    "cylinder": {"radiusTop": 1, "radiusBottom": 1, "height": 1},
    "plane": {"width": 1, "height": 1},
}


def _create_scene_once(provider: MistralSceneProvider, prompt: str) -> dict:
    """Create one scene and turn provider errors into safe smoke-test output."""
    result = provider.create_scene3d(AICreateScene3DRequest(prompt=prompt))
    if not result.success:
        assert result.error is not None
        category = result.error.category.value
        if result.error.category == AIErrorCategory.QUOTA_EXCEEDED:
            pytest.fail(
                "Mistral 3D smoke check hit the provider quota/rate limit "
                f"for this prompt ({category}); no retry was attempted."
            )
        pytest.fail(
            f"Mistral 3D smoke check reported provider failure ({category}); "
            "no retry was attempted."
        )

    assert result.scene is not None
    return result.scene


def _assert_scene_has_dimensions(
    scene: dict, expected_dimensions: dict[str, dict[str, int | float]]
) -> None:
    validation = validate_scene3d(scene)
    assert validation.valid, [(error.path, error.message) for error in validation.errors]

    objects_by_type = {
        object_type: [obj for obj in scene["objects"] if obj.get("type") == object_type]
        for object_type in expected_dimensions
    }
    for object_type, dimensions in expected_dimensions.items():
        matching_objects = objects_by_type[object_type]
        assert matching_objects, f"Live provider did not create a {object_type}."
        for obj in matching_objects:
            for field, expected_value in dimensions.items():
                assert obj[field] == expected_value, (
                    f"Live provider changed {object_type}.{field}: "
                    f"expected {expected_value!r}, got {obj.get(field)!r}."
                )

    assert scene["lights"], "Live provider did not create the requested ambient light."
    assert any(light.get("type") == "ambient" for light in scene["lights"])


def test_real_provider_creates_every_3d_primitive_with_explicit_dimensions():
    provider = MistralSceneProvider()
    scene = _create_scene_once(provider, _EXPLICIT_DIMENSION_PROMPT)

    _assert_scene_has_dimensions(scene, _EXPECTED_EXPLICIT_DIMENSIONS)


def test_real_provider_fills_unit_dimensions_when_primitive_sizes_are_omitted():
    provider = MistralSceneProvider()
    scene = _create_scene_once(provider, _DEFAULT_DIMENSION_PROMPT)

    _assert_scene_has_dimensions(scene, _EXPECTED_DEFAULT_DIMENSIONS)
