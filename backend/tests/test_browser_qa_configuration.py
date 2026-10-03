from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]


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
    assert "export E2E_FIXTURE_ENVIRONMENT=disposable-local" in script
    assert 'for candidate in {5000..5099}' in script
    assert "npx playwright test e2e/layersPanel.spec.ts" in script
    assert 'E2E_SPEC="${BROWSER_QA_E2E_SPEC:-}"' in script
    assert 'npx playwright test "$E2E_SPEC"' in script
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
        assert "runFixtureCommand" in hook
        assert "configuredEnvFile" not in hook

    resolver = (ROOT / "frontend" / "e2e" / "support" / "fixtureCommand.ts").read_text()
    assert "process.env.E2E_ENV_FILE" in resolver
    assert "process.env.E2E_FIXTURE_ENVIRONMENT" in resolver
    assert "['run', '--env-file', target.envFile" in resolver
    assert "backend/.env is never selected implicitly" in resolver


def test_playwright_disclosure_helper_handles_nested_closed_panels():
    helper = (ROOT / "frontend" / "e2e" / "support" / "expandCollapsibleSections.ts").read_text()

    assert "editor-panel-disclosure-toggle:visible" in helper
    assert "editor-collapsible-section-toggle:visible" in helper
    assert "panelContent" in helper
    assert "contentId" in helper


def test_browser_qa_is_available_from_the_frontend_working_directory():
    makefile = (ROOT / "frontend" / "Makefile").read_text()

    assert "browser-qa:" in makefile
    assert "$(MAKE) -C .. browser-qa" in makefile


def test_compose_preflight_cannot_be_redirected_to_another_project_or_file():
    script = (ROOT / "scripts" / "compose-preflight.sh").read_text()

    assert 'expected_project="ai-dev-tools-zoomcamp-1"' in script
    assert 'compose_file="$repo_root/compose.yaml"' in script
    assert 'COMPOSE_PROJECT_NAME must be' in script
    assert 'COMPOSE_FILE must resolve to this repository' in script


def test_ci_runs_the_full_browser_acceptance_suite_and_uploads_diagnostics():
    workflow = (ROOT / ".github" / "workflows" / "ci.yml").read_text()

    assert "e2e-browser:" in workflow
    assert "name: Browser acceptance E2E" in workflow

    full_suite = workflow.split("      - name: Run full browser acceptance suite\n", 1)[1]
    full_suite = full_suite.split("\n      - name:", 1)[0]
    assert "github.event_name == 'workflow_dispatch'" in full_suite
    assert "github.event_name == 'schedule'" in full_suite
    assert "PLAYWRIGHT_JSON_OUTPUT_NAME: test-results/results.json" in full_suite
    assert "npm run test:e2e -- --shard=${{ matrix.shard }}/16 --reporter=list,json" in full_suite
    assert 'echo "playwright_exit=$playwright_exit" >> "$GITHUB_OUTPUT"' in full_suite

    ratchet = workflow.split(
        "      - name: Apply known-failure ratchet and write job summary\n", 1
    )[1]
    ratchet = ratchet.split("\n      - name:", 1)[0]
    assert "github.event_name == 'workflow_dispatch'" in ratchet
    assert "github.event_name == 'schedule'" in ratchet
    assert "node scripts/e2e-ratchet.mjs" in ratchet
    assert "--report test-results/results.json" in ratchet
    assert "--baseline e2e/known-failures.json" in ratchet
    assert '--playwright-exit-code "$PLAYWRIGHT_EXIT_CODE"' in ratchet

    diagnostics = workflow.split("      - name: Upload browser diagnostics\n", 1)[1]
    diagnostics = diagnostics.split("\n      - name:", 1)[0]
    assert "if: ${{ failure() }}" in diagnostics
    assert "name: browser-e2e-diagnostics" in diagnostics
