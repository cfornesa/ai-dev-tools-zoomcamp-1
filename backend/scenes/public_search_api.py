"""Anonymous public gallery search, separated by account/content scope (#581)."""

import base64
import binascii
from datetime import datetime

from django.db.models import Count, Prefetch, Q, Value
from django.db.models.functions import Coalesce
from django.utils.dateparse import parse_datetime
from rest_framework.response import Response
from rest_framework.views import APIView

from scenes.art_piece_persistence import eligible_art_pieces
from scenes.collections import _cover_payload, _thumbnail_url
from scenes.gallery import (
    DEFAULT_PAGE_SIZE,
    clamp_page_size,
    eligible_collections,
    eligible_projects,
    eligible_projects3d,
)
from scenes.models import Collection, CollectionItem, PublicProfile
from scenes.public_identity import public_author_handle, public_author_name
from scenes.serializers import PublicGalleryItemSerializer

COLLECTION_SORTS = frozenset(("newest", "oldest", "item_count"))


def _encode_collection_cursor(sort: str, collection: Collection) -> str:
    count = getattr(collection, "_index_item_count", None)
    if collection.published_at is None:
        raise ValueError("cannot cursor a collection without a publication timestamp")
    raw = "|".join(
        (
            "collections",
            sort,
            str(count) if sort == "item_count" else "",
            collection.published_at.isoformat(),
            str(collection.id),
        )
    )
    return base64.urlsafe_b64encode(raw.encode("utf-8")).decode("ascii")


def _decode_collection_cursor(value: str) -> tuple[str, int, datetime, int]:
    try:
        decoded = base64.urlsafe_b64decode(value.encode("ascii")).decode("utf-8")
        prefix, sort, count_raw, published_at_raw, id_raw = decoded.split("|", 4)
        published_at = parse_datetime(published_at_raw)
        if prefix != "collections" or sort not in COLLECTION_SORTS or published_at is None:
            raise ValueError
        count = int(count_raw) if sort == "item_count" else 0
        return sort, count, published_at, int(id_raw)
    except (ValueError, TypeError, UnicodeDecodeError, binascii.Error) as exc:
        raise ValueError("invalid collection cursor") from exc


def _after_collection_cursor(queryset, sort: str, count: int, published_at, object_id: int):
    if sort == "newest":
        return queryset.filter(
            Q(published_at__lt=published_at) | Q(published_at=published_at, id__lt=object_id)
        )
    if sort == "oldest":
        return queryset.filter(
            Q(published_at__gt=published_at) | Q(published_at=published_at, id__gt=object_id)
        )
    return queryset.filter(
        Q(_index_item_count__lt=count)
        | Q(_index_item_count=count, published_at__lt=published_at)
        | Q(
            _index_item_count=count,
            published_at=published_at,
            id__lt=object_id,
        )
    )


def _public_collection_index_payloads(collections):
    """Build the fixed, visibility-safe card payload for public collections.

    Collection membership is polymorphic, so the eligible ids are fetched in
    three bounded batches for the page rather than resolving each item with
    an N+1 query. The public gallery page is capped at ``MAX_PAGE_SIZE`` by
    the caller, which keeps these set-membership checks bounded by the same
    public gallery scale as the existing collection listing.
    """
    item_rows = [
        item
        for collection in collections
        for item in getattr(collection, "_public_index_items", [])
    ]
    item_ids_by_kind = {
        kind: {item.item_id for item in item_rows if item.kind == kind}
        for kind in CollectionItem.Kind.values
    }
    eligible_ids_by_kind = {
        CollectionItem.Kind.PROJECT: set(
            eligible_projects()
            .filter(public_id__in=item_ids_by_kind[CollectionItem.Kind.PROJECT])
            .values_list("public_id", flat=True)
        ),
        CollectionItem.Kind.PROJECT3D: set(
            eligible_projects3d()
            .filter(public_id__in=item_ids_by_kind[CollectionItem.Kind.PROJECT3D])
            .values_list("public_id", flat=True)
        ),
        CollectionItem.Kind.ART_PIECE: set(
            eligible_art_pieces()
            .filter(public_id__in=item_ids_by_kind[CollectionItem.Kind.ART_PIECE])
            .values_list("public_id", flat=True)
        ),
    }
    payloads = []
    for collection in collections:
        explicit_cover = _cover_payload(collection, public=True)
        fallback_cover = next(
            (
                _thumbnail_url(item.kind, item.item_id)
                for item in getattr(collection, "_public_index_items", [])
                if item.item_id in eligible_ids_by_kind[item.kind]
            ),
            None,
        )
        public_item_count = sum(
            item.item_id in eligible_ids_by_kind[item.kind]
            for item in getattr(collection, "_public_index_items", [])
        )
        handle = public_author_handle(collection.owner)
        payloads.append(
            {
                "id": str(collection.public_id),
                "title": collection.title,
                "owner_handle": handle,
                "cover_url": (explicit_cover or {}).get("url") or fallback_cover,
                "item_count": public_item_count,
                "published_at": collection.published_at,
                "viewer_url": (
                    f"/users/@{handle}/collections/{collection.slug}" if handle else None
                ),
            }
        )
    return payloads


