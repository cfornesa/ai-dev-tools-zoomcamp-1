import importlib.util
import shutil
import subprocess
from pathlib import Path
from types import ModuleType

import pytest

ROOT = Path(__file__).resolve().parents[2]
SCRIPT = ROOT / "scripts" / "check-github-action-pins.py"
HOOK = ROOT / ".githooks" / "pre-commit"
MAKEFILE = ROOT / "Makefile"


def load_pin_checker() -> ModuleType:
    spec = importlib.util.spec_from_file_location("check_github_action_pins", SCRIPT)
    assert spec is not None
    assert spec.loader is not None
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module


PIN_CHECKER = load_pin_checker()


def test_pre_commit_hook_delegates_to_pin_check_target():
    hook = HOOK.read_text()

    assert "exec make check-github-action-pins" in hook
    assert "check-github-action-pins.py" not in hook


def test_git_safe_push_requires_pin_check():
    makefile = MAKEFILE.read_text()
    target_line = next(line for line in makefile.splitlines() if line.startswith("git-safe-push:"))

    assert "check-github-action-pins" in target_line.partition(":")[2].split()


def test_install_git_hooks_activates_versioned_hook_directory():
    makefile = MAKEFILE.read_text()
    lines = makefile.splitlines()
    target_index = lines.index("install-git-hooks:")
    recipe = []

    for line in lines[target_index + 1 :]:
        if line and not line.startswith("\t"):
            break
        if line.startswith("\t"):
            recipe.append(line.removeprefix("\t"))

    assert recipe[0] == "git config core.hooksPath .githooks"


def test_installed_pre_commit_hook_runs_pin_check_in_disposable_checkout(
    tmp_path: Path,
):
    checkout = tmp_path / "checkout"
    checkout.mkdir()
    (checkout / ".githooks").mkdir()
    (checkout / "scripts").mkdir()
    (checkout / ".github" / "workflows").mkdir(parents=True)

    shutil.copy2(HOOK, checkout / ".githooks" / "pre-commit")
    shutil.copy2(MAKEFILE, checkout / "Makefile")
    shutil.copy2(SCRIPT, checkout / "scripts" / SCRIPT.name)
    (checkout / ".github" / "workflows" / "pinned.yml").write_text(
        """\
name: Pinned
on: workflow_dispatch
jobs:
  verify:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@0123456789abcdef0123456789abcdef01234567 # v4
"""
    )

    subprocess.run(["git", "init"], cwd=checkout, check=True, capture_output=True, text=True)
    subprocess.run(
        ["make", "install-git-hooks"],
        cwd=checkout,
        check=True,
        capture_output=True,
        text=True,
    )

    hooks_path = subprocess.run(
        ["git", "config", "--get", "core.hooksPath"],
        cwd=checkout,
        check=True,
        capture_output=True,
        text=True,
    )
    assert hooks_path.stdout.strip() == ".githooks"

    subprocess.run(["git", "add", "."], cwd=checkout, check=True, capture_output=True, text=True)
    commit = subprocess.run(
        [
            "git",
            "-c",
            "user.name=Hook Integration Test",
            "-c",
            "user.email=hook-integration-test@example.invalid",
            "commit",
            "-m",
            "exercise installed hook",
        ],
        cwd=checkout,
        check=True,
        capture_output=True,
        text=True,
    )

    hook_output = commit.stdout + commit.stderr
    assert "python scripts/check-github-action-pins.py" in hook_output
    assert "GitHub Action pin check passed (1 workflow files scanned)." in hook_output


@pytest.fixture
def workflows_dir(tmp_path: Path) -> Path:
    directory = tmp_path / ".github" / "workflows"
    directory.mkdir(parents=True)
    return directory


def write_workflow(workflows_dir: Path, name: str, content: str) -> None:
    path = workflows_dir / name
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(content)


def test_full_commit_pins_with_release_comments_are_allowed(workflows_dir: Path):
    write_workflow(
        workflows_dir,
        "pinned.yml",
        """\
name: Pinned
on: workflow_dispatch
jobs:
  verify:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@0123456789abcdef0123456789abcdef01234567 # v4
      - uses: astral-sh/setup-uv@ABCDEF0123456789ABCDEF0123456789ABCDEF01 # v7.1.0
""",
    )

    assert PIN_CHECKER.find_unpinned_actions(workflows_dir) == []


def test_mutable_refs_and_missing_refs_report_file_and_line_diagnostics(
    workflows_dir: Path,
):
    write_workflow(
        workflows_dir,
        "new.yaml",
        """\
name: Mutable references
on: workflow_dispatch
jobs:
  verify:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-python@main
      - uses: actions/cache
""",
    )

    errors = PIN_CHECKER.find_unpinned_actions(workflows_dir)

    assert errors == [
        ".github/workflows/new.yaml:7: actions/checkout@v4 must use a full 40-character commit SHA",
        ".github/workflows/new.yaml:8: actions/setup-python@main "
        "must use a full 40-character commit SHA",
        ".github/workflows/new.yaml:9: actions/cache@<missing ref> "
        "must use a full 40-character commit SHA",
    ]


def test_local_actions_and_uses_like_text_in_run_blocks_are_allowed(workflows_dir: Path):
    write_workflow(
        workflows_dir,
        "local-actions.yml",
        """\
name: Local actions
on: workflow_dispatch
jobs:
  verify:
    runs-on: ubuntu-latest
    steps:
      - uses: ./.github/actions/check
      - run: |
          echo "uses: example/action@v4"
          uses: another/action@main
      - run: >
          echo "uses: folded/action@v1"
""",
    )

    assert PIN_CHECKER.find_unpinned_actions(workflows_dir) == []
