# Backlog session — 2026-10-01 continuation

Repository: `cfornesa/ai-dev-tools-zoomcamp-1`  
Branch: `docs/backlog-reevaluation-2026-09-27`  
Issue inventory at refresh: 32 open issues, from authenticated GitHub search on
2026-10-01. User authorized implementation of the refined open issues and
asked for bulk closure while preserving per-issue implementation/QA gates.
No push authorization was given.

## Open-issue manifest

The older Batch 14 and Batch 16 issue contracts and prior terminal decisions
remain in their linked issue bodies and earlier batch ledgers. This live
manifest captures every issue open at the refresh and the dependency order;
items advance only after the current transaction is terminal.

| Issue | Dependencies / lane | Initial status | Current owner / next action |
| --- | --- | --- | --- |
| #1096 | Browser-matrix tracker | HANDED-OFF | Reconcile only after cause-specific children and a fresh Linux matrix. |
| #1100 | Foundation E2E server fixtures | GROOMED | Implement before helper-migration children. |
| #1102 | After #1100 | DEPENDENCY-BLOCKED | Wait for #1100, then migrate single-purpose 2D specs. |
| #1103 | After #1100 | DEPENDENCY-BLOCKED | Wait for #1100, then migrate multi-call 2D specs. |
| #1104 | After #1100 | DEPENDENCY-BLOCKED | Wait for #1100, then migrate lifecycle/publication/responsive specs. |
| #1108 | 3D inline toolbar locator audit | GROOMED | Audit stale locators; reconcile concrete findings. |
| #1110 | 3D mobile move handle | GROOMED | Verify current implementation against its exact issue criteria. |
| #1111 | 3D inline control overlap | GROOMED | Verify current implementation against its exact issue criteria. |
| #1112 | After #1100; drawing-plane E2E | DEPENDENCY-BLOCKED | Migrate its setup after helper foundation. |
| #1114 | Depends on 3D toolbar/mobile regression lane | DEPENDENCY-BLOCKED | User selected 16:9 stage and outer rail under stage; finish required regression lane. |
| #1124 | Batch 15 theme/token foundation | CLOSED | QA comment 5930214077; closed completed 2026-10-01. |
| #1125 | After #1124 | CLOSED | Completed locally in `e2460057`; QA PASS comment 5931636109. |
| #1126 | After #1124 | GROOMED | Next transaction: implement shared shell/header/navigation/toggles. |
| #1127 | Independent Batch 15 copy/provider order | GROOMED | Process after #1126 by backlog order. |
| #1128 | After #1124–#1126 | DEPENDENCY-BLOCKED | Add route-level theme/viewport/contrast coverage after parents. |
| #1146 | Discovered during #1125 QA; Batch 15 | HANDED-OFF | Filed/milestoned as new follow-up; implementation deferred to a later issue transaction per discovery-gate rule. |
| #1129 | Owner decision D1 | OWNER-DECISION-PENDING | Request the project's documented owner choice when the decision gate is reached. |
| #1130 | Owner decision D2 | OWNER-DECISION-PENDING | Request the documented 2D/3D history scope decision. |
| #1131 | Independent 2D history event writer A1 | GROOMED | Implement after Batch 15. |
| #1132 | Independent 2D AI accept/discard history writer A2 | GROOMED | Implement after Batch 15. |
| #1133 | Activity read API | DEPENDENCY-BLOCKED | Requires #1131/#1132. |
| #1134 | History UI | DEPENDENCY-BLOCKED | Requires #1133. |
| #1135 | AI proposal reason UI | DEPENDENCY-BLOCKED | Requires #1132/#1134. |
| #1136 | Independent scene diff function B1 | GROOMED | Implement after Batch 15. |
| #1137 | Compare-versions UI | DEPENDENCY-BLOCKED | Requires #1136. |
| #1138 | Intent note storage/API | DEPENDENCY-BLOCKED | Requires owner decision #1129. |
| #1139 | Intent note editor | DEPENDENCY-BLOCKED | Requires #1138. |
| #1140 | Intent note AI context | DEPENDENCY-BLOCKED | Requires #1138/#1139. |
| #1141 | Independent related-pieces query C1 | GROOMED | Implement after Batch 15. |
| #1142 | More-like-this UI | DEPENDENCY-BLOCKED | Requires #1141. |
| #1143 | Owner continuity metrics | DEPENDENCY-BLOCKED | Requires #1131/#1132. |
| #1144 | Public 3D viewer E2E setup | DEPENDENCY-BLOCKED | Requires #1100. |
| #1145 | 3D drawing-plane cancel regression | GROOMED | Reproduce and address after #1108 audit. |

