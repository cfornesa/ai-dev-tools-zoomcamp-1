"""Tests for POST /api/ai/art-pieces/generate/ (issue #199, the Canvas2D
first-slice implementation of the multi-library AI art generation epic).

Mirrors `test_ai_create_scene_api.py`'s mocking boundary: every test
monkeypatches `scenes.art_piece_api.get_art_piece_provider` to a fake or a
`ArtPieceProvider(client=<fake>)`, so none of them open a socket or
require a real `MISTRAL_API_KEY`. This endpoint is deliberately not
project-scoped (see `scenes/art_piece_api.py`'s module docstring), so
these tests need no `Project` fixture at all.
"""

from __future__ import annotations

from dataclasses import replace
from types import SimpleNamespace

import pytest
from django.contrib.auth import get_user_model
from django.core.cache import cache
from rest_framework.test import APIClient

import scenes.art_piece_api as art_piece_api
from ai_provider.art_piece_provider import ArtPieceProvider
from scenes.models import AIPersona, AIProviderModel, AIRetryPreference, ProviderCredential

URL = "/api/ai/art-pieces/generate/"


@pytest.fixture(autouse=True)
def _clear_cache():
    cache.clear()
    yield
    cache.clear()


@pytest.fixture
def owner(db):
    return get_user_model().objects.create_user(username="alice")


@pytest.fixture
def owner_client(owner):
    client = APIClient()
    client.force_authenticate(owner)
    return client


def _use_provider(monkeypatch, provider):
    monkeypatch.setattr(art_piece_api, "get_art_piece_provider", lambda: provider)


def _bad_output_provider(operations):
    def handler(**kwargs):
        operations.append(kwargs)
        return SimpleNamespace(
            usage=SimpleNamespace(prompt_tokens=1, completion_tokens=1),
            choices=[SimpleNamespace(message=SimpleNamespace(content="<p>bad</p>"))],
        )

    return ArtPieceProvider(client=_FakeClient(handler))


class _FakeChat:
    def __init__(self, handler):
        self._handler = handler

    def complete(self, **kwargs):
        return self._handler(**kwargs)


class _FakeClient:
    def __init__(self, handler):
        self.chat = _FakeChat(handler)


def _mistral_provider_returning(content: str) -> ArtPieceProvider:
    def handler(**kwargs):
        return SimpleNamespace(
            usage=SimpleNamespace(prompt_tokens=10, completion_tokens=20),
            choices=[SimpleNamespace(message=SimpleNamespace(content=content))],
        )

    return ArtPieceProvider(client=_FakeClient(handler))


@pytest.mark.parametrize(
    ("library", "source", "search", "expected"),
    [
        (
            "canvas2d",
            "<canvas></canvas><script>const c = 'teal';</script>",
            "teal",
            "#e76f51",
        ),
        ("svg", '<svg fill="teal"></svg>', "teal", "#e76f51"),
        (
            "p5js",
            "window.sketch = function () { p.background(42, 157, 143); };",
            "42, 157, 143",
            "231, 111, 81",
        ),
        ("c2js", "window.sketch = function () { return '#2a9d8f'; };", "#2a9d8f", "#e76f51"),
        (
            "c2js-interactive",
            "window.sketch = function () { return '#2a9d8f'; };",
            "#2a9d8f",
            "#e76f51",
        ),
        ("threejs", "const material = { color: 0x2a9d8f };", "0x2a9d8f", "0xe76f51"),
        ("aframe", '<a-scene><a-box color="#2a9d8f"></a-box></a-scene>', "#2a9d8f", "#e76f51"),
    ],
)
@pytest.mark.django_db
def test_fake_provider_refinement_is_observable_for_every_engine(
    owner_client, monkeypatch, library, source, search, expected
):
    monkeypatch.setattr(art_piece_api, "use_fake_ai_provider", lambda: True)
    provider = art_piece_api.get_art_piece_provider()

    result = provider.refine("make the accent warmer", source, library, [])

    assert result.error is None
    assert result.edits == [{"search": search, "replace": expected}]


_VALID_SNIPPET = (
    '<canvas id="art-piece-canvas"></canvas>'
    "<script>const c=document.getElementById('art-piece-canvas');"
    "const ctx=c.getContext('2d');ctx.fillRect(0,0,10,10);</script>"
)

