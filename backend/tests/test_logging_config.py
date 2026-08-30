"""Regression test for issue #240.

Django's own default LOGGING config only sends the 'django.request'
logger's unhandled-exception tracebacks to console when DEBUG=True (its
'console' handler is filtered by RequireDebugTrue); in production the
traceback's only other destination is emailing ADMINS, which this
project doesn't set, so it silently went nowhere -- confirmed live via
issue #238's production incident, where the request-summary line (from
the separate, never-filtered 'django.server' logger) was visible in
Replit's logs but no traceback ever appeared.
"""

from __future__ import annotations

import logging

import pytest
from django.conf import settings
from django.urls import path
from rest_framework.test import APIClient


def _boom(request):
    raise RuntimeError("intentional-test-exception-for-logging-config")


urlpatterns = [path("__test_logging_boom__/", _boom)]


def test_django_request_logger_has_an_unfiltered_console_handler():
    handlers = settings.LOGGING["loggers"]["django.request"]["handlers"]
    assert "django_request_console" in handlers

    handler_config = settings.LOGGING["handlers"]["django_request_console"]
    # The bug this regresses against: Django's own default 'console'
    # handler filters on require_debug_true, silently dropping the
    # traceback once DEBUG=False. This handler must carry no such filter.
    assert "filters" not in handler_config or not handler_config["filters"]


@pytest.mark.urls(__name__)
@pytest.mark.django_db
def test_unhandled_exception_reaches_the_django_request_console_handler(caplog):
    client = APIClient(raise_request_exception=False)

    with caplog.at_level(logging.ERROR, logger="django.request"):
        response = client.get("/__test_logging_boom__/")

    assert response.status_code == 500
    assert any(
        "intentional-test-exception-for-logging-config" in (record.exc_text or "")
        or (record.exc_info and "RuntimeError" in str(record.exc_info[1]))
        for record in caplog.records
    )
