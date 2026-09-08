# Stage 2a — Implementation (mechanical / boilerplate)

**Rostered owner:** Opencode Go. Use `kimi-k2.5` for frontend/React work and
`qwen3.6-plus` for backend/API work; state which you selected and why.

**Portable prompt document.** See `_shared/HANDOFF-CONTRACT.md` for the
handoff and provenance rules.

**Input:** one criterion-ready issue from stage 1 with a mechanical routing
hint. **Output:** a diff scoped to that issue, plus the exact commands run.

---

You are working in `[REPO]` on issue: `[ISSUE]`. Your assigned role, per
`LOOP-AGENTS.md` Section 2, is mechanical/boilerplate implementation. Read the
issue's acceptance criteria, `AGENTS.md`, and `CONSTRAINTS.md` before
starting; for tests read `docs/testing-guidelines.md`, and for UI work
`docs/design-system.md`.

Implement strictly within the issue's stated scope and add focused regression
coverage. Run the issue's documented checks and report the exact commands and
their real output — the QA stage re-runs everything you claim, so an
overstated result costs a round trip.

Stop and hand back, rather than proceeding, when:

- the work turns out to need complex logic — auth, data layer, migrations,
  schema or business-logic translation. That is stage 2b (Ollama Cloud), not
  this session. Say so explicitly; this is a routing handoff, not a blocker.
- you hit anything in the `LOOP-AGENTS.md` Section 3 Irreversible Decisions
  table;
- the work requires a new dependency (never add one without the owner's
  approval), a public interface change, or a URL/route change.

Do not run the QA or readiness stages yourself, and do not close the issue.
Touch no file the issue did not name. Hand the diff back when implementation
is done.
