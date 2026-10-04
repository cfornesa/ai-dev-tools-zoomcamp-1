"""
ASGI config for config project.

It exposes the ASGI callable as a module-level variable named ``application``.

For more information on this file, see
https://docs.djangoproject.com/en/6.1/howto/deployment/asgi/
"""

import os

from django.core.asgi import get_asgi_application

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'backend.settings')

django_application = get_asgi_application()

# The MCP module imports Django settings and services, so import it after
# get_asgi_application() has initialized the app registry.
from scenes.mcp.server import create_mcp_asgi_app  # noqa: E402

application = create_mcp_asgi_app(django_application)