_VALID_SVG_SNIPPET = (
    '<svg id="art-piece-svg" viewBox="0 0 100 100">'
    '<circle cx="50" cy="50" r="40" fill="teal">'
    '<animate attributeName="r" values="40;20;40" dur="2s" repeatCount="indefinite" />'
    "</circle>"
    "</svg>"
)

_VALID_P5_SNIPPET = (
    "window.sketch = function (p) { p.setup = function () { p.createCanvas(10, 10); }; };"
)
_VALID_C2_SNIPPET = "window.sketch = function (runtime) { runtime.startFrame(function () {}); };"

_VALID_THREEJS_SNIPPET = (
    "const container = document.getElementById('art-piece-container');"
    "const renderer = new THREE.WebGLRenderer();"
    "renderer.setSize(container.clientWidth, container.clientHeight);"
    "container.appendChild(renderer.domElement);"
    "const scene = new THREE.Scene();"
    "const camera = new THREE.PerspectiveCamera(75, 1, 0.1, 1000);"
    "renderer.render(scene, camera);"
)

_VALID_AFRAME_SNIPPET = (
    '<a-scene id="art-piece-scene" embedded>'
    '<a-box position="0 1 -3" color="teal"></a-box>'
    '<a-camera position="0 1 0"></a-camera>'
    "</a-scene>"
)


@pytest.mark.django_db
def test_success_returns_the_generated_snippet_and_usage(owner_client, monkeypatch):
    _use_provider(monkeypatch, _mistral_provider_returning(_VALID_SNIPPET))

    response = owner_client.post(
        URL, {"library": "canvas2d", "prompt": "a calm field of teal circles"}, format="json"
    )

    assert response.status_code == 200
    body = response.json()
    assert body["library"] == "canvas2d"
    assert body["code"] == _VALID_SNIPPET
    assert set(body["usage"]) == {
        "prompt_tokens",
        "completion_tokens",
        "total_tokens",
        "estimated_cost_usd",
    }


@pytest.mark.django_db
def test_response_stripped_of_a_stray_markdown_fence(owner_client, monkeypatch):
    fenced = f"```html\n{_VALID_SNIPPET}\n```"
    _use_provider(monkeypatch, _mistral_provider_returning(fenced))

    response = owner_client.post(URL, {"library": "canvas2d", "prompt": "anything"}, format="json")

    assert response.status_code == 200
    assert response.json()["code"] == _VALID_SNIPPET


@pytest.mark.django_db
def test_repair_attempts_count_as_one_art_generation_quota_unit(owner, owner_client, monkeypatch):
    AIRetryPreference.objects.create(owner=owner, auto_retry_enabled=True, max_retries=3)
    responses = iter(["<p>bad</p>", _VALID_SNIPPET])
    calls = []

    def handler(**kwargs):
        calls.append(kwargs)
        return SimpleNamespace(
            usage=SimpleNamespace(prompt_tokens=1, completion_tokens=1),
            choices=[SimpleNamespace(message=SimpleNamespace(content=next(responses)))],
        )

    provider = ArtPieceProvider(client=_FakeClient(handler))
    _use_provider(monkeypatch, provider)

    response = owner_client.post(URL, {"library": "canvas2d", "prompt": "anything"}, format="json")

    assert response.status_code == 200
    assert len(calls) == 2
    assert cache.get(art_piece_api._quota_cache_key(owner.id)) == 1


