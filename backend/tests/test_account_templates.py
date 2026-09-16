"""Server-rendered account pages use the shared AugmentrART shell."""

import pytest
from django.urls import reverse


@pytest.mark.django_db
def test_email_settings_uses_the_shared_account_shell(client, django_user_model):
    user = django_user_model.objects.create_user(
        username="shell-user",
        email="shell-user@example.com",
    )
    client.force_login(user)

    response = client.get(reverse("account_email"))

    assert response.status_code == 200
    assert 'class="card"' in response.content.decode()
    assert 'href="/"' in response.content.decode()
    assert "<strong>Menu:</strong>" not in response.content.decode()
