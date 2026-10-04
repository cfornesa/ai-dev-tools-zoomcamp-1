"""Request-time crawler resources for public-site discovery."""

import xml.etree.ElementTree as ET
from itertools import islice

from django.http import HttpResponse
from rest_framework.views import APIView

from scenes.art_piece_persistence import eligible_art_pieces
from scenes.gallery import eligible_collections, eligible_projects, eligible_projects3d
from scenes.llms import public_profiles, published_cms_pages
from scenes.public_urls import piece_viewer_path

SITEMAP_NAMESPACE = 'http://www.sitemaps.org/schemas/sitemap/0.9'
MAX_SITEMAP_URLS = 50_000


def _sitemap_candidates():
    """Yield eligible public URL paths and their source record update times."""
    yield '/gallery', None

    for page in published_cms_pages().iterator():
        yield f'/pages/{page.slug}', page.updated_at

    profiles = public_profiles().exclude(handle='')
    for profile in profiles.iterator():
        yield f'/users/@{profile.handle}', profile.updated_at

    collections = (
        eligible_collections()
        .filter(owner__is_active=True)
        .order_by('owner__public_profile__handle', 'slug', 'pk')
    )
    for collection in collections.iterator():
        yield (
            f'/users/@{collection.owner.public_profile.handle}/collections/{collection.slug}',
            collection.updated_at,
        )

    for kind, queryset in (
        ('2d', eligible_projects()),
        ('3d', eligible_projects3d()),
        ('generated', eligible_art_pieces()),
    ):
        queryset = queryset.filter(
            owner__is_active=True,
            owner__public_profile__is_public=True,
            owner__public_profile__handle__gt='',
        ).select_related('owner__public_profile')
        queryset = queryset.order_by('owner__public_profile__handle', 'public_slug', 'pk')
        for record in queryset.iterator():
            yield piece_viewer_path(record, kind), record.updated_at


def render_sitemap(request) -> bytes:
    root = ET.Element(f'{{{SITEMAP_NAMESPACE}}}urlset')
    candidates = islice(_sitemap_candidates(), MAX_SITEMAP_URLS)
    for path, updated_at in candidates:
        url = ET.SubElement(root, f'{{{SITEMAP_NAMESPACE}}}url')
        ET.SubElement(url, f'{{{SITEMAP_NAMESPACE}}}loc').text = request.build_absolute_uri(path)
        if updated_at is not None:
            ET.SubElement(
                url, f'{{{SITEMAP_NAMESPACE}}}lastmod'
            ).text = updated_at.date().isoformat()
    return ET.tostring(root, encoding='utf-8', xml_declaration=True)


class RobotsTextView(APIView):
    authentication_classes: list = []
    permission_classes: list = []

    def get(self, request):
        sitemap_url = request.build_absolute_uri('/sitemap.xml')
        llms_url = request.build_absolute_uri('/llms.txt')
        body = '\n'.join(
            [
                'User-agent: *',
                'Allow: /',
                'Disallow: /api/',
                'Disallow: /admin',
                'Disallow: /account',
                'Disallow: /accounts/',
                'Disallow: /studio',
                f'Sitemap: {sitemap_url}',
                f'Llms: {llms_url}',
                '',
            ]
        )
        return HttpResponse(body, content_type='text/plain; charset=utf-8')


class SitemapXMLView(APIView):
    authentication_classes: list = []
    permission_classes: list = []

    def get(self, request):
        return HttpResponse(render_sitemap(request), content_type='application/xml; charset=utf-8')
