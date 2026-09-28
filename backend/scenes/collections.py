"""Owner collections and their visibility-safe item contract (#567)."""

from __future__ import annotations

import uuid

from django.db import transaction

from scenes.art_piece_persistence import eligible_art_pieces
from scenes.canonical_piece_signals import normalize_public_slug
from scenes.gallery import eligible_projects, eligible_projects3d
from scenes.models import (
    ArtPiece,
    Collection,
    CollectionItem,
    CollectionSlugRedirect,
    Project,
    Project3D,
    PublicProfile,
)
from scenes.public_identity import public_author_handle, public_author_name
from scenes.public_urls import piece_viewer_path


class CollectionValidationError(Exception):
    """A finite, client-actionable collection validation failure."""


class CollectionNotFound(Exception):
    """A collection is missing or not visible to the caller."""


_KIND_TO_LABEL: dict[str, str] = {
    str(CollectionItem.Kind.PROJECT): "2D project",
    str(CollectionItem.Kind.PROJECT3D): "3D project",
    str(CollectionItem.Kind.ART_PIECE): "Generated art piece",
}

_RESERVED_COLLECTION_SLUGS = frozenset(
    {"pieces", "collections", "immersive", "edit", "feed", "feeds"}
)


def _slug_for(owner, title: str) -> str:
    base = normalize_public_slug(title)[:110].strip("-") or "collection"
    if base in _RESERVED_COLLECTION_SLUGS:
        base = f"{base}-2"
    candidate = base
    suffix = 2
    while (
        Collection.objects.filter(owner=owner, slug=candidate).exists()
        or CollectionSlugRedirect.objects.filter(owner=owner, old_slug=candidate).exists()
    ):
        suffix_text = f"-{suffix}"
        candidate = f"{base[: 120 - len(suffix_text)]}{suffix_text}"
        suffix += 1
    return candidate


def _as_uuid(value) -> uuid.UUID:
    try:
        return uuid.UUID(str(value))
    except (ValueError, TypeError, AttributeError) as exc:
        raise CollectionValidationError("item id must be a UUID.") from exc


def _item_record(owner, kind: str, item_id: uuid.UUID, *, public: bool):
    if kind == CollectionItem.Kind.PROJECT:
        if public:
            return eligible_projects().filter(owner=owner, public_id=item_id).first()
        return Project.objects.filter(owner=owner, public_id=item_id).first()
    if kind == CollectionItem.Kind.PROJECT3D:
        if public:
            return eligible_projects3d().filter(owner=owner, public_id=item_id).first()
        return Project3D.objects.filter(owner=owner, public_id=item_id).first()
    if kind == CollectionItem.Kind.ART_PIECE:
        if public:
            return eligible_art_pieces().filter(owner=owner, public_id=item_id).first()
        return ArtPiece.objects.filter(owner=owner, public_id=item_id).first()
    raise CollectionValidationError("kind must be one of: project, project3d, art_piece.")


def _viewer_url(kind: str, item_id: uuid.UUID, record=None) -> str:
    if isinstance(record, ArtPiece):
        return piece_viewer_path(record, "generated")
    if isinstance(record, Project):
        return piece_viewer_path(record, "2d")
    if isinstance(record, Project3D):
        return piece_viewer_path(record, "3d")
    return f"/art-pieces/p/{item_id}"


def _thumbnail_url(kind: str, item_id: uuid.UUID) -> str:
    if kind == CollectionItem.Kind.PROJECT:
        return f"/api/public/projects/{item_id}/thumbnail.png"
    if kind == CollectionItem.Kind.PROJECT3D:
        return f"/api/public/projects3d/{item_id}/thumbnail.png"
    return f"/api/public/art-pieces/{item_id}/thumbnail.png"


def _item_payload(item: CollectionItem, *, public: bool) -> dict | None:
    if hasattr(item, "_resolved_record"):
        record = item._resolved_record
    else:
        record = _item_record(item.collection.owner, item.kind, item.item_id, public=public)
    if record is None:
        return None
    return {
        "kind": item.kind,
        "id": str(item.item_id),
        "position": item.position,
        "title": record.title,
        "viewer_url": _viewer_url(item.kind, item.item_id, record),
        "thumbnail_url": _thumbnail_url(item.kind, item.item_id),
        "label": _KIND_TO_LABEL[item.kind],
    }


