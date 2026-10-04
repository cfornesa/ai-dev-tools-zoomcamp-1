from django.test import override_settings
from django.urls import reverse


@override_settings(ALLOWED_HOSTS=['example.test'])
def test_robots_is_generated_as_plain_text_for_the_request_host(client):
    response = client.get(reverse('robots'), HTTP_HOST='example.test:8443')

    assert response.status_code == 200
    assert response['Content-Type'] == 'text/plain; charset=utf-8'
    body = response.content.decode()
    assert 'User-agent: *\nAllow: /' in body
    assert 'Disallow: /api/' in body
    assert 'Disallow: /admin' in body
    assert 'Disallow: /account' in body
    assert 'Disallow: /accounts/' in body
    assert 'Disallow: /studio' in body
    assert 'Sitemap: http://example.test:8443/sitemap.xml' in body
    assert 'Llms: http://example.test:8443/llms.txt' in body