## Transaction ledger

### #1124 — Account pages: site theme parity

**State:** `GROOMED → ENGINEERING → QA → RECONCILIATION → CLOSED`  
**Result:** completed; GitHub issue closed 2026-10-01 with state reason
`completed`. QA comment:
https://github.com/cfornesa/ai-dev-tools-zoomcamp-1/issues/1124#issuecomment-5930214077

**Stage owners and routing**

| Stage | Rostered owner | Actual owner | Substituted |
| --- | --- | --- | --- |
| Spec refinement / stage 1 | Codex via ChatGPT Plus | Claude Code; exact model/effort not present in issue record | yes |
| Implementation / stage 2b | Ollama Cloud / Kimi K3 | Codex / GPT-6.1-sol / effort unavailable | yes |
| Independent review / stage 3 | Mistral Vibe | Not run | — |
| QA / stage 4 | Claude / Sonnet 5 / Medium | Codex / GPT-6.1-sol / effort unavailable | yes |

**Commits:** `2c3056d7` server-injected palette/presentation and prepaint theme
resolution; `8cdeb84f` allauth template rendering coverage; `3646959e` spacing
tokens; `80de5581` normal-size account button text contrast at 4.5:1.

**Focused checks**

- Backend account/auth/OAuth tests: 29 passed in the focused run; updated
  template-render checks passed (2 tests).
- `E2E_BASE_URL=http://127.0.0.1:5003 E2E_ENV_FILE=/tmp/codex-qa-1120-current.env npx playwright test e2e/accountThemeParity.spec.ts --project=chromium`
  — final run 2 passed. It generated 32 screenshots for two viewport sizes,
  two palettes, four preference/OS combinations, and both Gallery/Login; the
  screenshots were inspected.
- A first sandboxed Chromium launch was blocked before tests by macOS
  `bootstrap_check_in` permission; rerun with approved escalation completed
  successfully. This was a runner restriction, not a product failure.

**Full checks:** `UV_CACHE_DIR=/tmp/codex-uv-cache make check` — workflow/action
pin validation, backend lint/format/mypy, backend tests 1,878 passed / 39
skipped, frontend lint/format/typecheck, Vitest 310 files / 3,187 tests passed.
`git diff --check` passed.

**QA matrix:** all issue criteria PASS: token-only palette/presentation/spacing
mapping; prepaint light/dark/system selection and blocked-storage fallback;
SPA/account computed token parity for default/non-default palettes; measured
contrast (body, muted, and button text >= 4.5:1); named account/social template
rendering; unchanged login/provider form contracts; no dependency or API
contract changes.

**Evidence boundary:** local/macOS, isolated disposable Django/Vite stack at
`127.0.0.1:5003`, Chromium only. No Linux CI or published-account route claim.

**Environment diagnostic (not a product mutation):** local `GET
/api/site-theme/` returns `style_key=default`, palette `original`, and generic
dark colors for both light and dark; production `GET
https://augmentrart.com/api/site-theme/` returns `style_key=celestial`, distinct
light/dark palettes, and script/cosmic presentation. No database values were
changed. This is a local-versus-production settings-data difference; #1124's
criterion is parity with the effective setting on the same instance, which
passed.

**New work discovered:** none requiring a new code issue. The local theme-data
difference is not part of #1124's finite styling contract and no settings were
copied or altered.

**Next action:** process #1125 now that its theme plumbing prerequisite is
closed; retain strict one-issue-at-a-time implementation and QA. Do not push.

### #1125 — Account page component styles (current)

