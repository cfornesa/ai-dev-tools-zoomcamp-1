import os
import signal
import subprocess
import textwrap
import time
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
            echo $$ > "${STATE_FILE}.django-pid"
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
            if [[ "${VITE_SLEEP:-}" == "1" ]]; then
              echo $$ > "${STATE_FILE}.frontend-pid"
              exec sleep 30
            fi
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
            "RUN_MIGRATIONS_ON_START": "false",
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
    assert "RUN_MIGRATIONS_ON_START=false" in wrapper
    assert 'exec "$(dirname "${BASH_SOURCE[0]}")/start.sh"' in wrapper
    assert "BACKEND_SERVE_MODE=asgi" in wrapper


def test_production_launcher_uses_pinned_asgi_server():
    launcher = (ROOT / "scripts" / "start.sh").read_text()

    assert 'backend_serve_mode="${BACKEND_SERVE_MODE:-dev}"' in launcher
    assert "uv run --with 'uvicorn==0.46.0' uvicorn backend.main:app" in launcher
    assert "--host 0.0.0.0 --port 8000" in launcher
    assert "manage.py runserver" in launcher


def test_launcher_rejects_invalid_backend_serve_mode(launcher_doubles):
    bin_dir, state_file = launcher_doubles

    result = run_launcher(
        bin_dir,
        state_file,
        BACKEND_SERVE_MODE="bogus",
        HEALTH_AFTER="1",
        STARTUP_TIMEOUT_SECONDS="5",
    )

    assert result.returncode == 2
    assert "Invalid BACKEND_SERVE_MODE: bogus" in result.stderr


def test_production_environment_disables_runtime_migrations():
    config = (ROOT / ".replit").read_text()
    production = config.split("[userenv.production]", 1)[1].split("[workflows]", 1)[0]

    assert 'RUN_MIGRATIONS_ON_START = "false"' in production


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


def test_ci_runs_published_smoke_against_an_isolated_published_like_runtime():
    workflow = (ROOT / ".github" / "workflows" / "ci.yml").read_text()
    job = workflow.split("  published-routing-disposable:", 1)[1].split(
        "  hosted-git-safe-push:", 1
    )[0]

    assert "github.event_name != 'deployment_status'" in job
    assert "services:" in job
    assert "POSTGRES_DB: creatrweb_published_smoke" in job
    assert "creatrweb_published_smoke" in job
    assert "scripts/start-production.sh" in job
    assert "FRONTEND_SERVE_MODE: preview" in job
    assert "RUN_MIGRATIONS_ON_START: \"false\"" in job
    assert "uv run python manage.py migrate --noinput" in job
    assert "PUBLISHED_APP_URL: http://127.0.0.1:5000" in job
    assert "run: scripts/smoke-published.sh" in job
    assert "environment_url" not in job
    assert "target_url" not in job


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


def test_launcher_terminates_children_and_leaves_no_orphans_on_sigterm(launcher_doubles):
    """Issue #415: the published deployment process must not leave orphaned
    Django/Vite children behind when the platform sends SIGTERM (a normal
    autoscale stop/restart) -- this is exactly `scripts/start.sh`'s own
    `cleanup()` trap contract, reproduced here against the real script and
    real (short-lived, doubled) child processes rather than asserted from
    source text alone, since sending a live signal to shared production is
    explicitly out of scope for this repository's own verification policy.
    """
    bin_dir, state_file = launcher_doubles
    environment = os.environ.copy()
    environment.update(
        {
            "PATH": f"{bin_dir}:{environment['PATH']}",
            "PORT": "5001",
            "STATE_FILE": str(state_file),
            "RUN_MIGRATIONS_ON_START": "false",
            "HEALTH_AFTER": "1",
            "STARTUP_TIMEOUT_SECONDS": "5",
            "VITE_SLEEP": "1",
        }
    )

    process = subprocess.Popen(
        ["bash", str(LAUNCHER)],
        cwd=ROOT,
        env=environment,
        stdout=subprocess.PIPE,
        stderr=subprocess.PIPE,
        text=True,
    )
    try:
        django_pid_file = state_file.parent / "startup-state.django-pid"
        frontend_pid_file = state_file.parent / "startup-state.frontend-pid"
        deadline = time.monotonic() + 10
        while time.monotonic() < deadline and not frontend_pid_file.exists():
            time.sleep(0.1)
        assert django_pid_file.exists(), "Django double never recorded its pid"
        assert frontend_pid_file.exists(), "Vite double never recorded its pid"

        django_pid = int(django_pid_file.read_text().strip())
        frontend_pid = int(frontend_pid_file.read_text().strip())

        def alive(pid: int) -> bool:
            try:
                os.kill(pid, 0)
            except OSError:
                return False
            return True

        assert alive(django_pid), "Django double exited before it could be signaled"
        assert alive(frontend_pid), "Vite double exited before it could be signaled"

        process.send_signal(signal.SIGTERM)
        process.wait(timeout=10)

        deadline = time.monotonic() + 5
        while time.monotonic() < deadline and (alive(django_pid) or alive(frontend_pid)):
            time.sleep(0.1)

        assert not alive(django_pid), (
            "Django child survived the launcher's SIGTERM cleanup -- an orphaned process"
        )
        assert not alive(frontend_pid), (
            "Vite child survived the launcher's SIGTERM cleanup -- an orphaned process"
        )
    finally:
        if process.poll() is None:
            process.kill()
            process.wait()
