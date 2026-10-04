"""Request-time crawler resources for public-site discovery."""

from django.http import HttpResponse
from rest_framework.views import APIView


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