@pytest.mark.django_db
@pytest.mark.parametrize("preference_state", ["missing", "disabled"])
def test_generation_retry_off_characterizes_operation_and_quota_counts(
    owner, owner_client, monkeypatch, preference_state
):
    """At adcb737e generation ignored the off preference and repaired once.

    The scripted client records actual chat.complete model operations;
    adapter_calls records provider.generate calls. Generation currently
    charges one quota unit after success and one rate-limit increment per
    request, regardless of repair count. #1315 will stop after the first
    invalid response when retry is off, preserving those accounting rules.
    """
    if preference_state == "disabled":
        AIRetryPreference.objects.create(owner=owner, auto_retry_enabled=False, max_retries=3)
    operations = []
    adapter_calls = []
    contents = iter(["<p>bad</p>", _VALID_SNIPPET])

    def handler(**kwargs):
        operations.append(kwargs)
        return SimpleNamespace(
            usage=SimpleNamespace(prompt_tokens=10, completion_tokens=20),
            choices=[SimpleNamespace(message=SimpleNamespace(content=next(contents)))],
        )

    model_provider = ArtPieceProvider(client=_FakeClient(handler))

    class CountingProvider:
        def generate(self, prompt, library, **kwargs):
            adapter_calls.append((prompt, library))
            return model_provider.generate(prompt, library, **kwargs)

    _use_provider(monkeypatch, CountingProvider())
    response = owner_client.post(
        URL, {"library": "canvas2d", "prompt": "a calm field"}, format="json"
    )

    # Corrected policy: one model operation inside one adapter call; one
    # rate-limit increment; no success quota unit because generation failed.
    assert response.status_code == 422
    assert len(adapter_calls) == 1
    assert len(operations) == 1
    assert cache.get(art_piece_api._rate_limit_cache_key(owner.id)) == 1
    assert cache.get(art_piece_api._quota_cache_key(owner.id), 0) == 0


@pytest.mark.django_db
@pytest.mark.parametrize("warnings", [None, []])
def test_generation_malformed_output_formats_nullable_warnings_safely(
    owner_client, monkeypatch, warnings
):
    operations = []
    provider = _bad_output_provider(operations)

    class WarningsOverrideProvider:
        def generate(self, prompt, library, **kwargs):
            return replace(provider.generate(prompt, library, **kwargs), warnings=warnings)

    _use_provider(monkeypatch, WarningsOverrideProvider())
    response = owner_client.post(URL, {"library": "canvas2d", "prompt": "anything"}, format="json")

    assert response.status_code == 422
    assert response.json()["detail"] == "missing_canvas_root"
    assert response.json()["guidance"] == (
        "No automatic repair was run; revise the prompt or submit again."
    )
    assert response.json()["attempts"] == []
    assert len(operations) == 1


@pytest.mark.django_db
def test_generation_preference_below_ceiling_limits_model_operations(
    owner, owner_client, monkeypatch
):
    AIRetryPreference.objects.create(owner=owner, auto_retry_enabled=True, max_retries=1)
    operations = []
    _use_provider(monkeypatch, _bad_output_provider(operations))

    response = owner_client.post(
        URL, {"library": "canvas2d", "prompt": "a calm field"}, format="json"
    )

    assert response.status_code == 422
    assert len(operations) == 2  # initial call plus the single preferred repair
    assert response.json()["detail"] == "missing_canvas_root"
    assert response.json()["guidance"] == (
        "Automatic repairs were exhausted; revise the prompt or submit again."
    )


@pytest.mark.django_db
def test_generation_escalation_requires_catalog_support(owner, owner_client, monkeypatch):
    AIRetryPreference.objects.create(owner=owner, auto_retry_enabled=True, max_retries=3)
    monkeypatch.setenv("ART_PIECE_ESCALATION_MODEL", "mistral-large-latest")
    monkeypatch.setattr(
        art_piece_api,
        "is_art_piece_supported",
        lambda **kwargs: kwargs["model_slug"] == "mistral-small-latest",
    )
    operations = []
    _use_provider(monkeypatch, _bad_output_provider(operations))

    owner_client.post(URL, {"library": "canvas2d", "prompt": "a calm field"}, format="json")

    assert [operation["model"] for operation in operations] == [
        "mistral-small-latest",
        "mistral-small-latest",
        "mistral-small-latest",
    ]


@pytest.mark.django_db
def test_generation_ignores_another_owners_retry_preference(owner, owner_client, monkeypatch):
    other = get_user_model().objects.create_user(username="other-preference-owner")
    AIRetryPreference.objects.create(owner=other, auto_retry_enabled=True, max_retries=3)
    operations = []
    _use_provider(monkeypatch, _bad_output_provider(operations))

    owner_client.post(URL, {"library": "canvas2d", "prompt": "a calm field"}, format="json")

    assert len(operations) == 1


