import os
import subprocess
import textwrap
from pathlib import Path

import pytest

ROOT = Path(__file__).resolve().parents[1]
LAUNCHER = ROOT / "scripts" / "start.sh"


@pytest.fixture
def launcher_doubles(tmp_path):
    bin_dir = tmp_path / "bin"
    bin_dir.mkdir()
    state_file = tmp_path / "startup-state"

    (bin_dir / "uv").write_text(
        textwrap.dedent(
            """\
            #!/usr/bin/env bash
            if [[ "${DJANGO_EXITS_EARLY:-}" == "1" ]]; then
              exit "${DJANGO_EXIT_STATUS:-1}"
            fi
            exec sleep 30
            """
        )
    )
    (bin_dir / "curl").write_text(
        textwrap.dedent(
            """\
            #!/usr/bin/env bash
            count_file="${STATE_FILE}.curl-count"
            count=0
            if [[ -f "$count_file" ]]; then
              count=$(cat "$count_file")
            fi
            count=$((count + 1))
            printf '%s\\n' "$count" > "$count_file"
            if [[ "${HEALTH_AFTER:-0}" != "always" ]] && (( count >= HEALTH_AFTER )); then
              date +%s%N > "${STATE_FILE}.healthy"
              exit 0
            fi
            exit 1
            """
        )
    )
    (bin_dir / "npm").write_text(
        textwrap.dedent(
            """\
            #!/usr/bin/env bash
            date +%s%N > "${STATE_FILE}.vite-started"
            exit 1
            """
        )
    )
    for executable in bin_dir.iterdir():
        executable.chmod(0o755)

    return bin_dir, state_file


def run_launcher(bin_dir, state_file, **extra_env):
    environment = os.environ.copy()
    environment.update(
        {
            "PATH": f"{bin_dir}:{environment['PATH']}",
            "PORT": "5001",
            "STATE_FILE": str(state_file),
        }
    )
    environment.update(extra_env)
    return subprocess.run(
        ["bash", str(LAUNCHER)],
        cwd=ROOT,
        env=environment,
        capture_output=True,
        text=True,
        timeout=10,
    )


def test_replit_uses_repository_launcher_for_startup():
    config = (ROOT / ".replit").read_text()

    assert 'args = "scripts/start.sh"' in config
    assert "bash -c" not in config


def test_launcher_has_publish_and_cleanup_contract():
    launcher = (ROOT / "scripts" / "start.sh").read_text()

    assert "frontend_port=\"${PORT:-5000}\"" in launcher
    assert "runserver 0.0.0.0:8000" in launcher
    assert "npm --prefix frontend run dev" in launcher
    assert "http://127.0.0.1:8000/health/" in launcher
    assert "Django health check passed; starting Vite" in launcher
    assert "startup_deadline" in launcher
    assert "trap cleanup EXIT INT TERM" in launcher
    assert 'wait -n "$django_pid" "$frontend_pid"' in launcher


def test_published_smoke_waits_for_health_before_browser_routes():
    smoke = (ROOT / "scripts" / "smoke-published.sh").read_text()

    assert "health_deadline" in smoke
    assert "probe_health" in smoke
    assert smoke.index("probe_health; then") < smoke.index('"$published_url/"')
    assert 'probe "/api/whoami/" "401"' in smoke
    assert 'probe "/accounts/login/" "200"' in smoke


def test_launcher_starts_vite_only_after_delayed_django_health(launcher_doubles):
    bin_dir, state_file = launcher_doubles

    result = run_launcher(
        bin_dir,
        state_file,
        HEALTH_AFTER="3",
        STARTUP_TIMEOUT_SECONDS="5",
    )

    assert result.returncode == 1
    healthy_at = int((state_file.parent / "startup-state.healthy").read_text())
    vite_started_at = int((state_file.parent / "startup-state.vite-started").read_text())
    assert healthy_at <= vite_started_at
    assert int((state_file.parent / "startup-state.curl-count").read_text()) >= 3
    assert "Django health check passed; starting Vite" in result.stdout


def test_launcher_exits_when_django_health_times_out(launcher_doubles):
    bin_dir, state_file = launcher_doubles

    result = run_launcher(
        bin_dir,
        state_file,
        HEALTH_AFTER="always",
        STARTUP_TIMEOUT_SECONDS="1",
    )

    assert result.returncode == 1
    assert "Django did not become healthy within 1 seconds" in result.stderr
    assert not (state_file.parent / "startup-state.vite-started").exists()


def test_launcher_reports_django_exit_before_starting_vite(launcher_doubles):
    bin_dir, state_file = launcher_doubles

    result = run_launcher(
        bin_dir,
        state_file,
        DJANGO_EXITS_EARLY="1",
        DJANGO_EXIT_STATUS="7",
        HEALTH_AFTER="always",
        STARTUP_TIMEOUT_SECONDS="5",
    )

    assert result.returncode != 0
    assert "Django exited before becoming healthy (status 7)" in result.stderr
    assert not (state_file.parent / "startup-state.vite-started").exists()