class PublicCollectionListView(APIView):
    """Anonymous public collection index with bounded, cursor-safe sorting (#1030)."""

    authentication_classes: list = []
    permission_classes: list = []

    def get(self, request):
        sort = request.query_params.get("sort", "newest")
        if sort not in COLLECTION_SORTS:
            return Response(
                {"errors": {"sort": ["Must be one of: newest, oldest, item_count."]}},
                status=400,
            )
        page_size_raw = request.query_params.get("page_size")
        if page_size_raw is not None:
            try:
                page_size = clamp_page_size(int(page_size_raw))
            except ValueError:
                return Response(
                    {"errors": {"page_size": ["Must be a positive integer."]}}, status=400
                )
        else:
            page_size = DEFAULT_PAGE_SIZE

        queryset = (
            eligible_collections()
            .filter(status=Collection.Status.ACTIVE)
            .prefetch_related(
                Prefetch(
                    "items",
                    queryset=CollectionItem.objects.only("collection_id", "kind", "item_id"),
                    to_attr="_public_index_items",
                )
            )
        )
        if sort == "item_count":
            public_item_count = sum(
                (
                    Coalesce(
                        Count(
                            "items",
                            filter=Q(
                                items__kind=kind,
                                items__item_id__in=eligible_queryset.values("public_id"),
                            ),
                            distinct=True,
                        ),
                        Value(0),
                    )
                    for kind, eligible_queryset in (
                        (CollectionItem.Kind.PROJECT, eligible_projects()),
                        (CollectionItem.Kind.PROJECT3D, eligible_projects3d()),
                        (CollectionItem.Kind.ART_PIECE, eligible_art_pieces()),
                    )
                )
            )
            queryset = queryset.annotate(_index_item_count=public_item_count)
            queryset = queryset.order_by("-_index_item_count", "-published_at", "-id")
        elif sort == "oldest":
            queryset = queryset.order_by("published_at", "id")
        else:
            queryset = queryset.order_by("-published_at", "-id")

        cursor = request.query_params.get("cursor")
        if cursor:
            try:
                cursor_sort, cursor_count, cursor_published_at, cursor_id = (
                    _decode_collection_cursor(cursor)
                )
                if cursor_sort != sort:
                    raise ValueError
            except ValueError:
                return Response({"errors": {"cursor": ["Invalid or expired cursor."]}}, status=400)
            queryset = _after_collection_cursor(
                queryset, sort, cursor_count, cursor_published_at, cursor_id
            )

        page = list(queryset[: page_size + 1])
        has_more = len(page) > page_size
        page = page[:page_size]
        next_cursor = None
        if has_more and page:
            last = page[-1]
            next_cursor = _encode_collection_cursor(sort, last)

        return Response(
            {
                "results": _public_collection_index_payloads(page),
                "next_cursor": next_cursor,
                "has_more": has_more,
            }
        )


class PublicGallerySearchView(APIView):
    authentication_classes: list = []
    permission_classes: list = []

    def get(self, request):
        query = request.query_params.get("q", "").strip()
        scope = request.query_params.get("scope", "content")
        if len(query) > 100 or scope not in {"accounts", "content"}:
            return Response({"errors": {"query": ["Invalid search query."]}}, status=400)
        if not query:
            return Response({"scope": scope, "results": []})
        if scope == "accounts":
            profiles = (
                PublicProfile.objects.filter(is_public=True)
                .filter(
                    Q(handle__icontains=query)
                    | Q(display_name__icontains=query)
                    | Q(user__username__icontains=query)
                )
                .select_related("user")
                .order_by("handle")[:50]
            )
            return Response(
                {
                    "scope": scope,
                    "results": [
                        {
                            "id": str(profile.user_id),
                            "kind": "account",
                            "title": profile.display_name or profile.handle,
                            "owner": public_author_name(profile.user),
                            "owner_handle": public_author_handle(profile.user),
                            "handle": profile.handle,
                            "viewer_url": f"/users/@{profile.handle}",
                        }
                        for profile in profiles
                    ],
                }
            )
        candidates = []
        for kind, queryset in (
            ("2d", eligible_projects()),
            ("3d", eligible_projects3d()),
            ("generated", eligible_art_pieces()),
        ):
            filtered = (
                queryset.filter(Q(title__icontains=query) | Q(description__icontains=query))
                if kind != "3d"
                else queryset.filter(title__icontains=query)
            )
            candidates.extend((record.published_at, kind, record) for record in filtered[:50])
        candidates.sort(key=lambda item: (item[0], item[2].id), reverse=True)
        return Response(
            {
                "scope": scope,
                "results": PublicGalleryItemSerializer(
                    [(kind, record) for _, kind, record in candidates[:50]], many=True
                ).data,
            }
        )
