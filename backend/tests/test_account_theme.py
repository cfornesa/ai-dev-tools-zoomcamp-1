import json
import re
from pathlib import Path

import pytest
from django.contrib.auth.models import AnonymousUser
from django.contrib.messages.storage.fallback import FallbackStorage
from django.contrib.sessions.backends.base import SessionBase
from django.template.loader import get_template
from django.test import RequestFactory
from django.urls import reverse

from backend.context_processors import palette_css_tokens, presentation_css_tokens

ROOT = Path(__file__).resolve().parents[2]


@pytest.mark.django_db
def test_login_shell_injects_palette_and_presentation_from_site_settings(client):
    response = client.get(reverse("account_login"))

    assert response.status_code == 200
    body = response.content.decode()
    template = (ROOT / "backend/templates/account/base.html").read_text()
    fixture = json.loads((ROOT / "schema/fixtures/site-theme-mapping.json").read_text())
    assert not re.search(r"#[0-9a-fA-F]{3,8}\b", template)
    assert body.index("<script>") < body.index("<style>")
    for mode in ("light", "dark"):
        palette = response.context["site_theme_palettes"][mode]
        css = response.context["site_theme_css"][mode]
        for css_name, token, key in (
            ("--bg", "background", "bg"),
            ("--code-bg", "surface", "surface"),
            ("--text-h", "text", "text_h"),
            ("--text", "muted", "text"),
            ("--accent", "accent", "accent"),
        ):
            value = css[key]
            assert f"{css_name}: {value}" in body
            assert value == palette[token]

        fixture_payload = fixture["siteTheme"]
        mapped = palette_css_tokens(
            fixture_payload["theme_palettes"][mode],
            fixture_payload["design_palettes"][mode],
        )
        assert mapped == {
            "bg": fixture["expected"][mode]["--bg"],
            "surface": fixture["expected"][mode]["--code-bg"],
            "text_h": fixture["expected"][mode]["--text-h"],
            "text": fixture["expected"][mode]["--text"],
            "accent": fixture["expected"][mode]["--accent"],
            "accent_foreground": "hsl(0 0% 0%)",
        }

    attrs = fixture["expected"]["presentation"]
    for attribute in ("data-site-font", "data-site-shadow", "data-site-backdrop"):
        assert f'{attribute}="{attrs[attribute]}"' in body
    presentation = presentation_css_tokens(fixture["siteTheme"]["presentation"])
    assert presentation == {
        "sans": attrs["--sans"],
        "site_font": attrs["--site-font"],
        "heading": attrs["--heading"],
        "density": attrs["--site-density"],
        "radius": attrs["--site-radius"],
        "border_style": attrs["--site-border-style"],
    }
    assert b'name="login"' in response.content
    assert b'name="password"' in response.content
    assert b"csrfmiddlewaretoken" in response.content


@pytest.mark.django_db
def test_allauth_account_and_social_templates_render_from_the_shared_shell():
    template_names = (
        "account/base.html",
        "account/base_entrance.html",
        "account/base_manage.html",
        "account/login.html",
        "account/signup_closed.html",
        "socialaccount/base_entrance.html",
        "socialaccount/base_manage.html",
        "socialaccount/signup.html",
        "socialaccount/social_identity_conflict.html",
        "socialaccount/social_identity_email_required.html",
    )
    request = RequestFactory().get("/")
    request.user = AnonymousUser()
    request.session = SessionBase()
    request._messages = FallbackStorage(request)
    for name in template_names:
        rendered = get_template(name).render({}, request=request)
        assert '<html lang="en"' in rendered, name
        assert "--bg:" in rendered, name

    social_signup = (ROOT / "backend/templates/socialaccount/signup.html").read_text()
    social_signup_styles = social_signup.split("{% block head %}", 1)[1].split("{% endblock %}", 1)[
        0
    ]
    assert not re.search(r"#[0-9a-fA-F]{3,8}\b", social_signup_styles)
    assert "var(--site-radius)" in social_signup_styles
    assert "var(--text-h)" in social_signup_styles
