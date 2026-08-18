"""Task 45: provider keys never leak; prompt retention defaults to off.

Covers:
- No request/response type in `ai_provider.interface` has a field that
  could carry a raw provider key (structural, name-based check).
- `ai_provider.config.get_provider_api_key` is the only way this package
  reads a key, reads it only from `os.environ`, and never returns it
  through a logged or otherwise persisted structure.
- `ai_provider.logging.log_operation_result` logs only the documented
  minimal metadata by default -- no prompt text, no full scene content,
  no key -- and only includes the prompt when a caller explicitly opts
  in via `retain_prompt=True`.
"""

import dataclasses
import inspect

import pytest
from django.core.exceptions import ImproperlyConfigured

from ai_provider import config as ai_config
from ai_provider import interface as ai_interface
from ai_provider import logging as ai_logging
from ai_provider.fake_provider import FakeAIProviderScenario, FakeAISceneProvider
from ai_provider.interface import AICreateSceneRequest

_FORBIDDEN_FIELD_SUBSTRINGS = ("key", "secret", "password", "credential", "token_value", "auth")
# "token" alone is fine (prompt_tokens/completion_tokens are counts, not
# secrets); only flag substrings that would suggest a raw credential.


def test_no_public_data_type_has_a_key_shaped_field():
    for data_type in ai_interface.PUBLIC_DATA_TYPES:
        assert dataclasses.is_dataclass(data_type), f"{data_type} is not a dataclass"
        for f in dataclasses.fields(data_type):
            lowered = f.name.lower()
            for forbidden in _FORBIDDEN_FIELD_SUBSTRINGS:
                assert forbidden not in lowered, (
                    f"{data_type.__name__}.{f.name} looks key-shaped "
                    f"(contains '{forbidden}') -- provider keys must never be "
                    "representable in a request or response type."
                )


def test_ai_scene_provider_abc_methods_take_no_key_parameter():
    for name in ("create_scene", "edit_scene"):
        method = getattr(ai_interface.AISceneProvider, name)
        params = inspect.signature(method).parameters
        for param_name in params:
            if param_name == "self":
                continue
            assert "key" not in param_name.lower()


def test_get_provider_api_key_reads_only_from_environment(monkeypatch):
    monkeypatch.delenv("MISTRAL_API_KEY", raising=False)

    with pytest.raises(ImproperlyConfigured):
        ai_config.get_provider_api_key("MISTRAL_API_KEY")

    monkeypatch.setenv("MISTRAL_API_KEY", "sk-fake-test-value-not-real")
    assert ai_config.get_provider_api_key("MISTRAL_API_KEY") == "sk-fake-test-value-not-real"


def test_key_never_appears_in_a_logged_operation_record(monkeypatch):
    secret = "sk-super-secret-value-should-never-be-logged"
    monkeypatch.setenv("MISTRAL_API_KEY", secret)

    provider = FakeAISceneProvider(scenario=FakeAIProviderScenario.SUCCESS)
    result = provider.create_scene(AICreateSceneRequest(prompt="a field of teal circles"))

    record = ai_logging.log_operation_result(result)

    assert secret not in repr(record)
    assert all(secret not in str(v) for v in record.values())
    # The scene itself (a plausible place a key could accidentally end
    # up embedded, per the acceptance criteria) also never contains it.
    assert secret not in repr(result.scene)


def test_default_log_record_omits_prompt_and_full_scene():
    provider = FakeAISceneProvider(scenario=FakeAIProviderScenario.SUCCESS)
    prompt = "a very specific, identifiable prompt about teal circles rippling on pinch"
    result = provider.create_scene(AICreateSceneRequest(prompt=prompt))

    record = ai_logging.log_operation_result(result)

    assert "prompt" not in record
    assert "scene" not in record
    assert prompt not in repr(record)

    # Only the documented minimal metadata fields are present.
    assert set(record) == {
        "operation",
        "timestamp",
        "success",
        "error_category",
        "prompt_tokens",
        "completion_tokens",
        "total_tokens",
        "estimated_cost_usd",
    }


def test_prompt_is_logged_only_on_explicit_opt_in():
    provider = FakeAISceneProvider(scenario=FakeAIProviderScenario.SUCCESS)
    prompt = "a distinctly identifiable prompt for the opt-in case"
    result = provider.create_scene(AICreateSceneRequest(prompt=prompt))

    default_record = ai_logging.log_operation_result(result)
    assert "prompt" not in default_record

    opted_in_record = ai_logging.log_operation_result(result, retain_prompt=True, prompt=prompt)
    assert opted_in_record["prompt"] == prompt

    # Explicitly passing retain_prompt=True without a prompt string is a
    # no-op, not an error -- there is nothing to include.
    no_prompt_record = ai_logging.log_operation_result(result, retain_prompt=True, prompt=None)
    assert "prompt" not in no_prompt_record


def test_error_result_logging_also_omits_prompt_by_default():
    provider = FakeAISceneProvider(scenario=FakeAIProviderScenario.PROVIDER_REJECTION)
    result = provider.create_scene(AICreateSceneRequest(prompt="something the provider rejects"))

    record = ai_logging.log_operation_result(result)

    assert record["success"] is False
    assert record["error_category"] == "provider_rejection"
    assert "prompt" not in record
