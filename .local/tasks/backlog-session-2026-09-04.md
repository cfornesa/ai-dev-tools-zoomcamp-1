# Backlog session — 2026-09-04

## Scope and discovery

Project: `cfornesa/ai-dev-tools-zoomcamp-1`.

This reconciliation audited all 21 records in `.local/tasks/`, the canonical
`docs/tasks.md` ledger, project guidance, repository history, and the complete
GitHub issue set. At the start of this pass, GitHub had no open issues. Four
local implementation specifications had no issue number or URL and were
genuinely actionable records, so four criterion-ready issues were created and
processed: #400–#403.

The local `reset-main-to-origin.md` record is a completed operational recovery
note, not product backlog work: `main` already equals `origin/main`, the
worktree is clean, and creating a new issue for a finished destructive
recovery would misrepresent current work.

## Complete manifest

| Issue | URL | Backlog record | Dependencies | Scope | Status | Owner / next action |
| --- | --- | --- | --- | --- | --- | --- |
| #97 | [issue](https://github.com/cfornesa/ai-dev-tools-zoomcamp-1/issues/97) | `production-operational-readiness.md` | none | Production configuration/readiness | completed | Historical closure retained |
| #104 | [issue](https://github.com/cfornesa/ai-dev-tools-zoomcamp-1/issues/104) | `prevent-false-push-rejected.md` | none | Git push result classification | completed | Historical closure retained |
| #108 | [issue](https://github.com/cfornesa/ai-dev-tools-zoomcamp-1/issues/108) | `capture-discovered-work.md` | none | Discovery gate | completed | Historical closure retained |
| #109 | [issue](https://github.com/cfornesa/ai-dev-tools-zoomcamp-1/issues/109) | `editor-preview-space.md` | none | Editor preview/control-panel layout | completed | Historical closure retained |
| #110 | [issue](https://github.com/cfornesa/ai-dev-tools-zoomcamp-1/issues/110) | `editor-layer-association.md` | none | Layer/shape association | completed | Historical closure retained |
| #111 | [issue](https://github.com/cfornesa/ai-dev-tools-zoomcamp-1/issues/111) | `editor-shape-manipulation.md` | none | Shape selection/dragging | completed | Historical closure retained |
| #112 | [issue](https://github.com/cfornesa/ai-dev-tools-zoomcamp-1/issues/112) | `editor-unexpected-refresh.md` | none | Unsaved-work refresh protection | completed | Historical closure retained |
| #133/#139 | [#133](https://github.com/cfornesa/ai-dev-tools-zoomcamp-1/issues/133), [#139](https://github.com/cfornesa/ai-dev-tools-zoomcamp-1/issues/139) | `fix-publish-run-command.md` | #133 before #139 | Publish-safe launcher and republish | completed | Historical closure retained |
| #193 | [issue](https://github.com/cfornesa/ai-dev-tools-zoomcamp-1/issues/193) | `production-readiness-2026-08-27.md` | prior readiness fixes | Full browser/readiness recovery | completed | Historical closure retained |
| #257/#259–#262 | [#257](https://github.com/cfornesa/ai-dev-tools-zoomcamp-1/issues/257), [#259](https://github.com/cfornesa/ai-dev-tools-zoomcamp-1/issues/259) | prior Mistral preference records | none | Models/personas, not credential storage | completed | Existing scope retained |
| #274/#320/#324, #344, #383–#398 | existing authored/generated parity issues | parity distillation records | FIFO/deployment evidence | Route/artifact parity | completed or not planned | Historical terminal records retained |
| #400 | [issue](https://github.com/cfornesa/ai-dev-tools-zoomcamp-1/issues/400) | `auth-experience-and-signup-protection.md` | none | Auth shell, branded account pages, signup reCAPTCHA | completed | Closed with QA comment [5539172629](https://github.com/cfornesa/ai-dev-tools-zoomcamp-1/issues/400#issuecomment-5539172629) |
| #401 | [issue](https://github.com/cfornesa/ai-dev-tools-zoomcamp-1/issues/401) | `fix-google-oauth-csrf-origin.md` | none | Explicit environment-driven trusted origins | completed | Closed with QA comment [5539174163](https://github.com/cfornesa/ai-dev-tools-zoomcamp-1/issues/401#issuecomment-5539174163) |
| #402 | [issue](https://github.com/cfornesa/ai-dev-tools-zoomcamp-1/issues/402) | `make-simple-3d-prompts-valid.md` | none | Safe primitive-dimension defaults for AI-created scenes | completed | Closed with QA comment [5539176212](https://github.com/cfornesa/ai-dev-tools-zoomcamp-1/issues/402#issuecomment-5539176212) |
| #403 | [issue](https://github.com/cfornesa/ai-dev-tools-zoomcamp-1/issues/403) | `per-user-mistral-credentials.md` | none; separate from #257/#259–#262 | Encrypted owner-scoped Mistral credentials | completed | Closed with QA comment [5539178258](https://github.com/cfornesa/ai-dev-tools-zoomcamp-1/issues/403#issuecomment-5539178258) |

