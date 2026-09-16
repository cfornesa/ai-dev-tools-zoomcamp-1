"""Owner collections and their visibility-safe item contract (#567)."""

from __future__ import annotations

import uuid

from django.db import transaction
from django.utils.text import slugify

from scenes.art_piece_persistence import eligible_art_pieces
from scenes.gallery import eligible_projects, eligible_projects3d
from scenes.models import ArtPiece, Collection, CollectionItem, Project, Project3D, PublicProfile


class CollectionValidationError(Exception):
    """A finite, client-actionable collection validation failure."""


class CollectionNotFound(Exception):
    """A collection is missing or not visible to the caller."""


_KIND_TO_LABEL: dict[str, str] = {
    str(CollectionItem.Kind.PROJECT): "2D project",
    str(CollectionItem.Kind.PROJECT3D): "3D project",
    str(CollectionItem.Kind.ART_PIECE): "Generated art piece",
}


def _slug_for(owner, title: str) -> str:
    base = slugify(title)[:110].strip("-") or "collection"
    candidate = base
    suffix = 2
    while Collection.objects.filter(owner=owner, slug=candidate).exists():
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


def _viewer_url(kind: str, item_id: uuid.UUID) -> str:
    if kind == CollectionItem.Kind.PROJECT:
        return f"/p/{item_id}"
    if kind == CollectionItem.Kind.PROJECT3D:
        return f"/p3d/{item_id}"
    return f"/art-pieces/p/{item_id}"


def _thumbnail_url(kind: str, item_id: uuid.UUID) -> str:
    if kind == CollectionItem.Kind.PROJECT:
        return f"/api/public/projects/{item_id}/thumbnail.png"
    if kind == CollectionItem.Kind.PROJECT3D:
        return f"/api/public/projects3d/{item_id}/thumbnail.png"
    return f"/api/public/art-pieces/{item_id}/thumbnail.png"


def _item_payload(item: CollectionItem, *, public: bool) -> dict | None:
    record = _item_record(item.collection.owner, item.kind, item.item_id, public=public)
    if record is None:
        return None
    return {
        "kind": item.kind,
        "id": str(item.item_id),
        "position": item.position,
        "title": record.title,
        "viewer_url": _viewer_url(item.kind, item.item_id),
        "thumbnail_url": _thumbnail_url(item.kind, item.item_id),
        "label": _KIND_TO_LABEL[item.kind],
    }


def collection_payload(collection: Collection, *, public: bool) -> dict:
    profile = PublicProfile.objects.filter(user=collection.owner).first()
    items = [
        payload
        for item in collection.items.select_related("collection__owner").order_by("position", "id")
        if (payload := _item_payload(item, public=public)) is not None
    ]
    return {
        "id": str(collection.public_id),
        "title": collection.title,
        "description": collection.description,
        "slug": collection.slug,
        "handle": profile.handle if profile else None,
        "owner": collection.owner.get_username(),
        "visibility": collection.visibility,
        "published_at": collection.published_at.isoformat() if collection.published_at else None,
        "created_at": collection.created_at.isoformat(),
        "updated_at": collection.updated_at.isoformat(),
        "items": items,
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
            collection__is_deleted=False,
        )
        .select_related("collection__owner")
        .order_by("collection__owner_id", "collection__slug", "collection_id")
    )
    result = []
    for row in rows:
        profile = PublicProfile.objects.filter(user=row.collection.owner).first()
        if profile is None or profile.handle is None:
            continue
        result.append(
            {
                "title": row.collection.title,
                "handle": profile.handle,
                "slug": row.collection.slug,
                "url": f"/users/@{profile.handle}/{row.collection.slug}",
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
def update_collection(*, collection: Collection, title=None, description=None) -> Collection:
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
    locked.save(update_fields=["title", "description", "updated_at"])
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
            is_deleted=False,
            published_at__isnull=False,
        )
        .first()
    )
