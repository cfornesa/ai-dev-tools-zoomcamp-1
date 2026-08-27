from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]


def test_browser_qa_owns_disposable_stack_and_identity_probes():
    script = (ROOT / "scripts" / "browser-qa.sh").read_text()

    assert "docker run --rm -d" in script
    assert "docker rm -f" in script
    assert 'uv run --env-file "$ENV_FILE" python manage.py migrate' in script
    assert 'runserver 0.0.0.0:"$BACKEND_PORT"' in script
    assert 'npm run dev -- --host 0.0.0.0 --port "$FRONTEND_PORT"' in script
    assert 'BROWSER_QA_BACKEND_URL="http://127.0.0.1:$BACKEND_PORT"' in script
    assert '"status"[[:space:]]*:[[:space:]]*"ok"' in script
    assert "whoami_status" in script
    assert 'E2E_ENV_FILE="$ENV_FILE"' in script
    assert 'for candidate in {5000..5099}' in script
    assert "npx playwright test e2e/layersPanel.spec.ts" in script
    assert "trap cleanup EXIT INT TERM" in script


def test_browser_qa_does_not_reuse_developer_env_or_database():
    script = (ROOT / "scripts" / "browser-qa.sh").read_text()

    assert 'ENV_FILE="$WORK_DIR/.env"' in script
    assert "creatrweb_browser_qa" in script
    assert "source .env" not in script


def test_vite_proxy_allows_browser_qa_to_avoid_an_occupied_backend_port():
    config = (ROOT / "frontend" / "vite.config.ts").read_text()

    assert "process.env.BROWSER_QA_BACKEND_URL" in config
    assert "backendProxyTarget" in config
    assert "target: backendProxyTarget" in config


def test_playwright_fixture_hooks_accept_the_disposable_environment_file():
    for name in ("global-setup.ts", "global-teardown.ts"):
        hook = (ROOT / "frontend" / "e2e" / "support" / name).read_text()
        assert "process.env.E2E_ENV_FILE" in hook
        assert "['--env-file', configuredEnvFile]" in hook


def test_browser_qa_is_available_from_the_frontend_working_directory():
    makefile = (ROOT / "frontend" / "Makefile").read_text()

    assert "browser-qa:" in makefile
    assert "$(MAKE) -C .. browser-qa" in makefile