@pytest.mark.django_db
def test_generation_escalation_shares_budget_and_sums_usage(owner, owner_client, monkeypatch):
    AIRetryPreference.objects.create(owner=owner, auto_retry_enabled=True, max_retries=8)
    monkeypatch.setenv("ART_PIECE_MAX_REPAIRS", "99")
    monkeypatch.setenv("ART_PIECE_ESCALATION_MODEL", "mistral-large-latest")
    monkeypatch.setattr(art_piece_api, "is_art_piece_supported", lambda **kwargs: True)
    operations = []
    adapter_calls = []
    contents = iter(["<p>bad</p>", "<div>still bad</div>", _VALID_SNIPPET])

    def handler(**kwargs):
        operations.append(kwargs)
        return SimpleNamespace(
            usage=SimpleNamespace(prompt_tokens=10, completion_tokens=20),
            choices=[SimpleNamespace(message=SimpleNamespace(content=next(contents)))],
        )

    model_provider = ArtPieceProvider(client=_FakeClient(handler))

    class CountingProvider:
        def generate(self, prompt, library, **kwargs):
            adapter_calls.append((prompt, library))
            return model_provider.generate(prompt, library, **kwargs)

    _use_provider(monkeypatch, CountingProvider())
    response = owner_client.post(
        URL, {"library": "canvas2d", "prompt": "a calm field"}, format="json"
    )

    assert response.status_code == 200
    assert len(adapter_calls) == 1
    assert [operation["model"] for operation in operations] == [
        "mistral-small-latest",
        "mistral-small-latest",
        "mistral-large-latest",
    ]
    assert response.json()["usage"]["prompt_tokens"] == 30
    assert response.json()["usage"]["completion_tokens"] == 60
    assert cache.get(art_piece_api._rate_limit_cache_key(owner.id)) == 1
    assert cache.get(art_piece_api._quota_cache_key(owner.id)) == 1


@pytest.mark.django_db
def test_generation_escalation_does_not_override_explicit_model(owner, owner_client, monkeypatch):
    AIRetryPreference.objects.create(owner=owner, auto_retry_enabled=True, max_retries=3)
    monkeypatch.setenv("ART_PIECE_ESCALATION_MODEL", "mistral-large-latest")
    monkeypatch.setattr(art_piece_api, "is_art_piece_supported", lambda **kwargs: True)
    operations = []

    def handler(**kwargs):
        operations.append(kwargs)
        return SimpleNamespace(
            usage=SimpleNamespace(prompt_tokens=1, completion_tokens=1),
            choices=[SimpleNamespace(message=SimpleNamespace(content="<p>bad</p>"))],
        )

    _use_provider(monkeypatch, ArtPieceProvider(client=_FakeClient(handler)))
    response = owner_client.post(
        URL,
        {
            "library": "canvas2d",
            "prompt": "a calm field",
            "model": "mistral-small-latest",
        },
        format="json",
    )

    assert response.status_code == 422
    assert [operation["model"] for operation in operations] == [
        "mistral-small-latest",
        "mistral-small-latest",
        "mistral-small-latest",
    ]


@pytest.mark.django_db
def test_output_missing_canvas_or_script_is_rejected_with_422(owner_client, monkeypatch):
    _use_provider(monkeypatch, _mistral_provider_returning("<p>not a canvas piece</p>"))

    response = owner_client.post(URL, {"library": "canvas2d", "prompt": "anything"}, format="json")

    assert response.status_code == 422
    assert response.json()["error"] == "invalid_structured_output"
    assert response.json()["detail"] == "missing_canvas_root"
    assert response.json()["guidance"] == (
        "No automatic repair was run; revise the prompt or submit again."
    )
    assert "anything" not in response.json()["detail"]


@pytest.mark.django_db
def test_registered_p5_engine_returns_a_valid_generated_snippet(owner_client, monkeypatch):
    _use_provider(monkeypatch, _mistral_provider_returning(_VALID_P5_SNIPPET))

    response = owner_client.post(URL, {"library": "p5js", "prompt": "a field"}, format="json")

    assert response.status_code == 200
    assert response.json()["code"] == _VALID_P5_SNIPPET


@pytest.mark.parametrize("library", ["c2js", "c2js-interactive"])
@pytest.mark.django_db
def test_registered_c2_engines_return_valid_generated_snippets(owner_client, monkeypatch, library):
    _use_provider(monkeypatch, _mistral_provider_returning(_VALID_C2_SNIPPET))

    response = owner_client.post(URL, {"library": library, "prompt": "a field"}, format="json")

    assert response.status_code == 200
    assert response.json()["library"] == library
    assert response.json()["code"] == _VALID_C2_SNIPPET


