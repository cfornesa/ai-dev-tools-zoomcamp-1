## Engineering handoff: 2D AI-editor engine integration

Implemented in commits `cc4b10a` and `411ebfc` (Codex/GPT-5 substitution
for the rostered Ollama Cloud `kimi-k3` stage 2b owner; stage 3 not run).

Completed:

- p5.js, C2.js, and C2.js Interactive are generation-capable stable engine IDs with provider prompts, deterministic fake-provider snippets, source-shape validation, and trusted sandbox adapters.
- The 2D Studio catalog exposes SVG, p5.js, C2.js, and C2.js Interactive distinctly.
- Unsupported download and immersive capability controls are disabled and sanitized for the three newly integrated engines; no silent coercion to Canvas2D occurs.
- Existing SVG behavior remains covered and the API capability registry now separates generation from regular/embed/download/immersive support.

Verification:

- Focused backend provider/API/contract/persistence/validation checks: 37 passed.
- Focused frontend Studio/runtime/engine-registry checks: 18 passed; typecheck passed.
- Full `UV_CACHE_DIR=/tmp/codex-uv-cache make check`: backend 1,434 passed, 39 skipped; frontend 2,724 passed; lint/format/typecheck passed.

Pending route evidence:

- `make compose-preflight` reports Docker unavailable and localhost `/health/` is unreachable.
- Playwright lists 6 relevant Chromium scenarios, but the disposable PostgreSQL/Django/Vite stack is not running, so create/preview/save/recovery screenshots at 1280x900 and 375x812 remain pending.
