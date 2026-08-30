"""Exceptions a provider implementation raises to signal a failure condition.

A provider implementation (real or fake) raises one of these from inside
the callable it hands to `ai_provider.interface.execute()`. `execute()`
catches each one and maps it to the matching `AIErrorCategory`, so every
caller — real Mistral client (Task 46/47) or `FakeAISceneProvider` — goes
through the exact same normalization path. Anything else the provider
callable raises is left to propagate (a genuine bug, not a documented
provider condition), rather than being silently swallowed into one of
these categories.

These exceptions carry no field capable of holding a raw provider secret
(API key, auth header, raw request/response body) — only short,
non-sensitive human-readable text. See `ai_provider/config.py` for where
the actual key lives, and
`tests/test_ai_provider_key_and_logging_safety.py` for the structural
check that none of this package's types have a key-shaped field.
"""

from __future__ import annotations


class AIProviderError(Exception):
    """Base class for the documented, normalizable provider failure conditions."""


class AIProviderTimeoutError(AIProviderError):
    """The provider did not respond within the configured deadline."""


class AIProviderCancelledError(AIProviderError):
    """The caller (user or server) cancelled the operation before completion."""


class AIProviderRejectionError(AIProviderError):
    """The provider declined to fulfill the request (e.g. content policy)."""


class AIProviderQuotaError(AIProviderError):
    """The provider or our own server-side quota/rate limit was exceeded."""
