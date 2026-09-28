# Dependency conventions

This is the *policy* page — vetting, removal, and audit-scanning. The
existing [`../dependencies.md`](../dependencies.md) is the *rationale log*
for specific chosen dependencies (currently: self-hosted fonts). Don't
merge them; cross-reference.

## Adding a dependency (existing policy, restated for completeness)

`AGENTS.md`'s Rules section and Section 8 already govern this — this page
doesn't replace them:
- Backend: `uv add <package>` (updates `pyproject.toml`/`uv.lock` together),
  never a hand-edit. Frontend: `npm install`.
- Never without asking first. `AGENTS.md` §8's mandatory question: *"This
  dependency sends data to [service]. If [service] changes its API,
  pricing, or shuts down, [describe what breaks]. The self-hosting
  alternative is [X]. Should I proceed and document this in `docs/
  dependencies.md`?"* — ask even when the person seems to have already
  decided.
- Document the choice in `docs/dependencies.md` once authorized.

## Removing a dependency (new — no prior policy existed)

Before removing: confirm it's genuinely unused (grep every import path, not
just the obvious ones) and that removing it doesn't silently change
behavior (e.g. a transitive polyfill). Record the removal in `docs/
dependencies.md` the same way an addition is recorded — why it was added
originally (if known), why it's being removed now, and what replaces it if
anything.

## Overlapping-purpose check (new — real examples found this session)

Before adding a dependency, check whether an existing one already covers
the need. Two real cases found in this codebase, evidence that this check
wasn't previously part of the review discipline:
- `backend/pyproject.toml` declares `cryptography` **twice** with two
  different version floors (`>=50.0.0` and `>=46.0.0`) — an accidental
  duplicate `[project.dependencies]` entry, not a deliberate choice.
- `frontend/package.json` lists both `fflate` and `jszip` — overlapping
  (de)compression/zip purpose. `generateHtmlExport.ts` imports `JSZip`
  directly for the export-ZIP feature; it's not yet confirmed whether
  `fflate` does something `jszip` can't, or whether one could be dropped.

Both are filed as their own small issues rather than fixed inline here —
see the issue list. **Rule going forward:** before adding a new dependency,
check `pyproject.toml`/`package.json` for an existing package covering
overlapping ground, and say so explicitly in the dependency-authorization
question if one exists but doesn't fully cover the need.

## Vulnerability/audit scanning — a real gap, not yet policy

Confirmed: no `pip-audit`, `npm audit`, `safety`, Snyk, or Dependabot
configuration exists anywhere in this repo (`.github/workflows/ci.yml` runs
lint/typecheck/test/E2E jobs only; no `.github/dependabot.yml` exists).
This means a known-vulnerable transitive dependency could ship without any
automated signal. Tracked as its own issue (add CI-level scanning); until
that lands, treat "check for known CVEs" as a manual step during any
dependency-review pass, not an automated guarantee.
