from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]


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