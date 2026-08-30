"""Task 66/issue #66: request-scoped storage for the E2E AI-scenario header.

`get_ai_provider()` in `scenes/ai_api.py` is, and must remain, a genuinely
zero-argument function — every existing AI-endpoint test
(`tests/test_ai_create_scene_api.py`, `tests/test_ai_edit_scene_api.py`)
replaces it entirely via `monkeypatch.setattr(ai_api, "get_ai_provider",
lambda: provider)`, so changing its call sites to pass a `request`
argument would break every one of those tests for no benefit (they
already bypass the real implementation). Instead, `E2EScenarioMiddleware`
(this module) reads the `X-E2E-AI-Scenario` request header once per
request — only when `ai_provider.config.use_fake_ai_provider()` is true —
and stashes it in a `contextvars.ContextVar` that `get_ai_provider()`
reads back, request-scoped and safely concurrent across Django's
threaded/async request handling.
"""

from __future__ import annotations

import contextvars

from ai_provider.config import use_fake_ai_provider

# The header a Playwright test sets (via `page.setExtraHTTPHeaders` — see
# `frontend/e2e/support/aiScenario.ts`) to select which deterministic
# outcome `ai_provider.e2e_provider.build_e2e_provider` should produce for
# this request. Has no effect at all unless `AI_PROVIDER=fake` is set
# server-side (see `E2EScenarioMiddleware` below) — a browser can never
# switch providers on its own.
E2E_SCENARIO_HEADER = "X-E2E-AI-Scenario"

DEFAULT_SCENARIO = "success"

_current_scenario: contextvars.ContextVar[str] = contextvars.ContextVar(
    "e2e_ai_scenario", default=DEFAULT_SCENARIO
)


def get_current_scenario() -> str:
    """The scenario selected for the request currently being handled.

    Always `DEFAULT_SCENARIO` ("success") outside of a request processed
    by `E2EScenarioMiddleware` with `AI_PROVIDER=fake` set — i.e. always,
    in every normal deployment and in every existing test that doesn't
    touch this module at all.
    """
    return _current_scenario.get()


class E2EScenarioMiddleware:
    """Registered unconditionally in `backend.settings.MIDDLEWARE`, but a
    complete no-op unless `AI_PROVIDER=fake` is set — see
    `ai_provider.config.use_fake_ai_provider`. When active, reads the
    `X-E2E-AI-Scenario` header off the incoming request and makes it
    available to `get_ai_provider()` for the lifetime of that request only
    (the contextvar token is always reset in a `finally`, so one request's
    scenario can never leak into the next).
    """

    def __init__(self, get_response):
        self.get_response = get_response

    def __call__(self, request):
        if not use_fake_ai_provider():
            return self.get_response(request)

        scenario = request.headers.get(E2E_SCENARIO_HEADER, DEFAULT_SCENARIO)
        token = _current_scenario.set(scenario)
        try:
            return self.get_response(request)
        finally:
            _current_scenario.reset(token)


__all__ = [
    "DEFAULT_SCENARIO",
    "E2E_SCENARIO_HEADER",
    "E2EScenarioMiddleware",
    "get_current_scenario",
]
