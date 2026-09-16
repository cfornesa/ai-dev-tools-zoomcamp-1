"""Account and public collection endpoints (#567)."""

from __future__ import annotations

from rest_framework import status
from rest_framework.response import Response
from rest_framework.views import APIView

from scenes.collections import (
    CollectionNotFound,
    CollectionValidationError,
    _collection_for_owner,
    collection_payload,
    create_collection,
    public_collection,
    replace_items,
    set_collection_visibility,
    soft_delete_collection,
    update_collection,
)
from scenes.models import Collection


def _auth_required(request):
    if not request.user.is_authenticated:
        return Response({"detail": "Authentication required."}, status=status.HTTP_401_UNAUTHORIZED)
    return None


def _owner_collection(request, public_id):
    try:
        return _collection_for_owner(request.user, public_id)
    except CollectionNotFound:
        return None


class CollectionListCreateView(APIView):
    def get(self, request):
        denied = _auth_required(request)
        if denied:
            return denied
        collections = (
            Collection.objects.filter(owner=request.user, is_deleted=False)
            .select_related("owner")
            .prefetch_related("items")
        )
        return Response([collection_payload(item, public=False) for item in collections])

    def post(self, request):
        denied = _auth_required(request)
        if denied:
            return denied
        try:
            collection = create_collection(
                owner=request.user,
                title=request.data.get("title"),
                description=request.data.get("description", ""),
            )
        except CollectionValidationError as exc:
            return Response({"error": "validation_failed", "detail": str(exc)}, status=400)
        return Response(
            collection_payload(collection, public=False), status=status.HTTP_201_CREATED
        )


class CollectionDetailView(APIView):
    def get(self, request, public_id):
        denied = _auth_required(request)
        if denied:
            return denied
        collection = _owner_collection(request, public_id)
        if collection is None:
            return Response({"detail": "Not found."}, status=status.HTTP_404_NOT_FOUND)
        return Response(collection_payload(collection, public=False))

    def patch(self, request, public_id):
        denied = _auth_required(request)
        if denied:
            return denied
        collection = _owner_collection(request, public_id)
        if collection is None:
            return Response({"detail": "Not found."}, status=status.HTTP_404_NOT_FOUND)
        try:
            collection = update_collection(
                collection=collection,
                title=request.data.get("title"),
                description=request.data.get("description"),
            )
        except CollectionValidationError as exc:
            return Response({"error": "validation_failed", "detail": str(exc)}, status=400)
        return Response(collection_payload(collection, public=False))

    def delete(self, request, public_id):
        denied = _auth_required(request)
        if denied:
            return denied
        collection = _owner_collection(request, public_id)
        if collection is None:
            return Response({"detail": "Not found."}, status=status.HTTP_404_NOT_FOUND)
        soft_delete_collection(collection=collection)
        return Response(status=status.HTTP_204_NO_CONTENT)


class CollectionItemsView(APIView):
    def post(self, request, public_id):
        denied = _auth_required(request)
        if denied:
            return denied
        collection = _owner_collection(request, public_id)
        if collection is None:
            return Response({"detail": "Not found."}, status=status.HTTP_404_NOT_FOUND)
        try:
            collection = replace_items(collection=collection, raw_items=request.data.get("items"))
        except CollectionValidationError as exc:
            return Response({"error": "validation_failed", "detail": str(exc)}, status=400)
        collection.refresh_from_db()
        return Response(collection_payload(collection, public=False))


class CollectionVisibilityView(APIView):
    public = False

    def post(self, request, public_id, public):
        denied = _auth_required(request)
        if denied:
            return denied
        collection = _owner_collection(request, public_id)
        if collection is None:
            return Response({"detail": "Not found."}, status=status.HTTP_404_NOT_FOUND)
        collection = set_collection_visibility(collection=collection, public=public)
        return Response(collection_payload(collection, public=False))


class CollectionSnapshotView(APIView):
    def get(self, request, public_id):
        denied = _auth_required(request)
        if denied:
            return denied
        collection = _owner_collection(request, public_id)
        if collection is None:
            return Response({"detail": "Not found."}, status=status.HTTP_404_NOT_FOUND)
        return Response(collection_payload(collection, public=False))


class PublicCollectionDetailView(APIView):
    def get(self, request, handle, slug):
        collection = public_collection(handle=handle, slug=slug)
        if collection is None:
            return Response({"detail": "Not found."}, status=status.HTTP_404_NOT_FOUND)
        return Response(collection_payload(collection, public=True))
