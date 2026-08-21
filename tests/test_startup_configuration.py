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
    assert "trap cleanup EXIT INT TERM" in launcher
    assert 'wait -n "$django_pid" "$frontend_pid"' in launcher