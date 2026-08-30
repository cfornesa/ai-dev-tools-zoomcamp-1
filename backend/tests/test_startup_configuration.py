import os
import subprocess
import textwrap
from pathlib import Path

import pytest

ROOT = Path(__file__).resolve().parents[2]
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
            printf '%s\\n' "$*" > "${STATE_FILE}.npm-args"
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


def test_replit_deployment_run_uses_the_production_wrapper_not_the_dev_server():
    """Issue #133: the deployed process must not run Vite's dev server (with
    its live HMR WebSocket, the "editor reloads at random" root cause) --
    `[deployment].run` delegates to a dedicated wrapper script instead of
    running scripts/start.sh directly, so it can select preview mode without
    reintroducing an inline `bash -c` (see the test above)."""
    config = (ROOT / ".replit").read_text()
    deployment_run = next(line for line in config.splitlines() if line.startswith("run ="))

    assert "scripts/start-production.sh" in deployment_run
    assert "bash -c" not in deployment_run


def test_production_wrapper_selects_preview_mode_via_the_shared_launcher():
    wrapper = (ROOT / "scripts" / "start-production.sh").read_text()

    assert "FRONTEND_SERVE_MODE=preview" in wrapper
    assert 'exec "$(dirname "${BASH_SOURCE[0]}")/start.sh"' in wrapper


def test_launcher_runs_vite_preview_against_the_built_frontend_in_preview_mode():
    launcher = (ROOT / "scripts" / "start.sh").read_text()

    assert "npm --prefix frontend run preview" in launcher
    assert 'frontend_serve_mode="${FRONTEND_SERVE_MODE:-dev}"' in launcher


def test_deployment_build_does_not_run_django_migrations():
    config = (ROOT / ".replit").read_text()
    deployment_build = next(line for line in config.splitlines() if line.startswith("build ="))

    assert "python manage.py migrate" not in deployment_build
    assert "python manage.py check --deploy" in deployment_build


def test_launcher_has_publish_and_cleanup_contract():
    launcher = (ROOT / "scripts" / "start.sh").read_text()

    assert "frontend_port=\"${PORT:-5000}\"" in launcher
    assert "runserver 0.0.0.0:8000" in launcher
    assert "npm --prefix frontend run dev" in launcher
    assert "http://127.0.0.1:8000/health/" in launcher
    assert "Django health check passed; starting Vite" in launcher
    assert "startup_deadline" in launcher
    assert "trap cleanup EXIT INT TERM" in launcher
    assert "wait -n" not in launcher
    assert 'wait "$django_pid"' in launcher
    assert 'wait "$frontend_pid"' in launcher
    assert "RUN_MIGRATIONS_ON_START" in launcher


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


def test_launcher_runs_the_dev_server_by_default(launcher_doubles):
    bin_dir, state_file = launcher_doubles

    run_launcher(bin_dir, state_file, HEALTH_AFTER="1", STARTUP_TIMEOUT_SECONDS="5")

    npm_args = (state_file.parent / "startup-state.npm-args").read_text()
    assert "run dev" in npm_args
    assert "run preview" not in npm_args


def test_launcher_runs_vite_preview_when_frontend_serve_mode_is_preview(launcher_doubles):
    bin_dir, state_file = launcher_doubles

    run_launcher(
        bin_dir,
        state_file,
        FRONTEND_SERVE_MODE="preview",
        HEALTH_AFTER="1",
        STARTUP_TIMEOUT_SECONDS="5",
    )

    npm_args = (state_file.parent / "startup-state.npm-args").read_text()
    assert "run preview" in npm_args
    assert "run dev" not in npm_args


def test_launcher_rejects_an_invalid_frontend_serve_mode(launcher_doubles):
    bin_dir, state_file = launcher_doubles

    result = run_launcher(
        bin_dir,
        state_file,
        FRONTEND_SERVE_MODE="bogus",
        HEALTH_AFTER="1",
        STARTUP_TIMEOUT_SECONDS="5",
    )

    assert result.returncode == 2
    assert "Invalid FRONTEND_SERVE_MODE: bogus" in result.stderr
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
