#!/usr/bin/env python3
"""Validate the live provider workflow's failure-alert contract.

This is intentionally a static check. It must never execute the live provider
workflow or make a request to Mistral.
"""

from __future__ import annotations

import re
import sys
from pathlib import Path


WORKFLOW_PATH = (
    Path(__file__).resolve().parents[1] / ".github" / "workflows" / "live-provider-3d.yml"
)


def normalized(value: str) -> str:
    return " ".join(value.split())


def job_body(lines: list[str], job_name: str) -> str | None:
    header = f"  {job_name}:"
    try:
        start = lines.index(header)
    except ValueError:
        return None

    end = len(lines)
    for index in range(start + 1, len(lines)):
        if re.fullmatch(r"  [A-Za-z0-9_-]+:", lines[index]):
            end = index
            break
    return "\n".join(lines[start + 1 : end])


def workflow_dispatch_body(lines: list[str]) -> str | None:
    try:
        start = lines.index("  workflow_dispatch:")
    except ValueError:
        return None

    end = len(lines)
    for index in range(start + 1, len(lines)):
        if re.fullmatch(r"  [A-Za-z0-9_-]+:", lines[index]):
            end = index
            break
    return "\n".join(lines[start + 1 : end])


def main() -> int:
    if not WORKFLOW_PATH.is_file():
        print(
            "Live provider alert check failed: "
            f"{WORKFLOW_PATH} is missing.\n"
            "Remediation: restore .github/workflows/live-provider-3d.yml "
            "before changing the provider alert workflow.",
            file=sys.stderr,
        )
        return 1

    text = WORKFLOW_PATH.read_text(encoding="utf-8")
    lines = text.splitlines()
    errors: list[str] = []

    dispatch = workflow_dispatch_body(lines)
    if dispatch is None:
        errors.append(
            "workflow_dispatch must remain available for the quota-free notification probe"
        )
    else:
        if "    notification_probe:" not in dispatch:
            errors.append(
                "workflow_dispatch must define the notification_probe boolean input"
            )
        if (
            "    description: " not in dispatch
            or "without contacting Mistral" not in dispatch
        ):
            errors.append(
                "notification_probe must document that it exercises the alert "
                "without contacting Mistral"
            )
        if "    default: false" not in dispatch:
            errors.append("notification_probe must default to false")
        if "    type: boolean" not in dispatch:
            errors.append("notification_probe must remain a boolean input")

    notifier = job_body(lines, "notify-maintainers")
    if notifier is None:
        errors.append("notify-maintainers job is missing")
    else:
        if not re.search(r"(?m)^    needs:\s*live-provider-3d\s*$", notifier):
            errors.append("notify-maintainers must depend on the live-provider-3d job")

        if_lines = re.findall(r"(?m)^    if:\s*(.+)$", notifier)
        if not if_lines:
            errors.append(
                "notify-maintainers is missing its job-level condition; "
                "restore the explicit failure gate"
            )
        else:
            condition = normalized(if_lines[0])
            expected_condition = (
                "${{ always() && (github.event_name == 'schedule' || "
                "(github.event_name == 'workflow_dispatch' && inputs.notification_probe)) "
                "&& needs.live-provider-3d.result == 'failure' }}"
            )
            if condition != expected_condition:
                errors.append(
                    "notify-maintainers must use the explicit "
                    f"'{expected_condition}' condition so failed jobs are observed, "
                    "scheduled alerts remain restricted, and notification_probe is allowed"
                )

    provider = job_body(lines, "live-provider-3d")
    if provider is None:
        errors.append("live-provider-3d job is missing")
    else:
        probe_variable = "          NOTIFICATION_PROBE: ${{ inputs.notification_probe }}"
        if probe_variable not in provider:
            errors.append(
                "the provider job must pass notification_probe into the setup step"
            )

        probe_gate = 'if [ "$NOTIFICATION_PROBE" = "true" ]; then'
        key_gate = 'if [ -z "$MISTRAL_API_KEY" ]; then'
        probe_position = provider.find(probe_gate)
        key_position = provider.find(key_gate)
        if probe_position < 0 or key_position < 0 or probe_position > key_position:
            errors.append(
                "the notification probe must fail before the Mistral API-key check "
                "and provider smoke command"
            )
        else:
            probe_section = provider[probe_position:key_position]
            if "Mistral requests sent: 0" not in probe_section:
                errors.append(
                    "the notification probe must report that zero Mistral requests were sent"
                )
            if "quota consumed: 0" not in probe_section:
                errors.append(
                    "the notification probe must report zero quota consumption"
                )

    if errors:
        print("Live provider alert contract check failed.", file=sys.stderr)
        for error in errors:
            print(f"- {error}", file=sys.stderr)
        print(
            "Remediation: update .github/workflows/live-provider-3d.yml so the "
            "scheduled failure notifier keeps always(), the schedule/probe guard, "
            "and the quota-free notification probe. This check is static and sent "
            "no requests to Mistral.",
            file=sys.stderr,
        )
        return 1

    print(
        "Live provider alert contract check passed "
        "(always() failure gate, scheduled/probe guard, and quota-free probe verified; "
        "no Mistral requests sent)."
    )
    return 0


if __name__ == "__main__":
    sys.exit(main())
