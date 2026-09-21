import json
from datetime import timedelta
from pathlib import Path
from xml.etree import ElementTree

import pytest
from django.contrib.auth import get_user_model
from django.utils import timezone

from scenes.models import (
    ArtPiece,
    ArtPieceVersion,
    Project,
    Project3D,
    PublicProfile,
    Scene,
    SceneVersion,
    SceneVersion3D,
)

FIXTURES = Path(__file__).resolve().parent.parent.parent / "schema" / "fixtures"
ATOM = {"atom": "http://www.w3.org/2005/Atom", "media": "http://search.yahoo.com/mrss/"}


@pytest.fixture
def feed_profile(db):
    owner = get_user_model().objects.create_user(username="feed-owner")
    profile = PublicProfile.objects.create(
        user=owner,
        handle="feed-artist",
        display_name="Feed Artist",
        is_public=True,
    )
    published_at = timezone.now() - timedelta(days=1)

    project = Project.objects.create(
        owner=owner,
        title="Older & 2D",
        description="A 2D description",
        visibility=Project.Visibility.PUBLIC,
        published_at=published_at - timedelta(hours=1),
    )
    scene = Scene.objects.create(project=project, name="Scene", position=0)
    version = SceneVersion.objects.create(
        project=project,
        scene=scene,
        sequence=1,
        scene_json=json.loads((FIXTURES / "valid" / "blank.json").read_text()),
        created_by=owner,
        origin=SceneVersion.Origin.MANUAL,
    )
    project.current_version = version
    project.save(update_fields=["current_version"])
    scene.current_version = version
    scene.save(update_fields=["current_version"])

    project3d = Project3D.objects.create(
        owner=owner,
        title="Middle 3D",
        seo_config={"description": "A 3D description"},
        visibility=Project3D.Visibility.PUBLIC,
        published_at=published_at,
    )
    version3d = SceneVersion3D.objects.create(
        project=project3d,
        sequence=1,
        scene_json=json.loads(
            (FIXTURES / "../fixtures3d/valid/minimal.json").resolve().read_text()
        ),
        created_by=owner,
        origin=SceneVersion3D.Origin.MANUAL,
    )
    project3d.current_version = version3d
    project3d.save(update_fields=["current_version"])

    piece = ArtPiece.objects.create(
        owner=owner,
        title="<script>& newest",
        description="Generated <description>&",
        prompt="feed",
        engine=ArtPiece.Engine.P5JS,
        status=ArtPiece.Status.PUBLISHED,
        published_at=published_at + timedelta(hours=1),
    )
    piece_version = ArtPieceVersion.objects.create(
        piece=piece,
        sequence=1,
        source="<canvas></canvas>",
    )
    piece.current_version = piece_version
    piece.save(update_fields=["current_version"])

    private = Project.objects.create(
        owner=owner,
        title="Private piece",
        visibility=Project.Visibility.PRIVATE,
    )
    unpublished = ArtPiece.objects.create(
        owner=owner,
        title="Unpublished piece",
        prompt="draft",
        engine=ArtPiece.Engine.CANVAS2D,
        status=ArtPiece.Status.DRAFT,
    )
    return profile, (project, project3d, piece, private, unpublished)


@pytest.mark.django_db
def test_profile_atom_feed_is_valid_public_and_escaped(client, feed_profile):
    profile, records = feed_profile

    response = client.get(
        f"/users/@{profile.handle}/feed.xml",
        HTTP_ACCEPT="application/atom+xml",
    )

    assert response.status_code == 200
    assert response["Content-Type"] == "application/atom+xml; charset=utf-8"
    assert response["Cache-Control"] == "public, max-age=300, must-revalidate"
    assert response["ETag"]
    assert response["Last-Modified"]
    assert b"&lt;script&gt;&amp; newest" in response.content
    assert b"Private piece" not in response.content
    assert b"Unpublished piece" not in response.content

    root = ElementTree.fromstring(response.content)
    assert root.findtext("atom:title", namespaces=ATOM) == "Feed Artist on AugmentrART"
    assert root.findtext("atom:author/atom:name", namespaces=ATOM) == "Feed Artist"
    entries = root.findall("atom:entry", namespaces=ATOM)
    assert len(entries) == 3
    assert [entry.findtext("atom:title", namespaces=ATOM) for entry in entries] == [
        "<script>& newest",
        "Middle 3D",
        "Older & 2D",
    ]

    for entry in entries:
        alternate = entry.find("atom:link[@rel='alternate']", namespaces=ATOM)
        enclosure = entry.find("atom:link[@rel='enclosure']", namespaces=ATOM)
        thumbnail = entry.find("media:thumbnail", namespaces=ATOM)
        assert alternate is not None and alternate.attrib["href"].startswith("http://testserver/")
        assert enclosure is not None and enclosure.attrib["type"] == "image/png"
        assert enclosure.attrib["href"].startswith("http://testserver/")
        assert thumbnail is not None and thumbnail.attrib["url"].startswith("http://testserver/")
        assert entry.find("atom:content", namespaces=ATOM).attrib["type"] == "html"

    assert records[0].title == "Older & 2D"