**State:** `GROOMED → ENGINEERING → QA → RECONCILIATION → CLOSED`.
**Result:** completed locally; GitHub issue closed 2026-10-01.
**QA comment:** https://github.com/cfornesa/ai-dev-tools-zoomcamp-1/issues/1125#issuecomment-5931636109.
New related follow-up #1146 records the SPA
`.content-panel` soft-shadow/token mismatch discovered in computed-style QA;
that out-of-scope panel change is deferred to its own transaction.

The #1124 prerequisite is closed. The issue names the entry point, finite
visual outcomes, provider selectors, form preservation constraints, local E2E
fixture, viewports, 200% zoom, and exact verification. Its code-quality
conventions are `design-ux.md`, `html-css-vanilla-js.md`,
`accessibility.md`, and `testing.md`.

| Stage | Rostered owner | Actual owner | Substituted |
| --- | --- | --- | --- |
| PM/grooming | Codex / GPT-6.1-sol (portable backlog-session profile) | Codex / GPT-6.1-sol / effort unavailable | no |
| Implementation / stage 2a | Opencode Go / Kimi K2.5 | Codex / GPT-6.1-sol / effort unavailable | yes |
| Independent review / stage 3 | Mistral Vibe | Not requested / not run | — |
| QA / stage 4 | Claude / Sonnet 5 / Medium | Codex / GPT-6.1-sol / effort unavailable | yes |

The checked-in `docs/design-system.md` and `docs/testing-guidelines.md`
mentioned by older project notes are absent; their current equivalents,
`docs/conventions/design-ux.md` and `docs/conventions/testing.md`, were read.
`DECISIONS.md` and `.agents/memory/MEMORY.md` contain no pending confirmation
or open `REVIEW REQUIRED` gate. Relevant browser/account and local PostgreSQL
memory topics were read.

**Implementation commit:** `e2460057`. Product files: account base/login/signup
templates; focused Django template test; Playwright visual and form-contract
test. No dependency/API/schema change.

**Focused verification:**

- `UV_CACHE_DIR=/tmp/codex-uv-cache uv run pytest tests/test_account_component_styles.py tests/test_account_theme.py tests/test_account_templates.py`
  — 5 passed.
- `E2E_BASE_URL=http://127.0.0.1:5003 E2E_ENV_FILE=/tmp/codex-qa-1120-current.env npx playwright test e2e/accountComponentStyles.spec.ts e2e/accountThemeParity.spec.ts --project=chromium`
  — 3 passed. Covers stable provider class, themed controls, four shadow
  states, script font, 375px and 188px (200%-equivalent) widths, keyboard and
  pointer state, locally intercepted provider POST/CSRF, `loginViaUI`, and
  #1124 parity regression. Manual active-Chrome inspection showed the themed
  login card and consistent provider actions. 188px no-overflow check passes.
- `UV_CACHE_DIR=/tmp/codex-uv-cache make check` — 1,879 backend tests passed,
  39 skipped; 310 frontend files / 3,187 tests passed; workflow pin, lint,
  format, mypy, and typecheck gates passed.
- `git diff --check` — passed before commit.

**QA criterion matrix:** all #1125 criteria pass after final primary-button
correction to the site accent-tinted action token. Account card consumes its
page `--shadow` token; stable provider styling and allauth POST/CSRF contracts
remain intact. The SPA `.content-panel` computed shadow remains `none` while
the active `soft` root token is nonzero; because changing SPA CSS is outside
#1125, this distinct mismatch is shifted to [#1146](https://github.com/cfornesa/ai-dev-tools-zoomcamp-1/issues/1146).

| Stage | Rostered owner | Actual owner | Substituted |
| --- | --- | --- | --- |
| PM/grooming | Codex / GPT-6.1-sol | Codex / GPT-6.1-sol / effort unavailable | no |
| Implementation / stage 2a | Opencode Go / Kimi K2.5 | Codex / GPT-6.1-sol / effort unavailable | yes |
| Independent review / stage 3 | Mistral Vibe | Not requested / not run | — |
| QA / stage 4 | Claude / Sonnet 5 / Medium | Codex / GPT-6.1-sol / effort unavailable | yes |

**Evidence boundary:** local disposable Django/Vite stack (`127.0.0.1:5003`),
Chromium on macOS; no production or Linux CI claim. **Next:** post QA evidence,
close #1125 after its issue-scoped commit, then process #1126.
