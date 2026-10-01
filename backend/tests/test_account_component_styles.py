import re
from pathlib import Path

import pytest
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
    assert 'class="{{ provider.id }}"' not in template
    assert '<form method="post" action="/accounts/login/">' in rendered
    assert "csrfmiddlewaretoken" in rendered
