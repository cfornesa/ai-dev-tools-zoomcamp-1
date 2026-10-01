import re
from pathlib import Path

import pytest
from django.template import Context, Template
from django.urls import reverse


@pytest.mark.django_db
def test_login_assigns_one_primary_and_a_stable_provider_style(client):
    response = client.get(reverse("account_login"))

    assert response.status_code == 200
    rendered = response.content.decode()
    template = (Path(__file__).resolve().parents[1] / "templates/account/login.html").read_text()

    assert rendered.count('class="auth-submit"') == 1
    providers = re.findall(r'<button class="auth-provider" type="submit">Continue with ', rendered)
    assert providers
    assert 'role="separator" aria-label="or continue with"' in rendered
    assert 'aria-label="Continue with a provider"' in rendered
    provider_names = re.findall(
        r'<button class="auth-provider" type="submit">Continue with ([^<]+)</button>', rendered
    )
    assert provider_names == sorted(provider_names, key=str.casefold)
    assert 'Log in to continue creating with AugmentrART.' in rendered
    assert 'class="{{ provider.id }}"' not in template
    assert '<form method="post" action="/accounts/login/">' in rendered
    assert "csrfmiddlewaretoken" in rendered


@pytest.mark.parametrize(
    "providers",
    [
        [{"name": "Google"}],
        [{"name": "GitHub"}, {"name": "Google"}],
        [{"name": "LinkedIn"}, {"name": "GitHub"}, {"name": "Google"}],
    ],
    ids=["one-provider", "two-providers", "three-providers"],
)
def test_login_provider_sort_rule_is_stable_for_one_two_or_three_providers(providers):
    rendered = Template(
        '{% for provider in providers|dictsort:"name" %}{{ provider.name }}|{% endfor %}'
    ).render(Context({"providers": providers}))

    assert rendered == "".join(
        f"{provider['name']}|" for provider in sorted(providers, key=lambda p: p["name"])
    )