The following records are terminal session/distillation history rather than
new work: `authored-piece-parity-distillation-2026-09-03.md`,
`authored-piece-parity-distillation.md`, `backlog-session-2026-08-26.md`,
`backlog-session-2026-09-01.md`, `session-completion-2026-08-27.md`, and
`task-distillation-2026-08-27.md`.

## Grooming and duplicate report

- Every current actionable local record is now linked to an existing or newly
  created GitHub issue.
- Issues #97, #104, #108–#112, #133/#139, #193, #257, and #259–#262 were
  reused; none was reopened or duplicated.
- Authored/generated parity issues #274/#320/#324, #344, and #383–#398 were
  already issue-owned and terminal. Their older open/blocked language is stale
  historical ledger content, not current work.
- The four new issues each name a single capability boundary, finite observable
  criteria, exact verification commands, out-of-scope work, and an evidence
  boundary. Their QA comments contain criterion matrices and closure decisions.
- `reset-main-to-origin.md` is classified non-actionable historical recovery:
  the requested state is already true and no remote history was changed.

## Dependency and transaction order

1. Reconcile existing issue ownership and stale local statuses.
2. Process #400 auth shell and signup protection.
3. Process #401 trusted-origin configuration.
4. Process #402 AI-created 3D normalization.
5. Process #403 owner-scoped Mistral credentials.
6. Reconcile canonical backlog and verify GitHub has no open issues.

The four transactions are independent at runtime. The listed order follows
the source-record order and keeps authentication/configuration before the AI
capabilities that depend on authenticated requests.

## Verification rollup

- Focused backend run: 193 passed.
- Focused frontend auth/settings run: 18 passed.
- Full `make check`: 944 backend passed, 22 skipped; 2,417 frontend passed;
  ruff, format, mypy, typecheck, workflow pin, and live-provider contract
  checks passed.
- Credential build scan:
  `cd frontend && npx playwright test e2e/buildOutputCredentialScan.spec.ts`
  — 3 passed.
- Direct Playwright against the running application at 375×812: Login
  heading, Google button, signup navigation, invalid-signup feedback, and
  footer — 5/5 passed.
- Rendered preview inspection covered `/`, `/accounts/login/`, and
  `/accounts/signup/` at 1280×720; Login/Google controls, branded forms,
  labels, signup controls, and current-year footer were visible.
- `bash scripts/browser-qa.sh` was attempted twice in the supported disposable
  path. Its PostgreSQL container reached database readiness, but the host
  Docker runtime rejected `docker exec` with OCI `setns` errors before
  Django/Vite startup. This is a verification-environment boundary, not a
  product failure; direct Playwright and the full local quality gate passed.

## Final status

| Count | Value |
| --- | ---: |
| Local records discovered | 21 |
| Newly created GitHub issues | 4 |
| Issues completed in this session | 4 |
| Existing terminal/covered records | 17 |
| Blocked | 0 |
| Dependency-blocked | 0 |
| Handed-off | 0 |
| Missing terminal status | 0 |
| Newly discovered actionable follow-ups | 0 |

The final GitHub audit reports zero open issues for the repository. The working
tree remains clean and `main` equals `origin/main`.