"""Where a real provider implementation reads its API key. Server-side only.

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
MISTRAL_API_KEY_ENV_VAR = "MISTRAL_API_KEY"


def get_provider_api_key(env_var: str) -> str:
    """Read a provider API key from a server-side environment variable.

    Raises `ImproperlyConfigured`, naming the missing variable, if it is
    unset — the same fail-fast convention `config.settings.get_required_env`
    uses for every other secret in this project. Callers must pass the
    variable name explicitly (e.g. `MISTRAL_API_KEY_ENV_VAR`); there is
    no default, and this function accepts no other way to supply a key.
    """
    try:
        return os.environ[env_var]
    except KeyError:
        raise ImproperlyConfigured(
            f"Required environment variable '{env_var}' is not set. "
            "Provider API keys are read from server-side environment "
            "variables only — never from request payloads, scene "
            "content, or browser code. See ai_provider/config.py and "
            "AGENTS.md."
        ) from None
