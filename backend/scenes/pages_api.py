"""Anonymous published CMS page reads (issue #517)."""

from django.http import HttpResponsePermanentRedirect
from rest_framework.response import Response
from rest_framework.views import APIView

from scenes.models import Page, PageSlugRedirect


class PublicPageDetailView(APIView):
    authentication_classes: list = []
    permission_classes: list = []

    def get(self, request, slug):
        page = Page.objects.filter(slug=slug, status=Page.Status.PUBLISHED).first()
        if page is not None:
            return Response(
                {
                    "title": page.title,
                    "slug": page.slug,
                    "description": page.description,
                    "nav_label": page.nav_label,
                    "show_in_nav": page.show_in_nav,
                    "sort_order": page.sort_order,
                }
            )
        redirect = PageSlugRedirect.objects.select_related("page").filter(old_slug=slug).first()
        if (
            redirect is not None
            and redirect.page.deleted_at is None
            and redirect.page.status == Page.Status.PUBLISHED
        ):
            return HttpResponsePermanentRedirect(f"/api/pages/{redirect.page.slug}/")
        return Response({"detail": "Not found."}, status=404)
