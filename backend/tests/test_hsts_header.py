"""HSTS header response tests (issue #490).

Behind Replit's custom-domain route, an upstream HSTS field
(max-age=63072000; includeSubDomains) is prepended by the Replit/Google-Frontend
edge after Django's response leaves the application. Per RFC 6797 §8.1, browsers
process only the FIRST Strict-Transport-Security field, so Django's preload
directive is ineffective where Django is not the TLS edge. The upstream field
cannot be configured or suppressed from this repository (grep of .replit
confirms no header-configuration surface).

These tests guard only the **application layer**: Django must emit exactly one
Strict-Transport-Security field whose value mirrors the current settings, and
must emit none in development/test where HSTS is intentionally disabled. They
cannot detect the upstream duplicate (it is added after Django's process_response
returns) and should not attempt to work around it — that is an owner/vendor
decision (see the ownership comment in backend/settings.py above the
SECURE_HSTS_* block).

SecurityMiddleware caches HSTS settings at __init__ time (not per-request), so
override_settings cannot reach an already-instantiated middleware. These tests
instantiate SecurityMiddleware directly within the override_settings context
to exercise the correct code path without subprocess overhead.
"""

from django.http import HttpResponse
from django.middleware.security import SecurityMiddleware
from django.test import RequestFactory
from django.test.utils import override_settings


def _secure_request():
    """Build a request that looks like HTTPS to Django (X-Forwarded-Proto)."""
    rf = RequestFactory()
    return rf.get("/health/", HTTP_X_FORWARDED_PROTO="https", SERVER_NAME="localhost")


def _make_middleware(**extra_settings):
    """Instantiate SecurityMiddleware within the given override_settings.

    SecurityMiddleware reads SECURE_HSTS_* at __init__ time (not per-request),
    so the middleware must be created INSIDE the override context.
    """
    defaults = {
        "SECURE_SSL_REDIRECT": False,
        "SECURE_CONTENT_TYPE_NOSNIFF": False,
        "SECURE_REFERRER_POLICY": "",
        "SECURE_CROSS_ORIGIN_OPENER_POLICY": "",
    }
    settings_patch = {**defaults, **extra_settings}
    with override_settings(**settings_patch):
        return SecurityMiddleware(lambda req: HttpResponse())


class TestHstsHeaderProduction:
    """When HSTS is enabled, exactly one Strict-Transport-Security field is
    emitted, and its value mirrors the configured settings."""

    def test_emits_single_hsts_header_with_production_defaults(self):
        """SECURE_HSTS_SECONDS=31536000, includeSubDomains, preload
        produces exactly one header with the expected value."""
        mw = _make_middleware(
            SECURE_HSTS_SECONDS=31536000,
            SECURE_HSTS_INCLUDE_SUBDOMAINS=True,
            SECURE_HSTS_PRELOAD=True,
        )
        response = mw.process_response(_secure_request(), HttpResponse())

        sth_headers = [
            v for k, v in response.headers.items() if k.lower() == "strict-transport-security"
        ]
        assert len(sth_headers) == 1, (
            f"Expected exactly one Strict-Transport-Security header, got {len(sth_headers)}: "
            f"{sth_headers}"
        )
        assert sth_headers[0] == "max-age=31536000; includeSubDomains; preload"

    def test_emits_single_hsts_header_with_custom_values(self):
        """Different configured values produce a matching single header,
        proving the emitted field tracks configuration rather than being hardcoded."""
        mw = _make_middleware(
            SECURE_HSTS_SECONDS=63072000,
            SECURE_HSTS_INCLUDE_SUBDOMAINS=True,
            SECURE_HSTS_PRELOAD=False,
        )
        response = mw.process_response(_secure_request(), HttpResponse())

        sth_headers = [
            v for k, v in response.headers.items() if k.lower() == "strict-transport-security"
        ]
        assert len(sth_headers) == 1
        assert sth_headers[0] == "max-age=63072000; includeSubDomains"

    def test_no_duplicate_when_header_already_present(self):
        """If a response already carries a Strict-Transport-Security field,
        SecurityMiddleware does not add a second one (its own guard clause)."""
        mw = _make_middleware(
            SECURE_HSTS_SECONDS=31536000,
            SECURE_HSTS_INCLUDE_SUBDOMAINS=True,
            SECURE_HSTS_PRELOAD=True,
        )
        response = HttpResponse()
        response.headers["Strict-Transport-Security"] = "max-age=999999"
        result = mw.process_response(_secure_request(), response)

        sth_headers = [
            v for k, v in result.headers.items() if k.lower() == "strict-transport-security"
        ]
        assert len(sth_headers) == 1
        # Existing header preserved, not overwritten
        assert sth_headers[0] == "max-age=999999"


class TestHstsHeaderDevelopment:
    """Development/test environments (HSTS disabled) must not emit any
    Strict-Transport-Security field."""

    def test_no_hsts_header_when_hsts_seconds_is_zero(self):
        """SECURE_HSTS_SECONDS=0 emits no Strict-Transport-Security header,
        so no dev/test environment is forced into production HSTS behavior."""
        mw = _make_middleware(
            SECURE_HSTS_SECONDS=0,
            SECURE_HSTS_INCLUDE_SUBDOMAINS=False,
            SECURE_HSTS_PRELOAD=False,
        )
        response = mw.process_response(_secure_request(), HttpResponse())

        sth_headers = [
            v for k, v in response.headers.items() if k.lower() == "strict-transport-security"
        ]
        assert len(sth_headers) == 0, (
            f"Expected no Strict-Transport-Security header in dev/test, got: {sth_headers}"
        )

    def test_no_hsts_header_over_insecure_request(self):
        """Even with positive HSTS seconds, no header is added for non-HTTPS
        requests (SecurityMiddleware's request.is_secure() guard)."""
        mw = _make_middleware(
            SECURE_HSTS_SECONDS=31536000,
            SECURE_HSTS_INCLUDE_SUBDOMAINS=True,
            SECURE_HSTS_PRELOAD=True,
        )
        rf = RequestFactory()
        insecure_request = rf.get("/health/", SERVER_NAME="localhost")
        assert not insecure_request.is_secure()

        response = mw.process_response(insecure_request, HttpResponse())
        sth_headers = [
            v for k, v in response.headers.items() if k.lower() == "strict-transport-security"
        ]
        assert len(sth_headers) == 0
