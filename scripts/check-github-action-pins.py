#!/usr/bin/env python3
"""Ensure external GitHub Actions are pinned to immutable commit SHAs."""

from __future__ import annotations

import re
import sys
from pathlib import Path


WORKFLOWS_DIR = Path(__file__).resolve().parents[1] / ".github" / "workflows"
COMMIT_SHA = re.compile(r"^[0-9a-fA-F]{40}$")
USES_LINE = re.compile(
    r"^(?P<indent>\s*)(?:-\s+)?uses:\s*(?P<value>.+?)\s*$"
)
BLOCK_SCALAR_LINE = re.compile(
    r"^\s*(?:-\s+)?run:\s*[|>][-+]?(?:\d+)?\s*(?:#.*)?$"
)


def workflow_files(workflows_dir: Path) -> list[Path]:
    """Return all YAML workflow files, including files added later."""

    if not workflows_dir.is_dir():
        return []
    return sorted(
        path
        for path in workflows_dir.rglob("*")
        if path.is_file() and path.suffix.lower() in {".yml", ".yaml"}
    )


def action_reference(value: str) -> tuple[str, str] | None:
    """Extract an external action name and ref from a YAML scalar."""

    # A trailing comment documents the release label; it is not part of the
    # action reference and must not make an otherwise valid pin fail.
    value = value.split(" #", 1)[0].strip().strip("\"'")
    if value.startswith("./"):
        return None
    if "@" not in value:
        return value, ""
    name, ref = value.rsplit("@", 1)
    return name, ref


def find_unpinned_actions(workflows_dir: Path) -> list[str]:
    """Find external action references that do not use a full commit SHA."""

    errors: list[str] = []
    for path in workflow_files(workflows_dir):
        relative_path = path.relative_to(workflows_dir.parent.parent)
        block_indent: int | None = None
        for line_number, line in enumerate(
            path.read_text(encoding="utf-8").splitlines(), start=1
        ):
            if block_indent is not None:
                if not line.strip():
                    continue
                indent = len(line) - len(line.lstrip())
                if indent > block_indent:
                    continue
                block_indent = None

            if BLOCK_SCALAR_LINE.match(line):
                block_indent = len(line) - len(line.lstrip())
                continue

            match = USES_LINE.match(line)
            if not match:
                continue

            reference = action_reference(match.group("value"))
            if reference is None:
                continue
            action, ref = reference
            if not COMMIT_SHA.fullmatch(ref):
                errors.append(
                    f"{relative_path}:{line_number}: "
                    f"{action or '<missing action>'}@{ref or '<missing ref>'} "
                    "must use a full 40-character commit SHA"
                )
    return errors


def main() -> int:
    if not WORKFLOWS_DIR.is_dir():
        print(
            f"GitHub Action pin check failed: {WORKFLOWS_DIR} is missing.",
            file=sys.stderr,
        )
        return 1

    errors = find_unpinned_actions(WORKFLOWS_DIR)
    if errors:
        print("GitHub Action pin check failed.", file=sys.stderr)
        for error in errors:
            print(f"- {error}", file=sys.stderr)
        print(
            "Remediation: replace each mutable release tag or branch with the "
            "resolved 40-character commit SHA and keep the release label in a "
            "trailing comment.",
            file=sys.stderr,
        )
        return 1

    count = len(
        [
            path
            for path in workflow_files(WORKFLOWS_DIR)
            if path.is_file()
        ]
    )
    print(f"GitHub Action pin check passed ({count} workflow files scanned).")
    return 0


if __name__ == "__main__":
    sys.exit(main())