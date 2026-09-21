"""Canonical public URL builders for authored and generated pieces."""

from urllib.parse import quote

from scenes.models import PublicProfile


def piece_viewer_path(record, kind: str) -> str:
    """Return the profile-nested viewer path, with a legacy safety shim.

    Public records should always have a public profile and generated slug. The
    legacy fallback is retained only for old rows that predate those fields;
    it keeps the compatibility surface usable without making a malformed
    canonical URL.
    """
    canonical = canonical_piece_viewer_path(record)
    if canonical:
        return canonical
    prefix = {"2d": "/p", "3d": "/p3d", "generated": "/art-pieces/p"}[kind]
    return f"{prefix}/{record.public_id}"


def canonical_piece_viewer_path(record) -> str | None:
    """Return the canonical path only when the record can support it."""
    handle = (
        PublicProfile.objects.filter(user_id=record.owner_id, is_public=True)
        .values_list("handle", flat=True)
        .first()
    )
    slug = getattr(record, "public_slug", None)
    if handle and slug:
        return f"/users/@{quote(handle, safe='@')}/pieces/{quote(slug, safe='-')}"
    return None


def piece_immersive_path(record, kind: str) -> str:
    """Return the profile-nested immersive path for a public piece."""
    regular = piece_viewer_path(record, kind)
    if regular.startswith("/users/@") and "/pieces/" in regular:
        return regular.replace("/pieces/", "/immersive/", 1)
    prefix = {
        "2d": "/immersive/p",
        "3d": "/immersive/p3d",
        "generated": "/art-pieces/immersive",
    }[kind]
    return f"{prefix}/{record.public_id}"
