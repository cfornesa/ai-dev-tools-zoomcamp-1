import base64
import os
import shutil
import subprocess
import threading
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from urllib.parse import urlsplit

import pytest

ROOT = Path(__file__).resolve().parents[1]
SCRIPT = ROOT / "scripts" / "git-safe-push.sh"
HOSTED_SCRIPT = ROOT / "scripts" / "smoke-hosted-git.sh"


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


def test_hosted_smoke_is_opt_in(tmp_path: Path):
    result = run(
        ["bash", str(HOSTED_SCRIPT)],
        tmp_path,
        HOSTED_GIT_SMOKE="0",
        GIT_URL="https://user:super-secret@example.test/repo.git",
    )
    assert result.returncode == 0
    assert "SKIP" in result.stdout
    assert "super-secret" not in result.stdout + result.stderr


class _AuthenticatedGitHandler(BaseHTTPRequestHandler):
    server_version = "TestGitHTTP/1.0"

    def _serve_git(self) -> None:
        expected = "Basic " + base64.b64encode(b"race-user:race-secret").decode()
        if self.headers.get("Authorization") != expected:
            self.send_response(401)
            self.send_header("WWW-Authenticate", 'Basic realm="test-git"')
            self.end_headers()
            return

        parsed = urlsplit(self.path)
        content_length = int(self.headers.get("Content-Length", "0"))
        body = self.rfile.read(content_length) if content_length else b""
        git_backend = (
            subprocess.run(
                ["git", "--exec-path"],
                check=True,
                capture_output=True,
                text=True,
            ).stdout.strip()
            + "/git-http-backend"
        )
        environment = os.environ.copy()
        environment.update(
            GIT_PROJECT_ROOT=str(self.server.repository_root),
            GIT_HTTP_EXPORT_ALL="1",
            PATH_INFO=parsed.path,
            QUERY_STRING=parsed.query,
            REQUEST_METHOD=self.command,
            CONTENT_TYPE=self.headers.get("Content-Type", ""),
            CONTENT_LENGTH=str(content_length),
            REMOTE_USER="race-user",
        )
        result = subprocess.run(
            [git_backend],
            input=body,
            capture_output=True,
            env=environment,
            check=False,
        )
        headers, separator, response_body = result.stdout.partition(b"\r\n\r\n")
        if not separator:
            self.send_error(502, result.stderr.decode(errors="replace"))
            return
        response_headers = headers.split(b"\r\n")
        status = next(
            (header for header in response_headers if header.startswith(b"Status: ")),
            b"Status: 200 OK",
        )
        self.send_response(int(status.split()[1]))
        for header in response_headers:
            if b": " not in header or header.startswith(b"Status: "):
                continue
            name, value = header.split(b": ", 1)
            self.send_header(name.decode(), value.decode())
        self.end_headers()
        self.wfile.write(response_body)

    do_GET = _serve_git
    do_POST = _serve_git

    def log_message(self, *_args: object) -> None:
        return


@pytest.fixture
def authenticated_git_remote(git_repositories):
    local, bare = git_repositories

    class Server(ThreadingHTTPServer):
        allow_reuse_address = True

    server = Server(("127.0.0.1", 0), _AuthenticatedGitHandler)
    server.repository_root = bare.parent
    thread = threading.Thread(target=server.serve_forever, daemon=True)
    thread.start()
    remote_url = f"http://127.0.0.1:{server.server_port}/remote.git"
    yield local, remote_url, bare
    server.shutdown()
    thread.join()
    server.server_close()


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
    run(
        ["git", "clone", "--branch", "main", str(bare), str(second)], local.parent
    ).check_returncode()
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


def test_remote_update_during_push_is_rejected_without_overwrite(git_repositories, tmp_path: Path):
    local, bare = git_repositories
    second = local.parent / "second"
    run(
        ["git", "clone", "--branch", "main", str(bare), str(second)], local.parent
    ).check_returncode()
    git(second, "config", "user.email", "test@example.com")
    git(second, "config", "user.name", "Test User")
    (second / "state").write_text("remote\n")
    git(second, "commit", "-am", "remote")
    remote_commit = run(["git", "rev-parse", "HEAD"], second).stdout.strip()

    (local / "state").write_text("local\n")
    git(local, "commit", "-am", "local")
    local_commit = run(["git", "rev-parse", "HEAD"], local).stdout.strip()

    fake_bin = tmp_path / "bin"
    fake_bin.mkdir()
    real_git = shutil.which("git")
    assert real_git is not None
    (fake_bin / "git").write_text(
        f"""#!/usr/bin/env bash
for argument in "$@"; do
  if [[ "$argument" == "push" ]]; then
    "{real_git}" -C "$RACE_REPOSITORY" push origin main
    break
  fi
done
exec "{real_git}" "$@"
"""
    )
    (fake_bin / "git").chmod(0o755)

    result = run(
        ["bash", str(SCRIPT)],
        local,
        PATH=f"{fake_bin}:{os.environ['PATH']}",
        RACE_REPOSITORY=str(second),
    )

    assert result.returncode != 0
    assert "safe fast-forward push failed" in result.stderr
    remote_tip = run(["git", "--git-dir", str(bare), "rev-parse", "refs/heads/main"], local)
    assert remote_tip.stdout.strip() == remote_commit
    assert remote_tip.stdout.strip() != local_commit


def test_authenticated_remote_update_during_push_is_rejected_without_overwrite(
    authenticated_git_remote, tmp_path: Path
):
    local, remote_url, bare = authenticated_git_remote
    second = local.parent / "second-authenticated"
    run(
        ["git", "clone", "--branch", "main", str(bare), str(second)], local.parent
    ).check_returncode()
    git(second, "config", "user.email", "test@example.com")
    git(second, "config", "user.name", "Test User")
    git(
        second,
        "remote",
        "set-url",
        "origin",
        remote_url.replace("http://", "http://race-user:race-secret@"),
    )
    (second / "state").write_text("remote-authenticated\n")
    git(second, "commit", "-am", "remote authenticated")
    remote_commit = run(["git", "rev-parse", "HEAD"], second).stdout.strip()

    (local / "state").write_text("local-authenticated\n")
    git(local, "commit", "-am", "local authenticated")
    local_commit = run(["git", "rev-parse", "HEAD"], local).stdout.strip()
    git(local, "remote", "set-url", "origin", remote_url)

    fake_bin = tmp_path / "bin"
    fake_bin.mkdir()
    real_git = shutil.which("git")
    assert real_git is not None
    (fake_bin / "git").write_text(
        f"""#!/usr/bin/env bash
for argument in "$@"; do
  if [[ "$argument" == "push" ]]; then
    "{real_git}" -C "$RACE_REPOSITORY" push origin main
    break
  fi
done
exec "{real_git}" "$@"
"""
    )
    (fake_bin / "git").chmod(0o755)

    result = run(
        ["bash", str(SCRIPT)],
        local,
        PATH=f"{fake_bin}:{os.environ['PATH']}",
        GIT_URL="https://race-user:race-secret@example.test/repo.git",
        RACE_REPOSITORY=str(second),
    )

    assert result.returncode != 0
    assert "safe fast-forward push failed" in result.stderr
    remote_tip = run(["git", "--git-dir", str(bare), "rev-parse", "refs/heads/main"], local)
    assert remote_tip.stdout.strip() == remote_commit
    assert remote_tip.stdout.strip() != local_commit
    assert "race-secret" not in result.stdout + result.stderr


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
    run(
        ["git", "clone", "--branch", "main", str(bare), str(second)], local.parent
    ).check_returncode()
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
