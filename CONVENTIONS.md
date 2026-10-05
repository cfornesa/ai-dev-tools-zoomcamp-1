# Conventions

This is the standing code-quality, accessibility, security, and design/UX
standard for this repo. It exists so untangling this codebase's tangled
files (see `#979`–`#986`, the `EditorWorkspace.tsx` decomposition) is the
*expected* result of normal work, not an aspiration nobody acts on.

**Read this before any non-trivial implementation.** An issue that touches
code structure, an accessible pattern, a security-relevant boundary, or a
UI surface must cite which page/section below applies (see
`docs/task-template.md`'s "Code-quality checklist"). If you're re-deriving
one of these rules from memory instead of reading the linked page, stop and
read it — this file changes as evidence changes, and memory goes stale.

## Architecture, first — a correction, not an assumption

This is **not** a microservices architecture. It's a two-process monolith:
one Django backend, one Vite frontend, started together and torn down
together by one `scripts/start.sh` lifecycle (`compose.yaml` defines exactly
3 services — postgres, backend, frontend; `.replit` has one deployment
target). Mistral, Gemini, DeepSeek, PayPal, and Google/GitHub/LinkedIn
OAuth are external third-party SaaS APIs called in-process from Django via
`*_provider.py`/`*_adapter.py` adapter modules — not services this repo
deploys. Full detail: `docs/conventions/architecture.md`.

## The one efficiency principle, stated once

**Every data-structure choice is justified against this codebase's actual
scale — cite a real limit or benchmark, not an abstract "always fastest."**
This app already publishes its own scale ceilings: `schema/limits.json`
(`maxShapes: 200`, `maxGroups: 50`, `maxBindings: 100`, `maxGraphNodes: 100`,
etc.) and `docs/benchmarks.md`'s `DEFAULT_WORK_BUDGET_MS = 4` per-tick
budget. An O(n) array scan against a 200-item cap is fine and doesn't need
defending. An O(n²) pattern, or an O(n) scan inside a per-frame loop, needs
either a citation showing it's still inside budget at the stated cap, or a
fix. Full detail and worked examples (good and bad): `docs/conventions/
efficiency.md`.

## Topic pages

| Page | Covers |
|---|---|
| [`docs/conventions/python.md`](docs/conventions/python.md) | Django/Python: module naming (`_helper`, `__all__`, `<domain>.py`/`<domain>_api.py`), function atomicity, env-var discipline |
| [`docs/conventions/typescript.md`](docs/conventions/typescript.md) | TypeScript: the `strict` gap, naming, colocation |
| [`docs/conventions/react.md`](docs/conventions/react.md) | React: component/hook atomicity, state scoping (document state vs. device preference), the `.{slice}.test.tsx` convention |
| [`docs/conventions/html-css-vanilla-js.md`](docs/conventions/html-css-vanilla-js.md) | Django templates, generated export HTML/CSS/JS, `index.css`, the code-grammar allowlist pattern |
| [`docs/conventions/testing.md`](docs/conventions/testing.md) | Backend pytest, frontend vitest, the slice-test convention, Playwright e2e (cross-refs `AGENTS.md`) |
| [`docs/conventions/dependencies.md`](docs/conventions/dependencies.md) | Vetting, removal, and audit-scanning policy (distinct from `docs/dependencies.md`'s rationale log) |
| [`docs/conventions/architecture.md`](docs/conventions/architecture.md) | The two-process boundary, the external-adapter pattern, env-var-driven service config |
| [`docs/conventions/efficiency.md`](docs/conventions/efficiency.md) | Big-O/data-structure justification, worked good/bad examples from this codebase |
| [`docs/conventions/accessibility.md`](docs/conventions/accessibility.md) | WCAG-aligned rules, grounded in this app's already-strong `a11y/` hook library |
| [`docs/conventions/security.md`](docs/conventions/security.md) | NIST CSF-aligned rules (Identify/Protect/Detect/Respond/Recover) |
| [`docs/conventions/design-ux.md`](docs/conventions/design-ux.md) | Nielsen's heuristics, Jakob's/Hick's/Fitt's Law, the hand-rolled design system, the mixed-library option |

## What's machine-enforced vs. documentation-only

Verify exact rule codes/flags against the tool's own docs at implementation
time — this table is a snapshot, checked at time of writing (2026-09-27),
not a permanent guarantee.

| Rule | Enforcement |
|---|---|
| Backend formatting, import order, pyflakes, pyupgrade, bugbear, Django lint | **Enforced** — ruff `E,F,I,UP,B,DJ` (`backend/pyproject.toml`) |
| Backend type correctness (django-stubs) | **Enforced**, not global-`strict` — mypy |
| Frontend formatting | **Enforced** — prettier |
| React hooks correctness | **Enforced** — oxlint `react/rules-of-hooks` |
| Frontend unused locals/params, exhaustive switch | **Enforced** — tsconfig |
| Frontend `noImplicitAny`/`strictNullChecks`/etc. | **Not enforced** — `strict` is absent from every tsconfig file. Tracked: issue "incremental ruff C90/N + TS strict rollout" |
| Backend complexity/naming (mccabe, pep8-naming) | **Not enforced yet** — same tracking issue |
| `_leading_underscore`/`__all__`/`<domain>.py` pairing, colocation, verb-first naming, document-state-vs-preference scoping, `.{slice}.test.` convention, the code-grammar allowlist pattern, env-var/`.env.example` sync, data-structure scale-justification | **Documentation + code-review only** — no linter checks these |
| WCAG contrast ratio | **Not enforced** — no target defined yet (see `docs/conventions/accessibility.md`) |
| Dependency vulnerability scanning | **Not enforced** — no `pip-audit`/`npm audit`/Dependabot in CI (tracked as its own issue) |

## Scope and honesty

"No code left unevaluated" cannot mean a literal line-by-line read of every
file in one session — claiming that would be dishonest. What this file and
its topic pages represent instead: a full, systematic, tool-assisted sweep
(every relevant signal grepped across the whole tree, then sampled for
depth) done on 2026-09-27, wired into the existing discovery-gate/
task-distillation machinery (`docs/process.md`) so every future session
keeps applying it — systematic coverage over time, not a one-shot claim of
completeness. When a topic page cites a file, it's because that file was
actually read this session, not guessed.