@pytest.mark.django_db
def test_empty_output_is_rejected_with_422(owner_client, monkeypatch):
    _use_provider(monkeypatch, _mistral_provider_returning("   "))

    response = owner_client.post(URL, {"library": "canvas2d", "prompt": "anything"}, format="json")

    assert response.status_code == 422


@pytest.mark.django_db
def test_oversized_raw_response_is_rejected_with_413(owner_client, monkeypatch):
    from ai_provider.art_piece_provider import MAX_RAW_RESPONSE_BYTES

    huge = "x" * (MAX_RAW_RESPONSE_BYTES + 1)
    _use_provider(monkeypatch, _mistral_provider_returning(huge))

    response = owner_client.post(URL, {"library": "canvas2d", "prompt": "anything"}, format="json")

    assert response.status_code == 413
    assert response.json()["error"] == "response_too_large"


@pytest.mark.django_db
def test_svg_success_returns_the_generated_snippet(owner_client, monkeypatch):
    _use_provider(monkeypatch, _mistral_provider_returning(_VALID_SVG_SNIPPET))

    response = owner_client.post(
        URL, {"library": "svg", "prompt": "a pulsing teal circle"}, format="json"
    )

    assert response.status_code == 200
    body = response.json()
    assert body["library"] == "svg"
    assert body["code"] == _VALID_SVG_SNIPPET


@pytest.mark.django_db
def test_svg_output_with_inline_script_is_accepted(owner_client, monkeypatch):
    scripted = '<svg id="art-piece-svg"><script>alert(1)</script></svg>'
    _use_provider(monkeypatch, _mistral_provider_returning(scripted))

    response = owner_client.post(URL, {"library": "svg", "prompt": "anything"}, format="json")

    assert response.status_code == 200
    assert response.json()["code"] == scripted


@pytest.mark.django_db
def test_svg_output_with_external_script_is_rejected_with_422(owner_client, monkeypatch):
    scripted = '<svg id="art-piece-svg"><script src="https://example.test/app.js"></script></svg>'
    _use_provider(monkeypatch, _mistral_provider_returning(scripted))

    response = owner_client.post(URL, {"library": "svg", "prompt": "anything"}, format="json")

    assert response.status_code == 422


@pytest.mark.django_db
def test_svg_output_missing_svg_tag_is_rejected_with_422(owner_client, monkeypatch):
    _use_provider(monkeypatch, _mistral_provider_returning("<p>not svg</p>"))

    response = owner_client.post(URL, {"library": "svg", "prompt": "anything"}, format="json")

    assert response.status_code == 422


@pytest.mark.django_db
def test_threejs_success_returns_the_generated_snippet(owner_client, monkeypatch):
    _use_provider(monkeypatch, _mistral_provider_returning(_VALID_THREEJS_SNIPPET))

    response = owner_client.post(
        URL, {"library": "threejs", "prompt": "a rotating teal cube"}, format="json"
    )

    assert response.status_code == 200
    body = response.json()
    assert body["library"] == "threejs"
    assert body["code"] == _VALID_THREEJS_SNIPPET


@pytest.mark.django_db
def test_threejs_output_wrapped_in_a_script_tag_is_rejected_with_422(owner_client, monkeypatch):
    """Issue #199 (Three.js extension): the sandboxed document supplies the
    <script> tag and the THREE global itself -- a model that wraps its own
    <script> tag around the code didn't follow the plain-JavaScript-only
    rule, so this is rejected rather than double-wrapped."""
    wrapped = f"<script>{_VALID_THREEJS_SNIPPET}</script>"
    _use_provider(monkeypatch, _mistral_provider_returning(wrapped))

    response = owner_client.post(URL, {"library": "threejs", "prompt": "anything"}, format="json")

    assert response.status_code == 422
    assert response.json()["error"] == "invalid_structured_output"


@pytest.mark.django_db
def test_threejs_output_not_referencing_three_is_rejected_with_422(owner_client, monkeypatch):
    _use_provider(monkeypatch, _mistral_provider_returning("console.log('no three here');"))

    response = owner_client.post(URL, {"library": "threejs", "prompt": "anything"}, format="json")

    assert response.status_code == 422


