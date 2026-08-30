"""Minimal-metadata operation logging. Prompt retention defaults to off.

`docs/plan.md`'s "AI provider and cost control" section: "Enforce
authenticated-user quotas, rate limits, prompt/request size limits, and
token/cost metadata logging. Log minimal necessary metadata; avoid
retaining prompts by default unless the product later adds an explicit
user-facing history choice."

`log_operation_result` is the single place any caller (a future
endpoint, Task 46/48) should log an `AIOperationResult`. By default it
logs only:

- `operation` (create_scene / edit_scene)
- `timestamp` (UTC, ISO 8601)
- `success` (bool)
- `error_category` (one of `AIErrorCategory`, or `None` on success)
- `prompt_tokens`, `completion_tokens`, `total_tokens`
- `estimated_cost_usd`

It never logs the prompt text, the full scene document (proposed or
resulting), or a provider API key by default — none of those are even
parameters `AIOperationResult`/`AIUsageMetadata` carry (see
`interface.py`), so there is nothing to accidentally include beyond the
one explicit opt-in below.

`retain_prompt=True` is the only way `prompt` is ever included, and it
requires the caller to pass the prompt text explicitly — this function
never reaches into a request object to find it on its own. That keeps
the off-by-default behaviour a caller cannot get wrong by accident, and
gives the "explicit user-facing history choice" `docs/plan.md` mentions
a single, obvious switch to flip later.
"""

from __future__ import annotations

import logging
from datetime import UTC, datetime
from typing import Any

from ai_provider.interface import AIOperationResult

logger = logging.getLogger("ai_provider")


def log_operation_result(
    result: AIOperationResult,
    *,
    retain_prompt: bool = False,
    prompt: str | None = None,
) -> dict[str, Any]:
    """Log (and return) the documented minimal metadata for one AI operation.

    Returns the record that was logged, primarily so tests can assert on
    its exact contents without re-parsing log output.
    """
    record: dict[str, Any] = {
        "operation": result.operation.value,
        "timestamp": datetime.now(UTC).isoformat(),
        "success": result.success,
        "error_category": result.error.category.value if result.error else None,
        "prompt_tokens": result.usage.prompt_tokens,
        "completion_tokens": result.usage.completion_tokens,
        "total_tokens": result.usage.total_tokens,
        "estimated_cost_usd": result.usage.estimated_cost_usd,
    }
    if retain_prompt and prompt is not None:
        record["prompt"] = prompt

    logger.info("ai_provider.operation", extra={"ai_provider": record})
    return record
