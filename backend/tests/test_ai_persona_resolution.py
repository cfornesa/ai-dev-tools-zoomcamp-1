"""Issue #260: unit coverage for `scenes.ai_api._resolve_persona_prompt`,
the owner-scoped lookup that turns a caller-supplied persona id into the
persona's additive prompt text (or `None`) before a provider is ever
constructed."""

import pytest
from django.contrib.auth import get_user_model

from scenes import ai_api
from scenes.models import AIPersona


@pytest.fixture
def owner(db):
    return get_user_model().objects.create_user(username="persona-owner")


@pytest.fixture
def other(db):
    return get_user_model().objects.create_user(username="persona-other")


@pytest.mark.django_db
def test_no_persona_id_resolves_to_none(owner):
    assert ai_api._resolve_persona_prompt(owner, None) is None


@pytest.mark.django_db
def test_owned_persona_resolves_to_its_prompt_text(owner):
    persona = AIPersona.objects.create(
        owner=owner, name="Bold", prompt_text="Use bold saturated colors."
    )
    assert ai_api._resolve_persona_prompt(owner, persona.id) == "Use bold saturated colors."


@pytest.mark.django_db
def test_another_users_persona_id_is_silently_ignored(owner, other):
    other_persona = AIPersona.objects.create(
        owner=other, name="Minimal", prompt_text="Favor negative space."
    )
    assert ai_api._resolve_persona_prompt(owner, other_persona.id) is None


@pytest.mark.django_db
def test_nonexistent_persona_id_is_silently_ignored(owner):
    assert ai_api._resolve_persona_prompt(owner, 999999) is None