@pytest.mark.django_db
def test_aframe_success_returns_the_generated_snippet(owner_client, monkeypatch):
    _use_provider(monkeypatch, _mistral_provider_returning(_VALID_AFRAME_SNIPPET))

    response = owner_client.post(
        URL, {"library": "aframe", "prompt": "a teal box floating in space"}, format="json"
    )

    assert response.status_code == 200
    body = response.json()
    assert body["library"] == "aframe"
    assert body["code"] == _VALID_AFRAME_SNIPPET


@pytest.mark.django_db
def test_aframe_output_with_inline_script_is_accepted(owner_client, monkeypatch):
    scripted = (
        '<a-scene id="art-piece-scene"><script>'
        "AFRAME.registerComponent('lamp-toggle', {});"
        "</script></a-scene>"
    )
    _use_provider(monkeypatch, _mistral_provider_returning(scripted))

    response = owner_client.post(URL, {"library": "aframe", "prompt": "anything"}, format="json")

    assert response.status_code == 200
    assert response.json()["code"] == scripted


@pytest.mark.django_db
def test_aframe_output_with_external_script_is_rejected_with_422(owner_client, monkeypatch):
    scripted = '<a-scene id="art-piece-scene"><script src="https://example.test/app.js"></script></a-scene>'
    _use_provider(monkeypatch, _mistral_provider_returning(scripted))

    response = owner_client.post(URL, {"library": "aframe", "prompt": "anything"}, format="json")

    assert response.status_code == 422


@pytest.mark.django_db
def test_aframe_output_missing_a_scene_tag_is_rejected_with_422(owner_client, monkeypatch):
    _use_provider(monkeypatch, _mistral_provider_returning("<div>not a-frame</div>"))

    response = owner_client.post(URL, {"library": "aframe", "prompt": "anything"}, format="json")

    assert response.status_code == 422


@pytest.mark.django_db
def test_unsupported_library_is_rejected_with_400(owner_client, monkeypatch):
    _use_provider(monkeypatch, _mistral_provider_returning(_VALID_SNIPPET))

    response = owner_client.post(
        URL, {"library": "unreal-engine", "prompt": "anything"}, format="json"
    )

    assert response.status_code == 400


@pytest.mark.django_db
def test_blank_prompt_is_rejected_with_400(owner_client, monkeypatch):
    _use_provider(monkeypatch, _mistral_provider_returning(_VALID_SNIPPET))

    response = owner_client.post(URL, {"library": "canvas2d", "prompt": ""}, format="json")

    assert response.status_code == 400
    assert response.json()["error"] == "prompt_invalid"


@pytest.mark.django_db
def test_malformed_model_id_is_rejected_with_400_and_model_invalid(owner_client, monkeypatch):
    _use_provider(monkeypatch, _mistral_provider_returning(_VALID_SNIPPET))

    response = owner_client.post(
        URL,
        {"library": "canvas2d", "prompt": "anything", "model": "Not A Valid Model!"},
        format="json",
    )

    assert response.status_code == 400
    assert response.json()["error"] == "model_invalid"


@pytest.mark.django_db
def test_fake_provider_seam_needs_no_personal_key(owner_client, monkeypatch):
    """`AI_PROVIDER=fake` (`ai_provider/config.py`) short-circuits
    `get_art_piece_provider` before any credential lookup, mirroring
    `scenes.ai_api.get_ai_provider`'s identical seam -- an owner with no
    generic Mistral credential at all still gets a deterministic success."""
    monkeypatch.setattr(art_piece_api, "use_fake_ai_provider", lambda: True)

    def fail_if_queried(*args, **kwargs):
        raise AssertionError("fake-provider path must never touch the credential store")

    monkeypatch.setattr(art_piece_api.ProviderCredential.objects, "filter", fail_if_queried)

    response = owner_client.post(URL, {"library": "canvas2d", "prompt": "x"}, format="json")

    assert response.status_code == 200
    assert "<canvas" in response.json()["code"]


@pytest.mark.django_db
def test_anonymous_request_is_rejected_with_401():
    client = APIClient()
    response = client.post(URL, {"library": "canvas2d", "prompt": "anything"}, format="json")

    assert response.status_code == 401


