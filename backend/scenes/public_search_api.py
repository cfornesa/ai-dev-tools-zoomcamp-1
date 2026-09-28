"""Anonymous public gallery search, separated by account/content scope (#581)."""

from django.db.models import Prefetch, Q
from rest_framework.response import Response
from rest_framework.views import APIView

from scenes.art_piece_persistence import eligible_art_pieces
from scenes.gallery import (
    DEFAULT_PAGE_SIZE,
    InvalidCursor,
    clamp_page_size,
    decode_gallery_cursor,
    eligible_collections,
    eligible_projects,
    eligible_projects3d,
    encode_gallery_cursor,
    filter_after_gallery_cursor,
)
from scenes.models import Collection, CollectionItem, PublicProfile
from scenes.public_identity import public_author_handle, public_author_name
from scenes.serializers import PublicGalleryItemSerializer


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
                "cover_url": None,
                "item_count": public_item_count,
                "published_at": collection.published_at,
                "viewer_url": (
                    f"/users/@{handle}/collections/{collection.slug}" if handle else None
                ),
            }
        )
    return payloads


class PublicCollectionListView(APIView):
    """Anonymous newest-first public collection index (#1028)."""

    authentication_classes: list = []
    permission_classes: list = []

    def get(self, request):
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
        cursor = request.query_params.get("cursor")
        if cursor:
            try:
                published_at, kind, object_id, cursor_type = decode_gallery_cursor(cursor)
            except InvalidCursor:
                return Response({"errors": {"cursor": ["Invalid or expired cursor."]}}, status=400)
            if kind != "collection" or cursor_type != "collections":
                return Response({"errors": {"cursor": ["Invalid or expired cursor."]}}, status=400)
            queryset = filter_after_gallery_cursor(queryset, published_at, kind, object_id)

        page = list(queryset[: page_size + 1])
        has_more = len(page) > page_size
        page = page[:page_size]
        next_cursor = None
        if has_more and page:
            last = page[-1]
            next_cursor = encode_gallery_cursor(
                last.published_at, "collection", last.id, "collections"
            )

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
