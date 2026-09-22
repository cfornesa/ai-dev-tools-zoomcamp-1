import pytest
from django.contrib.auth import get_user_model
from django.urls import reverse

from scenes.models import ApplicationAdmin, ProfileStyle, ThemeGenerationAttempt
from scenes.theme import DESIGN_PALETTE_KEYS
from scenes.theme_generation import MAX_ATTEMPTS, ThemeGenerationError, validate_theme_definition


@pytest.fixture
def theme_admin():
    user = get_user_model().objects.create_user(username="theme-admin", password="x")
    ApplicationAdmin.objects.create(user=user)
    return user


@pytest.fixture(autouse=True)
def fake_theme_provider(monkeypatch):
    monkeypatch.setenv("AI_PROVIDER", "fake")


@pytest.mark.django_db
def test_admin_can_generate_accept_and_restore_a_theme_snapshot(client, theme_admin):
    client.force_login(theme_admin)
    style = ProfileStyle.objects.get(key="celestial")
    original = {
        "key": style.key,
        "label": style.label,
        "description": style.description,
        "tokens": style.tokens,
        "presentation": style.presentation,
    }

    created = client.post(
        reverse("admin-theme-generation"),
        {"prompt": "Make this a readable serif cosmic theme.", "style_id": style.id},
        content_type="application/json",
    )
    assert created.status_code == 201
    attempt = created.json()
    assert attempt["state"] == "draft"
    assert attempt["source"] == "fake"
    assert set(attempt["definition"]["palettes"]) == {"label", "description", "light", "dark"}

    accepted = client.post(
        reverse(
            "admin-theme-generation-action",
            kwargs={"attempt_id": attempt["id"], "action": "accept"},
        ),
        {"revision": attempt["revision"]},
        content_type="application/json",
    )
    assert accepted.status_code == 200, accepted.json()
    assert accepted.json()["state"] == "accepted"
    style.refresh_from_db()
    assert style.tokens["light"] == attempt["definition"]["palettes"]["light"]

    restored = client.post(
        reverse(
            "admin-theme-generation-action",
            kwargs={"attempt_id": attempt["id"], "action": "restore"},
        ),
        content_type="application/json",
    )
    assert restored.status_code == 200
    style.refresh_from_db()
    assert {
        "key": style.key,
        "label": style.label,
        "description": style.description,
        "tokens": style.tokens,
        "presentation": style.presentation,
    } == original


@pytest.mark.django_db
def test_rejected_draft_does_not_change_the_selected_style(client, theme_admin):
    client.force_login(theme_admin)
    style = ProfileStyle.objects.get(key="celestial")
    original_tokens = style.tokens
    created = client.post(
        reverse("admin-theme-generation"),
        {"prompt": "A gentle ocean theme.", "style_id": style.id},
        content_type="application/json",
    )
    attempt = created.json()
    rejected = client.post(
        reverse(
            "admin-theme-generation-action",
            kwargs={"attempt_id": attempt["id"], "action": "reject"},
        ),
        {"revision": attempt["revision"]},
        content_type="application/json",
    )
    assert rejected.status_code == 200
    assert rejected.json()["state"] == "rejected"
    assert ProfileStyle.objects.get(pk=style.pk).tokens == original_tokens


@pytest.mark.django_db
def test_generation_is_bounded_and_rejects_unsafe_preview_code(theme_admin):
    with pytest.raises(ThemeGenerationError, match="Maximum theme attempts"):
        from scenes.theme_generation import create_attempt

        create_attempt(
            actor=theme_admin,
            prompt="retry",
            operation=ThemeGenerationAttempt.Operation.GENERATE,
            attempt_number=MAX_ATTEMPTS + 1,
        )

    with pytest.raises(ThemeGenerationError, match="forbidden"):
        validate_theme_definition(
            {
                "key": "unsafe-theme",
                "label": "Unsafe",
                "palettes": {
                    "label": "x",
                    "description": "x",
                    "light": {key: "#111111" for key in DESIGN_PALETTE_KEYS},
                    "dark": {key: "#111111" for key in DESIGN_PALETTE_KEYS},
                },
                "code": {"html": "<script>alert(1)</script>"},
            }
        )