@pytest.mark.django_db
def test_own_request_rate_limit_returns_429(owner_client, monkeypatch):
    _use_provider(monkeypatch, _mistral_provider_returning(_VALID_SNIPPET))

    for _ in range(art_piece_api.RATE_LIMIT_MAX_ATTEMPTS):
        owner_client.post(URL, {"library": "canvas2d", "prompt": "x"}, format="json")

    response = owner_client.post(URL, {"library": "canvas2d", "prompt": "x"}, format="json")

    assert response.status_code == 429
    assert response.json()["error"] == "rate_limited"


@pytest.mark.django_db
def test_own_daily_quota_returns_429(owner, owner_client, monkeypatch):
    _use_provider(monkeypatch, _mistral_provider_returning(_VALID_SNIPPET))
    cache.set(
        art_piece_api._quota_cache_key(owner.id),
        art_piece_api.DAILY_QUOTA_MAX_SUCCESSES,
        timeout=60,
    )

    response = owner_client.post(URL, {"library": "canvas2d", "prompt": "x"}, format="json")

    assert response.status_code == 429
    assert response.json()["error"] == "quota_exceeded"


@pytest.mark.django_db
def test_missing_personal_key_returns_424(owner_client):
    # No monkeypatch: exercises the real `get_art_piece_provider`, which
    # requires a personal generic Mistral credential -- none exists for `owner`.
    response = owner_client.post(URL, {"library": "canvas2d", "prompt": "x"}, format="json")

    assert response.status_code == 424
    assert response.json()["error"] == "personal_key_required"


@pytest.mark.django_db
def test_selected_vendor_does_not_fall_back_to_another_vendor_key(owner, owner_client, monkeypatch):
    """A requested vendor must own the credential used for the request."""
    credential = ProviderCredential(owner=owner, vendor="mistral")
    credential.set_key("sk-mistral-only-key")
    credential.save()
    constructed = False

    def should_not_construct(**kwargs):
        nonlocal constructed
        constructed = True
        raise AssertionError("the selected vendor had no credential")

    monkeypatch.setattr(art_piece_api, "ArtPieceProvider", should_not_construct)
    response = owner_client.post(
        URL,
        {"vendor": "gemini", "library": "canvas2d", "prompt": "x"},
        format="json",
    )

    assert response.status_code == 424
    assert response.json()["error"] == "personal_key_required"
    assert constructed is False


@pytest.mark.django_db
def test_model_without_art_piece_catalog_capability_is_rejected_before_provider(
    owner_client, monkeypatch
):
    AIProviderModel.objects.create(
        vendor="gemini",
        model_slug="gemini-scene-only-test",
        display_label="Scene-only test model",
        task_kinds=["one_shot_2d"],
        agentic_supported=False,
    )
    monkeypatch.setattr(
        art_piece_api,
        "_provider_for_user",
        lambda *args, **kwargs: (_ for _ in ()).throw(
            AssertionError("catalog rejection must happen before credential/provider resolution")
        ),
    )

    response = owner_client.post(
        URL,
        {
            "vendor": "gemini",
            "model": "gemini-scene-only-test",
            "library": "canvas2d",
            "prompt": "x",
        },
        format="json",
    )

    assert response.status_code == 400
    assert response.json()["error"] == "model_invalid"


@pytest.mark.django_db
def test_owner_key_and_model_reach_the_real_provider(owner, monkeypatch):
    """Mirrors `test_mistral_credentials.py`'s `test_owner_key_is_selected_
    for_real_provider`/`test_caller_supplied_model_reaches_the_real_provider`
    -- calls `_provider_for_user` directly rather than through the HTTP
    view, since this only needs to verify what `ArtPieceProvider` is
    constructed with, not exercise the full request/response cycle."""
    credential = ProviderCredential(owner=owner, vendor="mistral")
    credential.set_key("sk-owner-only-key-12345")
    credential.save()
    captured = {}

    class CapturingProvider:
        def __init__(self, *, api_key, model=None):
            captured["api_key"] = api_key
            captured["model"] = model

    monkeypatch.setattr(art_piece_api, "ArtPieceProvider", CapturingProvider)

    art_piece_api._provider_for_user(owner, "codestral-2405")

    assert captured == {"api_key": "sk-owner-only-key-12345", "model": "codestral-2405"}


