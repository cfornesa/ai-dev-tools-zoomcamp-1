import os
import shutil
import subprocess
from pathlib import Path

import pytest

ROOT = Path(__file__).resolve().parents[1]
SCRIPT = ROOT / "scripts" / "git-safe-push.sh"


def run(command: list[str], cwd: Path, **env: str) -> subprocess.CompletedProcess[str]:
    environment = os.environ.copy()
    environment.update(env)
    return subprocess.run(command, cwd=cwd, env=environment, text=True, capture_output=True)


def git(cwd: Path, *args: str) -> None:
    result = run(["git", *args], cwd)
    assert result.returncode == 0, result.stderr


@pytest.fixture
def git_repositories(tmp_path: Path) -> tuple[Path, Path]:
    local = tmp_path / "local"
    bare = tmp_path / "remote.git"
    local.mkdir()
    run(["git", "init", "--bare", str(bare)], tmp_path).check_returncode()
    run(["git", "init", "-b", "main", str(local)], tmp_path).check_returncode()
    git(local, "config", "user.email", "test@example.com")
    git(local, "config", "user.name", "Test User")
    (local / "state").write_text("one\n")
    git(local, "add", "state")
    git(local, "commit", "-m", "one")
    git(local, "remote", "add", "origin", str(bare))
    git(local, "push", "-u", "origin", "main")
    return local, bare


def invoke(local: Path, **env: str) -> subprocess.CompletedProcess[str]:
    return run(["bash", str(SCRIPT)], local, **env)


def test_equal_refs_are_a_success(git_repositories):
    local, _ = git_repositories
    result = invoke(local, GIT_URL="https://user:super-secret@example.test/repo.git")
    assert result.returncode == 0
    assert "already up to date" in result.stdout
    output = result.stdout + result.stderr
    assert "super-secret" not in output


def test_fetch_refreshes_stale_remote_and_fast_forwards(git_repositories):
    local, bare = git_repositories
    second = local.parent / "second"
    run(["git", "clone", "--branch", "main", str(bare), str(second)], local.parent).check_returncode()
    git(second, "config", "user.email", "test@example.com")
    git(second, "config", "user.name", "Test User")
    (second / "state").write_text("remote\n")
    git(second, "add", "state")
    git(second, "commit", "-am", "remote")
    git(second, "push", "origin", "main")
    (local / "state").write_text("local\n")
    git(local, "commit", "-am", "local")

    result = invoke(local)
    assert result.returncode != 0
    assert "diverged" in result.stderr


def test_local_ahead_is_fast_forwarded(git_repositories):
    local, bare = git_repositories
    (local / "state").write_text("local\n")
    git(local, "commit", "-am", "local")
    result = invoke(local)
    assert result.returncode == 0
    assert "fast-forwarded" in result.stdout
    assert (
        run(["git", "--git-dir", str(bare), "rev-parse", "refs/heads/main"], local).stdout
        == run(["git", "rev-parse", "HEAD"], local).stdout
    )


def test_push_uses_ephemeral_helper_with_git_url(git_repositories, tmp_path: Path):
    local, _ = git_repositories
    (local / "state").write_text("local\n")
    git(local, "commit", "-am", "local")
    fake_bin = tmp_path / "bin"
    fake_bin.mkdir()
    capture = tmp_path / "credential-output"
    real_git = shutil.which("git")
    assert real_git is not None
    (fake_bin / "git").write_text(
        f"""#!/usr/bin/env bash
for argument in "$@"; do
  if [[ "$argument" == credential.helper=!* ]]; then
    helper="${{argument#credential.helper=!}}"
    "$helper" get > "{capture}"
  fi
done
exec {real_git} "$@"
"""
    )
    (fake_bin / "git").chmod(0o755)
    result = run(
        ["bash", str(SCRIPT)],
        local,
        PATH=f"{fake_bin}:{os.environ['PATH']}",
        GIT_URL="https://helper-user:helper-secret@example.test/repo.git",
    )
    assert result.returncode == 0
    assert capture.read_text().splitlines() == [
        "username=helper-user",
        "password=helper-secret",
    ]
    assert "helper-secret" not in (result.stdout + result.stderr)


def test_remote_ahead_is_rejected_distinctly(git_repositories):
    local, bare = git_repositories
    second = local.parent / "second"
    run(["git", "clone", "--branch", "main", str(bare), str(second)], local.parent).check_returncode()
    git(second, "config", "user.email", "test@example.com")
    git(second, "config", "user.name", "Test User")
    (second / "state").write_text("remote\n")
    git(second, "add", "state")
    git(second, "commit", "-am", "remote")
    git(second, "push", "origin", "main")
    result = invoke(local)
    assert result.returncode != 0
    assert "ahead of this checkout" in result.stderr
    assert "force-push" not in result.stderr


def test_authentication_failure_is_not_reported_as_divergence(tmp_path: Path):
    local = tmp_path / "local"
    local.mkdir()
    run(["git", "init", "-b", "main", str(local)], tmp_path).check_returncode()
    git(local, "config", "user.email", "test@example.com")
    git(local, "config", "user.name", "Test User")
    (local / "state").write_text("one\n")
    git(local, "add", "state")
    git(local, "commit", "-m", "one")
    git(local, "remote", "add", "origin", str(tmp_path / "remote.git"))
    fake_bin = tmp_path / "bin"
    fake_bin.mkdir()
    real_git = shutil.which("git")
    assert real_git is not None
    (fake_bin / "git").write_text(
        f"""#!/usr/bin/env bash
if [[ "$*" == *" fetch "* ]]; then
  printf 'remote: invalid username or password\\n' >&2
  exit 128
fi
exec {real_git} "$@"
"""
    )
    (fake_bin / "git").chmod(0o755)
    result = run(
        ["bash", str(SCRIPT)],
        local,
        PATH=f"{fake_bin}:{os.environ['PATH']}",
        GIT_URL="https://user:super-secret@invalid.example/repo.git",
    )
    assert result.returncode != 0
    assert "authentication/authorization" in result.stderr
    assert "diverged" not in result.stderr
    output = result.stdout + result.stderr
    assert "super-secret" not in output