def collection_payload(collection: Collection, *, public: bool) -> dict:
    profile = PublicProfile.objects.filter(user=collection.owner).first()
    items = list(collection.items.select_related("collection__owner").order_by("position", "id"))
    item_ids_by_kind: dict[str, set[uuid.UUID]] = {}
    for item in items:
        item_ids_by_kind.setdefault(item.kind, set()).add(item.item_id)
    records_by_key: dict[tuple[str, uuid.UUID], object] = {}
    querysets = {
        CollectionItem.Kind.PROJECT: eligible_projects() if public else Project.objects,
        CollectionItem.Kind.PROJECT3D: eligible_projects3d() if public else Project3D.objects,
        CollectionItem.Kind.ART_PIECE: eligible_art_pieces() if public else ArtPiece.objects,
    }
    for kind, item_ids in item_ids_by_kind.items():
        for record in querysets[kind].filter(owner=collection.owner, public_id__in=item_ids):
            records_by_key[(kind, record.public_id)] = record
    for item in items:
        item._resolved_record = records_by_key.get((item.kind, item.item_id))
    payloads = [
        payload for item in items if (payload := _item_payload(item, public=public)) is not None
    ]
    return {
        "id": str(collection.public_id),
        "title": collection.title,
        "description": collection.description,
        "slug": collection.slug,
        "handle": profile.handle if profile else None,
        "owner": public_author_name(collection.owner),
        "owner_handle": public_author_handle(collection.owner),
        "visibility": collection.visibility,
        "status": collection.status,
        "published_at": collection.published_at.isoformat() if collection.published_at else None,
        "created_at": collection.created_at.isoformat(),
        "updated_at": collection.updated_at.isoformat(),
        "items": payloads,
        "seo_config": collection.seo_config,
        "canonical_url": (
            f"/users/@{profile.handle}/collections/{collection.slug}" if profile else None
        ),
        "immersive_url": (
            f"/users/@{profile.handle}/collections/{collection.slug}/immersive" if profile else None
        ),
        "embed_url": (
            f"/embed/collections/@{profile.handle}/{collection.slug}" if profile else None
        ),
        "download_url": (
            f"/api/public/collections/{profile.handle}/{collection.slug}/download/"
            if public and profile
            else None
        ),
    }


def public_collection_context(kind: str, item_id) -> list[dict[str, str]]:
    """Return only published collection links containing a public item.

    This is deliberately a link-only contract: callers never receive the
    collection's private description, owner id, or unpublished membership.
    Ordering is stable and duplicate memberships are impossible by the
    database constraint on ``CollectionItem``.
    """
    rows = (
        CollectionItem.objects.filter(
            kind=kind,
            item_id=item_id,
            collection__visibility=Collection.Visibility.PUBLIC,
            collection__status=Collection.Status.ACTIVE,
            collection__is_deleted=False,
        )
        .select_related("collection__owner__public_profile")
        .order_by("collection__owner_id", "collection__slug", "collection_id")
    )
    result = []
    for row in rows:
        try:
            profile = row.collection.owner.public_profile
        except PublicProfile.DoesNotExist:
            profile = None
        if profile is None or profile.handle is None:
            continue
        result.append(
            {
                "title": row.collection.title,
                "handle": profile.handle,
                "slug": row.collection.slug,
                "url": f"/users/@{profile.handle}/collections/{row.collection.slug}",
            }
        )
    return result


def _collection_for_owner(owner, public_id) -> Collection:
    try:
        return (
            Collection.objects.select_related("owner")
            .prefetch_related("items")
            .get(owner=owner, public_id=public_id, is_deleted=False)
        )
    except (Collection.DoesNotExist, ValueError, TypeError) as exc:
        raise CollectionNotFound from exc


def _validate_items(owner, raw_items) -> list[tuple[str, uuid.UUID]]:
    if not isinstance(raw_items, list):
        raise CollectionValidationError("items must be a list.")
    validated: list[tuple[str, uuid.UUID]] = []
    seen: set[tuple[str, uuid.UUID]] = set()
    for raw in raw_items:
        if not isinstance(raw, dict):
            raise CollectionValidationError("each item must be an object.")
        kind = raw.get("kind")
        if not isinstance(kind, str) or kind not in CollectionItem.Kind.values:
            raise CollectionValidationError("kind must be one of: project, project3d, art_piece.")
        item_id = _as_uuid(raw.get("id"))
        key = (kind, item_id)
        if key in seen:
            raise CollectionValidationError("collection items must be unique.")
        if _item_record(owner, kind, item_id, public=True) is None:
            raise CollectionValidationError("every item must be an owned, published artwork.")
        seen.add(key)
        validated.append(key)
    return validated


@transaction.atomic
def create_collection(*, owner, title: str, description: str = "") -> Collection:
    title = title.strip() if isinstance(title, str) else ""
    if not title:
        raise CollectionValidationError("title is required.")
    if len(title) > 200:
        raise CollectionValidationError("title must be 200 characters or fewer.")
    return Collection.objects.create(
        owner=owner,
        title=title,
        description=description if isinstance(description, str) else "",
        slug=_slug_for(owner, title),
    )