@pytest.mark.django_db
def test_owned_persona_id_is_resolved_before_art_piece_generation(owner, owner_client, monkeypatch):
    persona = AIPersona.objects.create(
        owner=owner,
        name="Solarist",
        prompt_text="Use bright solar colors.",
    )
    captured = {}

    def provider_for_user(user, model=None, persona_prompt=None):
        captured["persona_prompt"] = persona_prompt
        return _mistral_provider_returning(_VALID_SNIPPET)

    monkeypatch.setattr(art_piece_api, "_provider_for_user", provider_for_user)
    response = owner_client.post(
        URL,
        {"library": "canvas2d", "prompt": "a solar halo", "persona_id": persona.id},
        format="json",
    )

    assert response.status_code == 200
    assert captured["persona_prompt"] == "Use bright solar colors."


# --- Issue #499: credential-resolution parity with the scene path ----------


@pytest.mark.django_db
def test_generic_endpoint_key_is_accepted_for_an_art_piece_request(owner_client, monkeypatch):
    """Issue #499's headline guarantee through the real request path: a key
    saved via `PUT /api/account/provider-credentials/` is exactly the key
    `get_art_piece_provider` constructs the provider from. `ArtPieceProvider`
    is not monkeypatched here -- the request exercises the real credential
    lookup/decrypt; the provider's lazy `client` property is replaced with a
    fake chat client, so no SDK is constructed and no socket is opened."""
    from ai_provider.art_piece_provider import ArtPieceProvider as RealArtPieceProvider

    assert (
        owner_client.put(
            "/api/account/provider-credentials/",
            {"vendor": "mistral", "key": "sk-art-piece-via-generic"},
            format="json",
        ).status_code
        == 200
    )

    captured = {}

    def fake_client(provider_self):
        captured["api_key"] = provider_self._api_key
        return _FakeClient(
            lambda **kw: SimpleNamespace(
                usage=SimpleNamespace(prompt_tokens=1, completion_tokens=1),
                choices=[SimpleNamespace(message=SimpleNamespace(content=_VALID_SNIPPET))],
            )
        )

    monkeypatch.setattr(RealArtPieceProvider, "client", property(fake_client))

    response = owner_client.post(URL, {"library": "canvas2d", "prompt": "x"}, format="json")

    assert response.status_code == 200
    assert captured["api_key"] == "sk-art-piece-via-generic"
    assert "sk-art-piece-via-generic" not in response.content.decode()


@pytest.mark.django_db
def test_broken_owner_credential_fails_before_provider_construction(
    owner, owner_client, monkeypatch
):
    """A stored credential no current key ring can decrypt must surface the
    same stable, actionable `personal_key_required` as a missing one --
    before `ArtPieceProvider` is ever constructed, and without the
    undecryptable bytes or any key material leaking into the response."""
    ProviderCredential.objects.create(
        owner=owner, vendor="mistral", encrypted_key=b"undecryptable-bytes"
    )

    called = False

    class ShouldNotConstruct:
        def __init__(self, **kwargs):
            nonlocal called
            called = True

    monkeypatch.setattr(art_piece_api, "ArtPieceProvider", ShouldNotConstruct)
    response = owner_client.post(URL, {"library": "canvas2d", "prompt": "x"}, format="json")

    assert response.status_code == 424
    assert response.json()["error"] == "personal_key_required"
    assert "undecryptable-bytes" not in response.content.decode()
    assert called is False


@pytest.mark.django_db
def test_another_users_mistral_key_is_never_selected(db, owner_client, monkeypatch):
    """Owner isolation mirrors `test_mistral_credentials.py`'s
    `test_owner_isolation_for_provider_resolution` for the art-piece path:
    only the other user has a generic Mistral credential, so this request
    must fail before provider construction rather than borrow it."""
    other = get_user_model().objects.create_user(username="art-piece-other")
    credential = ProviderCredential(owner=other, vendor="mistral")
    credential.set_key("sk-other-users-key-12345")
    credential.save()

    called = False

    class ShouldNotConstruct:
        def __init__(self, **kwargs):
            nonlocal called
            called = True

    monkeypatch.setattr(art_piece_api, "ArtPieceProvider", ShouldNotConstruct)
    response = owner_client.post(URL, {"library": "canvas2d", "prompt": "x"}, format="json")

    assert response.status_code == 424
    assert response.json()["error"] == "personal_key_required"
    assert called is False
