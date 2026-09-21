"""Anonymous published CMS page reads (issue #517)."""

from django.http import HttpResponsePermanentRedirect
from rest_framework.response import Response
from rest_framework.views import APIView

from scenes.models import Page, PageSlugRedirect


class PublicPageNavigationView(APIView):
    """Anonymous navigation projection for published CMS pages."""

    authentication_classes: list = []
    permission_classes: list = []

    def get(self, request):
        pages = Page.objects.filter(
            status=Page.Status.PUBLISHED,
            show_in_nav=True,
        ).values("title", "slug", "nav_label", "sort_order", "id")
        return Response(list(pages))


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
                    "seo_config": page.seo_config,
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
