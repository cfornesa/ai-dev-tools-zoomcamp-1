"""Account and public collection endpoints (#567)."""

from __future__ import annotations

import io
import json
import zipfile

from django.core.cache import cache
from django.http import HttpResponse, HttpResponsePermanentRedirect
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
    public_collection_redirect,
    replace_items,
    set_collection_visibility,
    soft_delete_collection,
    update_collection,
)
from scenes.content_metadata import sanitize_content_seo
from scenes.models import Collection, CollectionComment


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
            Collection.objects.filter(
                owner=request.user,
                is_deleted=False,
            )
            .exclude(status=Collection.Status.ARCHIVED)
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
            collection._seo_config_update = sanitize_content_seo(
                request.data.get("seo_config", collection.seo_config)
            )
            collection = update_collection(
                collection=collection,
                title=request.data.get("title"),
                description=request.data.get("description"),
                public_slug=request.data.get("public_slug"),
                status=request.data.get("status"),
            )
            if "comments_enabled" in request.data:
                collection.comments_enabled = bool(request.data["comments_enabled"])
                collection.save(update_fields=["comments_enabled", "updated_at"])
        except CollectionValidationError as exc:
            return Response({"error": "validation_failed", "detail": str(exc)}, status=400)
        except ValueError as exc:
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


class PublicCollectionCommentsView(APIView):
    def post(self, request, handle, slug):
        denied = _auth_required(request)
        if denied:
            return denied
        collection = public_collection(handle=handle, slug=slug)
        if collection is None or not collection.comments_enabled:
            return Response({"detail": "Comments are disabled."}, status=status.HTTP_404_NOT_FOUND)
        body = request.data.get("body")
        if not isinstance(body, str) or not body.strip() or len(body.strip()) > 2000:
            return Response(
                {"error": "validation_failed", "detail": "body must be 1-2000 characters."},
                status=400,
            )
        key = f"collection-comment:{request.user.pk}:{collection.pk}"
        if not cache.add(key, True, timeout=60):
            return Response({"error": "rate_limited"}, status=429)
        comment = CollectionComment.objects.create(
            collection=collection, author=request.user, body=body.strip()
        )
        return Response(
            {
                "id": comment.id,
                "body": comment.body,
                "author": comment.author.get_username(),
                "created_at": comment.created_at.isoformat(),
            },
            status=201,
        )


class CollectionCommentDeleteView(APIView):
    def delete(self, request, public_id, comment_id):
        denied = _auth_required(request)
        if denied:
            return denied
        comment = (
            CollectionComment.objects.filter(
                id=comment_id, collection__public_id=public_id, is_deleted=False
            )
            .select_related("collection")
            .first()
        )
        if comment is None or (comment.author_id != request.user.id and not request.user.is_staff):
            return Response({"detail": "Not found."}, status=404)
        comment.is_deleted = True
        comment.save(update_fields=["is_deleted"])
        return Response(status=204)


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
            redirected_collection = public_collection_redirect(handle=handle, slug=slug)
            if redirected_collection:
                return HttpResponsePermanentRedirect(
                    f"/api/public/collections/{handle}/{redirected_collection.slug}/"
                )
            return Response({"detail": "Not found."}, status=status.HTTP_404_NOT_FOUND)
        return Response(collection_payload(collection, public=True))


class PublicCollectionDownloadView(APIView):
    """Download a visibility-safe ordered manifest for a public collection."""

    def get(self, request, handle, slug):
        collection = public_collection(handle=handle, slug=slug)
        if collection is None:
            redirected_collection = public_collection_redirect(handle=handle, slug=slug)
            if redirected_collection:
                return HttpResponsePermanentRedirect(
                    f"/api/public/collections/{handle}/{redirected_collection.slug}/download/"
                )
            return Response({"detail": "Not found."}, status=status.HTTP_404_NOT_FOUND)

        manifest = json.dumps(
            collection_payload(collection, public=True),
            ensure_ascii=False,
            indent=2,
        ).encode("utf-8")
        archive = io.BytesIO()
        with zipfile.ZipFile(archive, "w", compression=zipfile.ZIP_DEFLATED) as bundle:
            bundle.writestr("collection.json", manifest)
        response = HttpResponse(archive.getvalue(), content_type="application/zip")
        response["Content-Disposition"] = f'attachment; filename="{collection.slug}.zip"'
        return response
