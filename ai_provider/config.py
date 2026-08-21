"""Provider selection configuration. User credentials are resolved elsewhere.

`_docs/plan.md`'s "API-key security" section: "Keep provider API keys
only in Django deployment secrets/environment variables. Never expose
keys to the browser, scene JSON, public pages, or exported HTML ...
Do not store user-supplied provider keys in V1."

This mirrors `config.settings.get_required_env`'s fail-fast convention
(missing var -> `ImproperlyConfigured` naming the variable) rather than
reusing that function directly, because provider keys are read lazily,
at call time inside a real provider implementation (Task 46/47) — not
eagerly at Django settings-load time. Task 45 does not integrate a real
provider, so no environment variable here is required yet and nothing
in this codebase calls `get_provider_api_key` today; `MISTRAL_API_KEY`
becomes a real, required-at-call-time variable when Task 46/47 adds the
Mistral client, following `.env.example`'s existing documentation
convention at that point.

Structural guarantees this module (and the rest of `ai_provider/`)
upholds, checked by
`tests/test_ai_provider_key_and_logging_safety.py`:

- No `ai_provider` request/response type (see
  `interface.PUBLIC_DATA_TYPES`) has a field that could carry a raw key.
- Keys are read only from `os.environ` here, never accepted as a
  function parameter from request payloads or caller-supplied strings.
- Keys are never written to `ai_provider.logging`'s operation log.
"""

from __future__ import annotations

import os

from django.core.exceptions import ImproperlyConfigured

# The environment variable Task 46/47's real Mistral provider will read.
# Documented here so every future provider implementation follows the
# same one-env-var-per-provider convention as the rest of this codebase
# (see AGENTS.md and config/settings.py).

# Task 66/issue #66's deterministic-provider swap for the Playwright
# AI/recovery end-to-end suite (`frontend/e2e/aiAndRecovery.spec.ts`).
# When, and only when, this environment variable is set to exactly
# "fake" (case-insensitive), `scenes.ai_api.get_ai_provider()` returns a
# network-free `ai_provider.e2e_provider` provider instead of a real
# `MistralSceneProvider()` — see that module's own docstring for the
# full wiring. No documented deployment `.env`/`.env.example` anywhere in
# this repo sets `AI_PROVIDER`, so a real deployment's behavior is
# completely unchanged; this only ever takes effect when a developer or
# CI explicitly starts `manage.py runserver` with `AI_PROVIDER=fake` in
# its environment, exactly as AGENTS.md documents for this suite.
AI_PROVIDER_ENV_VAR = "AI_PROVIDER"
AI_PROVIDER_FAKE_VALUE = "fake"


def use_fake_ai_provider() -> bool:
    """Whether `AI_PROVIDER_ENV_VAR` selects the deterministic E2E provider.

    Reads directly from `os.environ` (never cached) so a test process that
    sets/unsets the variable via `monkeypatch.setenv`/`os.environ` sees the
    change take effect immediately, matching every other env-driven check
    in this codebase.
    """
    return os.environ.get(AI_PROVIDER_ENV_VAR, "").strip().lower() == AI_PROVIDER_FAKE_VALUE


def get_provider_api_key(env_var: str) -> str:
    """Compatibility helper for older integrations; production AI never calls it."""
    try:
        return os.environ[env_var]
    except KeyError:
        raise ImproperlyConfigured(
            f"Required environment variable '{env_var}' is not set."
        ) from None