@pytest.mark.django_db
def test_profile_atom_feed_supports_etag_and_last_modified(client, feed_profile):
    profile, _ = feed_profile
    url = f"/users/@{profile.handle}/feed.xml"
    first = client.get(url)

    etag_response = client.get(url, HTTP_IF_NONE_MATCH=first["ETag"])
    assert etag_response.status_code == 304
    assert etag_response["ETag"] == first["ETag"]

    modified_response = client.get(url, HTTP_IF_MODIFIED_SINCE=first["Last-Modified"])
    assert modified_response.status_code == 304
    assert modified_response["Last-Modified"] == first["Last-Modified"]


@pytest.mark.django_db
def test_profile_rss_feed_reuses_public_entries_and_rss_metadata(client, feed_profile):
    profile, _ = feed_profile

    response = client.get(
        f"/users/@{profile.handle}/feed.rss",
        HTTP_ACCEPT="text/html",
    )

    assert response.status_code == 200
    assert response["Content-Type"] == "application/rss+xml"
    assert response["Cache-Control"] == "public, max-age=300, must-revalidate"
    root = ElementTree.fromstring(response.content)
    channel = root.find("channel")
    assert channel is not None
    assert channel.findtext("title") == "Feed Artist on AugmentrART"
    assert channel.findtext("lastBuildDate")
    self_link = channel.find("atom:link", namespaces=ATOM)
    assert self_link is not None
    assert self_link.attrib["rel"] == "self"
    assert self_link.attrib["type"] == "application/rss+xml"
    assert self_link.attrib["href"].endswith("/users/@feed-artist/feed.rss")

    items = channel.findall("item")
    assert [item.findtext("title") for item in items] == [
        "<script>& newest",
        "Middle 3D",
        "Older & 2D",
    ]
    for item in items:
        assert item.findtext("guid") == item.findtext("link")
        assert item.findtext("pubDate")
        description = item.findtext("description") or ""
        assert "<img" in description
        assert item.find("enclosure").attrib["type"] == "image/png"
        assert item.find("media:thumbnail", namespaces=ATOM) is not None

    not_modified = client.get(
        f"/users/@{profile.handle}/feed.rss",
        HTTP_IF_NONE_MATCH=response["ETag"],
    )
    assert not_modified.status_code == 304


@pytest.mark.django_db
def test_profile_json_feed_reuses_public_entries_and_json_feed_metadata(client, feed_profile):
    profile, _ = feed_profile

    response = client.get(f"/users/@{profile.handle}/feed.json", HTTP_ACCEPT="text/html")

    assert response.status_code == 200
    assert response["Content-Type"] == "application/feed+json"
    assert response["Cache-Control"] == "public, max-age=300, must-revalidate"
    document = response.json()
    assert document["version"] == "https://jsonfeed.org/version/1.1"
    assert document["title"] == "Feed Artist on AugmentrART"
    assert document["home_page_url"].endswith(f"/users/@{profile.handle}")
    assert document["feed_url"].endswith(f"/users/@{profile.handle}/feed.json")
    assert document["authors"] == [{"name": "Feed Artist"}]

    items = document["items"]
    assert [item["title"] for item in items] == [
        "<script>& newest",
        "Middle 3D",
        "Older & 2D",
    ]
    for item in items:
        assert item["id"] == item["url"]
        assert item["image"] == item["banner_image"]
        assert item["content_html"].count("<img") == 1
        assert item["date_published"]
        assert item["date_modified"]
        assert item["tags"]
        assert item["url"].startswith("http://testserver/")

    not_modified = client.get(
        f"/users/@{profile.handle}/feed.json",
        HTTP_IF_NONE_MATCH=response["ETag"],
    )
    assert not_modified.status_code == 304


@pytest.mark.django_db
def test_profile_atom_feed_hides_unknown_and_private_profiles(client, feed_profile):
    profile, _ = feed_profile
    profile.is_public = False
    profile.save(update_fields=["is_public"])

    assert client.get(f"/users/@{profile.handle}/feed.xml").status_code == 404
    assert client.get("/users/@does-not-exist/feed.xml").status_code == 404
