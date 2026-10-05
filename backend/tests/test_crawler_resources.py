import copy
import json
import xml.etree.ElementTree as ET
from pathlib import Path

import pytest
from django.contrib.auth import get_user_model
from django.test import override_settings
from django.urls import reverse
from django.utils import timezone

from scenes.models import (
    ArtPiece,
    ArtPieceVersion,
    Collection,
    Page,
    Project,
    Project3D,
    PublicProfile,
    SceneVersion,
    SceneVersion3D,
)

SCENE_2D = json.loads(
    (
        Path(__file__).resolve().parent.parent.parent
        / 'schema'
        / 'fixtures'
        / 'valid'
        / 'blank.json'
    ).read_text()
)
SCENE_3D = json.loads(
    (
        Path(__file__).resolve().parent.parent.parent
        / 'schema'
        / 'fixtures3d'
        / 'valid'
        / 'minimal.json'
    ).read_text()
)


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


@pytest.mark.django_db
@override_settings(ALLOWED_HOSTS=['example.test'])
def test_sitemap_contains_only_eligible_public_urls_with_lastmod(client):
    user_model = get_user_model()
    owner = user_model.objects.create_user(username='sitemap-owner', is_active=True)
    profile = PublicProfile.objects.create(user=owner, handle='sitemap-owner', is_public=True)
    private_owner = user_model.objects.create_user(username='hidden-owner', is_active=True)
    PublicProfile.objects.create(user=private_owner, handle='hidden-owner', is_public=False)
    inactive_owner = user_model.objects.create_user(username='inactive-owner', is_active=False)
    PublicProfile.objects.create(user=inactive_owner, handle='inactive-owner', is_public=True)

    public_page = Page.objects.create(
        title='Published page', slug='published-page', status=Page.Status.PUBLISHED
    )
    Page.objects.create(title='Draft page', slug='draft-page', status=Page.Status.DRAFT)
    Page.all_objects.create(
        title='Deleted page',
        slug='deleted-page',
        status=Page.Status.PUBLISHED,
        deleted_at=timezone.now(),
    )

    project = Project.objects.create(
        owner=owner,
        title='Public 2D',
        public_slug='public-2d',
        visibility=Project.Visibility.PUBLIC,
    )
    version = SceneVersion.objects.create(
        project=project,
        sequence=1,
        scene_json=copy.deepcopy(SCENE_2D),
        created_by=owner,
        origin=SceneVersion.Origin.MANUAL,
    )
    project.current_version = version
    project.published_at = timezone.now()
    project.save(update_fields=['current_version', 'published_at'])

    hidden_project = Project.objects.create(
        owner=private_owner,
        title='Unlisted 2D',
        public_slug='unlisted-2d',
        visibility=Project.Visibility.PUBLIC,
        published_at=timezone.now(),
    )
    hidden_version = SceneVersion.objects.create(
        project=hidden_project,
        sequence=1,
        scene_json=copy.deepcopy(SCENE_2D),
        created_by=private_owner,
        origin=SceneVersion.Origin.MANUAL,
    )
    hidden_project.current_version = hidden_version
    hidden_project.save(update_fields=['current_version'])
    deleted_project = Project.objects.create(
        owner=owner,
        title='Deleted 2D',
        public_slug='deleted-2d',
        visibility=Project.Visibility.PUBLIC,
        current_version=version,
        published_at=timezone.now(),
        is_deleted=True,
    )

    project3d = Project3D.objects.create(
        owner=owner,
        title='Public 3D',
        public_slug='public-3d',
        visibility=Project3D.Visibility.PUBLIC,
        published_at=timezone.now(),
    )
    version3d = SceneVersion3D.objects.create(
        project=project3d,
        sequence=1,
        scene_json=copy.deepcopy(SCENE_3D),
        created_by=owner,
    )
    project3d.current_version = version3d
    project3d.save(update_fields=['current_version'])

    generated = ArtPiece.objects.create(
        owner=owner,
        title='Public generated',
        public_slug='public-generated',
        prompt='test prompt',
        engine=ArtPiece.Engine.SVG,
        status=ArtPiece.Status.PUBLISHED,
        published_at=timezone.now(),
    )
    generated_version = ArtPieceVersion.objects.create(
        piece=generated, sequence=1, source='<svg />'
    )
    generated.current_version = generated_version
    generated.save(update_fields=['current_version'])
    ArtPiece.objects.create(
        owner=owner,
        title='Draft generated',
        prompt='test prompt',
        engine=ArtPiece.Engine.SVG,
        status=ArtPiece.Status.DRAFT,
    )

    public_collection = Collection.objects.create(
        owner=owner,
        title='Public collection',
        slug='public-collection',
        visibility=Collection.Visibility.PUBLIC,
        published_at=timezone.now(),
    )
    Collection.objects.create(
        owner=owner,
        title='Private collection',
        slug='private-collection',
    )

    response = client.get(reverse('sitemap'), HTTP_HOST='example.test:8443')
    repeated_response = client.get(reverse('sitemap'), HTTP_HOST='example.test:8443')

    assert response.status_code == 200
    assert repeated_response.content == response.content
    assert response['Content-Type'] == 'application/xml; charset=utf-8'
    root = ET.fromstring(response.content)
    namespace = '{http://www.sitemaps.org/schemas/sitemap/0.9}'
    urls = {
        entry.findtext(f'{namespace}loc'): entry.findtext(f'{namespace}lastmod')
        for entry in root.findall(f'{namespace}url')
    }
    expected = {
        'http://example.test:8443/gallery',
        'http://example.test:8443/pages/published-page',
        'http://example.test:8443/users/@sitemap-owner',
        'http://example.test:8443/users/@sitemap-owner/collections/public-collection',
        'http://example.test:8443/users/@sitemap-owner/pieces/public-2d',
        'http://example.test:8443/users/@sitemap-owner/pieces/public-3d',
        'http://example.test:8443/users/@sitemap-owner/pieces/public-generated',
    }
    assert set(urls) == expected
    assert urls['http://example.test:8443/gallery'] is None
    assert (
        urls['http://example.test:8443/users/@sitemap-owner']
        == profile.updated_at.date().isoformat()
    )
    assert (
        urls['http://example.test:8443/users/@sitemap-owner/collections/public-collection']
        == public_collection.updated_at.date().isoformat()
    )
    assert (
        urls['http://example.test:8443/pages/published-page']
        == public_page.updated_at.date().isoformat()
    )
    assert (
        urls['http://example.test:8443/users/@sitemap-owner/pieces/public-2d']
        == project.updated_at.date().isoformat()
    )
    assert (
        urls['http://example.test:8443/users/@sitemap-owner/pieces/public-3d']
        == project3d.updated_at.date().isoformat()
    )
    assert (
        urls['http://example.test:8443/users/@sitemap-owner/pieces/public-generated']
        == generated.updated_at.date().isoformat()
    )
    assert hidden_project.public_slug not in response.content.decode()
    assert deleted_project.public_slug not in response.content.decode()
    assert 'private-collection' not in response.content.decode()


@pytest.mark.django_db
def test_sitemap_enforces_documented_url_cap(client, monkeypatch):
    from scenes import crawler_resources

    Page.objects.create(title='Alpha', slug='alpha', status=Page.Status.PUBLISHED)
    Page.objects.create(title='Beta', slug='beta', status=Page.Status.PUBLISHED)
    monkeypatch.setattr(crawler_resources, 'MAX_SITEMAP_URLS', 2)

    response = client.get(reverse('sitemap'))

    assert response.status_code == 200
    root = ET.fromstring(response.content)
    namespace = '{http://www.sitemaps.org/schemas/sitemap/0.9}'
    assert len(root.findall(f'{namespace}url')) == 2