@transaction.atomic
def update_collection(
    *, collection: Collection, title=None, description=None, public_slug=None, status=None
) -> Collection:
    locked = Collection.objects.select_for_update().get(pk=collection.pk)
    if title is not None:
        title = title.strip() if isinstance(title, str) else ""
        if not title or len(title) > 200:
            raise CollectionValidationError("title must be between 1 and 200 characters.")
        locked.title = title
    if description is not None:
        if not isinstance(description, str):
            raise CollectionValidationError("description must be text.")
        locked.description = description
    if status is not None:
        if status not in Collection.Status.values:
            raise CollectionValidationError("status must be active, draft, or archived.")
        locked.status = status
    if public_slug is not None:
        normalized = normalize_public_slug(public_slug)
        if not normalized:
            raise CollectionValidationError("public_slug must contain a letter or number.")
        if len(normalized) > 120:
            raise CollectionValidationError("public_slug must be 120 characters or fewer.")
        if normalized in _RESERVED_COLLECTION_SLUGS:
            raise CollectionValidationError("public_slug is reserved by the application.")
        if (
            Collection.objects.filter(owner=locked.owner, slug=normalized)
            .exclude(pk=locked.pk)
            .exists()
        ):
            raise CollectionValidationError("public_slug is already in use.")
        if (
            CollectionSlugRedirect.objects.filter(owner=locked.owner, old_slug=normalized)
            .exclude(collection=locked)
            .exists()
        ):
            raise CollectionValidationError("public_slug is already reserved by slug history.")
        old_slug = locked.slug
        if normalized != old_slug:
            locked.slug = normalized
            CollectionSlugRedirect.objects.update_or_create(
                owner=locked.owner, old_slug=old_slug, defaults={"collection": locked}
            )
    if hasattr(collection, "_seo_config_update"):
        locked.seo_config = collection._seo_config_update
    locked.save(
        update_fields=["title", "description", "slug", "seo_config", "status", "updated_at"]
    )
    return locked


@transaction.atomic
def replace_items(*, collection: Collection, raw_items) -> Collection:
    locked = Collection.objects.select_for_update().get(pk=collection.pk)
    values = _validate_items(locked.owner, raw_items)
    CollectionItem.objects.filter(collection=locked).delete()
    CollectionItem.objects.bulk_create(
        [
            CollectionItem(collection=locked, kind=kind, item_id=item_id, position=position)
            for position, (kind, item_id) in enumerate(values)
        ]
    )
    return locked


@transaction.atomic
def set_collection_visibility(*, collection: Collection, public: bool) -> Collection:
    locked = Collection.objects.select_for_update().get(pk=collection.pk)
    locked.visibility = Collection.Visibility.PUBLIC if public else Collection.Visibility.PRIVATE
    locked.published_at = locked.published_at if public and locked.published_at else None
    if public and locked.published_at is None:
        from django.utils import timezone

        locked.published_at = timezone.now()
    locked.save(update_fields=["visibility", "published_at", "updated_at"])
    return locked


@transaction.atomic
def soft_delete_collection(*, collection: Collection) -> None:
    locked = Collection.objects.select_for_update().get(pk=collection.pk)
    if not locked.is_deleted:
        from django.utils import timezone

        locked.is_deleted = True
        locked.deleted_at = timezone.now()
        locked.visibility = Collection.Visibility.PRIVATE
        locked.published_at = None
        locked.save(
            update_fields=["is_deleted", "deleted_at", "visibility", "published_at", "updated_at"]
        )


def public_collection(*, handle: str, slug: str) -> Collection | None:
    return (
        Collection.objects.select_related("owner")
        .prefetch_related("items")
        .filter(
            owner__public_profile__handle=handle.lower(),
            owner__public_profile__is_public=True,
            slug=slug,
            visibility=Collection.Visibility.PUBLIC,
            status=Collection.Status.ACTIVE,
            is_deleted=False,
            published_at__isnull=False,
        )
        .first()
    )


def public_collection_redirect(*, handle: str, slug: str) -> Collection | None:
    redirect = (
        CollectionSlugRedirect.objects.select_related("collection", "collection__owner")
        .filter(
            owner__public_profile__handle=handle.lower(),
            owner__public_profile__is_public=True,
            old_slug=slug,
            collection__visibility=Collection.Visibility.PUBLIC,
            collection__status=Collection.Status.ACTIVE,
            collection__is_deleted=False,
            collection__published_at__isnull=False,
        )
        .first()
    )
    return redirect.collection if redirect else None
